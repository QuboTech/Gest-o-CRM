-- MÓDULO PERFIS DE ACESSO (opcional, flag perfisAcesso): perfis de usuário e segurança por perfil (RLS) no banco.
-- Troca as policies abertas do CRP ("authenticated acessa tudo") por policies por perfil em clientes, pedidos,
-- catálogo, financeiro e profiles. Estoque, equipamentos e assistências só são restringidos pelo módulo Chamados (012).
-- Perfis: admin, atendente, vendedor, financeiro (núcleo) + tecnico, programadora, recepcao, oficina_interna (módulo Chamados).
-- Idempotente. Rodar depois de 001–007.

create schema if not exists private;
grant usage on schema private to authenticated;

-- profiles: coluna role (is_admin vira coluna gerada, para manter compatibilidade com o código do CRP)
do $mig$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles add column role text not null default 'atendente';
    update public.profiles set role = case when is_admin then 'admin' else 'atendente' end;
    alter table public.profiles drop column is_admin;
    alter table public.profiles add column is_admin boolean generated always as (role = 'admin') stored;
  end if;
end $mig$;
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'atendente', 'vendedor', 'tecnico', 'programadora', 'recepcao', 'oficina_interna', 'financeiro'));

-- policies abertas do CRP original
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists authenticated_all_clientes on public.clientes;

-- perfil do usuário logado (schema privado: não exposto como RPC)
create or replace function private.meu_perfil()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke all on function private.meu_perfil() from public, anon;
grant execute on function private.meu_perfil() to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.meu_perfil() = 'admin');
drop policy if exists profiles_update_proprio on public.profiles;
create policy profiles_update_proprio on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = private.meu_perfil());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (private.meu_perfil() = 'admin')
  with check (private.meu_perfil() = 'admin');

-- clientes: leads (eh_cliente = false) x clientes da assistência (eh_cliente = true)
alter table public.clientes add column if not exists eh_cliente boolean not null default false;
alter table public.clientes drop constraint if exists clientes_contato_obrigatorio;
alter table public.clientes add constraint clientes_contato_obrigatorio
  check (cnpj_cpf is not null or telefone_empresa is not null or email_empresa is not null);

drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select to authenticated
  using (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor', 'financeiro')
    or (private.meu_perfil() in ('programadora', 'recepcao', 'tecnico', 'oficina_interna') and eh_cliente)
  );
drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes for insert to authenticated
  with check (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  );
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update to authenticated
  using (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  )
  with check (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  );
drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes for delete to authenticated
  using (private.meu_perfil() = 'admin');

-- MÓDULO COMERCIAL: Pedidos/Orçamentos, Catálogo e Financeiro, agora com segurança por perfil.
--   admin            : tudo
--   financeiro       : Financeiro completo; vê Pedidos e Catálogo
--   vendedor/atendente: Pedidos e Catálogo (criar/editar); sem acesso ao Financeiro; apagar só admin

drop policy if exists authenticated_all_pedidos on public.pedidos;
drop policy if exists authenticated_all_pedido_itens_gerais on public.pedido_itens_gerais;
drop policy if exists authenticated_all_pedido_itens_vacuo on public.pedido_itens_vacuo;
drop policy if exists authenticated_all_produtos_catalogo on public.produtos_catalogo;
drop policy if exists authenticated_all_financeiro_entradas on public.financeiro_entradas;
drop policy if exists authenticated_all_financeiro_saidas on public.financeiro_saidas;

-- pedidos e itens
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos for update to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
drop policy if exists pedidos_delete on public.pedidos;
create policy pedidos_delete on public.pedidos for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists pedido_itens_gerais_select on public.pedido_itens_gerais;
create policy pedido_itens_gerais_select on public.pedido_itens_gerais for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
drop policy if exists pedido_itens_gerais_write on public.pedido_itens_gerais;
create policy pedido_itens_gerais_write on public.pedido_itens_gerais for all to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));

drop policy if exists pedido_itens_vacuo_select on public.pedido_itens_vacuo;
create policy pedido_itens_vacuo_select on public.pedido_itens_vacuo for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
drop policy if exists pedido_itens_vacuo_write on public.pedido_itens_vacuo;
create policy pedido_itens_vacuo_write on public.pedido_itens_vacuo for all to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));

-- catálogo
drop policy if exists catalogo_select on public.produtos_catalogo;
create policy catalogo_select on public.produtos_catalogo for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
drop policy if exists catalogo_insert on public.produtos_catalogo;
create policy catalogo_insert on public.produtos_catalogo for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
drop policy if exists catalogo_update on public.produtos_catalogo;
create policy catalogo_update on public.produtos_catalogo for update to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
drop policy if exists catalogo_delete on public.produtos_catalogo;
create policy catalogo_delete on public.produtos_catalogo for delete to authenticated
  using (private.meu_perfil() = 'admin');

-- financeiro
drop policy if exists financeiro_entradas_all on public.financeiro_entradas;
create policy financeiro_entradas_all on public.financeiro_entradas for all to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro'))
  with check (private.meu_perfil() in ('admin', 'financeiro'));
drop policy if exists financeiro_saidas_all on public.financeiro_saidas;
create policy financeiro_saidas_all on public.financeiro_saidas for all to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro'))
  with check (private.meu_perfil() in ('admin', 'financeiro'));
