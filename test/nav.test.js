// Testa admin/js/nav.js com jsdom e configuração simulada — sem rede, sem
// Supabase real. Roda com: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const NAV_JS = fs.readFileSync(path.join(__dirname, '..', 'admin', 'js', 'nav.js'), 'utf8');

const PAGE_HTML = `<!doctype html><html><body>
  <nav class="admin-nav"></nav>
  <div id="abas-estoque" hidden></div>
  <div id="card-vacuo" data-requires-module="pedidosVacuo">vacuo</div>
  <div id="bloco-selo-lacre" data-requires-module="assistenciaSeloLacre">selo/lacre</div>
</body></html>`;

// Monta a página sem perfis (comportamento original do CRP) ou com perfil (role) quando perfisAcesso está ligado.
function montar(urlPath, enabledModules, role) {
  const dom = new JSDOM(PAGE_HTML, {
    url: 'https://cliente-teste.exemplo/admin/' + urlPath,
    runScripts: 'outside-only'
  });
  dom.window.ADMIN_CONFIG = { enabledModules: enabledModules || {} };
  if (role) dom.window.ADMIN_AUTH_READY = Promise.resolve({ profile: { role } });
  // jsdom não deixa sobrescrever location.replace (é read-only de verdade);
  // usamos o ponto de interceptação __crpIrPara que nav.js expõe pra isso.
  dom.window.__crpIrPara = (url) => { dom.window.__redirecionouPara = url; };
  dom.window.eval(NAV_JS);
  const pronto = role
    ? dom.window.ADMIN_AUTH_READY.then(() => new Promise((r) => setImmediate(r)))
    : Promise.resolve();
  return pronto.then(() => dom.window);
}

// Estrutura do menu: link da raiz = 'arquivo.html'; grupo = { 'Rótulo': ['a.html', 'b.html'] }
function menuDe(win) {
  return [...win.document.querySelector('.admin-nav').children].map((el) => {
    if (el.tagName === 'A') return el.getAttribute('href');
    const rotulo = el.querySelector('.nav-grupo-btn').textContent.replace('▾', '').trim();
    return { [rotulo]: [...el.querySelectorAll('.nav-menu a')].map((a) => a.getAttribute('href')) };
  });
}
const todosOsLinks = (win) => [...win.document.querySelectorAll('.admin-nav a')].map((a) => a.getAttribute('href'));
const abasDe = (win) => [...win.document.querySelectorAll('#abas-estoque a')].map((a) => a.textContent);

const TUDO = { perfisAcesso: true, funisLeads: true, chamados: true, apiIntegracao: true, estoque: true, financeiro: true };

// ---------------------------------------------------------------------------
// Núcleo e módulos do CRP
// ---------------------------------------------------------------------------
test('núcleo (Pedido/Clientes/Catálogo) sempre aparece, no grupo Vendas, mesmo com tudo desligado', async () => {
  const win = await montar('pedido.html', {});
  assert.deepEqual(menuDe(win), [{ Vendas: ['pedido.html', 'clientes.html', 'catalogo.html'] }]);
});

test('módulos opcionais aparecem só quando ligados; o Catálogo vira guia de Estoque', async () => {
  const win = await montar('pedido.html', { estoque: true, financeiro: true, leads: true });
  assert.deepEqual(menuDe(win), [
    { Vendas: ['pedido.html', 'clientes.html', 'estoque.html'] },
    { Lead: ['leads.html'] },
    'financeiro.html'
  ]);
});

test('link da página atual recebe class="active"', async () => {
  const win = await montar('clientes.html', { estoque: true });
  const ativo = win.document.querySelector('.admin-nav a.active');
  assert.equal(ativo.getAttribute('href'), 'clientes.html');
  assert.ok(ativo.closest('.nav-grupo').classList.contains('ativo'), 'o grupo da página atual fica destacado');
});

test('submódulo pedidosVacuo: bloco fica oculto quando desligado (padrão)', async () => {
  const win = await montar('pedido.html', {});
  assert.equal(win.document.getElementById('card-vacuo').hidden, true);
});

test('submódulo pedidosVacuo: bloco aparece quando ligado explicitamente', async () => {
  const win = await montar('pedido.html', { pedidosVacuo: true });
  assert.equal(win.document.getElementById('card-vacuo').hidden, false);
});

test('submódulo assistenciaSeloLacre: oculto por padrão, visível quando ligado', async () => {
  const desligado = await montar('assistencia-tecnica.html', { assistenciaTecnica: true });
  assert.equal(desligado.document.getElementById('bloco-selo-lacre').hidden, true);
  const ligado = await montar('assistencia-tecnica.html', { assistenciaTecnica: true, assistenciaSeloLacre: true });
  assert.equal(ligado.document.getElementById('bloco-selo-lacre').hidden, false);
});

