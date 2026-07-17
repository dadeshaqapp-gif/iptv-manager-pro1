// ============================================
// IPTV MANAGER PRO - APP
// ============================================
let usuarios = [];
let usuariosFiltrados = [];

function gerarSenhaAleatoria(tamanho) {
  tamanho = tamanho || 10;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

function gerarSenha() {
  document.getElementById('inputPassword').value = gerarSenhaAleatoria(10);
  mostrarFeedback('🔑 Senha gerada!', 'sucesso');
}

async function criarUsuario() {
  const username = document.getElementById('inputUsername').value.trim();
  const contato = document.getElementById('inputContato').value.trim();
  let password = document.getElementById('inputPassword').value.trim();
  const plano = document.getElementById('inputPlano').value;
  const mac = document.getElementById('inputMac').value.trim().toUpperCase();

  if (!password) {
    password = gerarSenhaAleatoria(10);
    document.getElementById('inputPassword').value = password;
  }

  if (!username) {
    mostrarFeedback('❌ Usuário é obrigatório!', 'erro');
    return;
  }
  if (password.length < 6) {
    mostrarFeedback('❌ Senha deve ter 6+ caracteres!', 'erro');
    return;
  }

  try {
    const response = await fetch('/api/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, plano, contato, mac })
    });
    const result = await response.json();
    if (result.success) {
      document.getElementById('inputUsername').value = '';
      document.getElementById('inputContato').value = '';
      document.getElementById('inputPassword').value = '';
      document.getElementById('inputPlano').value = 'teste';
      document.getElementById('inputMac').value = '';

      let msg = '✅ Usuário "' + username + '" criado!\n\n';
      msg += '🔗 URL: ' + result.url + '\n';
      if (result.urlMac) msg += '📶 MAC: ' + mac + '\n📺 Playlist MAC: ' + result.urlMac + '\n';
      mostrarFeedback(msg, 'sucesso');

      if (navigator.clipboard) navigator.clipboard.writeText(result.url);
      carregarUsuarios();
    } else {
      mostrarFeedback('❌ ' + result.error, 'erro');
    }
  } catch (error) {
    mostrarFeedback('❌ Erro: ' + error.message, 'erro');
  }
}

function mostrarFeedback(mensagem, tipo) {
  const el = document.getElementById('mensagemFeedback');
  el.textContent = mensagem;
  el.className = 'msg-' + tipo;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 8000);
}

function gerarTeste() {
  criarUsuarioDireto('teste_' + Math.random().toString(36).substr(2, 4), gerarSenhaAleatoria(10), 'teste', 'teste@temp.com', '');
}
function gerarMensal() {
  criarUsuarioDireto('user_' + Math.random().toString(36).substr(2, 4), gerarSenhaAleatoria(10), 'mensal', 'mensal@temp.com', '');
}
function gerarTrimestral() {
  criarUsuarioDireto('trial_' + Math.random().toString(36).substr(2, 4), gerarSenhaAleatoria(10), 'trimestral', 'trimestral@temp.com', '');
}
function gerarAnual() {
  criarUsuarioDireto('anual_' + Math.random().toString(36).substr(2, 4), gerarSenhaAleatoria(10), 'anual', 'anual@temp.com', '');
}

async function criarUsuarioDireto(username, password, plano, contato, mac) {
  try {
    const response = await fetch('/api/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, plano, contato, mac })
    });
    const result = await response.json();
    if (result.success) {
      let msg = '✅ ' + plano.toUpperCase() + ' criado!\n\n👤 ' + username + '\n🔑 ' + password + '\n🔗 ' + result.url;
      if (mac) msg += '\n📶 MAC: ' + mac;
      alert(msg);
      carregarUsuarios();
    }
  } catch (error) {
    alert('❌ Erro: ' + error.message);
  }
}

function excluirUsuario(id) {
  const usuario = usuarios.find(u => u.id === id);
  if (!usuario) return;
  if (!confirm('⚠️ Excluir "' + usuario.username + '"?')) return;
  fetch('/api/excluir/' + id, { method: 'DELETE' })
    .then(function() { carregarUsuarios(); mostrarFeedback('🗑️ Usuário excluído!', 'sucesso'); });
}

function getStatusInfo(dataExpiracao) {
  const agora = new Date();
  const expiracao = new Date(dataExpiracao);
  const diffMs = expiracao - agora;
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs <= 0) return { status: 'expirado', text: '❌ Expirado', class: 'status-expirado' };
  if (diffDias <= 1) return { status: 'aviso-1dia', text: '🔴 Expira amanhã!', class: 'status-aviso' };
  if (diffDias <= 5) return { status: 'aviso-5dias', text: '⚠️ Expira em ' + Math.ceil(diffDias) + ' dias', class: 'status-aviso' };
  return { status: 'ativo', text: '✅ Ativo', class: 'status-ativo' };
}

