// Configuração do portal administrativo. A anon/publishable key é pública por
// design — a segurança real vem das políticas RLS no banco (só authenticated).
var ADMIN_CONFIG = {
  supabaseUrl: 'https://mpenhzpdjadnyahbegeo.supabase.co',
  supabaseAnonKey: 'sb_publishable_Q47PiKObRbcNe_XZjMt8Xw_LD2dRCmj',
  syntheticEmailDomain: '@gestaocrm.internal'
};

// Dados da empresa que usa este sistema (aparecem nos impressos). Preencher por cliente.
var EMPRESA_CONFIG = { nome: 'Gestão CRM', cnpj: '', endereco: '' };
