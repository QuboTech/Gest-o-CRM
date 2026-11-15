// Inclua este script em toda página do admin, EXCETO login.html (e depois de modulos.js).
// Garante: sessão válida + troca de senha obrigatória cumprida + perfil com acesso à página (conforme modulos.js).
// Expõe window.ADMIN_AUTH_READY (Promise) que resolve com { session, profile } depois que o guard concluiu.

// Normaliza o nome da página independente de ".html" estar presente na URL
var CURRENT_PAGE = location.pathname.split('/').pop().replace(/\.html$/, '');

// Celular/tablet? (iPadOS se apresenta como Mac, por isso o teste de toque)
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

  // Módulo Chamados: técnico, oficina interna e admin no celular usam o app (/app/), que já trata a troca de senha.
  if (MODULOS_ATIVOS.chamados && ['tecnico', 'oficina_interna', 'admin'].indexOf(profile.role) !== -1 && ehCelular() && !forcouDesktop()) {
    location.replace('../app/');
    return new Promise(function () {});
  }

  if (profile.must_change_password && CURRENT_PAGE !== 'trocar-senha') {
    location.replace('trocar-senha.html');
    return new Promise(function () {});
  }

  // Cada perfil só abre as páginas dos módulos ativos que lhe cabem (por URL direta ou pelo menu).
  if (paginasPermitidas(profile.role).indexOf(CURRENT_PAGE) === -1) {
    location.replace(paginaInicial(profile.role));
    return new Promise(function () {});
  }

  montarMenu(profile.role);

  document.querySelectorAll('[data-user-name]').forEach(function (el) { el.textContent = profile.nome_exibicao; });

  document.querySelectorAll('[data-logout]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      try { sessionStorage.removeItem('crm_forcar_desktop'); } catch (e) {}
      await supabaseClient.auth.signOut();
      location.replace('login.html');
    });
  });

  window.ADMIN_ROLE = profile.role;
  return { session: session, profile: profile };
})();
