// BRANCH DEMO: aponta para o banco de teste (oficina-das-balancas) e liga os módulos da Oficina. Não fazer merge na main.
// Configuração do portal administrativo. A anon/publishable key é pública por
// design — a segurança real vem das políticas RLS no banco (só authenticated).
var ADMIN_CONFIG = {
  supabaseUrl: 'https://sgnohhnnwptzvjfwypwj.supabase.co',
  supabaseAnonKey: 'sb_publishable_RReMC30xMQFLxcoiAZqBwQ_JLV39mbT',
  syntheticEmailDomain: '@gestaocrm.internal',
  // Módulos ligados neste cliente. Ver sql/README.md e CHECKLIST-NOVO-CLIENTE.md.
  // Núcleo (crm) não tem chave aqui porque está sempre ligado.
  enabledModules: {
    estoque: true,
    assistenciaTecnica: true,
    assistenciaSeloLacre: false, // submódulo: selos/lacres de metrologia legal (ex: balanças)
    pedidosVacuo: false,         // submódulo: itens de embalagem a vácuo
    financeiro: true,
    leads: false,
    // Módulos vindos do CRM da Oficina (ver sql/010 a 013):
    perfisAcesso: true, // perfis (admin, atendente, vendedor, financeiro, tecnico...) com segurança no banco; liga a tela Usuários
    funisLeads: true,   // funis Vendas/Manutenção/Pós-venda + Dashboard (exige perfisAcesso)
    chamados: true,     // Chamados (campo/oficina), OS, Relatórios; substitui a Assistência Técnica (exige perfisAcesso e estoque)
    apiIntegracao: true // tela Integrações + API somente leitura em /api/v1 (exige perfisAcesso)
  }
};

// Dados da empresa que usa este sistema — aparecem nos impressos (pedido,
// orçamento, assistência técnica). Ao clonar este sistema base para um
// cliente novo, é só preencher aqui: nenhum outro arquivo tem esses dados
// fixos no código.
var EMPRESA_CONFIG = {
  nome: 'CRP',
  cnpj: '',
  endereco: '',
  chavePix: ''
};
