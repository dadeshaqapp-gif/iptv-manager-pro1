// ============================================
// IPTV MANAGER PRO - COM LOGS DE AUTENTICAÇÃO
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 8888;
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'iptv2024';
const sessoes = {};
const TEMPO_SESSAO = 24 * 60 * 60 * 1000;

function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

function criarSessao() {
    const token = gerarToken();
    sessoes[token] = { criado_em: Date.now(), valido: true };
    console.log(`✅ [AUTH] Sessão criada: ${token.substring(0, 20)}...`);
    return token;
}

function validarSessao(token) {
    console.log(`🔍 [AUTH] Validando token: ${token ? token.substring(0, 20) + '...' : 'NENHUM'}`);
    if (!token) {
        console.log('❌ [AUTH] Token não fornecido');
        return false;
    }
    const sessao = sessoes[token];
    if (!sessao) {
        console.log('❌ [AUTH] Sessão não encontrada');
        return false;
    }
    if (!sessao.valido) {
        console.log('❌ [AUTH] Sessão inválida');
        return false;
    }
    if (Date.now() - sessao.criado_em > TEMPO_SESSAO) {
        console.log('❌ [AUTH] Sessão expirada');
        delete sessoes[token];
        return false;
    }
    console.log('✅ [AUTH] Token válido!');
    return true;
}

function serveStatic(filePath, res) {
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    if (extname === '.css') contentType = 'text/css';
    if (extname === '.js') contentType = 'application/javascript';
    if (extname === '.png') contentType = 'image/png';
    if (extname === '.jpg' || extname === '.jpeg') contentType = 'image/jpeg';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('Arquivo não encontrado');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// ============================================
// CANAIS E SERVIDORES (SIMPLIFICADO PARA TESTE)
// ============================================
const CANAIS_FALLBACK = [
    { nome: 'ZAP Novelas', url: 'http://zap.ao/novelas', origem: 'ZAP' },
    { nome: 'RTP 1', url: 'http://rtp.pt/rtp1', origem: 'Portugal' },
    { nome: 'SIC', url: 'http://sic.pt/sic', origem: 'Portugal' },
    { nome: 'TVI', url: 'http://tvi.pt/tvi', origem: 'Portugal' },
    { nome: 'CNN Internacional', url: 'http://cnn.com/international', origem: 'Internacional' },
];

let cacheCanais = CANAIS_FALLBACK;
let usuarios = [];

try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
} catch {
    usuarios = [
        { id: '1', username: 'teste', contato: 'teste@teste.com', password: '123456', plano: 'mensal', data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null },
        { id: '2', username: 'Barbosa', contato: 'teste@iptv.com', password: 'zYrtNutAeL', plano: 'teste', data_expiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null }
    ];
    fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
}

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

async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));
    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro\n`;
    playlist += `#PLAYLIST: ${usuario.username} - ${usuario.plano.toUpperCase()}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;
    const grupos = {};
    cacheCanais.forEach(canal => {
        const grupo = canal.origem || '📡 Vector';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });
    for (const grupo of Object.keys(grupos)) {
        playlist += `#EXTINF:-1 tvg-logo="",📁 📡 ${grupo}\n`;
        playlist += `#EXTGRP:${grupo}\n`;
        grupos[grupo].forEach(canal => {
            playlist += `#EXTINF:-1 tvg-logo="${canal.logo || ''}",${canal.nome}\n`;
            playlist += `${canal.url}\n`;
        });
        playlist += '\n';
    }
    return playlist;
}