function getAviso(dataExpiracao) {
  const agora = new Date();
  const expiracao = new Date(dataExpiracao);
  const diffMs = expiracao - agora;
  const diffHoras = diffMs / (1000 * 60 * 60);
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs <= 0) return 'Expirado';
  if (diffDias <= 1) return '⚠️ Expira em ' + Math.ceil(diffHoras) + 'h';
  if (diffDias <= 5) return '📅 Expira em ' + Math.ceil(diffDias) + ' dias';
  return '📅 ' + expiracao.toLocaleDateString();
}

function renderizarUsuarios() {
  const tbody = document.getElementById('listaUsuarios');
  if (!tbody) return;
  const dados = usuariosFiltrados.length > 0 ? usuariosFiltrados : usuarios;
  if (dados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#8899aa;">📭 Nenhum usuário</td></tr>';
    document.getElementById('totalRegistros').textContent = '0 registros';
    return;
  }
  tbody.innerHTML = dados.map(function(user) {
    const expiracao = new Date(user.data_expiracao);
    const statusInfo = getStatusInfo(user.data_expiracao);
    const aviso = getAviso(user.data_expiracao);
    const avisoClass = statusInfo.status === 'aviso-1dia' ? 'aviso-1dia' : 'aviso-5dias';
    const planoLabel = user.plano.toUpperCase();
    const mac = user.mac_address || '-';
    return '<tr>'
      + '<td><strong>' + user.username + '</strong></td>'
      + '<td style="font-size:13px;color:#8899aa;">' + (user.contato || '-') + '</td>'
      + '<td><span style="font-family:monospace;font-size:13px;">' + user.password + '</span></td>'
      + '<td><span class="badge badge-' + user.plano + '">' + planoLabel + '</span></td>'
      + '<td style="font-size:13px;">' + expiracao.toLocaleString() + '</td>'
      + '<td><span class="' + statusInfo.class + '">' + statusInfo.text + '</span></td>'
      + '<td style="font-size:12px;font-family:monospace;color:#00d4ff;">' + mac + '</td>'
      + '<td><button onclick="excluirUsuario(\'' + user.id + '\')" class="btn-excluir">🗑️</button></td>'
      + '</tr>';
  }).join('');
  document.getElementById('totalRegistros').textContent = dados.length + ' registros';
}

function filtrarUsuarios() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filtroPlano = document.getElementById('filtroPlano').value;
  const filtroStatus = document.getElementById('filtroStatus').value;
  usuariosFiltrados = usuarios.filter(function(user) {
    const matchSearch = user.username.toLowerCase().includes(search) || (user.contato && user.contato.toLowerCase().includes(search));
    const matchPlano = filtroPlano === 'todos' || user.plano === filtroPlano;
    let matchStatus = true;
    if (filtroStatus !== 'todos') {
      const statusInfo = getStatusInfo(user.data_expiracao);
      matchStatus = statusInfo.status === filtroStatus;
    }
    return matchSearch && matchPlano && matchStatus;
  });
  renderizarUsuarios();
}

function atualizarDashboard() {
  const agora = new Date();
  let total = usuarios.length, ativos = 0, expirando5 = 0, expirando1 = 0;
  usuarios.forEach(function(user) {
    const diffDias = (new Date(user.data_expiracao) - agora) / (1000 * 60 * 60 * 24);
    if (diffDias > 0) ativos++;
    if (diffDias > 0 && diffDias <= 5) expirando5++;
    if (diffDias > 0 && diffDias <= 1) expirando1++;
  });
  document.getElementById('totalUsuariosStat').textContent = total;
  document.getElementById('ativosStat').textContent = ativos;
  document.getElementById('expirando5Stat').textContent = expirando5;
  document.getElementById('expirando1Stat').textContent = expirando1;
}

async function carregarUsuarios() {
  try {
    const response = await fetch('/api/usuarios');
    const result = await response.json();
    if (result.success) {
      usuarios = result.data;
      usuariosFiltrados = [...usuarios];
      atualizarDashboard();
      renderizarUsuarios();
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM carregado!');
  carregarUsuarios();
});

window.gerarSenha = gerarSenha;
window.criarUsuario = criarUsuario;
window.excluirUsuario = excluirUsuario;
window.gerarTeste = gerarTeste;
window.gerarMensal = gerarMensal;
window.gerarTrimestral = gerarTrimestral;
window.gerarAnual = gerarAnual;
window.filtrarUsuarios = filtrarUsuarios;
