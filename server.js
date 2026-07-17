// ============================================
// IPTV MANAGER PRO - COM VECTOR PLAYER API
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// CONFIGURAÇÃO VECTOR PLAYER
// ============================================
const VECTOR_API_KEY = '364e8ddcae71ebbd96996a871690fd10d69affb719f9b6a87383987aa79590b3';
const VECTOR_API_URL = 'https://vectorplayer.com/api/develop';
const VECTOR_LISTA_ID = 1; // Altere para o ID da sua lista premium

// ============================================
// FUNÇÃO: OBTER IP LOCAL
// ============================================
function obterIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// ============================================
// FUNÇÃO: VALIDAR MAC
// ============================================
function validarMac(mac) {
  if (!mac) return true;
  mac = mac.trim().toUpperCase().replace(/\s/g, '');
  const regex6 = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/;
  const regex8 = /^([0-9A-F]{2}[:-]){7}[0-9A-F]{2}$/;
  const regex6sem = /^[0-9A-F]{12}$/;
  const regex8sem = /^[0-9A-F]{16}$/;
  return regex6.test(mac) || regex8.test(mac) || regex6sem.test(mac) || regex8sem.test(mac);
}

// ============================================
// FUNÇÃO: BUSCAR CANAIS DA API VECTOR PLAYER
// ============================================
async function buscarCanaisVectorPlayer() {
  try {
    const url = `${VECTOR_API_URL}/lista/${VECTOR_LISTA_ID}/channels`;
    console.log('📡 Buscando canais do Vector Player...');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VECTOR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Erro na API Vector Player:', response.status);
      return [];
    }

    const data = await response.json();
    console.log(`✅ ${data.data?.length || 0} canais carregados do Vector Player`);
    return data.data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar canais:', error.message);
    return [];
  }
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST M3U
// ============================================
async function gerarPlaylistM3U(usuario) {
  const expiracao = new Date(usuario.data_expiracao);
  const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));
  
  // Buscar canais reais do Vector Player
  let canais = await buscarCanaisVectorPlayer();
  
  // Fallback: canais de exemplo se a API falhar
  if (!canais || canais.length === 0) {
    console.log('⚠️ Usando canais de exemplo (fallback)');
    canais = [
      { nome: 'Globo HD', url: 'http://exemplo.com/globo.ts', logo: '' },
      { nome: 'SBT HD', url: 'http://exemplo.com/sbt.ts', logo: '' },
      { nome: 'Record HD', url: 'http://exemplo.com/record.ts', logo: '' },
      { nome: 'CNN Brasil', url: 'http://exemplo.com/cnn.ts', logo: '' },
      { nome: 'SporTV', url: 'http://exemplo.com/sportv.ts', logo: '' },
      { nome: 'HBO', url: 'http://exemplo.com/hbo.ts', logo: '' }
    ];
  }

  let playlist = '#EXTM3U\n';
  playlist += `#PLAYLIST: IPTV Manager Pro - ${usuario.username}\n`;
  playlist += `#EXTINF:-1,Plano: ${usuario.plano.toUpperCase()} | Expira em: ${diasRestantes} dias\n\n`;
  
  canais.forEach(canal => {
    const logo = canal.logo || canal.tvg_logo || '';
    playlist += `#EXTINF:-1 tvg-logo="${logo}",${canal.nome}\n`;
    playlist += canal.url + '\n';
  });

  return playlist;
}