test('acesso direto a módulo desligado redireciona pro núcleo (pedido.html)', async () => {
  const win = await montar('leads.html', { estoque: true }); // leads não está ligado
  assert.equal(win.__redirecionouPara, 'pedido.html');
});

test('acesso a módulo ligado NÃO redireciona', async () => {
  const win = await montar('leads.html', { leads: true });
  assert.equal(win.__redirecionouPara, undefined);
});

test('data-hidden-with-module: bloco simples some quando o módulo está ligado', () => {
  const dom = new JSDOM('<!doctype html><body><nav class="admin-nav"></nav><div id="simples" data-hidden-with-module="chamados">a</div><div id="completo" data-requires-module="chamados">b</div></body>', {
    url: 'https://cliente-teste.exemplo/admin/estoque.html', runScripts: 'outside-only'
  });
  dom.window.ADMIN_CONFIG = { enabledModules: { chamados: true } };
  dom.window.eval(NAV_JS);
  assert.equal(dom.window.document.getElementById('simples').hidden, true);
  assert.equal(dom.window.document.getElementById('completo').hidden, false);
});

// ---------------------------------------------------------------------------
// Estrutura do menu: Dashboard, Vendas, Lead, Assistência Técnica, Financeiro, Relatórios, Configuração
// ---------------------------------------------------------------------------
test('sem perfisAcesso, todo usuário vê o menu completo dos módulos ligados, agrupado', async () => {
  const win = await montar('pedido.html', { estoque: true, funisLeads: true });
  assert.deepEqual(menuDe(win), [
    'dashboard.html',
    { Vendas: ['pedido.html', 'clientes.html', 'estoque.html'] },
    { Lead: ['vendas.html', 'manutencao.html', 'pos-venda.html'] }
  ]);
});

test('menu completo do admin: Dashboard primeiro, Estoque nos grupos Vendas e Assistência Técnica, Configuração por último', async () => {
  const win = await montar('pedido.html', TUDO, 'admin');
  assert.deepEqual(menuDe(win), [
    'dashboard.html',
    { Vendas: ['pedido.html', 'clientes.html', 'estoque.html'] },
    { Lead: ['vendas.html', 'manutencao.html', 'pos-venda.html'] },
    { 'Assistência Técnica': ['chamados.html', 'estoque.html'] },
    'financeiro.html',
    'relatorios.html',
    { 'Configuração': ['usuarios.html', 'integracoes.html'] }
  ]);
});

test('chamados substitui a Assistência Técnica simples dentro do grupo Assistência Técnica', async () => {
  const simples = await montar('pedido.html', { assistenciaTecnica: true, estoque: true });
  assert.deepEqual(menuDe(simples).filter((m) => typeof m === 'object' && m['Assistência Técnica'])[0],
    { 'Assistência Técnica': ['assistencia-tecnica.html', 'estoque.html'] });
  const comChamados = await montar('pedido.html', { assistenciaTecnica: true, chamados: true, estoque: true });
  const grupo = menuDe(comChamados).filter((m) => typeof m === 'object' && m['Assistência Técnica'])[0];
  assert.deepEqual(grupo, { 'Assistência Técnica': ['chamados.html', 'estoque.html'] });
});

test('a cópia do Estoque só aparece em Assistência Técnica quando há assistência (simples ou chamados)', async () => {
  const win = await montar('pedido.html', { estoque: true });
  assert.ok(!menuDe(win).some((m) => typeof m === 'object' && m['Assistência Técnica']));
});

test('Dashboard é a primeira opção do menu quando funisLeads está ligado', async () => {
  const win = await montar('pedido.html', { estoque: true, financeiro: true, funisLeads: true, chamados: true });
  assert.equal(menuDe(win)[0], 'dashboard.html');
});

test('menus suspensos abrem e fecham com clique e com Esc', async () => {
  const win = await montar('pedido.html', { estoque: true, funisLeads: true });
  const grupo = win.document.querySelector('.nav-grupo');
  const botao = grupo.querySelector('.nav-grupo-btn');
  botao.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(grupo.classList.contains('aberto'));
  assert.equal(botao.getAttribute('aria-expanded'), 'true');
  botao.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(!grupo.classList.contains('aberto'));
  botao.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.ok(!grupo.classList.contains('aberto'));
});

// ---------------------------------------------------------------------------
// Perfis de acesso: cada perfil vê só o que é dele
// ---------------------------------------------------------------------------
test('perfisAcesso: recepção vê Clientes (em Vendas) e Chamados (em Assistência Técnica)', async () => {
  const win = await montar('chamados.html', { perfisAcesso: true, chamados: true, estoque: true }, 'recepcao');
  assert.deepEqual(menuDe(win), [
    { Vendas: ['clientes.html'] },
    { 'Assistência Técnica': ['chamados.html'] }
  ]);
});

