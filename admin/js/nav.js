// Gera a navegação do admin a partir de ADMIN_CONFIG.enabledModules.
// Núcleo (Pedido/Clientes/Catálogo) sempre aparece; o resto é opcional por
// cliente. Isso substitui a navegação hardcoded que antes era duplicada em
// cada página .html — pra ligar/desligar um módulo, edita só admin-config.js.
//
// O menu é organizado em grupos (menus suspensos):
//   Dashboard · Vendas ▾ (Pedido, Clientes, Estoque) · Lead ▾ (Vendas, Manutenção, Pós-venda) ·
//   Assistência Técnica ▾ (Chamados, Estoque) · Financeiro · Relatórios · Configuração ▾ (Usuários, Integrações)
// O Estoque aparece em dois grupos (Vendas e Assistência Técnica): é o mesmo item, só com duas portas de entrada.
//
// Com o módulo perfisAcesso ligado, cada link também tem a lista de perfis
// (role) que o enxergam; o admin vê tudo dos módulos ligados. Sem o módulo,
// todo usuário logado vê todos os links (comportamento original do CRP).
// Um grupo sem nenhum link visível não aparece.
var ADMIN_NAV_LINKS = [
  // Raiz
  { href: 'dashboard.html', label: 'Dashboard', modulo: 'funisLeads', perfis: ['atendente'] },
  { href: 'financeiro.html', label: 'Financeiro', modulo: 'financeiro', perfis: ['financeiro'] },
  { href: 'relatorios.html', label: 'Relatórios', modulo: 'chamados', perfis: [] },

  // Grupo Vendas
  { grupo: 'vendas', href: 'pedido.html', label: 'Pedido', perfis: ['atendente', 'vendedor'] },
  { grupo: 'vendas', href: 'clientes.html', label: 'Clientes', perfis: ['atendente', 'vendedor', 'programadora', 'recepcao'] },
  // Com o módulo estoque ligado, o Catálogo vira uma guia dentro de Estoque (ver abas abaixo); sem ele, continua no menu
  { grupo: 'vendas', href: 'catalogo.html', label: 'Catálogo', substituidoPor: 'estoque', perfis: ['atendente', 'vendedor', 'financeiro'] },
  { grupo: 'vendas', href: 'estoque.html', label: 'Estoque', modulo: 'estoque', perfis: ['atendente', 'vendedor', 'financeiro'] },

  // Grupo Lead
  { grupo: 'lead', href: 'leads.html', label: 'Leads', modulo: 'leads', perfis: ['atendente', 'vendedor'] },
  { grupo: 'lead', href: 'vendas.html', label: 'Vendas', modulo: 'funisLeads', perfis: ['atendente', 'vendedor'] },
  { grupo: 'lead', href: 'manutencao.html', label: 'Manutenção', modulo: 'funisLeads', perfis: ['vendedor'] },
  { grupo: 'lead', href: 'pos-venda.html', label: 'Pós-venda', modulo: 'funisLeads', perfis: ['atendente', 'vendedor'] },

  // Grupo Assistência Técnica
  // Chamados (módulo "chamados") substitui a Assistência Técnica simples quando está ligado
  { grupo: 'assistencia', href: 'assistencia-tecnica.html', label: 'Assistência Técnica', modulo: 'assistenciaTecnica', substituidoPor: 'chamados', perfis: ['atendente'] },
  { grupo: 'assistencia', href: 'chamados.html', label: 'Chamados', modulo: 'chamados', perfis: ['programadora', 'recepcao', 'tecnico', 'oficina_interna', 'financeiro'] },
  // cópia do Estoque: só aparece quando há assistência técnica (simples ou chamados)
  { grupo: 'assistencia', href: 'estoque.html', label: 'Estoque', modulo: 'estoque', requerAlgum: ['chamados', 'assistenciaTecnica'], perfis: [] },

  // Grupo Configuração
  { grupo: 'config', href: 'usuarios.html', label: 'Usuários', modulo: 'perfisAcesso', perfis: [] },
  { grupo: 'config', href: 'integracoes.html', label: 'Integrações', modulo: 'apiIntegracao', perfis: [] }
];

