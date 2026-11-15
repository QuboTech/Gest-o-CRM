// Gera a navegação do admin a partir de ADMIN_CONFIG.enabledModules.
// Núcleo (Pedido/Clientes/Catálogo) sempre aparece; o resto é opcional por
// cliente. Isso substitui a navegação hardcoded que antes era duplicada em
// cada página .html — pra ligar/desligar um módulo, edita só admin-config.js.
//
// Com o módulo perfisAcesso ligado, cada link também tem a lista de perfis
// (role) que o enxergam; o admin vê tudo dos módulos ligados. Sem o módulo,
// todo usuário logado vê todos os links (comportamento original do CRP).
var ADMIN_NAV_LINKS = [
  { href: 'pedido.html', label: 'Pedido', perfis: ['atendente', 'vendedor'] },
  { href: 'clientes.html', label: 'Clientes', perfis: ['atendente', 'vendedor', 'programadora', 'recepcao'] },
  { href: 'catalogo.html', label: 'Catálogo', perfis: ['atendente', 'vendedor', 'financeiro'] },
  // Chamados (módulo "chamados") substitui a Assistência Técnica simples quando está ligado
  { href: 'assistencia-tecnica.html', label: 'Assistência Técnica', modulo: 'assistenciaTecnica', substituidoPor: 'chamados', perfis: ['atendente'] },
  { href: 'estoque.html', label: 'Estoque', modulo: 'estoque', perfis: [] },
  { href: 'financeiro.html', label: 'Financeiro', modulo: 'financeiro', perfis: ['financeiro'] },
  { href: 'leads.html', label: 'Leads', modulo: 'leads', perfis: ['atendente', 'vendedor'] },
  // módulos criados a partir do CRM da Oficina
  { href: 'dashboard.html', label: 'Dashboard', modulo: 'funisLeads', perfis: ['atendente'] },
  { href: 'vendas.html', label: 'Vendas', modulo: 'funisLeads', perfis: ['atendente', 'vendedor'] },
  { href: 'manutencao.html', label: 'Manutenção', modulo: 'funisLeads', perfis: ['vendedor'] },
  { href: 'pos-venda.html', label: 'Pós-venda', modulo: 'funisLeads', perfis: ['atendente', 'vendedor'] },
  { href: 'chamados.html', label: 'Chamados', modulo: 'chamados', perfis: ['programadora', 'recepcao', 'tecnico', 'oficina_interna', 'financeiro'] },
  { href: 'relatorios.html', label: 'Relatórios', modulo: 'chamados', perfis: [] },
  { href: 'usuarios.html', label: 'Usuários', modulo: 'perfisAcesso', perfis: [] },
  { href: 'integracoes.html', label: 'Integrações', modulo: 'apiIntegracao', perfis: [] }
];

// Páginas que não aparecem no menu, mas cada perfil do módulo pode abrir
var ADMIN_PAGINAS_EXTRAS = [
  { pagina: 'trocar-senha', perfis: null }, // qualquer perfil
  { pagina: 'os', modulo: 'chamados', perfis: ['programadora', 'recepcao', 'tecnico', 'oficina_interna', 'financeiro'] }
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

function linkDisponivel(link) {
  if (!moduloLigado(link.modulo)) return false;
  if (link.substituidoPor && moduloLigado(link.substituidoPor)) return false;
  return true;
}

// links que o perfil enxerga (sem o módulo perfisAcesso, todos os disponíveis)
function linksDoPerfil(role) {
  return ADMIN_NAV_LINKS.filter(function (link) {
    if (!linkDisponivel(link)) return false;
    if (!moduloLigado('perfisAcesso') || role === 'admin') return true;
    return (link.perfis || []).indexOf(role) !== -1;
  });
}

function paginaPermitidaParaPerfil(pagina, role) {
  var link = ADMIN_NAV_LINKS.filter(function (l) { return l.href.replace(/\.html$/, '') === pagina; })[0];
  if (link) return linksDoPerfil(role).indexOf(link) !== -1;
  var extra = ADMIN_PAGINAS_EXTRAS.filter(function (e) { return e.pagina === pagina; })[0];
  if (!extra) return true; // página desconhecida: não bloqueia
  if (!moduloLigado(extra.modulo)) return false;
  if (!extra.perfis || !moduloLigado('perfisAcesso') || role === 'admin') return true;
  return extra.perfis.indexOf(role) !== -1;
}

function renderNav(role) {
  var nav = document.querySelector('.admin-nav');
  if (!nav) return;
  var paginaAtual = nomePaginaAtual();
  nav.innerHTML = linksDoPerfil(role).map(function (link) {
    var nomeLink = link.href.replace(/\.html$/, '');
    return '<a href="' + link.href + '"' + (nomeLink === paginaAtual ? ' class="active"' : '') + '>' + link.label + '</a>';
  }).join('');
}

// Sem perfis: renderiza já. Com perfis: espera o auth-guard dizer quem é o usuário
// (o auth-guard pode carregar depois deste script, por isso só olha ADMIN_AUTH_READY quando o HTML terminou de carregar).
function iniciarNavComPerfil() {
  if (!window.ADMIN_AUTH_READY) return;
  window.ADMIN_AUTH_READY.then(function (auth) {
    var role = auth && auth.profile && auth.profile.role;
    window.ADMIN_ROLE = role;
    var pagina = nomePaginaAtual();
    if (!paginaPermitidaParaPerfil(pagina, role)) {
      var primeiro = linksDoPerfil(role)[0];
      window.__crpIrPara(primeiro ? primeiro.href : 'login.html');
      return;
    }
    renderNav(role);
  });
}
if (!moduloLigado('perfisAcesso')) {
  renderNav(null);
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarNavComPerfil);
} else {
  iniciarNavComPerfil();
}

// Oculta qualquer elemento marcado com data-requires-module="nomeDoModulo"
// quando esse módulo (ou submódulo, ex: pedidosVacuo / assistenciaSeloLacre)
// está desligado neste cliente. Os campos continuam existindo no DOM (só
// escondidos), então o JS da página pode ler/gravar neles sem checagem extra.
(function ocultarBlocosDeModuloDesligado() {
  document.querySelectorAll('[data-requires-module]').forEach(function (el) {
    if (!moduloLigado(el.dataset.requiresModule)) el.hidden = true;
  });
  // o contrário: bloco que só vale enquanto o módulo está DESLIGADO (ex: versão simples da tabela)
  document.querySelectorAll('[data-hidden-with-module]').forEach(function (el) {
    if (moduloLigado(el.dataset.hiddenWithModule)) el.hidden = true;
  });
})();

// Se a página atual pertence a um módulo desligado neste cliente (ex: acesso
// direto pela URL), manda pro núcleo em vez de deixar a página "fantasma" aberta.
(function protegerPaginaDeModuloDesligado() {
  var paginaAtual = nomePaginaAtual();
  var link = ADMIN_NAV_LINKS.filter(function (l) {
    return l.href.replace(/\.html$/, '') === paginaAtual;
  })[0];
  if (link && !linkDisponivel(link)) {
    window.__crpIrPara('pedido.html');
  }
})();
