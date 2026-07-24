// ============================================
// IPTV MANAGER PRO - VERSÃO DEFINITIVA
// Pesquisa ativa de servidores Vector Player
// Cache de canais com redundância
// Fallback automático para TV Garden
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 8888;
const VECTOR_API_KEY = '94281efe5dcb09c000bf0cd825e856519219a41d54c31d32487baf1b2d6e6e51';
const VECTOR_API_URL = 'https://vectorplayer.com/api/develop/listas';

// ============================================
// ADMIN LOGIN
// ============================================
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'iptv2024';
const sessoes = {};

function gerarToken() { return crypto.randomBytes(32).toString('hex'); }
function criarSessao() { const token = gerarToken(); sessoes[token] = { criado_em: Date.now(), valido: true }; return token; }
function validarSessao(token) { if (!token) return false; const sessao = sessoes[token]; if (!sessao || !sessao.valido) return false; return true; }

// ============================================
// CANAIS DE FALLBACK (SEMPRE DISPONÍVEIS)
// ============================================
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

// ============================================
// CACHE GLOBAL
// ============================================
let cacheServidores = [];
let cacheCanais = [];
let cacheUltimaAtualizacao = 0;
let estaAAtualizar = false;

// ============================================
// FUNÇÃO: BUSCAR SERVIDORES VECTOR PLAYER (USANDO A API)
// ============================================
async function buscarServidoresVectorPlayer() {
    try {
        console.log('📡 [Vector Player] A buscar lista de servidores...');
        const response = await fetch(VECTOR_API_URL, {
            headers: { 'Authorization': `Bearer ${VECTOR_API_KEY}` }
        });
        if (!response.ok) {
            console.error(`⚠️ [Vector Player] Erro ao buscar servidores: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            console.log('⚠️ [Vector Player] Nenhum servidor encontrado.');
            return [];
        }
        // Filtrar apenas servidores com status "Active"
        const servidores = data.data.filter(s => s.status === 'Active');
        console.log(`✅ [Vector Player] ${servidores.length} servidores ativos encontrados.`);
        return servidores;
    } catch (error) {
        console.error('❌ [Vector Player] Erro:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: TESTAR CONECTIVIDADE DE UM SERVIDOR
// ============================================
async function testarServidor(servidor) {
    const url = `${servidor.url}/get.php?username=${servidor.usuario}&password=${servidor.senha}&type=m3u_plus&output=ts`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return response.ok;
    } catch {
        return false;
    }
}

// ============================================
// FUNÇÃO: BUSCAR CANAIS DE UM SERVIDOR
// ============================================
async function buscarCanaisDeServidor(servidor) {
    const url = `${servidor.url}/get.php?username=${servidor.usuario}&password=${servidor.senha}&type=m3u_plus&output=ts`;
    try {
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
                canalAtual = { nome, url: '', origem: servidor.nome || servidor.url };
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

// ============================================
// FUNÇÃO: ATUALIZAR CACHE (PESQUISA ATIVA)
// ============================================
async function atualizarCache() {
    if (estaAAtualizar) return;
    estaAAtualizar = true;
    console.log('🔄 [CACHE] A iniciar pesquisa ativa de servidores...');

    try {
        // 1. Buscar todos os servidores da API
        const servidores = await buscarServidoresVectorPlayer();
        if (servidores.length === 0) {
            console.log('⚠️ [CACHE] Nenhum servidor encontrado. A usar fallback.');
            cacheServidores = [];
            cacheCanais = CANAIS_FALLBACK;
            cacheUltimaAtualizacao = Date.now();
            estaAAtualizar = false;
            return;
        }

        // 2. Testar conectividade em paralelo (máx 10 simultâneos)
        const servidoresParaTestar = servidores.slice(0, 50); // Testar os primeiros 50
        console.log(`🧪 [CACHE] A testar ${servidoresParaTestar.length} servidores...`);

        const servidoresOnline = [];
        for (const servidor of servidoresParaTestar) {
            const online = await testarServidor(servidor);
            if (online) {
                servidoresOnline.push(servidor);
                console.log(`✅ [CACHE] Servidor online: ${servidor.url}`);
            }
        }

        console.log(`✅ [CACHE] ${servidoresOnline.length} servidores online confirmados.`);

        // 3. Buscar canais dos servidores online
        let todosCanais = [];
        for (const servidor of servidoresOnline.slice(0, 10)) { // Buscar dos 10 primeiros online
            const canais = await buscarCanaisDeServidor(servidor);
            if (canais.length > 0) {
                console.log(`📡 [CACHE] Servidor ${servidor.url}: ${canais.length} canais`);
                todosCanais = [...todosCanais, ...canais];
            }
        }

        // 4. Combinar com fallback e remover duplicados
        const todos = [...todosCanais, ...CANAIS_FALLBACK];
        const unicos = [];
        const vistos = new Set();
        for (const canal of todos) {
            const key = canal.nome + '|' + canal.url;
            if (!vistos.has(key)) {
                vistos.add(key);
                unicos.push(canal);
            }
        }

        cacheServidores = servidoresOnline;
        cacheCanais = unicos;
        cacheUltimaAtualizacao = Date.now();
        console.log(`✅ [CACHE] ${cacheCanais.length} canais disponíveis!`);
    } catch (error) {
        console.error('❌ [CACHE] Erro:', error.message);
        if (cacheCanais.length === 0) {
            cacheCanais = CANAIS_FALLBACK;
        }
    } finally {
        estaAAtualizar = false;
    }
}

function obterCanais() {
    if (cacheCanais.length === 0 || (Date.now() - cacheUltimaAtualizacao > 30 * 60 * 1000)) {
        atualizarCache();
    }
    return cacheCanais;
}

// ============================================
// FUNÇÃO: SERVE ARQUIVOS ESTÁTICOS
// ============================================
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
// CARREGAR USUÁRIOS
// ============================================
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
const server = http.createServer(async (req, res) => {
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
    // ROTA: /api/login
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
    // ROTA: /api/usuarios (PROTEGIDA)
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
    // ROTA: /dashboard (PROTEGIDA)
    // ============================================
    if (pathname === '/dashboard') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        let filePath = './public/index.html';
        serveStatic(filePath, res);
        return;
    }

    // ============================================
    // ROTA: / (RAIZ) - Login
    // ============================================
    if (pathname === '/') {
        let filePath = './public/login.html';
        if (!fs.existsSync(filePath)) {
            const loginHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>IPTV Manager Pro - Login</title>
<style>body{font-family:Arial;background:#0a0e17;color:#e0e0e0;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.login-container{background:#141b2b;padding:40px;border-radius:12px;border:1px solid #1a2a3a;width:100%;max-width:380px}h1{color:#00d4ff;text-align:center;margin-bottom:30px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#8899aa}input{width:100%;padding:12px;border-radius:8px;border:1px solid #1a2a3a;background:#0a0e17;color:#e0e0e0;font-size:16px}input:focus{border-color:#00d4ff;outline:none}button{width:100%;padding:12px;border:none;border-radius:8px;background:#00d4ff;color:#0a0e17;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#00b8e6}.error{color:#ff5252;text-align:center;margin-top:15px;display:none}.logo{text-align:center;font-size:48px;margin-bottom:20px}</style>
</head>
<body>
<div class="login-container"><div class="logo">📺</div><h1>IPTV Manager Pro</h1>
<form id="loginForm">
<div class="form-group"><label>👤 Utilizador</label><input type="text" id="username" value="admin" required></div>
<div class="form-group"><label>🔑 Senha</label><input type="password" id="password" value="iptv2024" required></div>
<button type="submit">Entrar</button>
<div id="error" class="error">Credenciais inválidas!</div>
</form></div>
<script>
document.getElementById('loginForm').addEventListener('submit', async function(e){
e.preventDefault();const username=document.getElementById('username').value;const password=document.getElementById('password').value;const errorDiv=document.getElementById('error');errorDiv.style.display='none';
try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await response.json();if(data.success){localStorage.setItem('token',data.token);window.location.href='/dashboard';}else{errorDiv.textContent=data.error||'Credenciais inválidas';errorDiv.style.display='block';}
}catch(error){errorDiv.textContent='Erro ao conectar';errorDiv.style.display='block';}
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

        const playlist = await gerarPlaylistM3U(user);
        res.writeHead(200, {
            'Content-Type': 'audio/x-mpegurl',
            'Content-Disposition': 'attachment; filename="playlist.m3u"'
        });
        res.end(playlist);
        return;
    }

    // ============================================
    // ROTA: /player_api.php (Xtream Codes)
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
                { category_id: "6", category_name: "Vector Player", parent_id: 0 },
                { category_id: "7", category_name: "TV Garden", parent_id: 0 }
            ]));
            return;
        }

        if (action === 'get_live_streams') {
            const canais = obterCanais();
            const categoryMap = { 'ZAP':'1', 'Angola':'2', 'Moçambique':'3', 'Portugal':'4', 'Internacional':'5', 'Vector Player':'6', 'TV Garden':'7' };
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
        await fs.promises.access(filePath);
        serveStatic(filePath, res);
    } catch {
        res.writeHead(404);
        res.end('Rota não encontrada');
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(PORT, async () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Servidor Definitivo');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('==================================================');
    console.log('🚀 [CACHE] A iniciar pesquisa ativa de servidores...');
    await atualizarCache();
    console.log(`✅ [CACHE] Pronto! ${cacheCanais.length} canais disponíveis.`);
    console.log('==================================================');
});

setInterval(() => {
    console.log('🔄 [CACHE] A atualizar servidores (30 minutos)');
    atualizarCache();
}, 30 * 60 * 1000);
