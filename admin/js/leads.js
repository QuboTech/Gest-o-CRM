var currentUserId = null;
var allLeads = [];

var STATUS_OPCOES = ['Qualificado', 'Analisando', 'Desqualificado', 'Serviço', 'Compra', 'Sem resposta'];

var STATUS_BADGE = {
  'Qualificado': 'badge-ok', 'Compra': 'badge-ok', 'Serviço': 'badge-ok',
  'Analisando': 'badge-warning', 'Sem resposta': 'badge-warning',
  'Desqualificado': 'badge-danger'
};

(function popularFiltroStatus() {
  var select = document.getElementById('lead-filtro-status');
  STATUS_OPCOES.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
})();

document.getElementById('mensagem_final').addEventListener('change', function (e) {
  document.getElementById('tentativas_contato').disabled = e.target.checked;
  if (e.target.checked) document.getElementById('tentativas_contato').value = '';
});

function resetLeadForm() {
  document.getElementById('lead-form').reset();
  document.getElementById('lead-id').value = '';
  document.getElementById('tentativas_contato').disabled = false;
  document.getElementById('form-title').textContent = 'Novo lead';
  document.getElementById('lead-error').style.display = 'none';
  document.getElementById('data_contato').value = new Date().toISOString().slice(0, 10);
}

async function loadLeads() {
  var termo = document.getElementById('lead-search').value.trim();
  var statusFiltro = document.getElementById('lead-filtro-status').value;

  var query = supabaseClient.from('leads').select('*')
    .order('data_contato', { ascending: false })
    .order('created_at', { ascending: false });

  if (statusFiltro) query = query.eq('status', statusFiltro);
  if (termo) query = query.or('nome.ilike.%' + termo + '%,numero.ilike.%' + termo + '%');

  var { data, error } = await query;
  if (error) { showToast('Erro ao carregar leads: ' + error.message, 'error'); return; }

  allLeads = data || [];
  renderLeadsTable(allLeads);
}

function formatDataLead(d) {
  var partes = String(d).split('-');
  return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : d;
}

function renderLeadsTable(list) {
  var tbody = document.getElementById('leads-tbody');
  document.getElementById('lead-resumo').textContent = list.length + ' lead(s) encontrado(s)';

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8">Nenhum lead cadastrado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function (l) {
    var badgeClass = STATUS_BADGE[l.status] || 'badge-warning';
    var statusCell = l.status ? '<span class="badge ' + badgeClass + '">' + l.status + '</span>' : '—';
    var tentativasCell = l.mensagem_final ? 'Mensagem Final' : (l.tentativas_contato != null ? l.tentativas_contato : '—');

    return '<tr>' +
      '<td>' + formatDataLead(l.data_contato) + '</td>' +
      '<td>' + (l.nome || '—') + '</td>' +
      '<td>' + (l.numero || '—') + '</td>' +
      '<td>' + (l.canal_aquisicao || '—') + '</td>' +
      '<td>' + statusCell + '</td>' +
      '<td>' + tentativasCell + '</td>' +
      '<td>' + (l.quem_atendeu || '—') + '</td>' +
      '<td class="row-actions">' +
        '<button data-edit="' + l.id + '">Editar</button>' +
        '<button data-delete="' + l.id + '" class="danger">Excluir</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lead = allLeads.find(function (l) { return l.id === btn.dataset.edit; });
      if (!lead) return;
      document.getElementById('lead-id').value = lead.id;
      document.getElementById('data_contato').value = lead.data_contato;
      document.getElementById('nome').value = lead.nome || '';
      document.getElementById('numero').value = lead.numero || '';
      document.getElementById('canal_aquisicao').value = lead.canal_aquisicao || '';
      document.getElementById('status').value = lead.status || '';
      document.getElementById('quem_atendeu').value = lead.quem_atendeu || '';
      document.getElementById('mensagem_final').checked = !!lead.mensagem_final;
      document.getElementById('tentativas_contato').disabled = !!lead.mensagem_final;
      document.getElementById('tentativas_contato').value = lead.tentativas_contato != null ? lead.tentativas_contato : '';
      document.getElementById('motivo_nao_fechou').value = lead.motivo_nao_fechou || '';
      document.getElementById('form-title').textContent = 'Editar lead';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('[data-delete]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Excluir este lead? Essa ação não pode ser desfeita.')) return;
      var { error } = await supabaseClient.from('leads').delete().eq('id', btn.dataset.delete);
      if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
      showToast('Lead excluído.', 'ok');
      loadLeads();
    });
  });
}

document.getElementById('lead-search').addEventListener('input', debounce(loadLeads, 300));
document.getElementById('lead-filtro-status').addEventListener('change', loadLeads);

function debounce(fn, ms) {
  var timer = null;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

document.getElementById('lead-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var errorEl = document.getElementById('lead-error');
  var saveBtn = document.getElementById('lead-save-btn');
  errorEl.style.display = 'none';

  var nome = document.getElementById('nome').value.trim();
  var numero = document.getElementById('numero').value.trim();
  if (!nome && !numero) {
    errorEl.textContent = 'Informe ao menos o nome ou o número do lead.';
    errorEl.style.display = 'block';
    return;
  }

  var mensagemFinal = document.getElementById('mensagem_final').checked;
  var tentativasStr = document.getElementById('tentativas_contato').value;

  var payload = {
    data_contato: document.getElementById('data_contato').value,
    nome: nome || null,
    numero: numero || null,
    canal_aquisicao: document.getElementById('canal_aquisicao').value.trim() || null,
    status: document.getElementById('status').value.trim() || null,
    tentativas_contato: mensagemFinal ? null : (tentativasStr !== '' ? parseInt(tentativasStr, 10) : null),
    mensagem_final: mensagemFinal,
    motivo_nao_fechou: document.getElementById('motivo_nao_fechou').value.trim() || null,
    quem_atendeu: document.getElementById('quem_atendeu').value.trim() || null
  };

  var leadId = document.getElementById('lead-id').value;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  var result;
  if (leadId) {
    result = await supabaseClient.from('leads').update(payload).eq('id', leadId);
  } else {
    payload.created_by = currentUserId;
    result = await supabaseClient.from('leads').insert(payload);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar lead';

  if (result.error) {
    errorEl.textContent = 'Erro ao salvar: ' + result.error.message;
    errorEl.style.display = 'block';
    return;
  }

  showToast('Lead salvo com sucesso.', 'ok');
  resetLeadForm();
  loadLeads();
});

document.getElementById('lead-cancel-btn').addEventListener('click', resetLeadForm);

(async function () {
  var auth = await window.ADMIN_AUTH_READY;
  if (!auth) return;
  currentUserId = auth.session.user.id;
  resetLeadForm();
  loadLeads();
})();
