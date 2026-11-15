# Checklist — novo cliente a partir do CRP

O CRP é o sistema base: **nunca é modificado para atender uma necessidade
específica de cliente.** Toda vez que for atender um cliente novo, o caminho
é sempre clonar este repositório e customizar a cópia.

> **Marcar como template no GitHub** (passo manual, não tem API pra isso):
> `github.com/QuboTech/Gest-o-CRM` → Settings → marcar "Template repository".
> Feito isso, "Use this template" cria a cópia já sem o histórico de commits
> do CRP.

## 1. Repositório

- [ ] Criar o repositório do cliente a partir do template (ou clonar e trocar o remote).
- [ ] Decidir visibilidade: **privado** se o cliente vai ter dados reais de pessoas/empresas antes de ir pro ar.

## 2. Supabase

- [ ] Criar um projeto Supabase novo e vazio pro cliente (não reaproveitar o do CRP nem o de outro cliente).
- [ ] Aplicar as migrações de `sql/` na ordem numérica (ver `sql/README.md`).
- [ ] Criar o(s) usuário(s) iniciais direto no banco (ver padrão de SQL no histórico do projeto — nunca usar e-mail real, sempre o domínio sintético).

## 3. `admin/js/admin-config.js`

- [ ] `ADMIN_CONFIG.supabaseUrl` / `supabaseAnonKey` → do projeto Supabase do cliente.
- [ ] `ADMIN_CONFIG.syntheticEmailDomain` → algo como `@nomedocliente.internal`.
- [ ] `ADMIN_CONFIG.enabledModules` → decidir módulo por módulo:
  - `estoque`, `assistenciaTecnica`, `financeiro`, `leads`: ligar os que o cliente usa.
  - `assistenciaSeloLacre`: só ligar se o cliente trabalha com selo/lacre de metrologia legal (ex: balanças). Não é o caso da maioria.
  - `pedidosVacuo`: só ligar se o cliente vende por itens de embalagem a vácuo (medidas em metros/micras). Não é o caso da maioria.
- [ ] `EMPRESA_CONFIG` → nome, CNPJ, endereço, chave PIX do cliente (aparecem nos impressos).

## 4. Identidade visual

- [ ] `css/style.css` → trocar os valores das variáveis de cor (manter os nomes: `--navy-900`, `--blue-accent`, etc.) pela paleta do cliente.
- [ ] `assets/img/logo-full.png` → logo do cliente.
- [ ] `index.html` → landing própria, se o cliente quiser.

## 5. Deploy

- [ ] Criar o projeto Vercel do cliente apontando pro repositório novo (passo manual: `vercel.com/new`, a API de criação de projeto costuma dar 403 pro token deste ambiente).
- [ ] Apontar domínio próprio, se o cliente tiver.

## 6. Antes de publicar

- [ ] `npm install && npm test` — os testes em `test/` cobrem a navegação modular (`nav.js`) e o módulo de Leads com dados simulados; não substituem testar manualmente o fluxo real no navegador.
- [ ] Testar login, troca de senha obrigatória, e cada módulo ligado, com dados fake.
