// Inclua este script em toda página do admin, EXCETO login.html.
// Garante: sessão válida + troca de senha obrigatória cumprida.
// Expõe window.ADMIN_AUTH_READY (Promise) que resolve com { session, profile }
// depois que o guard concluiu (só chega lá se a página não foi redirecionada).

// Normaliza o nome da página independente de ".html" estar presente na URL
// (servidores estáticos costumam remover a extensão, ex: /admin/trocar-senha).
var CURRENT_PAGE = location.pathname.split('/').pop().replace(/\.html$/, '');

// Celular/tablet? (iPadOS se apresenta como Mac, por isso o teste de toque). Usado pelo módulo chamados.
function ehCelular() {
  var ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
// ?desktop=1 força o sistema completo no celular (vale só nesta aba)
if (/[?&]desktop=1/.test(location.search)) { try { sessionStorage.setItem('crm_forcar_desktop', '1'); } catch (e) {} }
function forcouDesktop() { try { return sessionStorage.getItem('crm_forcar_desktop') === '1'; } catch (e) { return false; } }

window.ADMIN_AUTH_READY = (async function () {
  var { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    location.replace('login.html');
    return new Promise(function () {}); // nunca resolve, a navegação já está saindo da página
  }

  var { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    await supabaseClient.auth.signOut();
    location.replace('login.html');
    return new Promise(function () {});
  }

  // Módulo chamados: técnico, oficina interna e admin no celular usam o app (/app/), que já trata a troca de senha.
  var modulosCfg = (window.ADMIN_CONFIG && ADMIN_CONFIG.enabledModules) || {};
  if (modulosCfg.chamados && ['tecnico', 'oficina_interna', 'admin'].indexOf(profile.role) !== -1 && ehCelular() && !forcouDesktop()) {
    location.replace('../app/');
    return new Promise(function () {});
  }

  if (profile.must_change_password && CURRENT_PAGE !== 'trocar-senha') {
    location.replace('trocar-senha.html');
    return new Promise(function () {});
  }

  // Não usar DOMContentLoaded aqui: como este código já passou por vários
  // awaits, o DOM certamente já está pronto — e o evento pode já ter disparado
  // antes de chegarmos aqui, o que faria o listener nunca executar.
  var nameEls = document.querySelectorAll('[data-user-name]');
  nameEls.forEach(function (el) { el.textContent = profile.nome_exibicao; });

  var logoutBtns = document.querySelectorAll('[data-logout]');
  logoutBtns.forEach(function (btn) {
    btn.addEventListener('click', async function () {
      try { sessionStorage.removeItem('crm_forcar_desktop'); } catch (e) {}
      await supabaseClient.auth.signOut();
      location.replace('login.html');
    });
  });

  window.ADMIN_ROLE = profile.role; // usado pelos módulos com perfis (perfisAcesso)
  return { session: session, profile: profile };
})();
