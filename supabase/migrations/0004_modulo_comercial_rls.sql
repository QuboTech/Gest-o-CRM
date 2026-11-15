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
create policy pedidos_select on public.pedidos for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
create policy pedidos_insert on public.pedidos for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
create policy pedidos_update on public.pedidos for update to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
create policy pedidos_delete on public.pedidos for delete to authenticated
  using (private.meu_perfil() = 'admin');

create policy pedido_itens_gerais_select on public.pedido_itens_gerais for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
create policy pedido_itens_gerais_write on public.pedido_itens_gerais for all to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));

create policy pedido_itens_vacuo_select on public.pedido_itens_vacuo for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
create policy pedido_itens_vacuo_write on public.pedido_itens_vacuo for all to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));

-- catálogo
create policy catalogo_select on public.produtos_catalogo for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro', 'vendedor', 'atendente'));
create policy catalogo_insert on public.produtos_catalogo for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
create policy catalogo_update on public.produtos_catalogo for update to authenticated
  using (private.meu_perfil() in ('admin', 'vendedor', 'atendente'))
  with check (private.meu_perfil() in ('admin', 'vendedor', 'atendente'));
create policy catalogo_delete on public.produtos_catalogo for delete to authenticated
  using (private.meu_perfil() = 'admin');

-- financeiro
create policy financeiro_entradas_all on public.financeiro_entradas for all to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro'))
  with check (private.meu_perfil() in ('admin', 'financeiro'));
create policy financeiro_saidas_all on public.financeiro_saidas for all to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro'))
  with check (private.meu_perfil() in ('admin', 'financeiro'));
