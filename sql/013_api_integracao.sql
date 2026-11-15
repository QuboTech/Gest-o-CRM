-- API DE INTEGRAÇÃO (todos os módulos): chaves de acesso somente leitura (lista de preços e clientes).
-- A chave em si NUNCA é guardada: só o hash SHA-256 (a pessoa vê a chave uma única vez, ao criar).

create table if not exists public.api_chaves (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (length(trim(nome)) > 0),
  prefixo      text not null,
  chave_hash   text not null unique,
  escopos      text[] not null check (escopos <> '{}' and escopos <@ array['precos', 'custos', 'clientes']),
  ativa        boolean not null default true,
  criada_por   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  ultimo_uso   timestamptz,
  total_usos   bigint not null default 0,
  revogada_em  timestamptz
);
alter table public.api_chaves enable row level security;

drop policy if exists api_chaves_select on public.api_chaves;
create policy api_chaves_select on public.api_chaves for select to authenticated
  using (private.meu_perfil() = 'admin');
drop policy if exists api_chaves_insert on public.api_chaves;
create policy api_chaves_insert on public.api_chaves for insert to authenticated
  with check (private.meu_perfil() = 'admin' and criada_por = auth.uid());
drop policy if exists api_chaves_update on public.api_chaves;
create policy api_chaves_update on public.api_chaves for update to authenticated
  using (private.meu_perfil() = 'admin') with check (private.meu_perfil() = 'admin');
drop policy if exists api_chaves_delete on public.api_chaves;
create policy api_chaves_delete on public.api_chaves for delete to authenticated
  using (private.meu_perfil() = 'admin');

create or replace function private.proteger_api_chave() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.chave_hash is distinct from old.chave_hash or new.escopos is distinct from old.escopos
       or new.prefixo is distinct from old.prefixo or new.ultimo_uso is distinct from old.ultimo_uso
       or new.total_usos is distinct from old.total_usos or new.criada_por is distinct from old.criada_por then
      raise exception 'Só o nome e o estado (ativa/revogada) da chave podem ser alterados.';
    end if;
    if old.ativa and not new.ativa then new.revogada_em := now(); end if;
    if not old.ativa and new.ativa then raise exception 'Chave revogada não volta a valer: crie uma nova.'; end if;
  end if;
  return new;
end $$;

drop trigger if exists api_chaves_proteger on public.api_chaves;
create trigger api_chaves_proteger before update on public.api_chaves
  for each row execute function private.proteger_api_chave();

create or replace function public.registrar_uso_api(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.api_chaves set ultimo_uso = now(), total_usos = total_usos + 1 where id = p_id;
$$;
revoke all on function public.registrar_uso_api(uuid) from public, anon, authenticated;
grant execute on function public.registrar_uso_api(uuid) to service_role;
