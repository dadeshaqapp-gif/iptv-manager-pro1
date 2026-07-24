// ============================================
// IPTV MANAGER PRO - LOGIN PROFISSIONAL
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
    return token;
}

function validarSessao(token) {
    if (!token) return false;
    const sessao = sessoes[token];
    if (!sessao || !sessao.valido) return false;
    if (Date.now() - sessao.criado_em > TEMPO_SESSAO) {
        delete sessoes[token];
        return false;
    }
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
// CANAIS E SERVIDORES
// ============================================
const SERVERS = [
    { id: 1, url: 'http://stv.sstv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSTV' },
    { id: 2, url: 'http://stv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'STV' },
    { id: 3, url: 'http://ssapp.ch:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSApp' },
    { id: 4, url: 'http://play.dnsrot.vip:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'DNSRot' }
];

const CANAIS_FALLBACK = [
    { nome: 'ZAP Novelas', url: 'http://zap.ao/novelas', origem: 'ZAP' },
    { nome: 'ZAP Viva', url: 'http://zap.ao/viva', origem: 'ZAP' },
    { nome: 'ZAP Cinema', url: 'http://zap.ao/cinema', origem: 'ZAP' },
    { nome: 'TPA 1', url: 'http://tpa.ao/tpa1', origem: 'Angola' },
    { nome: 'TPA 2', url: 'http://tpa.ao/tpa2', origem: 'Angola' },
    { nome: 'TVM', url: 'http://tvm.co.mz/tvm', origem: 'Moçambique' },
    { nome: 'Stv', url: 'http://stv.co.mz/stv', origem: 'Moçambique' },
    { nome: 'Miramar', url: 'http://miramar.co.mz/miramar', origem: 'Moçambique' },
    { nome: 'RTP 1', url: 'http://rtp.pt/rtp1', origem: 'Portugal' },
    { nome: 'RTP 2', url: 'http://rtp.pt/rtp2', origem: 'Portugal' },
    { nome: 'RTP 3', url: 'http://rtp.pt/rtp3', origem: 'Portugal' },
    { nome: 'SIC', url: 'http://sic.pt/sic', origem: 'Portugal' },
    { nome: 'SIC Notícias', url: 'http://sic.pt/noticias', origem: 'Portugal' },
    { nome: 'TVI', url: 'http://tvi.pt/tvi', origem: 'Portugal' },
    { nome: 'TVI 24', url: 'http://tvi.pt/24', origem: 'Portugal' },
    { nome: 'CMTV', url: 'http://cmtv.pt/cmtv', origem: 'Portugal' },
    { nome: 'CNN Internacional', url: 'http://cnn.com/international', origem: 'Internacional' },
    { nome: 'BBC World News', url: 'http://bbc.com/world', origem: 'Internacional' },
    { nome: 'DW TV', url: 'http://dw.com/dw', origem: 'Internacional' },
    { nome: 'Euronews', url: 'http://euronews.com/euronews', origem: 'Internacional' },
];

let cacheCanais = [];
let cacheUltimaAtualizacao = 0;

async function buscarCanaisServer(server) {
    try {
        const url = `${server.url}/get.php?username=${server.usuario}&password=${server.senha}&type=m3u_plus&output=ts`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return [];
        const playlist = await response.text();
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const matchNome = linhaLimpa.match(/,([^,]+)$/);
                const nome = matchNome ? matchNome[1] : 'Canal';
                canalAtual = { nome, url: '', logo: '', origem: server.nome };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                if (linhaLimpa.startsWith('http://') || linhaLimpa.startsWith('https://')) {
                    canalAtual.url = linhaLimpa;
                    canais.push(canalAtual);
                }
                canalAtual = null;
            }
        }
        return canais;
    } catch { return []; }
}

async function atualizarCacheCanais() {
    try {
        const resultados = await Promise.all(SERVERS.map(server => buscarCanaisServer(server)));
        const todosCanais = [];
        const vistos = new Set();
        resultados.forEach(canais => {
            for (const canal of canais) {
                const key = canal.nome + '|' + canal.url;
                if (!vistos.has(key)) { vistos.add(key); todosCanais.push(canal); }
            }
        });
        cacheCanais = todosCanais.length > 0 ? [...todosCanais, ...CANAIS_FALLBACK] : CANAIS_FALLBACK;
        cacheUltimaAtualizacao = Date.now();
    } catch {}
}

function obterCanais() {
    if (cacheCanais.length === 0 || (Date.now() - cacheUltimaAtualizacao > 20 * 60 * 1000)) {
        atualizarCacheCanais();
    }
    return cacheCanais;
}

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
    const canais = obterCanais();
    if (canais.length === 0) return '#EXTM3U\n#EXTINF:-1,⚠️ Nenhum canal disponível\n';
    const canaisSelecionados = canais.slice(0, 5000);
    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro\n`;
    playlist += `#PLAYLIST: ${usuario.username} - ${usuario.plano.toUpperCase()}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;
    const grupos = {};
    canaisSelecionados.forEach(canal => {
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
                if (dados.username === ADMIN_USER && dados.password === ADMIN_PASS) {
                    const token = criarSessao();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, token }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas' }));
                }
            } catch {
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
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
        return;
    }

    // ============================================
    // ROTA: /dashboard (GET) - PROTEGIDA
    // ============================================
    if (pathname === '/dashboard') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        // Servir o index.html
        let filePath = './public/index.html';
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ROTA: / (RAIZ) - Servir login.html
    // ============================================
    if (pathname === '/') {
        let filePath = './public/login.html';
        if (!fs.existsSync(filePath)) {
            // Criar login.html com JavaScript que envia o token no header
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
            // Redirecionar para /dashboard com o token no header
            window.location.href = '/dashboard';
        } else {
            errorDiv.textContent = data.error || 'Credenciais inválidas';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Erro ao conectar';
        errorDiv.style.display = 'block';
    }
});

