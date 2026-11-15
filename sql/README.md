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
| `010_perfis_rls.sql` | Perfis de acesso (`perfisAcesso`) | Opcional — troca "authenticated acessa tudo" por segurança por perfil |
| `011_funis_leads.sql` | Funis de Leads (`funisLeads`) | Opcional — exige 010 |
| `012_chamados_estoque.sql` | Chamados + estoque com marca/custo/preço (`chamados`) | Opcional — exige 010 e 004/003; **substitui** a baixa de estoque da Assistência Técnica simples |
| `013_api_integracao.sql` | API de integração (`apiIntegracao`) | Opcional — exige 010 |

Todas as tabelas são criadas sempre (schema único para todo cliente) — o
que varia por cliente é **quais módulos aparecem na navegação**, controlado
em `admin/js/admin-config.js` → `ADMIN_CONFIG.enabledModules`. Ver
`../CHECKLIST-NOVO-CLIENTE.md`.

RLS: toda tabela tem `authenticated` com acesso total e `anon` sem nenhum
acesso (política ausente = negado por padrão). Exceção: `profiles`, onde
cada usuário só lê/edita a própria linha.

Os arquivos 010 a 013 vieram do CRM da Oficina e também são idempotentes, mas **mudam a segurança do banco**:
a partir do 010, o acesso passa a depender do perfil (`profiles.role`), não mais de "qualquer usuário logado".
Só aplique em projeto de cliente que vai usar os módulos correspondentes; no banco do CRP base, não aplique.
