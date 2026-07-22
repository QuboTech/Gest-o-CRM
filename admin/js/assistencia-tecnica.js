var currentUserId = null;
var clientesCache = [];
var allAssistencias = [];
var selectedClienteAssistencia = null;
var assistenciaEmEdicaoId = null;

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

function equipamentoTexto(a) {
  return [a.marca, a.modelo].filter(Boolean).join(' ') || '—';
}

function resetForm() {
  document.getElementById('assistencia-form').reset();
  document.getElementById('assistencia-id').value = '';
  assistenciaEmEdicaoId = null;
  selectedClienteAssistencia = null;
  document.getElementById('form-title').textContent = 'Nova assistência técnica';
  document.getElementById('pagina-titulo').textContent = 'Assistência Técnica';
  document.getElementById('edicao-banner').style.display = 'none';
  document.getElementById('assistencia-error').style.display = 'none';
  document.getElementById('alerta-serie-repetida').style.display = 'none';
  document.getElementById('cliente-resumo').style.display = 'none';
  document.getElementById('status').value = 'aberta';
  document.getElementById('assistencia-save-btn').textContent = 'Salvar assistência técnica';
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
  selectedClienteAssistencia = cliente || null;

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

/* ===================== HISTÓRICO DE ASSISTÊNCIAS DO CLIENTE ===================== */

document.getElementById('btn-ver-historico').addEventListener('click', function () {
  if (!selectedClienteAssistencia) return;
  document.getElementById('historico-cliente-nome').textContent = selectedClienteAssistencia.razao_social;
  document.getElementById('modal-historico').classList.add('open');
  loadHistoricoAssistencias(selectedClienteAssistencia.id, 'historico-conteudo');
});

document.getElementById('historico-btn-fechar').addEventListener('click', function () {
  document.getElementById('modal-historico').classList.remove('open');
});

/* ===================== DESCRIÇÃO DO DEFEITO (contador) ===================== */

function atualizarContadorDescricao() {
  var valor = document.getElementById('descricao_defeito').value;
  document.getElementById('descricao-contador').textContent = valor.length;
}
document.getElementById('descricao_defeito').addEventListener('input', atualizarContadorDescricao);

/* ===================== ALERTA DE Nº DE SÉRIE JÁ REGISTRADO ===================== */

document.getElementById('numero_serie').addEventListener('change', async function (e) {
  var valor = e.target.value.trim();
  var alertaEl = document.getElementById('alerta-serie-repetida');
  if (!valor) { alertaEl.style.display = 'none'; return; }

  var encontradas = await buscarAssistenciasPorNumeroSerie(valor, assistenciaEmEdicaoId);
  if (!encontradas.length) { alertaEl.style.display = 'none'; return; }

  var partes = encontradas.slice(0, 5).map(function (a) {
    var nomeCliente = a.clientes ? a.clientes.razao_social : 'cliente não identificado';
    return 'nº ' + a.numero + ' (' + nomeCliente + ')';
  });
  alertaEl.textContent = '⚠️ Este número de série já tem ' + encontradas.length + ' assistência' + (encontradas.length > 1 ? 's' : '') + ' técnica' + (encontradas.length > 1 ? 's' : '') + ' registrada' + (encontradas.length > 1 ? 's' : '') + ': ' + partes.join(', ') + '.';
  alertaEl.style.display = 'block';
});

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
    tbody.innerHTML = '<tr><td colspan="7">Nenhuma assistência técnica registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function (a) {
    var dataStr = new Date(a.created_at).toLocaleDateString('pt-BR');
    var badgeClass = STATUS_BADGE_CLASS[a.status] || 'badge-warning';
    var badgeText = STATUS_LABELS[a.status] || a.status;
    return '<tr>' +
      '<td>' + a.numero + '</td>' +
      '<td>' + nomeClienteAssistencia(a) + '</td>' +
      '<td>' + equipamentoTexto(a) + '</td>' +
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
  assistenciaEmEdicaoId = a.id;
  document.getElementById('assistencia-id').value = a.id;
  document.getElementById('select-cliente').value = a.cliente_id || '';
  document.getElementById('select-cliente').dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('marca').value = a.marca || '';
  document.getElementById('modelo').value = a.modelo || '';
  document.getElementById('numero_serie').value = a.numero_serie || '';
  document.getElementById('descricao_defeito').value = a.descricao_defeito || '';
  document.getElementById('selo_antigo').value = a.selo_antigo || '';
  document.getElementById('selo_novo').value = a.selo_novo || '';
  document.getElementById('lacre_antigo').value = a.lacre_antigo || '';
  document.getElementById('lacre_novo').value = a.lacre_novo || '';
  document.getElementById('status').value = a.status || 'aberta';
  document.getElementById('alerta-serie-repetida').style.display = 'none';
  atualizarContadorDescricao();
  document.getElementById('form-title').textContent = 'Editar assistência técnica nº ' + a.numero;
  document.getElementById('pagina-titulo').textContent = 'Editando Assistência Técnica nº ' + a.numero;
  document.getElementById('edicao-banner-texto').textContent = '✏️ Editando Assistência Técnica nº ' + a.numero;
  document.getElementById('edicao-banner').style.display = 'block';
  document.getElementById('assistencia-save-btn').textContent = 'Salvar alterações';
}