var ADMIN_NAV_GRUPOS = [
  { chave: 'vendas', rotulo: 'Vendas' },
  { chave: 'lead', rotulo: 'Lead' },
  { chave: 'assistencia', rotulo: 'Assistência Técnica' },
  { chave: 'config', rotulo: 'Configuração' }
];

// Ordem do menu: link da raiz (nome do arquivo) ou grupo (@chave)
var ADMIN_NAV_ORDEM = ['dashboard.html', '@vendas', '@lead', '@assistencia', 'financeiro.html', 'relatorios.html', '@config'];

// Páginas que não aparecem no menu, mas cada perfil do módulo pode abrir
var ADMIN_PAGINAS_EXTRAS = [
  { pagina: 'trocar-senha', perfis: null }, // qualquer perfil
  { pagina: 'catalogo', modulo: 'estoque', perfis: ['atendente', 'vendedor', 'financeiro'] }, // guia Catálogo dentro de Estoque
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
  if (link.requerAlgum && !link.requerAlgum.some(moduloLigado)) return false;
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

function nomeDaPagina(href) { return href.replace(/\.html$/, ''); }

function paginaPermitidaParaPerfil(pagina, role) {
  var links = ADMIN_NAV_LINKS.filter(function (l) { return nomeDaPagina(l.href) === pagina; });
  var visiveis = linksDoPerfil(role);
  if (links.some(function (l) { return visiveis.indexOf(l) !== -1; })) return true;
  var extra = ADMIN_PAGINAS_EXTRAS.filter(function (e) { return e.pagina === pagina; })[0];
  if (extra) {
    if (!moduloLigado(extra.modulo)) return false;
    if (!extra.perfis || !moduloLigado('perfisAcesso') || role === 'admin') return true;
    return extra.perfis.indexOf(role) !== -1;
  }
  return links.length === 0; // página que não está na navegação: não bloqueia
}

// Guias da área de Estoque: Peças (estoque.html) e Catálogo (catalogo.html). Cada perfil só vê as guias a que tem direito.
var ADMIN_ABAS_ESTOQUE = [
  { href: 'estoque.html', label: 'Peças', perfis: [] },
  { href: 'catalogo.html', label: 'Catálogo', perfis: ['atendente', 'vendedor', 'financeiro'] }
];
function abasDoPerfil(role) {
  return ADMIN_ABAS_ESTOQUE.filter(function (a) {
    return !moduloLigado('perfisAcesso') || role === 'admin' || a.perfis.indexOf(role) !== -1;
  });
}
function renderAbasEstoque(role) {
  var el = document.getElementById('abas-estoque');
  if (!el) return;
  if (!moduloLigado('estoque')) { el.hidden = true; return; }
  var paginaAtual = nomePaginaAtual();
  var abas = abasDoPerfil(role);
  el.hidden = abas.length < 2; // uma guia só não precisa de barra
  el.innerHTML = abas.map(function (a) {
    return '<a href="' + a.href + '"' + (nomeDaPagina(a.href) === paginaAtual ? ' class="ativa"' : '') + '>' + a.label + '</a>';
  }).join('');
}

function linkEstaAtivo(link, paginaAtual) {
  var nome = nomeDaPagina(link.href);
  // dentro da guia Catálogo, o item Estoque do menu fica destacado
  return nome === paginaAtual || (nome === 'estoque' && paginaAtual === 'catalogo' && moduloLigado('estoque'));
}

// primeira página do perfil, na ordem em que aparece no menu (usada quando ele tenta abrir uma página que não é dele)
function primeiraPaginaDoPerfil(role) {
  var visiveis = linksDoPerfil(role);
  for (var i = 0; i < ADMIN_NAV_ORDEM.length; i++) {
    var item = ADMIN_NAV_ORDEM[i];
    var achado = item.charAt(0) === '@'
      ? visiveis.filter(function (l) { return l.grupo === item.slice(1); })[0]
      : visiveis.filter(function (l) { return !l.grupo && l.href === item; })[0];
    if (achado) return achado.href;
  }
  return null;
}

function renderNav(role) {
  var nav = document.querySelector('.admin-nav');
  if (!nav) return;
  var paginaAtual = nomePaginaAtual();
  var visiveis = linksDoPerfil(role);
  renderAbasEstoque(role);

  function htmlLink(link) {
    return '<a href="' + link.href + '"' + (linkEstaAtivo(link, paginaAtual) ? ' class="active"' : '') + '>' + link.label + '</a>';
  }

  nav.innerHTML = ADMIN_NAV_ORDEM.map(function (item) {
    if (item.charAt(0) !== '@') {
      var raiz = visiveis.filter(function (l) { return !l.grupo && l.href === item; })[0];
      return raiz ? htmlLink(raiz) : '';
    }
    var chave = item.slice(1);
    var grupo = ADMIN_NAV_GRUPOS.filter(function (g) { return g.chave === chave; })[0];
    var links = visiveis.filter(function (l) { return l.grupo === chave; });
    if (!grupo || !links.length) return '';
    var ativo = links.some(function (l) { return linkEstaAtivo(l, paginaAtual); });
    return '<div class="nav-grupo' + (ativo ? ' ativo' : '') + '">' +
      '<button type="button" class="nav-grupo-btn" aria-haspopup="true" aria-expanded="false">' + grupo.rotulo + ' <span aria-hidden="true">▾</span></button>' +
      '<div class="nav-menu">' + links.map(htmlLink).join('') + '</div>' +
    '</div>';
  }).join('');
}

// Abre/fecha os menus suspensos (clique, para funcionar também no toque). Um único ouvinte para a página toda.
document.addEventListener('click', function (ev) {
  var botao = ev.target.closest ? ev.target.closest('.nav-grupo-btn') : null;
  var grupos = document.querySelectorAll('.nav-grupo');
  grupos.forEach(function (g) {
    var dono = botao && g.contains(botao);
    var abrir = dono && !g.classList.contains('aberto');
    g.classList.toggle('aberto', !!abrir);
    var b = g.querySelector('.nav-grupo-btn');
    if (b) b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });
});
document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Escape') return;
  document.querySelectorAll('.nav-grupo.aberto').forEach(function (g) { g.classList.remove('aberto'); });
});

