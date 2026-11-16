-- MÓDULO CHAMADOS E ESTOQUE: chamados de campo (rua, EX) e de oficina interna (OF), orçamento, faturamento,
-- peças por chamado, estoque com marca/custo/preço, documentos da OS. Estado FINAL (já consolida as etapas intermediárias).

-- 1) Remove a baixa de estoque antiga do CRP (1 peça por chamado, baixa ao salvar): a nova baixa é ao FECHAR o chamado
drop trigger if exists trg_assistencias_tecnicas_ajustar_estoque on public.assistencias_tecnicas;
drop function if exists public.ajustar_estoque_assistencia();

-- 2) Clientes: coordenadas para a rota do técnico
alter table public.clientes
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocodificado_em timestamptz;

-- 3) Equipamentos: nº de série (letras/números até 20, ou NÃO CONSTA)
alter table public.equipamentos drop constraint if exists equipamentos_numero_serie_check;
alter table public.equipamentos add constraint equipamentos_numero_serie_check
  check (numero_serie ~ '^[A-Za-z0-9]{1,20}$' or numero_serie = 'NÃO CONSTA');

-- 4) Estoque: marca, preço de venda e custo (custo em tabela à parte, só admin/financeiro)
alter table public.estoque_pecas
  add column if not exists marca text,
  add column if not exists preco_venda numeric(12,2) check (preco_venda is null or preco_venda >= 0);

create table if not exists public.estoque_custos (
  peca_id uuid primary key references public.estoque_pecas(id) on delete cascade,
  custo numeric(12,2) not null check (custo >= 0),
  updated_at timestamptz not null default now()
);
alter table public.estoque_custos enable row level security;

-- 5) Chamados (assistencias_tecnicas)
alter table public.assistencias_tecnicas drop constraint if exists assistencias_tecnicas_status_check;
alter table public.assistencias_tecnicas drop constraint if exists assistencias_status_check;
alter table public.assistencias_tecnicas
  add column if not exists tipo text not null default 'campo' check (tipo in ('campo', 'oficina')),
  add column if not exists tecnico_id uuid references public.profiles(id),
  add column if not exists data_agendada date,
  add column if not exists selo_antigo_ausente boolean not null default false,
  add column if not exists lacre_antigo_ausente boolean not null default false,
  add column if not exists iniciado_em timestamptz,
  add column if not exists fechado_em timestamptz,
  add column if not exists orcamento_por uuid references public.profiles(id),
  add column if not exists orcamento_em timestamptz,
  add column if not exists devolvido boolean not null default false,
  add column if not exists faturado_em timestamptz,
  add column if not exists faturado_por uuid references public.profiles(id) on delete set null,
  add column if not exists prefixo text check (prefixo in ('OF', 'EX')),
  add column if not exists seq integer;
alter table public.assistencias_tecnicas add constraint assistencias_status_check
  check (status in ('aberta', 'em_andamento', 'pendente', 'orcamento_aprovado', 'nao_aprovada', 'concluida'));

create sequence if not exists public.chamado_seq_of;
create sequence if not exists public.chamado_seq_ex;

-- numeração dos chamados que já existiam (OF = oficina, EX = rua); só roda enquanto houver chamado sem número
do $mig$
begin
  if exists (select 1 from public.assistencias_tecnicas where prefixo is null) then
    with ord as (
      select id,
             case when tipo = 'oficina' then 'OF' else 'EX' end as p,
             coalesce((select max(a2.seq) from public.assistencias_tecnicas a2
                       where a2.prefixo = case when a.tipo = 'oficina' then 'OF' else 'EX' end), 0)
               + row_number() over (partition by (tipo = 'oficina') order by created_at, numero) as rn
      from public.assistencias_tecnicas a
      where prefixo is null
    )
    update public.assistencias_tecnicas a set prefixo = o.p, seq = o.rn from ord o where o.id = a.id;
  end if;
end $mig$;

select setval('public.chamado_seq_of', greatest(coalesce((select max(seq) from public.assistencias_tecnicas where prefixo = 'OF'), 0), 1),
              coalesce((select max(seq) from public.assistencias_tecnicas where prefixo = 'OF'), 0) > 0);