/* Suporte a assistencia-tecnica.html?editar=ID, e chamado pelo histórico do cliente em clientes.html */
async function iniciarEdicaoAssistencia(assistenciaId) {
  var { data, error } = await supabaseClient
    .from('assistencias_tecnicas')
    .select('*')
    .eq('id', assistenciaId)
    .single();

  if (error || !data) {
    showToast('Não foi possível carregar esse registro para edição.', 'error');
    return;
  }

  if (!clientesCache.length) await loadClientesSelect();
  preencherFormularioParaEdicao(data);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.iniciarEdicaoAssistencia = iniciarEdicaoAssistencia;

document.getElementById('assistencia-search').addEventListener('input', function (e) {
  var term = e.target.value.toLowerCase();
  var filtered = allAssistencias.filter(function (a) {
    return nomeClienteAssistencia(a).toLowerCase().includes(term) ||
      (a.numero_serie || '').toLowerCase().includes(term) ||
      equipamentoTexto(a).toLowerCase().includes(term) ||
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

function validarAssistencia(errorEl) {
  errorEl.style.display = 'none';

  if (!document.getElementById('select-cliente').value) {
    errorEl.textContent = 'Selecione um cliente.';
    errorEl.style.display = 'block';
    return false;
  }
  var descricaoDefeito = document.getElementById('descricao_defeito').value.trim();
  if (!descricaoDefeito) {
    errorEl.textContent = 'Descrição do defeito é obrigatória.';
    errorEl.style.display = 'block';
    return false;
  }
  if (descricaoDefeito.length > 5000) {
    errorEl.textContent = 'Descrição do defeito excede o limite de 5000 caracteres.';
    errorEl.style.display = 'block';
    return false;
  }
  return true;
}

async function salvarAssistencia() {
  var errorEl = document.getElementById('assistencia-error');
  if (!validarAssistencia(errorEl)) return null;

  var clienteId = document.getElementById('select-cliente').value;
  var descricaoDefeito = document.getElementById('descricao_defeito').value.trim();

  var numeroSerie = validarCampoAlfanumerico('numero_serie', 'Número de série', errorEl, true);
  if (numeroSerie === null) return null;
  var seloAntigo = validarCampoAlfanumerico('selo_antigo', 'Selo antigo', errorEl, false);
  if (seloAntigo === null) return null;
  var seloNovo = validarCampoAlfanumerico('selo_novo', 'Selo novo', errorEl, false);
  if (seloNovo === null) return null;
  var lacreAntigo = validarCampoAlfanumerico('lacre_antigo', 'Lacre antigo', errorEl, false);
  if (lacreAntigo === null) return null;
  var lacreNovo = validarCampoAlfanumerico('lacre_novo', 'Lacre novo', errorEl, false);
  if (lacreNovo === null) return null;

  var payload = {
    cliente_id: clienteId,
    marca: document.getElementById('marca').value.trim() || null,
    modelo: document.getElementById('modelo').value.trim() || null,
    numero_serie: numeroSerie,
    descricao_defeito: descricaoDefeito,
    selo_antigo: seloAntigo || null,
    selo_novo: seloNovo || null,
    lacre_antigo: lacreAntigo || null,
    lacre_novo: lacreNovo || null,
    status: document.getElementById('status').value || 'aberta'
  };

  var assistenciaId = document.getElementById('assistencia-id').value;
  var result;

  if (assistenciaId) {
    result = await supabaseClient.from('assistencias_tecnicas').update(payload).eq('id', assistenciaId).select().single();
  } else {
    payload.created_by = currentUserId;
    result = await supabaseClient.from('assistencias_tecnicas').insert(payload).select().single();
  }

  if (result.error) {
    errorEl.textContent = 'Erro ao salvar: ' + result.error.message;
    errorEl.style.display = 'block';
    return null;
  }

  assistenciaEmEdicaoId = result.data.id;
  document.getElementById('assistencia-id').value = result.data.id;
  return result.data;
}

document.getElementById('assistencia-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var saveBtn = document.getElementById('assistencia-save-btn');
  var estavaEditando = !!assistenciaEmEdicaoId;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  var assistencia = await salvarAssistencia();

  saveBtn.disabled = false;
  saveBtn.textContent = assistenciaEmEdicaoId ? 'Salvar alterações' : 'Salvar assistência técnica';

  if (!assistencia) return;

  showToast((estavaEditando ? 'Assistência técnica nº ' + assistencia.numero + ' atualizada com sucesso.' : 'Assistência técnica nº ' + assistencia.numero + ' salva com sucesso.'), 'ok');
  loadAssistencias();
});

document.getElementById('assistencia-cancel-btn').addEventListener('click', resetForm);

/* ===================== IMPRESSÃO (2 vias) ===================== */

function buildAssistenciaViaHtml(assistencia, label) {
  var dataStr = new Date(assistencia.created_at || Date.now()).toLocaleDateString('pt-BR');
  var cliente = selectedClienteAssistencia || {};
  var enderecoCompleto = [
    cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro, cliente.municipio, cliente.uf
  ].filter(Boolean).join(', ');

  return '<div class="print-via">' +
    '<div class="print-header"><div><h2>Assistência Técnica nº ' + (assistencia.numero || '') + ' — HLN Embalagens e Equipamentos</h2>Data: ' + dataStr + '</div>' +
    '<div class="print-via-label">Via ' + label + '</div></div>' +
    '<p><strong>CLIENTE:</strong> ' + (cliente.razao_social || '') + (cliente.nome_fantasia ? ' (' + cliente.nome_fantasia + ')' : '') + '</p>' +
    '<p><strong>ENDEREÇO:</strong> ' + enderecoCompleto + '</p>' +
    '<p><strong>CNPJ/CPF:</strong> ' + (cliente.cnpj_cpf || '') + ' &nbsp; <strong>CONTATO:</strong> ' + (cliente.contato_nome || '') + ' &nbsp; <strong>TEL:</strong> ' + (cliente.contato_telefone || '') + '</p>' +
    '<p><strong>MARCA / MODELO:</strong> ' + equipamentoTexto(assistencia) + ' &nbsp; <strong>Nº DE SÉRIE:</strong> ' + (assistencia.numero_serie || '') + '</p>' +
    '<p><strong>DESCRIÇÃO DO DEFEITO:</strong><br>' + (assistencia.descricao_defeito || '').replace(/\n/g, '<br>') + '</p>' +
    '<p><strong>SELO ANTIGO:</strong> ' + (assistencia.selo_antigo || '—') + ' &nbsp; <strong>SELO NOVO:</strong> ' + (assistencia.selo_novo || '—') + '</p>' +
    '<p><strong>LACRE ANTIGO:</strong> ' + (assistencia.lacre_antigo || '—') + ' &nbsp; <strong>LACRE NOVO:</strong> ' + (assistencia.lacre_novo || '—') + '</p>' +
    '<p><strong>STATUS:</strong> ' + (STATUS_LABELS[assistencia.status] || assistencia.status || '') + '</p>' +
    '<div style="margin-top:40px; padding-top:10px; border-top:1px solid #000;">Assinatura do Cliente: _______________________________________________ &nbsp;&nbsp; Data: ___/___/_____</div>' +
  '</div>';
}

var originalDocumentTitleAssistencia = document.title;

document.getElementById('btn-imprimir').addEventListener('click', async function () {
  var errorEl = document.getElementById('assistencia-error');
  if (!validarAssistencia(errorEl)) return;
  if (!selectedClienteAssistencia) {
    showToast('Selecione um cliente antes de imprimir.', 'warning');
    return;
  }

  var btn = this;
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  var assistencia = await salvarAssistencia();
  btn.disabled = false;
  btn.textContent = 'Imprimir (2 vias)';

  if (!assistencia) return;

  document.getElementById('print-sheet').innerHTML = buildAssistenciaViaHtml(assistencia, 'Cliente') + buildAssistenciaViaHtml(assistencia, 'Empresa');

  document.title = (selectedClienteAssistencia.razao_social || 'Assistencia') + ' - Gestão CRM';
  window.print();

  showToast('Assistência técnica nº ' + assistencia.numero + ' salva e enviada para impressão.', 'ok');
  loadAssistencias();
});

window.addEventListener('afterprint', function () {
  document.title = originalDocumentTitleAssistencia;
});

/* ===================== INIT ===================== */

(async function () {
  var auth = await window.ADMIN_AUTH_READY;
  if (!auth) return;
  currentUserId = auth.session.user.id;
  await loadClientesSelect();
  await loadAssistencias();
  atualizarContadorDescricao();

  var params = new URLSearchParams(location.search);
  var editarId = params.get('editar');
  if (editarId) {
    iniciarEdicaoAssistencia(editarId);
  }
})();
