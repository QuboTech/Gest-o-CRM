// MÓDULOS E MENU POR PERFIL — fonte única de "quem vê o quê".
// Para vender os módulos separados, basta desligar o que o cliente não contratou (true/false).
// Os dados são do mesmo banco: ligar um módulo depois não exige migração.
var MODULOS_ATIVOS = {
  comercial: true, // Pedidos/Orçamentos, Catálogo, Financeiro, Calculadora de custo
  chamados: true,  // Chamados (campo e oficina), Estoque, Relatórios, OS, app do celular
  leads: true      // Funis de Leads: Vendas, Manutenção, Pós-venda, Dashboard
};

// pagina = nome do arquivo sem .html; modulo = 'core' (sempre) ou um dos módulos acima;
// perfis = quem vê (o admin vê tudo dos módulos ativos).
var MENU_ITENS = [
  { pagina: 'dashboard',  rotulo: 'Dashboard',            modulo: 'leads',     perfis: ['atendente'] },
  { pagina: 'vendas',     rotulo: 'Vendas',               modulo: 'leads',     perfis: ['atendente', 'vendedor'] },
  { pagina: 'manutencao', rotulo: 'Manutenção',           modulo: 'leads',     perfis: ['vendedor'] },
  { pagina: 'pos-venda',  rotulo: 'Pós-venda',            modulo: 'leads',     perfis: ['atendente', 'vendedor'] },
  { pagina: 'pedido',     rotulo: 'Pedido',               modulo: 'comercial', perfis: ['atendente', 'vendedor'] },
  { pagina: 'financeiro', rotulo: 'Financeiro',           modulo: 'comercial', perfis: ['financeiro'] },
  { pagina: 'catalogo',   rotulo: 'Catálogo',             modulo: 'comercial', perfis: ['atendente', 'vendedor', 'financeiro'] },
  { pagina: 'calculadora-custo', rotulo: 'Calculadora de Custo', modulo: 'comercial', perfis: ['atendente', 'vendedor'] },
  { pagina: 'chamados',   rotulo: 'Chamados',             modulo: 'chamados',  perfis: ['programadora', 'recepcao', 'tecnico', 'oficina_interna', 'financeiro'] },
  { pagina: 'relatorios', rotulo: 'Relatórios',           modulo: 'chamados',  perfis: [] },
  { pagina: 'estoque',    rotulo: 'Estoque',              modulo: 'chamados',  perfis: [] },
  { pagina: 'clientes',   rotulo: 'Clientes',             modulo: 'core',      perfis: ['atendente', 'vendedor', 'programadora', 'recepcao'] },
  { pagina: 'usuarios',   rotulo: 'Usuários',             modulo: 'core',      perfis: [] },
  { pagina: 'integracoes', rotulo: 'Integrações',         modulo: 'core',      perfis: [] }
];

// páginas do módulo Chamados que não aparecem no menu, mas estes perfis podem abrir
var PERFIS_EXTRAS_CHAMADOS = ['admin', 'tecnico', 'oficina_interna', 'programadora', 'recepcao', 'financeiro'];

function moduloAtivo(m) { return m === 'core' || MODULOS_ATIVOS[m] === true; }

function itensDoPerfil(role) {
  return MENU_ITENS.filter(function (i) {
    return moduloAtivo(i.modulo) && (role === 'admin' || i.perfis.indexOf(role) !== -1);
  });
}

function paginasPermitidas(role) {
  var paginas = itensDoPerfil(role).map(function (i) { return i.pagina; });
  paginas.push('trocar-senha');
  if (MODULOS_ATIVOS.chamados && PERFIS_EXTRAS_CHAMADOS.indexOf(role) !== -1) paginas.push('os', 'assistencia-tecnica');
  return paginas;
}

// primeira tela do perfil (depois do login e quando tenta abrir uma página fora do perfil)
function paginaInicial(role) {
  var itens = itensDoPerfil(role);
  return (itens.length ? itens[0].pagina : 'login') + '.html';
}

// monta o menu em <nav class="admin-nav" data-menu>
function montarMenu(role) {
  var nav = document.querySelector('[data-menu]');
  if (!nav) return;
  var atual = location.pathname.split('/').pop().replace(/\.html$/, '');
  nav.innerHTML = itensDoPerfil(role).map(function (i) {
    return '<a href="' + i.pagina + '.html"' + (i.pagina === atual ? ' class="active"' : '') + '>' + i.rotulo + '</a>';
  }).join('');
}