select setval('public.chamado_seq_ex', greatest(coalesce((select max(seq) from public.assistencias_tecnicas where prefixo = 'EX'), 0), 1),
              coalesce((select max(seq) from public.assistencias_tecnicas where prefixo = 'EX'), 0) > 0);

alter table public.assistencias_tecnicas
  alter column prefixo set not null,
  alter column seq set not null;
alter table public.assistencias_tecnicas drop constraint if exists assistencias_prefixo_seq_unico;
alter table public.assistencias_tecnicas add constraint assistencias_prefixo_seq_unico unique (prefixo, seq);

alter table public.assistencias_tecnicas
  add column if not exists codigo text generated always as (prefixo || '-' || lpad(seq::text, 4, '0')) stored;

create index if not exists assistencias_tecnico_status_idx on public.assistencias_tecnicas (tecnico_id, status);
grant usage, select on sequence public.chamado_seq_of, public.chamado_seq_ex to authenticated;

-- 6) Histórico, peças e documentos do chamado
create table if not exists public.chamado_historico (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.assistencias_tecnicas(id) on delete cascade,
  autor_id uuid references public.profiles(id),
  autor_nome text,
  tipo text not null default 'nota' check (tipo in ('nota', 'inicio', 'pendencia', 'fechamento', 'orcamento')),
  status_para text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists chamado_historico_chamado_idx on public.chamado_historico (chamado_id, created_at);
alter table public.chamado_historico enable row level security;

create table if not exists public.chamado_itens (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.assistencias_tecnicas(id) on delete cascade,
  peca_id uuid not null references public.estoque_pecas(id),
  quantidade numeric(10,2) not null check (quantidade > 0),
  preco_unit numeric(12,2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists chamado_itens_chamado_idx on public.chamado_itens (chamado_id);
alter table public.chamado_itens enable row level security;

-- o que já estava registrado no chamado antigo (1 peça) vira item (o estoque já tinha baixado); só roda uma vez
insert into public.chamado_itens (chamado_id, peca_id, quantidade, created_by)
select a.id, a.peca_id, a.quantidade_peca_utilizada, a.created_by
from public.assistencias_tecnicas a
where a.peca_id is not null and coalesce(a.quantidade_peca_utilizada, 0) > 0 and a.status <> 'nao_aprovada'
  and not exists (select 1 from public.chamado_itens i where i.chamado_id = a.id);

insert into storage.buckets (id, name, public)
values ('os-documentos', 'os-documentos', false)
on conflict (id) do nothing;

create table if not exists public.chamado_documentos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.assistencias_tecnicas(id) on delete cascade,
  tipo text not null check (tipo in ('assinatura', 'comprovante_pdf')),
  caminho text not null,
  nome_assinante text,
  cliente_nao_assinou boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists chamado_documentos_chamado_idx on public.chamado_documentos (chamado_id);
alter table public.chamado_documentos enable row level security;

-- 7) Funções de apoio e regras do chamado (valem para qualquer caminho de acesso, não só para a tela)
create or replace function private.perfil_de(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = p_id
$$;
revoke all on function private.perfil_de(uuid) from public, anon;
grant execute on function private.perfil_de(uuid) to authenticated;

create or replace function private.numerar_chamado()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipo = 'oficina' then
    new.prefixo := 'OF';
    new.seq := nextval('public.chamado_seq_of');
  else
    new.prefixo := 'EX';
    new.seq := nextval('public.chamado_seq_ex');
  end if;
  return new;
end $$;

create or replace function private.validar_chamado()
returns trigger language plpgsql set search_path = public as $$
declare
  papel text := private.meu_perfil();
  perfil_tec text;
  transferindo boolean := false;
begin
  if papel is null or papel = 'admin' then
    if tg_op = 'UPDATE' then
      if new.status = 'em_andamento' and old.status <> 'em_andamento' and new.iniciado_em is null then new.iniciado_em := now(); end if;
      if new.status = 'concluida' and old.status <> 'concluida' then new.fechado_em := now(); end if;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if papel not in ('programadora', 'recepcao') then
      raise exception 'Seu perfil não abre chamados.';
    end if;
    if new.tecnico_id is null then
      raise exception 'Escolha o técnico responsável pelo chamado.';
    end if;
    perfil_tec := private.perfil_de(new.tecnico_id);
    if perfil_tec is null or perfil_tec not in ('tecnico', 'oficina_interna') then
      raise exception 'O responsável precisa ser um técnico de campo ou da oficina interna.';
    end if;
    if btrim(coalesce(new.descricao_defeito, '')) = '' then
      raise exception 'Informe o defeito.';
    end if;
    if new.status <> 'aberta' then
      raise exception 'O chamado é aberto com status Aberto.';
    end if;

    if perfil_tec = 'tecnico' then
      new.tipo := 'campo';
      if new.data_agendada is null then
        raise exception 'Informe a data da visita.';
      end if;
      if new.selo_antigo is not null or new.lacre_antigo is not null
         or new.selo_antigo_ausente or new.lacre_antigo_ausente then
        raise exception 'Selo e lacre antigos são informados pelo técnico no atendimento, não na abertura.';
      end if;
    else
      new.tipo := 'oficina';
      if btrim(coalesce(new.selo_antigo, '')) = '' and not new.selo_antigo_ausente then
        raise exception 'Informe o selo antigo ou marque "Não possui selo".';
      end if;
      if btrim(coalesce(new.lacre_antigo, '')) = '' and not new.lacre_antigo_ausente then
        raise exception 'Informe o lacre antigo ou marque "Não possui lacre".';
      end if;
    end if;
    new.created_by := auth.uid();
    return new;
  end if;

  -- UPDATE
  if new.tipo is distinct from old.tipo then
    if not (papel = 'tecnico' and old.tipo = 'campo' and new.tipo = 'oficina' and new.status = 'aberta'
            and old.status in ('aberta', 'em_andamento', 'orcamento_aprovado')) then
      raise exception 'Só o técnico de rua transfere o chamado para a oficina interna.';
    end if;
    transferindo := true;
  end if;

  if papel in ('tecnico', 'oficina_interna') then
    if new.cliente_id <> old.cliente_id or new.equipamento_id <> old.equipamento_id
       or new.tecnico_id is distinct from old.tecnico_id
       or new.data_agendada is distinct from old.data_agendada
       or new.descricao_defeito is distinct from old.descricao_defeito then
      raise exception 'Você não pode alterar cliente, equipamento, defeito, técnico ou agenda do chamado.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if papel = 'tecnico' then
      if not (transferindo
           or (old.status = 'aberta' and new.status = 'em_andamento')
           or (old.status in ('aberta', 'em_andamento', 'orcamento_aprovado') and new.status = 'pendente')
           or (old.status = 'orcamento_aprovado' and new.status = 'em_andamento')
           or (old.status in ('em_andamento', 'orcamento_aprovado', 'nao_aprovada') and new.status = 'concluida')) then
        raise exception 'Mudança de status não permitida para o técnico (% → %).', old.status, new.status;
      end if;
    elsif papel = 'oficina_interna' then
      if not ((old.status in ('aberta', 'orcamento_aprovado') and new.status = 'em_andamento')
           or (old.status in ('aberta', 'em_andamento', 'orcamento_aprovado') and new.status = 'pendente')
           or (old.status in ('aberta', 'em_andamento', 'orcamento_aprovado', 'nao_aprovada') and new.status = 'concluida')) then
        raise exception 'Mudança de status não permitida para a oficina interna (% → %).', old.status, new.status;
      end if;
    elsif papel in ('programadora', 'recepcao') then
      if not (old.status = 'pendente' and new.status in ('orcamento_aprovado', 'nao_aprovada')) then
        raise exception 'Você só decide o orçamento de chamados aguardando orçamento (aprovar ou recusar).';
      end if;
    else
      raise exception 'Seu perfil não altera o status dos chamados.';
    end if;
  elsif papel = 'tecnico' and old.status in ('pendente', 'nao_aprovada', 'concluida') then
    raise exception 'Este chamado não pode mais ser editado por você.';
  elsif papel = 'oficina_interna' and old.status in ('pendente', 'concluida') then
    raise exception 'Este chamado não pode mais ser editado por você.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'em_andamento' and new.iniciado_em is null then new.iniciado_em := now(); end if;
    if new.status = 'pendente' then
      new.pausado_em := coalesce(old.pausado_em, now());
    else
      new.pausado_em := null;
    end if;
    if new.status in ('orcamento_aprovado', 'nao_aprovada') then
      new.orcamento_por := auth.uid();
      new.orcamento_em := now();
    end if;
    if new.status = 'concluida' then
      new.fechado_em := now();
      if old.status = 'nao_aprovada' then
        -- orçamento recusado: equipamento devolvido sem conserto, selos/lacres continuam os antigos
        new.devolvido := true;
        if btrim(coalesce(new.selo_antigo, '')) = '' and not new.selo_antigo_ausente then
          raise exception 'Informe o selo antigo ou marque "Não possui selo".';
        end if;
        if btrim(coalesce(new.lacre_antigo, '')) = '' and not new.lacre_antigo_ausente then
          raise exception 'Informe o lacre antigo ou marque "Não possui lacre".';
        end if;
      else
        if btrim(coalesce(new.selo_novo, '')) = '' then raise exception 'Informe o selo novo para fechar o chamado.'; end if;
        if btrim(coalesce(new.lacre_novo, '')) = '' then raise exception 'Informe o lacre novo para fechar o chamado.'; end if;
        if btrim(coalesce(new.selo_antigo, '')) = '' and not new.selo_antigo_ausente then
          raise exception 'Informe o selo antigo ou marque "Não possui selo".';
        end if;
        if btrim(coalesce(new.lacre_antigo, '')) = '' and not new.lacre_antigo_ausente then
          raise exception 'Informe o lacre antigo ou marque "Não possui lacre".';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function private.validar_faturamento()
returns trigger language plpgsql set search_path = public as $$
declare
  papel text := private.meu_perfil();
  ignorar text[] := array['faturado_em', 'faturado_por', 'updated_at', 'codigo'];
begin
  if tg_op = 'INSERT' then
    if papel is not null and papel <> 'admin' then
      new.faturado_em := null;
      new.faturado_por := null;
    end if;
    return new;
  end if;

  -- o financeiro só mexe nos campos do faturamento
  if papel = 'financeiro' and (to_jsonb(new) - ignorar) is distinct from (to_jsonb(old) - ignorar) then
    raise exception 'O financeiro só registra o faturamento.';
  end if;

  if new.faturado_em is distinct from old.faturado_em or new.faturado_por is distinct from old.faturado_por then
    if papel is null then return new; end if;
    if papel = 'admin' then
      if new.faturado_em is not null and old.faturado_em is null then new.faturado_por := auth.uid(); end if;
      return new;
    end if;
    if papel <> 'financeiro' then
      raise exception 'Só o financeiro fatura o serviço.';
    end if;
    if old.faturado_em is not null then
      raise exception 'Este serviço já foi faturado.';
    end if;
    if new.faturado_em is null then
      return new;
    end if;
    if old.status <> 'concluida' then
      raise exception 'Só é possível faturar chamados fechados.';
    end if;
    if old.devolvido then
      raise exception 'Equipamento devolvido sem conserto (orçamento recusado) não é faturado.';
    end if;
    if old.tipo = 'campo' and old.orcamento_em is null then
      raise exception 'Chamado de rua só é faturado depois de passar por orçamento.';
    end if;
    new.faturado_em := now();
    new.faturado_por := auth.uid();
  end if;
  return new;
end $$;

-- o técnico de rua só altera chamado de campo (depois de transferido para a oficina, só consulta)
create or replace function private.validar_chamado_tecnico_campo()
returns trigger language plpgsql set search_path = public as $$
begin
  if private.meu_perfil() = 'tecnico' and old.tipo <> 'campo' then
    raise exception 'Este chamado já está na oficina interna.';
  end if;
  return new;
end $$;

create or replace function private.validar_item_chamado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  papel text := private.meu_perfil();
  cid uuid := case when tg_op = 'DELETE' then old.chamado_id else new.chamado_id end;
  ch public.assistencias_tecnicas%rowtype;
  preco numeric(12,2);
begin
  if papel is not null and papel <> 'admin' then
    select * into ch from public.assistencias_tecnicas where id = cid;
    if not found then raise exception 'Chamado não encontrado.'; end if;
    if ch.status not in ('aberta', 'em_andamento', 'orcamento_aprovado') then
      raise exception 'As peças deste chamado não podem mais ser alteradas.';
    end if;
    if papel = 'tecnico' and (ch.tipo <> 'campo' or ch.tecnico_id is distinct from auth.uid()) then
      raise exception 'Você só altera as peças dos seus chamados de rua.';
    end if;
    if tg_op = 'UPDATE' and new.chamado_id <> old.chamado_id then
      raise exception 'Não é possível mover a peça para outro chamado.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;

  select preco_venda into preco from public.estoque_pecas where id = new.peca_id;
  if tg_op = 'INSERT' then
    if papel is null or papel = 'admin' then
      new.preco_unit := coalesce(new.preco_unit, preco);
    else
      new.preco_unit := preco;
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.peca_id is distinct from old.peca_id then
    new.preco_unit := preco;
  else
    new.preco_unit := old.preco_unit;
  end if;
  return new;
end $$;

-- baixa do estoque quando o chamado FECHA (soma das peças); reabrir ou apagar devolve; devolvido sem conserto não baixa
create or replace function private.baixar_estoque_itens()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'concluida' and old.status <> 'concluida' and not new.devolvido then
      update public.estoque_pecas e set quantidade = e.quantidade - i.q
      from (select peca_id, sum(quantidade) q from public.chamado_itens where chamado_id = new.id group by peca_id) i
      where e.id = i.peca_id;
    elsif old.status = 'concluida' and new.status <> 'concluida' and not old.devolvido then
      update public.estoque_pecas e set quantidade = e.quantidade + i.q
      from (select peca_id, sum(quantidade) q from public.chamado_itens where chamado_id = new.id group by peca_id) i
      where e.id = i.peca_id;
    end if;
    return new;
  end if;
  if old.status = 'concluida' and not old.devolvido then
    update public.estoque_pecas e set quantidade = e.quantidade + i.q
    from (select peca_id, sum(quantidade) q from public.chamado_itens where chamado_id = old.id group by peca_id) i
    where e.id = i.peca_id;
  end if;
  return old;
end $$;

revoke all on function private.numerar_chamado(), private.validar_chamado(), private.validar_faturamento(),
  private.validar_chamado_tecnico_campo(), private.validar_item_chamado(), private.baixar_estoque_itens()
  from public, anon, authenticated;

drop trigger if exists trg_assistencias_validar on public.assistencias_tecnicas;
create trigger trg_assistencias_validar
  before insert or update on public.assistencias_tecnicas
  for each row execute function private.validar_chamado();
drop trigger if exists trg_assistencias_faturamento on public.assistencias_tecnicas;
create trigger trg_assistencias_faturamento
  before insert or update on public.assistencias_tecnicas
  for each row execute function private.validar_faturamento();
drop trigger if exists trg_assistencias_tecnico_tipo on public.assistencias_tecnicas;
create trigger trg_assistencias_tecnico_tipo
  before update on public.assistencias_tecnicas
  for each row execute function private.validar_chamado_tecnico_campo();
drop trigger if exists trg_assistencias_zz_numero on public.assistencias_tecnicas;
create trigger trg_assistencias_zz_numero
  before insert on public.assistencias_tecnicas
  for each row execute function private.numerar_chamado();
drop trigger if exists trg_chamado_itens_validar on public.chamado_itens;
create trigger trg_chamado_itens_validar
  before insert or update or delete on public.chamado_itens
  for each row execute function private.validar_item_chamado();
drop trigger if exists trg_assistencias_estoque_itens on public.assistencias_tecnicas;
create trigger trg_assistencias_estoque_itens
  after update of status on public.assistencias_tecnicas
  for each row execute function private.baixar_estoque_itens();
drop trigger if exists trg_assistencias_estoque_itens_del on public.assistencias_tecnicas;
create trigger trg_assistencias_estoque_itens_del
  before delete on public.assistencias_tecnicas
  for each row execute function private.baixar_estoque_itens();

-- 8) RPCs
create or replace function public.listar_tecnicos()
returns table (id uuid, nome text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome_exibicao, p.role
  from public.profiles p
  where p.role in ('tecnico', 'oficina_interna')
    and private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'tecnico', 'oficina_interna')
  order by p.nome_exibicao
$$;
revoke all on function public.listar_tecnicos() from public, anon;
grant execute on function public.listar_tecnicos() to authenticated;

create or replace function public.salvar_geocodigo(p_cliente uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if private.meu_perfil() not in ('admin', 'programadora', 'recepcao', 'tecnico', 'oficina_interna') then
    raise exception 'Sem permissão.';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas inválidas.';
  end if;
  update public.clientes set latitude = p_lat, longitude = p_lng, geocodificado_em = now()
  where id = p_cliente and eh_cliente;
end $$;
revoke all on function public.salvar_geocodigo(uuid, double precision, double precision) from public, anon;
grant execute on function public.salvar_geocodigo(uuid, double precision, double precision) to authenticated;

-- 9) RLS
drop policy if exists authenticated_all_assistencias_tecnicas on public.assistencias_tecnicas;
drop policy if exists authenticated_all_equipamentos on public.equipamentos;
drop policy if exists authenticated_all_estoque_pecas on public.estoque_pecas;

drop policy if exists assistencias_select on public.assistencias_tecnicas;
create policy assistencias_select on public.assistencias_tecnicas for select to authenticated
  using (
    private.meu_perfil() in ('admin', 'atendente', 'programadora', 'recepcao', 'financeiro')
    or (private.meu_perfil() = 'tecnico' and tecnico_id = auth.uid())
    or (private.meu_perfil() = 'oficina_interna' and tipo = 'oficina')
  );
drop policy if exists assistencias_insert on public.assistencias_tecnicas;
create policy assistencias_insert on public.assistencias_tecnicas for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'programadora', 'recepcao'));
drop policy if exists assistencias_update on public.assistencias_tecnicas;
create policy assistencias_update on public.assistencias_tecnicas for update to authenticated
  using (
    private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'financeiro')
    or (private.meu_perfil() = 'tecnico' and tecnico_id = auth.uid())
    or (private.meu_perfil() = 'oficina_interna' and tipo = 'oficina')
  )
  with check (
    private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'financeiro')
    or (private.meu_perfil() = 'tecnico' and tecnico_id = auth.uid())
    or (private.meu_perfil() = 'oficina_interna' and tipo = 'oficina')
  );
