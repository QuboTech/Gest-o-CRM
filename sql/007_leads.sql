-- Módulo: Leads (opcional, novo).
--
-- Portado de desktop/schema.sql do repositório oficina-das-balancas (lá a
-- autenticação é local via tabela "usuarios"; aqui created_by/quem_atendeu
-- seguem o padrão do resto do CRP: auth.users + profiles). Nenhum dado real
-- de lead entra neste arquivo — é só a estrutura.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  data_contato date not null,
  nome text,
  numero text,
  canal_aquisicao text,
  intencao text,
  status text,
  tentativas_contato integer,
  mensagem_final boolean not null default false,
  motivo_nao_fechou text,
  quem_atendeu text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

alter table leads enable row level security;
drop policy if exists authenticated_all_leads on leads;
create policy authenticated_all_leads on leads
  for all to authenticated using (true) with check (true);
