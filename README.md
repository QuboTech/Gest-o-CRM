# Gestão CRM

Sistema de gestão modular, genérico e sem marca ou dados de nenhuma empresa. Três módulos que funcionam juntos
(mesmo banco) ou separados (vendidos à parte), ligados em `admin/js/modulos.js` (`MODULOS_ATIVOS`).

| Módulo | O que tem |
|---|---|
| **comercial** | Pedidos/Orçamentos, Catálogo, Financeiro, Calculadora de custo |
| **chamados** | Chamados de campo (EX) e de oficina (OF), orçamento, faturamento, Estoque, Relatórios, OS, app do celular (`/app/`) |
| **leads** | Funis de Vendas, Manutenção e Pós-venda, Dashboard, alertas por e-mail |

Comum a todos: login por usuário, 8 perfis com RLS no banco (admin, atendente, vendedor, financeiro, tecnico,
oficina_interna, programadora, recepcao), Clientes, Usuários, Integrações e API somente leitura (`api/v1/`).

## Estrutura
- `admin/` telas (HTML/CSS/JS puro, sem build); `admin/js/modulos.js` é a fonte única de menu e permissões por perfil.
- `app/` app de chamados para o celular; `api/` funções da Vercel (gerenciar usuários e API de integração).
- `supabase/migrations/` 0001 base e perfis, 0002 leads, 0003 chamados e estoque, 0004 comercial, 0005 API.
  O agendamento dos alertas (`0006_...sql.modelo`) só entra depois de publicar a edge function.

## Parametrização por cliente
`admin/js/admin-config.js` (Supabase e empresa), `admin/js/os-lib.js` (`OS_EMPRESA`), `api/*.js` (URL do Supabase e
domínio sintético), logos em `assets/img/`, tema em `admin/css/tema.css`. Chaves secretas (service_role, Resend) ficam
nas variáveis da Vercel/Supabase, nunca no código.

## Pendências
- Clientes: reincluir "Histórico de compras" e "Mesclar duplicados" (existiam no portal original) na tela unificada.
- Ligar o cron de alertas e publicar a edge function `alertas-followup` (falta copiá-la para este repositório).
- Logo definitivo, `OS_EMPRESA`, `EMPRESA_CONFIG` e site público.
- Testar cada tela logado com cada perfil.