drop policy if exists assistencias_delete on public.assistencias_tecnicas;
create policy assistencias_delete on public.assistencias_tecnicas for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists equipamentos_select on public.equipamentos;
create policy equipamentos_select on public.equipamentos for select to authenticated
  using (private.meu_perfil() in ('admin', 'atendente', 'programadora', 'recepcao', 'tecnico', 'oficina_interna', 'financeiro'));
drop policy if exists equipamentos_insert on public.equipamentos;
create policy equipamentos_insert on public.equipamentos for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'tecnico'));
drop policy if exists equipamentos_update on public.equipamentos;
create policy equipamentos_update on public.equipamentos for update to authenticated
  using (private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'tecnico'))
  with check (private.meu_perfil() in ('admin', 'programadora', 'recepcao', 'tecnico'));
drop policy if exists equipamentos_delete on public.equipamentos;
create policy equipamentos_delete on public.equipamentos for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists estoque_select on public.estoque_pecas;
create policy estoque_select on public.estoque_pecas for select to authenticated
  using (private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna', 'programadora', 'recepcao', 'financeiro'));
drop policy if exists estoque_insert on public.estoque_pecas;
create policy estoque_insert on public.estoque_pecas for insert to authenticated
  with check (private.meu_perfil() = 'admin');
drop policy if exists estoque_update on public.estoque_pecas;
create policy estoque_update on public.estoque_pecas for update to authenticated
  using (private.meu_perfil() = 'admin') with check (private.meu_perfil() = 'admin');
drop policy if exists estoque_delete on public.estoque_pecas;
create policy estoque_delete on public.estoque_pecas for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists estoque_custos_select on public.estoque_custos;
create policy estoque_custos_select on public.estoque_custos for select to authenticated
  using (private.meu_perfil() in ('admin', 'financeiro'));
drop policy if exists estoque_custos_insert on public.estoque_custos;
create policy estoque_custos_insert on public.estoque_custos for insert to authenticated
  with check (private.meu_perfil() = 'admin');
drop policy if exists estoque_custos_update on public.estoque_custos;
create policy estoque_custos_update on public.estoque_custos for update to authenticated
  using (private.meu_perfil() = 'admin') with check (private.meu_perfil() = 'admin');
drop policy if exists estoque_custos_delete on public.estoque_custos;
create policy estoque_custos_delete on public.estoque_custos for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists chamado_hist_select on public.chamado_historico;
create policy chamado_hist_select on public.chamado_historico for select to authenticated
  using (exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_id));
