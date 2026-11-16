# CRP (CRM com ERP)

Sistema de gestão genérico, sem marca ou dados de nenhuma empresa
específica. É o **sistema base**: sempre que for parametrizado para um
cliente, o caminho é criar uma cópia limpa deste repositório e customizar
essa cópia (branding, dados da empresa, banco Supabase próprio, módulos
ligados) — este repositório em si permanece genérico. Ver
`CHECKLIST-NOVO-CLIENTE.md` para o passo a passo.

## Módulos

Todo cliente tem o núcleo (sempre ligado) e escolhe quais módulos opcionais
usar, via `ADMIN_CONFIG.enabledModules` em `admin/js/admin-config.js`:

- **CRM** (núcleo) — Clientes, Pedidos e Catálogo de produtos.
  - Submódulo opcional `pedidosVacuo`: itens de pedido em formato de
    embalagem a vácuo (material, largura/comprimento/espessura, peso) —
    só faz sentido pra cliente desse ramo específico.
- **Assistência Técnica** (`assistenciaTecnica`) — atendimentos vinculados a
  cliente + equipamento cadastrado, com baixa automática de peça no estoque.
  - Submódulo opcional `assistenciaSeloLacre`: campos de selo/lacre de
    metrologia legal (ex: balanças) — só faz sentido pra cliente desse ramo.
- **Estoque** (`estoque`) — cadastro de peças, exportação/relatório e
  importação via planilha Excel.
- **Financeiro** (`financeiro`) — entradas e saídas.
- **Leads** (`leads`) — acompanhamento de leads (canal de aquisição, status,
  tentativas de contato, quem atendeu). Portado do sistema desktop da
  Oficina das Balanças.

Módulos opcionais vindos do CRM da Oficina (todos desligados por padrão; ver `sql/README.md`):

- **Perfis de acesso** (`perfisAcesso`) — perfis admin, atendente, vendedor, financeiro, tecnico, programadora, recepcao e
  oficina_interna, com segurança no banco (RLS) e a tela **Usuários**.
- **Funis de Leads** (`funisLeads`) — Vendas, Manutenção e Pós-venda com cadência de retorno, Dashboard e alertas.
- **Chamados** (`chamados`) — chamados de campo (EX) e de oficina (OF), orçamento, faturamento, rota, OS impressa,
  comprovante com assinatura, Relatórios e app do celular (`/app/`); substitui a Assistência Técnica simples e acrescenta
  marca/custo/preço ao Estoque.
- **API de integração** (`apiIntegracao`) — leitura de preços e clientes por chave (`/api/v1`) e a tela **Integrações**.

A navegação (`admin/js/nav.js`) e os blocos de formulário marcados com
`data-requires-module="..."` seguem essa configuração automaticamente — não
precisa editar cada página `.html` por cliente.

## Parametrização para um cliente novo

Tudo que muda de cliente para cliente está centralizado em poucos lugares
— ver `CHECKLIST-NOVO-CLIENTE.md` para o passo a passo completo:

- `admin/js/admin-config.js` → `ADMIN_CONFIG` (projeto Supabase e módulos
  ligados do cliente) e `EMPRESA_CONFIG` (nome, CNPJ, endereço, chave PIX).
- `assets/img/logo-full.png` e o bloco `.brand-mark` — trocar pela
  identidade visual do cliente.
- Banco de dados: criar um projeto Supabase novo e aplicar as migrações de
  `sql/` (ver `sql/README.md`) nesse projeto próprio do cliente.
- `index.html` — landing enxuta apontando pro login; cada cliente pode
  receber sua própria página institucional aqui, se quiser.

## Infraestrutura (deste ambiente de referência)

- **Supabase**: projeto `crp-base` (ref `mpenhzpdjadnyahbegeo`, região
  `sa-east-1`, org QuboTech). Schema versionado em `sql/` (ver
  `sql/README.md`) — antes só existia descrito em prosa, apontando pra um
  projeto Supabase antigo e pausado.
- **Deploy**: Vercel, projeto `gestao-crm`, produção em
  `https://gestao-crm-three.vercel.app`.
- **Repositório**: `github.com/QuboTech/Gest-o-CRM`.
- **Testes**: `npm install && npm test` — jsdom cobrindo a navegação modular
  e o módulo de Leads com dados simulados (ver `test/`).

## Como continuar

Basta abrir uma sessão do Claude Code apontando para esta pasta (ou
clonando o repositório acima) — todo o código, schema e deploy já estão
funcionando; é só seguir incrementando.
