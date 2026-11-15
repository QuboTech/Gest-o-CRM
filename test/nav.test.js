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
  <div id="card-vacuo" data-requires-module="pedidosVacuo">vacuo</div>
  <div id="bloco-selo-lacre" data-requires-module="assistenciaSeloLacre">selo/lacre</div>
</body></html>`;

function montarPagina(urlPath, enabledModules) {
  const dom = new JSDOM(PAGE_HTML, {
    url: 'https://cliente-teste.exemplo/admin/' + urlPath,
    runScripts: 'outside-only'
  });
  dom.window.ADMIN_CONFIG = { enabledModules: enabledModules || {} };
  // jsdom não deixa sobrescrever location.replace (é read-only de verdade);
  // usamos o ponto de interceptação __crpIrPara que nav.js expõe pra isso.
  dom.window.__crpIrPara = (url) => { dom.window.__redirecionouPara = url; };
  dom.window.eval(NAV_JS);
  return dom.window;
}

test('núcleo (Pedido/Clientes/Catálogo) sempre aparece, mesmo com tudo desligado', () => {
  const win = montarPagina('pedido.html', {});
  const hrefs = [...win.document.querySelectorAll('.admin-nav a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['pedido.html', 'clientes.html', 'catalogo.html']);
});

test('módulos opcionais aparecem só quando ligados em ADMIN_CONFIG.enabledModules', () => {
  const win = montarPagina('pedido.html', { estoque: true, financeiro: true, leads: true });
  const hrefs = [...win.document.querySelectorAll('.admin-nav a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(hrefs, [
    'pedido.html', 'clientes.html', 'catalogo.html',
    'estoque.html', 'financeiro.html', 'leads.html'
  ]);
});

test('link da página atual recebe class="active"', () => {
  const win = montarPagina('clientes.html', { estoque: true });
  const ativo = win.document.querySelector('.admin-nav a.active');
  assert.equal(ativo.getAttribute('href'), 'clientes.html');
});

test('submódulo pedidosVacuo: bloco fica oculto quando desligado (padrão)', () => {
  const win = montarPagina('pedido.html', {});
  assert.equal(win.document.getElementById('card-vacuo').hidden, true);
});

test('submódulo pedidosVacuo: bloco aparece quando ligado explicitamente', () => {
  const win = montarPagina('pedido.html', { pedidosVacuo: true });
  assert.equal(win.document.getElementById('card-vacuo').hidden, false);
});

test('submódulo assistenciaSeloLacre: oculto por padrão, visível quando ligado', () => {
  const desligado = montarPagina('assistencia-tecnica.html', { assistenciaTecnica: true });
  assert.equal(desligado.document.getElementById('bloco-selo-lacre').hidden, true);

  const ligado = montarPagina('assistencia-tecnica.html', { assistenciaTecnica: true, assistenciaSeloLacre: true });
  assert.equal(ligado.document.getElementById('bloco-selo-lacre').hidden, false);
});

test('acesso direto a módulo desligado redireciona pro núcleo (pedido.html)', () => {
  const win = montarPagina('leads.html', { estoque: true }); // leads não está ligado
  assert.equal(win.__redirecionouPara, 'pedido.html');
});

test('acesso a módulo ligado NÃO redireciona', () => {
  const win = montarPagina('leads.html', { leads: true });
  assert.equal(win.__redirecionouPara, undefined);
});

// ---------------------------------------------------------------------------
// Módulos vindos do CRM da Oficina (perfisAcesso, chamados, funisLeads, apiIntegracao)
// ---------------------------------------------------------------------------
function montarPaginaComPerfil(urlPath, enabledModules, role) {
  const dom = new JSDOM(PAGE_HTML, {
    url: 'https://cliente-teste.exemplo/admin/' + urlPath,
    runScripts: 'outside-only'
  });
  dom.window.ADMIN_CONFIG = { enabledModules };
  dom.window.ADMIN_AUTH_READY = Promise.resolve({ profile: { role } });
  dom.window.__crpIrPara = (url) => { dom.window.__redirecionouPara = url; };
  dom.window.eval(NAV_JS);
  return dom.window.ADMIN_AUTH_READY.then(() => new Promise((r) => setImmediate(() => r(dom.window))));
}
const hrefsDe = (win) => [...win.document.querySelectorAll('.admin-nav a')].map((a) => a.getAttribute('href'));

test('chamados substitui a Assistência Técnica simples quando está ligado', () => {
  const win = montarPagina('pedido.html', { assistenciaTecnica: true, chamados: true });
  const hrefs = hrefsDe(win);
  assert.ok(hrefs.includes('chamados.html'));
  assert.ok(!hrefs.includes('assistencia-tecnica.html'));
});

test('sem perfisAcesso, todo usuário vê todos os links dos módulos ligados (comportamento original)', () => {
  const win = montarPagina('pedido.html', { estoque: true, funisLeads: true });
  assert.deepEqual(hrefsDe(win), [
    'pedido.html', 'clientes.html', 'catalogo.html', 'estoque.html',
    'dashboard.html', 'vendas.html', 'manutencao.html', 'pos-venda.html'
  ]);
});

test('perfisAcesso: admin vê todos os links dos módulos ligados', async () => {
  const win = await montarPaginaComPerfil('pedido.html', { perfisAcesso: true, chamados: true, estoque: true, apiIntegracao: true }, 'admin');
  assert.deepEqual(hrefsDe(win), [
    'pedido.html', 'clientes.html', 'catalogo.html', 'estoque.html',
    'chamados.html', 'relatorios.html', 'usuarios.html', 'integracoes.html'
  ]);
});

test('perfisAcesso: recepção vê só Clientes e Chamados', async () => {
  const win = await montarPaginaComPerfil('chamados.html', { perfisAcesso: true, chamados: true, estoque: true }, 'recepcao');
  assert.deepEqual(hrefsDe(win), ['clientes.html', 'chamados.html']);
});

test('perfisAcesso: técnico de rua vê só Chamados', async () => {
  const win = await montarPaginaComPerfil('chamados.html', { perfisAcesso: true, chamados: true }, 'tecnico');
  assert.deepEqual(hrefsDe(win), ['chamados.html']);
});

test('perfisAcesso: financeiro vê Catálogo, Financeiro e Chamados', async () => {
  const win = await montarPaginaComPerfil('financeiro.html', { perfisAcesso: true, chamados: true, financeiro: true }, 'financeiro');
  assert.deepEqual(hrefsDe(win), ['catalogo.html', 'financeiro.html', 'chamados.html']);
});

test('perfisAcesso: vendedor não abre Estoque (vai para a primeira página do perfil)', async () => {
  const win = await montarPaginaComPerfil('estoque.html', { perfisAcesso: true, estoque: true, funisLeads: true }, 'vendedor');
  assert.equal(win.__redirecionouPara, 'pedido.html');
});

test('perfisAcesso: a página extra os.html é do módulo chamados e dos perfis de chamado', async () => {
  const ok = await montarPaginaComPerfil('os.html', { perfisAcesso: true, chamados: true }, 'recepcao');
  assert.equal(ok.__redirecionouPara, undefined);
  const negado = await montarPaginaComPerfil('os.html', { perfisAcesso: true, chamados: true }, 'vendedor');
  assert.ok(negado.__redirecionouPara);
});

test('perfisAcesso: trocar-senha é aberta por qualquer perfil', async () => {
  const win = await montarPaginaComPerfil('trocar-senha.html', { perfisAcesso: true }, 'tecnico');
  assert.equal(win.__redirecionouPara, undefined);
});
