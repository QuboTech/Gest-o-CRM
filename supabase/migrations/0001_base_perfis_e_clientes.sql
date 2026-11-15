-- BASE COMUM (todos os módulos): perfis, segurança por perfil (RLS) e clientes.
-- Aplicar sobre o schema original do CRP (profiles, clientes, equipamentos, estoque, assistências, pedidos, catálogo, financeiro).
-- Perfis: admin, atendente, vendedor, tecnico, programadora, recepcao, oficina_interna, financeiro.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- policies abertas do CRP original (qualquer usuário logado via tudo)
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists authenticated_all_clientes on public.clientes;

-- profiles: role (substitui is_admin, que vira coluna gerada para manter compatibilidade com o código)
alter table public.profiles add column role text not null default 'atendente';
alter table public.profiles add column email text;
update public.profiles p
set role = case when p.is_admin then 'admin' else 'atendente' end,
    email = u.email
from auth.users u where u.id = p.id;
alter table public.profiles drop column is_admin;
alter table public.profiles add column is_admin boolean generated always as (role = 'admin') stored;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'atendente', 'vendedor', 'tecnico', 'programadora', 'recepcao', 'oficina_interna', 'financeiro'));

-- perfil do usuário logado (schema privado: não exposto como RPC)
create or replace function private.meu_perfil()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke all on function private.meu_perfil() from public, anon;
grant execute on function private.meu_perfil() to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.meu_perfil() = 'admin');
create policy profiles_update_proprio on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = private.meu_perfil());
create policy profiles_admin_all on public.profiles for all to authenticated
  using (private.meu_perfil() = 'admin')
  with check (private.meu_perfil() = 'admin');

-- clientes: leads (eh_cliente = false) x clientes da assistência (eh_cliente = true)
alter table public.clientes add column eh_cliente boolean not null default false;
alter table public.clientes add constraint clientes_contato_obrigatorio
  check (cnpj_cpf is not null or telefone_empresa is not null or email_empresa is not null);

create policy clientes_select on public.clientes for select to authenticated
  using (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor', 'financeiro')
    or (private.meu_perfil() in ('programadora', 'recepcao', 'tecnico', 'oficina_interna') and eh_cliente)
  );
create policy clientes_insert on public.clientes for insert to authenticated
  with check (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  );
create policy clientes_update on public.clientes for update to authenticated
  using (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  )
  with check (
    private.meu_perfil() in ('admin', 'atendente', 'vendedor')
    or (private.meu_perfil() in ('programadora', 'recepcao') and eh_cliente)
  );
create policy clientes_delete on public.clientes for delete to authenticated
  using (private.meu_perfil() = 'admin');
