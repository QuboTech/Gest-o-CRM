-- CRP — schema base, versionado.
-- Idempotente: pode ser re-executado sem efeito colateral.
-- Ordem de aplicação: pelo prefixo numérico do nome do arquivo.

create extension if not exists pgcrypto;

-- profiles: 1 linha por usuário de auth.users. Login é username -> e-mail
-- sintético (ver ADMIN_CONFIG.syntheticEmailDomain), nunca e-mail real.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_usuario text not null unique,
  nome_exibicao text not null,
  must_change_password boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Nenhuma policy de insert/delete para authenticated: criação/remoção de
-- usuário é feita direto no banco (service role), nunca pelo front.
