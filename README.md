# Gestão CRM

Projeto paralelo, derivado do CRM da HLN Embalagens (`hln-embalagens` /
`hlnembalagens-creator/hln-embalagens`), criado para servir de sandbox onde
novas funcionalidades podem ser incrementadas sem afetar o sistema em
produção da HLN.

## Origem

Cópia integral do código do repositório HLN em 2026-07-22 (site institucional
estático + portal administrativo `/admin`). A partir daqui os dois projetos
evoluem de forma independente — mudanças em um não se propagam para o outro
automaticamente.

## O que já foi feito nesta cópia (além do fork em si)

- Rebrand do texto "Portal HLN" / "HLN Portal" para "Gestão CRM" nas páginas
  do admin (títulos e cabeçalho). O logo/identidade visual (SVG "HLN Embalagens
  e Equipamentos" em `admin/login.html` e no rodapé do site público) **não**
  foi alterado — ainda usa a marca da HLN. Trocar isso é uma decisão de
  design separada, ainda pendente.
- O site público (`index.html`, `obrigado.html`, `privacidade.html`, `404.html`)
  também **não** foi rebrandado — ainda contém dados da empresa HLN (CNPJ,
  endereço, textos institucionais). Só o portal administrativo foi renomeado.
- Domínio de e-mail sintético trocado de `@hln.internal` para
  `@gestaocrm.internal` em `admin/js/admin-config.js` (detalhe interno, não
  aparece em nenhuma tela).

## Infraestrutura

- **Supabase**: projeto `hln-gestao-crm` (ref `agtlqmbhkajsxdpeqviq`, região
  `sa-east-1`) — banco **separado e vazio**, schema idêntico ao da HLN
  (`profiles`, `clientes`, `produtos_catalogo`, `pedidos`,
  `pedido_itens_vacuo`, `pedido_itens_gerais`, `financeiro_entradas`,
  `financeiro_saidas`), mesmas políticas de RLS (`authenticated` tem acesso
  total, `anon` não tem acesso a nada).
- **Deploy**: Vercel, projeto `gestao-crm`, produção em
  `https://gestao-crm-three.vercel.app`.
- **Repositório**: `github.com/QuboTech/Gest-o-CRM`, branch `main`.
- **Login inicial**: usuário `gustavo`, com troca de senha obrigatória já
  configurada (`must_change_password = true` na tabela `profiles`) — a senha
  temporária foi combinada em conversa, não está registrada aqui por
  segurança.

## Como continuar

Basta abrir uma sessão do Claude Code apontando para esta pasta (ou
clonando o repositório acima) — todo o código, schema e deploy já estão
funcionando; é só seguir incrementando.
