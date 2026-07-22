var currentUserId = null;
var clientesCache = [];
var allAssistencias = [];

var ALFANUMERICO_REGEX = /^[A-Za-z0-9]{1,20}$/;

var STATUS_LABELS = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída'
};

var STATUS_BADGE_CLASS = {
  aberta: 'badge-warning',
  em_andamento: 'badge-warning',
  concluida: 'badge-ok'
};

function resetForm() {
  document.getElementById('assistencia-form').reset();
  document.getElementById('assistencia-id').value = '';
  document.getElementById('form-title').textContent = 'Nova assistência técnica';
  document.getElementById('assistencia-error').style.display = 'none';
  document.getElementById('cliente-resumo').style.display = 'none';
  document.getElementById('status').value = 'aberta';
  atualizarContadorDescricao();
}

/* ===================== CLIENTE ===================== */

async function loadClientesSelect() {
  var { data, error } = await supabaseClient.from('clientes').select('*').order('razao_social');
  if (error) { showToast('Erro ao carregar clientes: ' + error.message, 'error'); return; }
  clientesCache = data || [];

  var select = document.getElementById('select-cliente');
  select.innerHTML = '<option value="">— Selecione —</option>' + clientesCache.map(function (c) {
    return '<option value="' + c.id + '">' + c.razao_social + (c.nome_fantasia ? ' (' + c.nome_fantasia + ')' : '') + '</option>';
  }).join('');
}

document.getElementById('select-cliente').addEventListener('change', function (e) {
  var cliente = clientesCache.find(function (c) { return c.id === e.target.value; });
  var resumo = document.getElementById('cliente-resumo');

  if (!cliente) {
    resumo.style.display = 'none';
    return;
  }

  var enderecoPartes = [
    cliente.logradouro, cliente.numero, cliente.complemento,
    cliente.bairro, cliente.municipio, cliente.uf
  ].filter(Boolean).join(', ');

  document.getElementById('cliente-resumo-texto').innerHTML =
    '<strong>' + cliente.razao_social + '</strong><br>' +
    (enderecoPartes ? enderecoPartes + '<br>' : '') +
    (cliente.cnpj_cpf ? 'CNPJ/CPF: ' + cliente.cnpj_cpf + '<br>' : '') +
    (cliente.contato_nome ? 'Contato: ' + cliente.contato_nome +
      (cliente.contato_telefone ? ' — ' + cliente.contato_telefone : '') : '');
  resumo.style.display = 'block';
});

/* ===================== DESCRIÇÃO DO DEFEITO (contador) ===================== */

function atualizarContadorDescricao() {
  var valor = document.getElementById('descricao_defeito').value;
  document.getElementById('descricao-contador').textContent = valor.length;
}
document.getElementById('descricao_defeito').addEventListener('input', atualizarContadorDescricao);

/* ===================== LISTAGEM ===================== */

async function loadAssistencias() {
  var { data, error } = await supabaseClient
    .from('assistencias_tecnicas')
    .select('*, clientes(razao_social, nome_fantasia)')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Erro ao carregar assistências técnicas: ' + error.message, 'error');
    return;
  }

  allAssistencias = data || [];
  renderAssistenciasTable(allAssistencias);
}

function nomeClienteAssistencia(a) {
  if (!a.clientes) return '—';
  return a.clientes.razao_social + (a.clientes.nome_fantasia ? ' (' + a.clientes.nome_fantasia + ')' : '');
}

function renderAssistenciasTable(list) {
  var tbody = document.getElementById('assistencias-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhuma assistência técnica registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function (a) {
    var dataStr = new Date(a.created_at).toLocaleDateString('pt-BR');
    var badgeClass = STATUS_BADGE_CLASS[a.status] || 'badge-warning';
    var badgeText = STATUS_LABELS[a.status] || a.status;
    return '<tr>' +
      '<td>' + a.numero + '</td>' +
      '<td>' + nomeClienteAssistencia(a) + '</td>' +
      '<td>' + (a.numero_serie || '—') + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + badgeText + '</span></td>' +
      '<td>' + dataStr + '</td>' +
      '<td class="row-actions">' +
        '<button data-edit="' + a.id + '">Editar</button>' +
        '<button data-delete="' + a.id + '" class="danger">Excluir</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var assistencia = allAssistencias.find(function (a) { return a.id === btn.dataset.edit; });
      if (!assistencia) return;
      preencherFormularioParaEdicao(assistencia);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('[data-delete]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Excluir esta assistência técnica? Essa ação não pode ser desfeita.')) return;
      var { error } = await supabaseClient.from('assistencias_tecnicas').delete().eq('id', btn.dataset.delete);
      if (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
        return;
      }
      showToast('Assistência técnica excluída.', 'ok');
      loadAssistencias();
    });
  });
}