// ============================================
// CARREGAR USUÁRIOS
// ============================================
try {
  const data = fs.readFileSync('usuarios.json', 'utf8');
  usuarios = JSON.parse(data);
  console.log('✅ Usuários carregados:', usuarios.length);
} catch (err) {
  usuarios = [];
  fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
  console.log('✅ usuarios.json criado');
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================
function validarUsuario(username, password) {
  const user = usuarios.find(u => u.username === username && u.password === password);
  if (!user) return null;
  if (new Date() > new Date(user.data_expiracao)) return null;
  return user;
}

function validarPorMac(mac) {
  if (!mac) return null;
  const user = usuarios.find(u => u.mac_address === mac);
  if (!user) return null;
  if (new Date() > new Date(user.data_expiracao)) return null;
  return user;
}

// ============================================
// CRIAR SERVIDOR
// ============================================
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ===== PLAYLIST =====
  if (pathname === '/playlist.m3u') {
    const username = parsedUrl.query.username;
    const password = parsedUrl.query.password;
    const mac = parsedUrl.query.mac;

    let user = null;
    if (mac) user = validarPorMac(mac);
    else if (username && password) user = validarUsuario(username, password);

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro: Credenciais inválidas ou assinatura expirada');
      return;
    }

    gerarPlaylistM3U(user).then(playlist => {
      res.writeHead(200, {
        'Content-Type': 'audio/x-mpegurl',
        'Content-Disposition': 'attachment; filename="playlist.m3u"'
      });
      res.end(playlist);
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro ao gerar playlist: ' + err.message);
    });
    return;
  }

  // ===== API: USUARIOS =====
  if (pathname === '/api/usuarios' && req.method === 'GET') {
    const usuariosLimpos = usuarios.map(u => ({
      id: u.id,
      username: u.username,
      contato: u.contato || '-',
      password: u.password,
      plano: u.plano,
      data_expiracao: u.data_expiracao,
      status: u.status,
      mac_address: u.mac_address || null
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: usuariosLimpos }));
    return;
  }

  // ===== API: CRIAR =====
  if (pathname === '/api/criar' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const dados = JSON.parse(body);
        const { username, password, plano, contato, mac } = dados;

        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Usuário e senha obrigatórios' }));
          return;
        }

        if (usuarios.some(u => u.username === username)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Usuário já existe' }));
          return;
        }

        if (mac && !validarMac(mac)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Formato MAC inválido' }));
          return;
        }

        if (mac && usuarios.some(u => u.mac_address === mac)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'MAC já está em uso' }));
          return;
        }

        const duracaoMap = {
          teste: 2 * 60 * 60 * 1000,
          mensal: 30 * 24 * 60 * 60 * 1000,
          trimestral: 120 * 24 * 60 * 60 * 1000,
          anual: 365 * 24 * 60 * 60 * 1000
        };
        const dataExpiracao = new Date(Date.now() + (duracaoMap[plano] || duracaoMap.teste));

        const novoUsuario = {
          id: 'usr_' + Date.now(),
          username: username,
          contato: contato || 'Não informado',
          password: password,
          plano: plano || 'teste',
          data_expiracao: dataExpiracao.toISOString(),
          status: 'ativo',
          mac_address: mac || null
        };

        usuarios.push(novoUsuario);
        fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));

        const ip = obterIpLocal();
        const urlPlaylist = `http://${ip}:${PORT}/playlist.m3u?username=${novoUsuario.username}&password=${novoUsuario.password}`;
        const urlMac = mac ? `http://${ip}:${PORT}/playlist.m3u?mac=${mac}` : null;

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: novoUsuario,
          url: urlPlaylist,
          urlMac: urlMac
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // ===== API: EXCLUIR =====
  if (pathname.startsWith('/api/excluir/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/excluir/', '');
    const index = usuarios.findIndex(u => u.id === id);
    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Usuário não encontrado' }));
      return;
    }
    usuarios.splice(index, 1);
    fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Usuário excluído' }));
    return;
  }

  // ===== ARQUIVOS ESTÁTICOS =====
  let filePath = '.' + pathname;
  if (filePath === './') filePath = './public/index.html';
  if (!filePath.startsWith('./public')) filePath = './public' + pathname;
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  if (extname === '.css') contentType = 'text/css';
  if (extname === '.js') contentType = 'application/javascript';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end('Arquivo não encontrado');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(PORT, () => {
  const ip = obterIpLocal();
  console.log('📺 IPTV Manager Pro - Servidor rodando!');
  console.log('🌐 Local: http://localhost:' + PORT);
  console.log('🌐 Rede: http://' + ip + ':' + PORT);
  console.log('📋 Playlist MAC: http://' + ip + ':' + PORT + '/playlist.m3u?mac=AA:BB:CC:DD:EE:FF');
  console.log('============================================');
});

// Salvar usuários automaticamente
setInterval(() => {
  try { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); } catch (err) {}
}, 30000);
