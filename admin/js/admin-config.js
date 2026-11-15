// Configuração do portal administrativo. A anon/publishable key é pública por
// design — a segurança real vem das políticas RLS no banco (só authenticated).
var ADMIN_CONFIG = {
  supabaseUrl: 'https://mpenhzpdjadnyahbegeo.supabase.co',
  supabaseAnonKey: 'sb_publishable_Q47PiKObRbcNe_XZjMt8Xw_LD2dRCmj',
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
    perfisAcesso: false, // perfis (admin, atendente, vendedor, financeiro, tecnico...) com segurança no banco; liga a tela Usuários
    funisLeads: false,   // funis Vendas/Manutenção/Pós-venda + Dashboard (exige perfisAcesso)
    chamados: false,     // Chamados (campo/oficina), OS, Relatórios; substitui a Assistência Técnica (exige perfisAcesso e estoque)
    apiIntegracao: false // tela Integrações + API somente leitura em /api/v1 (exige perfisAcesso)
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