function preencherFormularioParaEdicao(a) {
  document.getElementById('assistencia-id').value = a.id;
  document.getElementById('select-cliente').value = a.cliente_id || '';
  document.getElementById('select-cliente').dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('numero_serie').value = a.numero_serie || '';
  document.getElementById('descricao_defeito').value = a.descricao_defeito || '';
  document.getElementById('selo_antigo').value = a.selo_antigo || '';
  document.getElementById('selo_novo').value = a.selo_novo || '';
  document.getElementById('lacre_antigo').value = a.lacre_antigo || '';
  document.getElementById('lacre_novo').value = a.lacre_novo || '';
  document.getElementById('status').value = a.status || 'aberta';
  atualizarContadorDescricao();
  document.getElementById('form-title').textContent = 'Editar assistência técnica nº ' + a.numero;
}

document.getElementById('assistencia-search').addEventListener('input', function (e) {
  var term = e.target.value.toLowerCase();
  var filtered = allAssistencias.filter(function (a) {
    return nomeClienteAssistencia(a).toLowerCase().includes(term) ||
      (a.numero_serie || '').toLowerCase().includes(term) ||
      String(a.numero).includes(term);
  });
  renderAssistenciasTable(filtered);
});

/* ===================== SALVAR ===================== */

function validarCampoAlfanumerico(id, label, errorEl, obrigatorio) {
  var valor = document.getElementById(id).value.trim();
  if (!valor) {
    if (obrigatorio) {
      errorEl.textContent = label + ' é obrigatório.';
      errorEl.style.display = 'block';
      return null;
    }
    return '';
  }
  if (!ALFANUMERICO_REGEX.test(valor)) {
    errorEl.textContent = label + ' deve conter apenas letras e números (sem espaços ou símbolos), até 20 caracteres.';
    errorEl.style.display = 'block';
    return null;
  }
  return valor;
}

document.getElementById('assistencia-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var errorEl = document.getElementById('assistencia-error');
  var saveBtn = document.getElementById('assistencia-save-btn');
  errorEl.style.display = 'none';

  var clienteId = document.getElementById('select-cliente').value;
  if (!clienteId) {
    errorEl.textContent = 'Selecione um cliente.';
    errorEl.style.display = 'block';
    return;
  }

  var descricaoDefeito = document.getElementById('descricao_defeito').value.trim();
  if (!descricaoDefeito) {
    errorEl.textContent = 'Descrição do defeito é obrigatória.';
    errorEl.style.display = 'block';
    return;
  }
  if (descricaoDefeito.length > 5000) {
    errorEl.textContent = 'Descrição do defeito excede o limite de 5000 caracteres.';
    errorEl.style.display = 'block';
    return;
  }

  var numeroSerie = validarCampoAlfanumerico('numero_serie', 'Número de série', errorEl, true);
  if (numeroSerie === null) return;
  var seloAntigo = validarCampoAlfanumerico('selo_antigo', 'Selo antigo', errorEl, false);
  if (seloAntigo === null) return;
  var seloNovo = validarCampoAlfanumerico('selo_novo', 'Selo novo', errorEl, false);
  if (seloNovo === null) return;
  var lacreAntigo = validarCampoAlfanumerico('lacre_antigo', 'Lacre antigo', errorEl, false);
  if (lacreAntigo === null) return;
  var lacreNovo = validarCampoAlfanumerico('lacre_novo', 'Lacre novo', errorEl, false);
  if (lacreNovo === null) return;

  var payload = {
    cliente_id: clienteId,
    numero_serie: numeroSerie,
    descricao_defeito: descricaoDefeito,
    selo_antigo: seloAntigo || null,
    selo_novo: seloNovo || null,
    lacre_antigo: lacreAntigo || null,
    lacre_novo: lacreNovo || null,
    status: document.getElementById('status').value || 'aberta'
  };

  var assistenciaId = document.getElementById('assistencia-id').value;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  var result;

  if (assistenciaId) {
    result = await supabaseClient.from('assistencias_tecnicas').update(payload).eq('id', assistenciaId);
  } else {
    payload.created_by = currentUserId;
    result = await supabaseClient.from('assistencias_tecnicas').insert(payload);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar assistência técnica';

  if (result.error) {
    errorEl.textContent = 'Erro ao salvar: ' + result.error.message;
    errorEl.style.display = 'block';
    return;
  }

  showToast('Assistência técnica salva com sucesso.', 'ok');
  resetForm();
  loadAssistencias();
});

document.getElementById('assistencia-cancel-btn').addEventListener('click', resetForm);

(async function () {
  var auth = await window.ADMIN_AUTH_READY;
  if (!auth) return;
  currentUserId = auth.session.user.id;
  await loadClientesSelect();
  await loadAssistencias();
  atualizarContadorDescricao();
})();