// Sem perfis: renderiza já. Com perfis: espera o auth-guard dizer quem é o usuário
// (o auth-guard pode carregar depois deste script, por isso só olha ADMIN_AUTH_READY quando o HTML terminou de carregar).
function iniciarNavComPerfil() {
  if (!window.ADMIN_AUTH_READY) return;
  window.ADMIN_AUTH_READY.then(function (auth) {
    var role = auth && auth.profile && auth.profile.role;
    window.ADMIN_ROLE = role;
    var pagina = nomePaginaAtual();
    if (!paginaPermitidaParaPerfil(pagina, role)) {
      window.__crpIrPara(primeiraPaginaDoPerfil(role) || 'login.html');
      return;
    }
    if (pagina === 'estoque' && abasDoPerfil(role).filter(function (a) { return a.href === 'estoque.html'; }).length === 0) {
      window.__crpIrPara('catalogo.html');
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
  var links = ADMIN_NAV_LINKS.filter(function (l) { return nomeDaPagina(l.href) === paginaAtual; });
  var extra = ADMIN_PAGINAS_EXTRAS.filter(function (e) { return e.pagina === paginaAtual; })[0];
  var abertaComoExtra = extra && moduloLigado(extra.modulo); // ex: catalogo.html vira guia de Estoque
  if (links.length && !links.some(linkDisponivel) && !abertaComoExtra) {
    window.__crpIrPara('pedido.html');
  }
})();
