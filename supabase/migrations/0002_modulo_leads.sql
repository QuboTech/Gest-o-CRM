-- MÓDULO FUNIS DE LEADS: Vendas, Manutenção e Pós-venda dentro de `clientes`, com histórico, encerramento e alertas.

alter table public.clientes
  add column categoria text check (categoria in ('venda', 'manutencao', 'pos_venda')),
  add column canal_aquisicao text,
  add column situacao text not null default 'ativo' check (situacao in ('ativo', 'ganho', 'perdido')),
  add column origem text not null default 'manual' check (origem in ('manual', 'importacao')),
  add column encerrado_em timestamptz,
  add column encerrado_por uuid references public.profiles(id) on delete set null,
  add column encerrado_por_nome text;

create table public.cliente_historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  anotacao text not null,
  resultado text check (resultado in ('positivo', 'negativo')),
  status text check (status in ('aberto', 'pendente', 'continuacao', 'fechado')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cliente_historico_cliente_idx on public.cliente_historico (cliente_id, created_at);
alter table public.cliente_historico enable row level security;

create policy historico_select on public.cliente_historico for select to authenticated
  using (private.meu_perfil() in ('admin', 'atendente', 'vendedor'));
create policy historico_insert on public.cliente_historico for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'atendente', 'vendedor'));
create policy historico_admin_update on public.cliente_historico for update to authenticated
  using (private.meu_perfil() = 'admin') with check (private.meu_perfil() = 'admin');
create policy historico_admin_delete on public.cliente_historico for delete to authenticated
  using (private.meu_perfil() = 'admin');

-- controle de alertas já enviados (a edge function alertas-followup usa a service_role; sem policy = só ela acessa)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.alertas_enviados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('atraso', 'tres_negativas')),
  chave text not null,
  enviado_em timestamptz not null default now(),
  unique (cliente_id, tipo, chave)
);
alter table public.alertas_enviados enable row level security;

-- registra quando e quem encerrou o lead (ganho/perdido)
create or replace function private.registrar_encerramento_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.situacao is distinct from old.situacao then
    if new.situacao in ('ganho', 'perdido') then
      new.encerrado_em := now();
      new.encerrado_por := auth.uid();
      new.encerrado_por_nome := (select coalesce(nullif(p.nome_exibicao, ''), p.nome_usuario) from public.profiles p where p.id = auth.uid());
    else
      new.encerrado_em := null;
      new.encerrado_por := null;
      new.encerrado_por_nome := null;
    end if;
  end if;
  return new;
end $$;

create trigger trg_clientes_registrar_encerramento
  before update on public.clientes
  for each row execute function private.registrar_encerramento_lead();
