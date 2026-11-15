-- Módulos: CRM (produtos_catalogo, núcleo) / Estoque (estoque_pecas, opcional).

create table if not exists produtos_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome_produto text not null,
  codigo_produto text,
  ncm text,
  preco_unitario numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_produtos_catalogo_updated_at on produtos_catalogo;
create trigger trg_produtos_catalogo_updated_at before update on produtos_catalogo
  for each row execute function set_updated_at();

alter table produtos_catalogo enable row level security;
drop policy if exists authenticated_all_produtos_catalogo on produtos_catalogo;
create policy authenticated_all_produtos_catalogo on produtos_catalogo
  for all to authenticated using (true) with check (true);

create table if not exists estoque_pecas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-Za-z0-9]{1,15}$'),
  tipo_modelo text not null check (char_length(tipo_modelo) <= 1000),
  quantidade numeric not null default 0,
  localidade text check (localidade is null or char_length(localidade) <= 200),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_estoque_pecas_updated_at on estoque_pecas;
create trigger trg_estoque_pecas_updated_at before update on estoque_pecas
  for each row execute function set_updated_at();

alter table estoque_pecas enable row level security;
drop policy if exists authenticated_all_estoque_pecas on estoque_pecas;
create policy authenticated_all_estoque_pecas on estoque_pecas
  for all to authenticated using (true) with check (true);
