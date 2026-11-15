# Migrações SQL — CRP

Aplicar na ordem numérica (`001_...` até `007_...`) num projeto Supabase
novo e vazio. Todos os arquivos são idempotentes (`create table if not
exists`, `drop policy/trigger if exists` antes de recriar) — podem ser
re-executados sem efeito colateral.

| Arquivo | Módulo | Obrigatório? |
|---|---|---|
| `001_extensions_profiles.sql` | Núcleo (auth) | Sim |
| `002_clientes.sql` | CRM | Sim |
| `003_catalogo_estoque.sql` | CRM (catálogo) + Estoque | Catálogo sim, Estoque opcional |
| `004_equipamentos_assistencia.sql` | Assistência Técnica | Opcional |
| `005_pedidos.sql` | CRM (pedidos) | Sim — inclui submódulo `pedidos_vacuo` |
| `006_financeiro.sql` | Financeiro | Opcional |
| `007_leads.sql` | Leads | Opcional |

Todas as tabelas são criadas sempre (schema único para todo cliente) — o
que varia por cliente é **quais módulos aparecem na navegação**, controlado
em `admin/js/admin-config.js` → `ADMIN_CONFIG.enabledModules`. Ver
`../CHECKLIST-NOVO-CLIENTE.md`.

RLS: toda tabela tem `authenticated` com acesso total e `anon` sem nenhum
acesso (política ausente = negado por padrão). Exceção: `profiles`, onde
cada usuário só lê/edita a própria linha.