// ============================================
// SERVIDOR HTTP
// ============================================
const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    console.log(`📡 [REQ] ${req.method} ${pathname}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ============================================
    // ROTA: /api/login (POST)
    // ============================================
    if (pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const dados = JSON.parse(body);
                console.log(`🔑 [LOGIN] Tentativa: ${dados.username}`);
                if (dados.username === ADMIN_USER && dados.password === ADMIN_PASS) {
                    const token = criarSessao();
                    console.log(`✅ [LOGIN] Sucesso! Token: ${token.substring(0, 20)}...`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, token }));
                } else {
                    console.log(`❌ [LOGIN] Falha: ${dados.username}`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas' }));
                }
            } catch (error) {
                console.error('❌ [LOGIN] Erro:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Erro interno' }));
            }
        });
        return;
    }

    // ============================================
    // ROTA: /api/usuarios (GET) - PROTEGIDA
    // ============================================
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        console.log(`🔍 [API] Authorization header: ${authHeader ? authHeader.substring(0, 30) + '...' : 'NENHUM'}`);
        
        const token = authHeader?.replace('Bearer ', '');
        console.log(`🔍 [API] Token extraído: ${token ? token.substring(0, 20) + '...' : 'NENHUM'}`);
        
        if (!token || !validarSessao(token)) {
            console.log('❌ [API] Acesso negado!');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        console.log('✅ [API] Acesso permitido!');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
        return;
    }

    // ============================================
    // ROTA: /dashboard (GET) - PROTEGIDA
    // ============================================
    if (pathname === '/dashboard') {
        const authHeader = req.headers.authorization;
        console.log(`🔍 [DASHBOARD] Authorization header: ${authHeader ? authHeader.substring(0, 30) + '...' : 'NENHUM'}`);
        
        const token = authHeader?.replace('Bearer ', '');
        console.log(`🔍 [DASHBOARD] Token extraído: ${token ? token.substring(0, 20) + '...' : 'NENHUM'}`);
        
        if (!token || !validarSessao(token)) {
            console.log('❌ [DASHBOARD] Acesso negado!');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        console.log('✅ [DASHBOARD] Acesso permitido!');
        let filePath = './public/index.html';
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ROTA: / (RAIZ) - Login
    // ============================================
    if (pathname === '/') {
        console.log('📄 [ROOT] Servindo login.html');
        let filePath = './public/login.html';
        if (!fs.existsSync(filePath)) {
            const loginHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPTV Manager Pro - Login</title>
    <style>
        body { font-family: Arial; background: #0a0e17; color: #e0e0e0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .login-container { background: #141b2b; padding: 40px; border-radius: 12px; border: 1px solid #1a2a3a; width: 100%; max-width: 380px; }
        h1 { color: #00d4ff; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #8899aa; }
        input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #1a2a3a; background: #0a0e17; color: #e0e0e0; font-size: 16px; }
        input:focus { border-color: #00d4ff; outline: none; }
        button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #00d4ff; color: #0a0e17; font-size: 16px; font-weight: 600; cursor: pointer; }
        button:hover { background: #00b8e6; }
        .error { color: #ff5252; text-align: center; margin-top: 15px; display: none; }
        .logo { text-align: center; font-size: 48px; margin-bottom: 20px; }
    </style>
</head>
<body>
<div class="login-container">
    <div class="logo">📺</div>
    <h1>IPTV Manager Pro</h1>
    <form id="loginForm">
        <div class="form-group">
            <label>👤 Utilizador</label>
            <input type="text" id="username" value="admin" required>
        </div>
        <div class="form-group">
            <label>🔑 Senha</label>
            <input type="password" id="password" value="iptv2024" required>
        </div>
        <button type="submit">Entrar</button>
        <div id="error" class="error">Credenciais inválidas!</div>
    </form>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
        } else {
            errorDiv.textContent = data.error || 'Credenciais inválidas';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Erro ao conectar ao servidor';
        errorDiv.style.display = 'block';
    }
});
</script>
</body>
</html>`;
            fs.writeFileSync('./public/login.html', loginHtml);
        }
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ROTA: /playlist.m3u (PÚBLICA)
    // ============================================
    if (pathname === '/playlist.m3u' || pathname === '/get.php') {
        const username = reqUrl.searchParams.get('username');
        const password = reqUrl.searchParams.get('password');
        const mac = reqUrl.searchParams.get('mac');

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
        });
        return;
    }

    // ============================================
    // ROTA: /player_api.php (PÚBLICA)
    // ============================================
    if (pathname === '/player_api.php') {
        const username = reqUrl.searchParams.get('username');
        const password = reqUrl.searchParams.get('password');
        const action = reqUrl.searchParams.get('action');

        let user = validarUsuario(username, password);
        if (!user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ user_info: { auth: 0 }, channels: [] }));
            return;
        }

        if (!action) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                user_info: {
                    username: user.username,
                    password: user.password,
                    auth: 1,
                    status: "Active",
                    exp_date: Math.floor(new Date(user.data_expiracao).getTime() / 1000).toString(),
                    is_trial: user.plano === 'teste' ? "1" : "0",
                    max_connections: "2"
                },
                server_info: {
                    url: req.headers.host ? req.headers.host.split(':')[0] : "iptv-manager-pro1-1.onrender.com",
                    port: "80",
                    https_port: "443",
                    server_protocol: "https",
                    timezone: "America/Sao_Paulo",
                    timestamp_now: Math.floor(Date.now() / 1000)
                }
            }));
            return;
        }

        if (action === 'get_live_categories') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([
                { category_id: "1", category_name: "ZAP", parent_id: 0 },
                { category_id: "2", category_name: "Portugal", parent_id: 0 },
                { category_id: "3", category_name: "Internacionais", parent_id: 0 }
            ]));
            return;
        }

        if (action === 'get_live_streams') {
            const streams = cacheCanais.map((c, i) => ({
                num: i+1,
                name: c.nome,
                stream_type: "live",
                stream_id: i+1,
                stream_icon: c.logo || "",
                category_id: c.origem === 'ZAP' ? "1" : c.origem === 'Portugal' ? "2" : "3",
                container_extension: "ts",
                direct_source: c.url
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streams));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
    }

    // ============================================
    // ARQUIVOS ESTÁTICOS
    // ============================================
    let filePath = '.' + pathname;
    if (!filePath.startsWith('./public')) filePath = './public' + pathname;
    try {
        if (fs.existsSync(filePath)) {
            serveStatic(filePath, res);
            return;
        }
    } catch {}

    console.log(`❌ [404] Rota não encontrada: ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

server.listen(PORT, () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Servidor com Logs');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('📡 Logs de autenticação ativados!');
    console.log('==================================================');
});
