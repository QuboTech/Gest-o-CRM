-- Módulo: CRM / Pedidos (núcleo).
--
-- Submódulo "pedidos_vacuo": pedido_itens_vacuo é embalagem a vácuo (nicho
-- HLN) — tabela só é usada se ADMIN_CONFIG.enabledModules.pedidos_vacuo
-- estiver ligado. Fica sempre criada (mais simples manter 1 schema único),
-- mas o novo cliente CRP não vê a seção de itens a vácuo na UI por padrão.

create sequence if not exists pedidos_numero_seq;

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('pedidos_numero_seq'),
  cliente_id uuid references clientes(id),
  tipo text not null default 'pedido' check (tipo = any (array['orcamento','pedido'])),
  status_orcamento text check (status_orcamento = any (array['pendente','convertido','nao_convertido'])),
  prazo_entrega text,
  observacao text,
  icms text,
  ipi text,
  regime_tributacao text,
  transportadora_empresa text,
  transportadora_cnpj text,
  transportadora_endereco text,
  transportadora_telefone text,
  forma_pagamento text not null check (forma_pagamento = any (array['boleto','a_vista','cartao_credito','cartao_debito','pix','link_pagamento'])),
  boleto_quantidade integer,
  boleto_dias integer,
  cartao_parcelas integer,
  valor_total_a_pagar numeric,
  desconto_percentual numeric,
  valor_total_a_pagar_vista numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_pedidos_updated_at on pedidos;
create trigger trg_pedidos_updated_at before update on pedidos
  for each row execute function set_updated_at();

alter table pedidos enable row level security;
drop policy if exists authenticated_all_pedidos on pedidos;
create policy authenticated_all_pedidos on pedidos
  for all to authenticated using (true) with check (true);

create table if not exists pedido_itens_gerais (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  ordem integer not null default 0,
  produto_catalogo_id uuid references produtos_catalogo(id),
  nome_produto text not null,
  codigo_produto text,
  ncm text,
  preco_unitario numeric not null default 0,
  quantidade numeric not null default 0,
  preco_total numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table pedido_itens_gerais enable row level security;
drop policy if exists authenticated_all_pedido_itens_gerais on pedido_itens_gerais;
create policy authenticated_all_pedido_itens_gerais on pedido_itens_gerais
  for all to authenticated using (true) with check (true);

-- submódulo pedidos_vacuo (ver comentário no topo do arquivo):
create table if not exists pedido_itens_vacuo (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  ordem integer not null default 0,
  item text,
  material text,
  largura_m numeric,
  comprimento_m numeric,
  espessura_micras numeric,
  tipo text,
  quantidade numeric,
  peso numeric,
  peso_total numeric,
  taxa_preco_peso numeric,
  vl_unitario numeric,
  vl_total numeric,
  created_at timestamptz not null default now()
);

alter table pedido_itens_vacuo enable row level security;
drop policy if exists authenticated_all_pedido_itens_vacuo on pedido_itens_vacuo;
create policy authenticated_all_pedido_itens_vacuo on pedido_itens_vacuo
  for all to authenticated using (true) with check (true);