// Interceptar todas as requisições fetch para adicionar o token
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = 'Bearer ' + token;
    }
    return originalFetch.call(this, url, options);
};
</script>
</body>
</html>`;
            fs.writeFileSync('./public/login.html', loginHtml);
            filePath = './public/login.html';
        }
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ARQUIVOS ESTÁTICOS
    // ============================================
    if (pathname.startsWith('/assets/') || pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
        let filePath = '.' + pathname;
        if (!filePath.startsWith('./public')) filePath = './public' + pathname;
        try {
            if (fs.existsSync(filePath)) {
                serveStatic(filePath, res);
                return;
            }
        } catch {}
    }

    // ============================================
    // ROTA: /index.html (PROTEGIDA)
    // ============================================
    if (pathname === '/index.html') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return;
        }
        let filePath = './public/index.html';
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ROTA: /playlist.m3u e /get.php (PÚBLICAS)
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
    // ROTA: /player_api.php (PÚBLICA - Xtream Codes)
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
                { category_id: "2", category_name: "Angola", parent_id: 0 },
                { category_id: "3", category_name: "Moçambique", parent_id: 0 },
                { category_id: "4", category_name: "Portugal", parent_id: 0 },
                { category_id: "5", category_name: "Internacionais", parent_id: 0 },
                { category_id: "6", category_name: "SSTV", parent_id: 0 },
                { category_id: "7", category_name: "STV", parent_id: 0 },
                { category_id: "8", category_name: "SSApp", parent_id: 0 },
                { category_id: "9", category_name: "DNSRot", parent_id: 0 }
            ]));
            return;
        }

        if (action === 'get_live_streams') {
            const canais = obterCanais();
            const categoryMap = { 'ZAP':'1', 'Angola':'2', 'Moçambique':'3', 'Portugal':'4', 'Internacional':'5', 'SSTV':'6', 'STV':'7', 'SSApp':'8', 'DNSRot':'9' };
            const streams = canais.map((c, i) => ({
                num: i+1,
                name: c.nome,
                stream_type: "live",
                stream_id: i+1,
                stream_icon: c.logo || "",
                category_id: categoryMap[c.origem] || "1",
                container_extension: "ts",
                direct_source: c.url
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streams));
            return;
        }

        if (action === 'get_vod_categories' || action === 'get_series_categories' || action === 'get_vod_streams' || action === 'get_series') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }
    }

    // ============================================
    // 404 - ROTA NÃO ENCONTRADA
    // ============================================
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(PORT, async () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Servidor com Login Profissional!');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('==================================================');
    await atualizarCacheCanais();
});
