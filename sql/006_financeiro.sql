-- Módulo: Financeiro (opcional).

create table if not exists financeiro_entradas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  cliente_nome text,
  produto text,
  valor numeric not null,
  observacao text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table financeiro_entradas enable row level security;
drop policy if exists authenticated_all_financeiro_entradas on financeiro_entradas;
create policy authenticated_all_financeiro_entradas on financeiro_entradas
  for all to authenticated using (true) with check (true);

create table if not exists financeiro_saidas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text not null,
  categoria text,
  valor numeric not null,
  observacao text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table financeiro_saidas enable row level security;
drop policy if exists authenticated_all_financeiro_saidas on financeiro_saidas;
create policy authenticated_all_financeiro_saidas on financeiro_saidas
  for all to authenticated using (true) with check (true);
