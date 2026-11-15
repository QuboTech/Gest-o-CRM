// Testa admin/js/leads.js com jsdom + um supabaseClient simulado em memória
// (sem rede, sem projeto real). Roda com: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const LEADS_HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'leads.html'), 'utf8');
const LEADS_JS = fs.readFileSync(path.join(__dirname, '..', 'admin', 'js', 'leads.js'), 'utf8');

// Fake supabase-js só com o pedacinho de query builder que leads.js usa
// (select/order/eq/or/insert/update/delete), guardando os leads num array
// em memória — equivalente aos "dados simulados" pedidos, sem tocar em
// nenhum projeto Supabase real.
function criarSupabaseFake(linhasIniciais) {
  var linhas = linhasIniciais.slice();

  function builder(tabela) {
    var filtros = [];
    var ordens = [];
    var api = {
      select: function () { return api; },
      order: function (campo, opts) { ordens.push({ campo: campo, asc: !opts || opts.ascending !== false }); return api; },
      eq: function (campo, valor) { filtros.push(function (l) { return l[campo] === valor; }); return api; },
      or: function (expr) {
        // "nome.ilike.%termo%,numero.ilike.%termo%" -> extrai o termo e casa com OR
        var termo = (expr.match(/%([^%]*)%/) || [, ''])[1].toLowerCase();
        filtros.push(function (l) {
          return (l.nome || '').toLowerCase().includes(termo) || (l.numero || '').toLowerCase().includes(termo);
        });
        return api;
      },
      insert: function (payload) {
        var novo = Object.assign({ id: 'id-' + (linhas.length + 1) }, payload);
        linhas.push(novo);
        return Promise.resolve({ data: novo, error: null });
      },
      update: function (payload) {
        return {
          eq: function (campo, valor) {
            var linha = linhas.find(function (l) { return l[campo] === valor; });
            if (linha) Object.assign(linha, payload);
            return Promise.resolve({ data: linha, error: null });
          }
        };
      },
      delete: function () {
        return {
          eq: function (campo, valor) {
            linhas = linhas.filter(function (l) { return l[campo] !== valor; });
            return Promise.resolve({ data: null, error: null });
          }
        };
      },
      then: function (resolve) {
        var resultado = linhas.filter(function (l) { return filtros.every(function (f) { return f(l); }); });
        ordens.forEach(function (o) {
          resultado.sort(function (a, b) {
            if (a[o.campo] === b[o.campo]) return 0;
            var cmp = a[o.campo] > b[o.campo] ? 1 : -1;
            return o.asc ? cmp : -cmp;
          });
        });
        resolve({ data: resultado, error: null });
      }
    };
    return api;
  }

  return { from: builder, _linhas: function () { return linhas; } };
}

function montarPaginaLeads(linhasIniciais) {
  const dom = new JSDOM(LEADS_HTML, { url: 'https://cliente-teste.exemplo/admin/leads.html', runScripts: 'outside-only' });
  const win = dom.window;

  win.ADMIN_CONFIG = { enabledModules: { leads: true } };
  win.supabaseClient = criarSupabaseFake(linhasIniciais || []);
  win.showToast = function () {}; // toast.js não é essencial pro teste
  win.ADMIN_AUTH_READY = Promise.resolve({ session: { user: { id: 'user-teste' } }, profile: {} });
  win.confirm = function () { return true; };

  win.eval(LEADS_JS);
  return win;
}

test('lead novo sem nome e sem número é rejeitado com mensagem de erro', async () => {
  const win = montarPaginaLeads([]);
  await win.ADMIN_AUTH_READY;
  await new Promise((r) => setTimeout(r, 0)); // deixa o IIFE de init rodar

  win.document.getElementById('data_contato').value = '2026-11-10';
  win.document.getElementById('lead-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));

  const erro = win.document.getElementById('lead-error');
  assert.equal(erro.style.display, 'block');
  assert.match(erro.textContent, /nome ou o número/);
});

test('mensagem final desabilita e zera o campo de tentativas', () => {
  const win = montarPaginaLeads([]);
  const checkbox = win.document.getElementById('mensagem_final');
  const campoTentativas = win.document.getElementById('tentativas_contato');

  campoTentativas.value = '5';
  checkbox.checked = true;
  checkbox.dispatchEvent(new win.Event('change'));

  assert.equal(campoTentativas.disabled, true);
  assert.equal(campoTentativas.value, '');
});

test('salvar lead válido grava no supabaseClient simulado com os campos certos', async () => {
  const win = montarPaginaLeads([]);
  await win.ADMIN_AUTH_READY;
  await new Promise((r) => setTimeout(r, 0));

  win.document.getElementById('data_contato').value = '2026-11-10';
  win.document.getElementById('nome').value = 'Maria Teste';
  win.document.getElementById('numero').value = '11999990000';
  win.document.getElementById('canal_aquisicao').value = 'Instagram';
  win.document.getElementById('status').value = 'Qualificado';
  win.document.getElementById('tentativas_contato').value = '2';
  win.document.getElementById('quem_atendeu').value = 'Equipe Teste';

  win.document.getElementById('lead-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));

  const salvos = win.supabaseClient._linhas();
  assert.equal(salvos.length, 1);
  assert.equal(salvos[0].nome, 'Maria Teste');
  assert.equal(salvos[0].canal_aquisicao, 'Instagram');
  assert.equal(salvos[0].status, 'Qualificado');
  assert.equal(salvos[0].tentativas_contato, 2);
  assert.equal(salvos[0].mensagem_final, false);
  assert.equal(salvos[0].created_by, 'user-teste');

  // confirma que não sobrou nenhum dado real/sensível no teste — só o que o teste colocou
  assert.equal(salvos[0].numero, '11999990000');
});

test('tabela renderiza badge de status e respeita busca por nome', async () => {
  const win = montarPaginaLeads([
    { id: 'l1', data_contato: '2026-11-01', nome: 'Ana Fake', numero: '11900000001', status: 'Qualificado', canal_aquisicao: 'Indicação', tentativas_contato: 1, mensagem_final: false, quem_atendeu: 'Equipe Teste' },
    { id: 'l2', data_contato: '2026-11-02', nome: 'Bruno Fake', numero: '11900000002', status: 'Desqualificado', canal_aquisicao: 'Meta ads', tentativas_contato: 3, mensagem_final: false, quem_atendeu: 'Equipe Teste' }
  ]);
  await win.ADMIN_AUTH_READY;
  await new Promise((r) => setTimeout(r, 0));

  let linhas = win.document.querySelectorAll('#leads-tbody tr');
  assert.equal(linhas.length, 2);
  assert.match(win.document.querySelector('#leads-tbody .badge-ok').textContent, /Qualificado/);
  assert.match(win.document.querySelector('#leads-tbody .badge-danger').textContent, /Desqualificado/);

  win.document.getElementById('lead-search').value = 'Ana';
  win.document.getElementById('lead-search').dispatchEvent(new win.Event('input'));
  await new Promise((r) => setTimeout(r, 350)); // debounce de 300ms

  linhas = win.document.querySelectorAll('#leads-tbody tr');
  assert.equal(linhas.length, 1);
  assert.match(linhas[0].textContent, /Ana Fake/);
});
