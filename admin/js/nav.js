// Gera a navegação do admin a partir de ADMIN_CONFIG.enabledModules.
// Núcleo (Pedido/Clientes/Catálogo) sempre aparece; o resto é opcional por
// cliente. Isso substitui a navegação hardcoded que antes era duplicada em
// cada página .html — pra ligar/desligar um módulo, edita só admin-config.js.
var ADMIN_NAV_LINKS = [
  { href: 'pedido.html', label: 'Pedido' },
  { href: 'clientes.html', label: 'Clientes' },
  { href: 'catalogo.html', label: 'Catálogo' },
  { href: 'assistencia-tecnica.html', label: 'Assistência Técnica', modulo: 'assistenciaTecnica' },
  { href: 'estoque.html', label: 'Estoque', modulo: 'estoque' },
  { href: 'financeiro.html', label: 'Financeiro', modulo: 'financeiro' },
  { href: 'leads.html', label: 'Leads', modulo: 'leads' }
];

function nomePaginaAtual() {
  return location.pathname.split('/').pop().replace(/\.html$/, '') || 'pedido';
}

// Indireção pequena só pra dar um ponto de interceptação em teste (jsdom não
// permite sobrescrever location.replace); em produção chama location.replace de verdade.
window.__crpIrPara = window.__crpIrPara || function (url) { location.replace(url); };

function moduloLigado(nomeModulo) {
  if (!nomeModulo) return true; // núcleo: sem módulo = sempre ligado
  var modulos = (window.ADMIN_CONFIG && ADMIN_CONFIG.enabledModules) || {};
  return !!modulos[nomeModulo];
}

(function renderNav() {
  var nav = document.querySelector('.admin-nav');
  if (!nav) return;
  var paginaAtual = nomePaginaAtual();

  nav.innerHTML = ADMIN_NAV_LINKS.filter(function (link) {
    return moduloLigado(link.modulo);
  }).map(function (link) {
    var nomeLink = link.href.replace(/\.html$/, '');
    return '<a href="' + link.href + '"' + (nomeLink === paginaAtual ? ' class="active"' : '') + '>' + link.label + '</a>';
  }).join('');
})();

// Oculta qualquer elemento marcado com data-requires-module="nomeDoModulo"
// quando esse módulo (ou submódulo, ex: pedidosVacuo / assistenciaSeloLacre)
// está desligado neste cliente. Os campos continuam existindo no DOM (só
// escondidos), então o JS da página pode ler/gravar neles sem checagem extra.
(function ocultarBlocosDeModuloDesligado() {
  document.querySelectorAll('[data-requires-module]').forEach(function (el) {
    if (!moduloLigado(el.dataset.requiresModule)) el.hidden = true;
  });
})();

// Se a página atual pertence a um módulo desligado neste cliente (ex: acesso
// direto pela URL), manda pro núcleo em vez de deixar a página "fantasma" aberta.
(function protegerPaginaDeModuloDesligado() {
  var paginaAtual = nomePaginaAtual();
  var link = ADMIN_NAV_LINKS.filter(function (l) {
    return l.href.replace(/\.html$/, '') === paginaAtual;
  })[0];
  if (link && !moduloLigado(link.modulo)) {
    window.__crpIrPara('pedido.html');
  }
})();
