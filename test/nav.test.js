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
