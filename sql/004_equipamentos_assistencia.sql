-- Módulo: Assistência Técnica (opcional, módulo "assistencia_tecnica").
--
-- Submódulo "selo_lacre": as 4 colunas selo_antigo/selo_novo/lacre_antigo/
-- lacre_novo são de metrologia legal (selos/lacres INMETRO em balanças) —
-- ficam sempre na tabela (nullable), e o front só mostra os campos quando
-- ADMIN_CONFIG.enabledModules.assistencia_selo_lacre === true. Não é nicho
-- de todo cliente de assistência técnica (ex: oficina de equipamentos sem
-- selo/lacre não usa), por isso é um toggle de UI, não de schema.

create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  marca text check (marca is null or char_length(marca) <= 100),
  modelo text check (modelo is null or char_length(modelo) <= 100),
  numero_serie text check (numero_serie is null or numero_serie ~ '^[A-Za-z0-9]{1,20}$'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_equipamentos_updated_at on equipamentos;
create trigger trg_equipamentos_updated_at before update on equipamentos
  for each row execute function set_updated_at();

alter table equipamentos enable row level security;
drop policy if exists authenticated_all_equipamentos on equipamentos;
create policy authenticated_all_equipamentos on equipamentos
  for all to authenticated using (true) with check (true);

create sequence if not exists assistencias_tecnicas_numero_seq;

create table if not exists assistencias_tecnicas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('assistencias_tecnicas_numero_seq'),
  cliente_id uuid references clientes(id),
  equipamento_id uuid not null references equipamentos(id),
  descricao_defeito text check (descricao_defeito is null or char_length(descricao_defeito) <= 5000),
  -- submódulo selo_lacre (ver comentário no topo do arquivo):
  selo_antigo text check (selo_antigo is null or selo_antigo ~ '^[A-Za-z0-9]{1,20}$'),
  selo_novo text check (selo_novo is null or selo_novo ~ '^[A-Za-z0-9]{1,20}$'),
  lacre_antigo text check (lacre_antigo is null or lacre_antigo ~ '^[A-Za-z0-9]{1,20}$'),
  lacre_novo text check (lacre_novo is null or lacre_novo ~ '^[A-Za-z0-9]{1,20}$'),
  status text not null default 'aberta' check (status = any (array['aberta','em_andamento','pendente','concluida','nao_aprovada'])),
  resolucao text check (resolucao is null or char_length(resolucao) <= 5000),
  peca_id uuid references estoque_pecas(id),
  quantidade_peca_utilizada numeric,
  pausado_em timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_assistencias_tecnicas_updated_at on assistencias_tecnicas;
create trigger trg_assistencias_tecnicas_updated_at before update on assistencias_tecnicas
  for each row execute function set_updated_at();

create or replace function ajustar_estoque_assistencia()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if TG_OP = 'INSERT' then
    if new.peca_id is not null and new.quantidade_peca_utilizada is not null then
      update estoque_pecas set quantidade = quantidade - new.quantidade_peca_utilizada where id = new.peca_id;
    end if;
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.peca_id is not null and old.quantidade_peca_utilizada is not null then
      update estoque_pecas set quantidade = quantidade + old.quantidade_peca_utilizada where id = old.peca_id;
    end if;
    if new.peca_id is not null and new.quantidade_peca_utilizada is not null then
      update estoque_pecas set quantidade = quantidade - new.quantidade_peca_utilizada where id = new.peca_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.peca_id is not null and old.quantidade_peca_utilizada is not null then
      update estoque_pecas set quantidade = quantidade + old.quantidade_peca_utilizada where id = old.peca_id;
    end if;
    return old;
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_assistencias_tecnicas_ajustar_estoque on assistencias_tecnicas;
create trigger trg_assistencias_tecnicas_ajustar_estoque
  after insert or update or delete on assistencias_tecnicas
  for each row execute function ajustar_estoque_assistencia();

alter table assistencias_tecnicas enable row level security;
drop policy if exists authenticated_all_assistencias_tecnicas on assistencias_tecnicas;
create policy authenticated_all_assistencias_tecnicas on assistencias_tecnicas
  for all to authenticated using (true) with check (true);
