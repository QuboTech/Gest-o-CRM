-- Módulo: CRM (núcleo, sempre ligado).

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  razao_social text not null,
  nome_fantasia text,
  cnpj_cpf text,
  ie text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  municipio text,
  uf text,
  telefone_empresa text,
  email_empresa text,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  forma_pagamento_padrao text check (forma_pagamento_padrao = any (array['boleto','a_vista','cartao_credito','cartao_debito','pix','link_pagamento'])),
  local_entrega_preferencial text,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_clientes_updated_at on clientes;
create trigger trg_clientes_updated_at before update on clientes
  for each row execute function set_updated_at();

alter table clientes enable row level security;

drop policy if exists authenticated_all_clientes on clientes;
create policy authenticated_all_clientes on clientes
  for all to authenticated using (true) with check (true);
