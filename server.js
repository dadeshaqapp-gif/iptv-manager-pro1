// ============================================
// IPTV MANAGER PRO - VERIFICAÇÃO DE AUTENTICAÇÃO
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8888;
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'iptv2024';
const sessoes = {};

function gerarToken() { return crypto.randomBytes(32).toString('hex'); }
function criarSessao() { const token = gerarToken(); sessoes[token] = { criado_em: Date.now(), valido: true }; return token; }
function validarSessao(token) { if (!token) return false; const sessao = sessoes[token]; if (!sessao || !sessao.valido) return false; return true; }

function serveStatic(filePath, res) {
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    if (extname === '.css') contentType = 'text/css';
    if (extname === '.js') contentType = 'application/javascript';
    if (extname === '.png') contentType = 'image/png';
    if (extname === '.jpg' || extname === '.jpeg') contentType = 'image/jpeg';
    fs.readFile(filePath, (error, content) => {
        if (error) { res.writeHead(404); res.end('Arquivo não encontrado'); }
        else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content); }
    });
}

// Dados básicos
let usuarios = [];
try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
} catch {
    usuarios = [
        { id: '1', username: 'teste', contato: 'teste@teste.com', password: '123456', plano: 'mensal', data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null }
    ];
    fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
}

function validarUsuario(username, password) {
    return usuarios.find(u => u.username === username && u.password === password) || null;
}

const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // ===== LOGIN =====
    if (pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const dados = JSON.parse(body);
                console.log(`🔑 Login: ${dados.username}`);
                if (dados.username === ADMIN_USER && dados.password === ADMIN_PASS) {
                    const token = criarSessao();
                    console.log(`✅ Token gerado: ${token.substring(0, 20)}...`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, token }));
                } else {
                    console.log(`❌ Login falhou: ${dados.username}`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas' }));
                }
            } catch (error) { res.writeHead(500); res.end(); }
        });
        return;
    }

    // ===== USUARIOS (PROTEGIDO) =====
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        console.log(`🔍 Token recebido: ${token ? token.substring(0, 20) + '...' : 'NENHUM'}`);
        
        if (!token || !validarSessao(token)) {
            console.log('❌ Token inválido!');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        console.log('✅ Token válido!');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
        return;
    }

    // ===== DASHBOARD (PROTEGIDO) =====
    if (pathname === '/dashboard') {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        console.log(`🔍 Dashboard - Token: ${token ? token.substring(0, 20) + '...' : 'NENHUM'}`);
        
        if (!token || !validarSessao(token)) {
            console.log('❌ Dashboard - Token inválido!');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        console.log('✅ Dashboard - Token válido!');
        serveStatic('./public/index.html', res);
        return;
    }

    // ===== RAIZ =====
    if (pathname === '/') {
        serveStatic('./public/login.html', res);
        return;
    }

    // ===== PLAYLIST =====
    if (pathname === '/playlist.m3u' || pathname === '/get.php') {
        const username = reqUrl.searchParams.get('username');
        const password = reqUrl.searchParams.get('password');
        const user = validarUsuario(username, password);
        if (!user) {
            res.writeHead(401);
            res.end('Erro: Credenciais inválidas');
            return;
        }
        const playlist = '#EXTM3U\n#EXTINF:-1,Teste Canal\nhttp://exemplo.com/stream.ts';
        res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
        res.end(playlist);
        return;
    }

    // ===== ESTÁTICOS =====
    let filePath = './public' + pathname;
    try {
        if (fs.existsSync(filePath)) { serveStatic(filePath, res); return; }
    } catch {}
    res.writeHead(404);
    res.end('Rota não encontrada');
});

server.listen(PORT, () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Modo Debug');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('📡 Logs de autenticação ativados!');
    console.log('==================================================');
});