drop policy if exists chamado_hist_insert on public.chamado_historico;
create policy chamado_hist_insert on public.chamado_historico for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_id));
drop policy if exists chamado_hist_admin_delete on public.chamado_historico;
create policy chamado_hist_admin_delete on public.chamado_historico for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists chamado_itens_select on public.chamado_itens;
create policy chamado_itens_select on public.chamado_itens for select to authenticated
  using (exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_itens.chamado_id));
drop policy if exists chamado_itens_insert on public.chamado_itens;
create policy chamado_itens_insert on public.chamado_itens for insert to authenticated
  with check (private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna')
              and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_itens.chamado_id));
drop policy if exists chamado_itens_update on public.chamado_itens;
create policy chamado_itens_update on public.chamado_itens for update to authenticated
  using (private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna')
         and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_itens.chamado_id))
  with check (private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna')
              and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_itens.chamado_id));
drop policy if exists chamado_itens_delete on public.chamado_itens;
create policy chamado_itens_delete on public.chamado_itens for delete to authenticated
  using (private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna')
         and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_itens.chamado_id));

drop policy if exists chamado_docs_select on public.chamado_documentos;
create policy chamado_docs_select on public.chamado_documentos for select to authenticated
  using (exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_documentos.chamado_id));
drop policy if exists chamado_docs_insert on public.chamado_documentos;
create policy chamado_docs_insert on public.chamado_documentos for insert to authenticated
  with check (created_by = auth.uid()
              and private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna', 'recepcao', 'programadora')
              and exists (select 1 from public.assistencias_tecnicas a where a.id = chamado_documentos.chamado_id));
drop policy if exists chamado_docs_delete on public.chamado_documentos;
create policy chamado_docs_delete on public.chamado_documentos for delete to authenticated
  using (private.meu_perfil() = 'admin');

drop policy if exists os_documentos_select on storage.objects;
create policy os_documentos_select on storage.objects for select to authenticated
  using (bucket_id = 'os-documentos'
         and exists (select 1 from public.assistencias_tecnicas a where a.id::text = (storage.foldername(name))[1]));
drop policy if exists os_documentos_insert on storage.objects;
create policy os_documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'os-documentos'
              and private.meu_perfil() in ('admin', 'tecnico', 'oficina_interna', 'recepcao', 'programadora')
              and exists (select 1 from public.assistencias_tecnicas a where a.id::text = (storage.foldername(name))[1]));
drop policy if exists os_documentos_delete on storage.objects;
create policy os_documentos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'os-documentos' and private.meu_perfil() = 'admin');
