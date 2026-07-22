// Configuração do portal administrativo. A anon/publishable key é pública por
// design — a segurança real vem das políticas RLS no banco (só authenticated).
var ADMIN_CONFIG = {
  supabaseUrl: 'https://agtlqmbhkajsxdpeqviq.supabase.co',
  supabaseAnonKey: 'sb_publishable_oewjlw01Gkkn8WSeLFczwA_pLbiDXnA',
  syntheticEmailDomain: '@hln.internal'
};