test('perfisAcesso: técnico de rua vê só Chamados', async () => {
  const win = await montar('chamados.html', { perfisAcesso: true, chamados: true }, 'tecnico');
  assert.deepEqual(menuDe(win), [{ 'Assistência Técnica': ['chamados.html'] }]);
});

test('perfisAcesso: financeiro vê Estoque (guia Catálogo), Chamados e Financeiro na raiz', async () => {
  const win = await montar('financeiro.html', { perfisAcesso: true, chamados: true, financeiro: true, estoque: true }, 'financeiro');
  assert.deepEqual(menuDe(win), [
    { Vendas: ['estoque.html'] },
    { 'Assistência Técnica': ['chamados.html'] },
    'financeiro.html'
  ]);
});

test('perfisAcesso: vendedor vê Vendas e Lead', async () => {
  const win = await montar('pedido.html', { perfisAcesso: true, estoque: true, funisLeads: true }, 'vendedor');
  assert.deepEqual(menuDe(win), [
    { Vendas: ['pedido.html', 'clientes.html', 'estoque.html'] },
    { Lead: ['vendas.html', 'manutencao.html', 'pos-venda.html'] }
  ]);
});

test('perfisAcesso: vendedor abre Estoque e cai direto na guia Catálogo (não tem a guia Peças)', async () => {
  const win = await montar('estoque.html', { perfisAcesso: true, estoque: true, funisLeads: true }, 'vendedor');
  assert.equal(win.__redirecionouPara, 'catalogo.html');
});

test('perfisAcesso: quem abre página fora do perfil vai para a primeira página do menu dele', async () => {
  const win = await montar('usuarios.html', TUDO, 'vendedor');
  assert.equal(win.__redirecionouPara, 'pedido.html');
  const win2 = await montar('financeiro.html', TUDO, 'recepcao');
  assert.equal(win2.__redirecionouPara, 'clientes.html');
});

test('perfisAcesso: a página extra os.html é do módulo chamados e dos perfis de chamado', async () => {
  const ok = await montar('os.html', { perfisAcesso: true, chamados: true }, 'recepcao');
  assert.equal(ok.__redirecionouPara, undefined);
  const negado = await montar('os.html', { perfisAcesso: true, chamados: true }, 'vendedor');
  assert.ok(negado.__redirecionouPara);
});

test('perfisAcesso: trocar-senha é aberta por qualquer perfil', async () => {
  const win = await montar('trocar-senha.html', { perfisAcesso: true }, 'tecnico');
  assert.equal(win.__redirecionouPara, undefined);
});

// ---------------------------------------------------------------------------
// Catálogo como guia dentro de Estoque
// ---------------------------------------------------------------------------
test('sem o módulo estoque, o Catálogo continua no menu e não há guias', async () => {
  const win = await montar('catalogo.html', {});
  assert.ok(todosOsLinks(win).includes('catalogo.html'));
  assert.equal(win.document.getElementById('abas-estoque').hidden, true);
});

test('com estoque ligado: guias Peças e Catálogo, e Estoque fica ativo no menu dentro do Catálogo', async () => {
  const win = await montar('catalogo.html', { estoque: true });
  assert.deepEqual(abasDe(win), ['Peças', 'Catálogo']);
  assert.equal(win.document.querySelector('#abas-estoque a.ativa').textContent, 'Catálogo');
  assert.equal(win.document.querySelector('.admin-nav a.active').getAttribute('href'), 'estoque.html');
  assert.equal(win.__redirecionouPara, undefined);
});

test('perfisAcesso: vendedor vê só a guia Catálogo (barra de guias escondida) e o menu Estoque', async () => {
  const win = await montar('catalogo.html', { perfisAcesso: true, estoque: true }, 'vendedor');
  assert.deepEqual(abasDe(win), ['Catálogo']);
  assert.equal(win.document.getElementById('abas-estoque').hidden, true);
  assert.ok(todosOsLinks(win).includes('estoque.html'));
  assert.equal(win.__redirecionouPara, undefined);
});

test('perfisAcesso: admin vê as duas guias', async () => {
  const win = await montar('estoque.html', { perfisAcesso: true, estoque: true }, 'admin');
  assert.deepEqual(abasDe(win), ['Peças', 'Catálogo']);
});

test('perfisAcesso: técnico não abre o Catálogo', async () => {
  const win = await montar('catalogo.html', { perfisAcesso: true, estoque: true, chamados: true }, 'tecnico');
  assert.ok(win.__redirecionouPara);
});
