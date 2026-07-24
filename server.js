// ============================================
// IPTV MANAGER PRO - AUTENTICAÇÃO POR COOKIE
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8888;
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'iptv2024';
const sessoes = {};
const TEMPO_SESSAO = 24 * 60 * 60 * 1000;

function gerarToken() { return crypto.randomBytes(32).toString('hex'); }

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

function destruirSessao(token) {
    if (token && sessoes[token]) delete sessoes[token];
}

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

// ============================================
// DADOS DE EXEMPLO
// ============================================
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

function validarPorMac(mac) {
    if (!mac) return null;
    return usuarios.find(u => u.mac_address === mac) || null;
}

// ============================================
// SERVIDOR
// ============================================
const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // ============================================
    // ROTA: /api/login (POST) - Cria cookie
    // ============================================
    if (pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const dados = JSON.parse(body);
                if (dados.username === ADMIN_USER && dados.password === ADMIN_PASS) {
                    const token = criarSessao();
                    // Criar cookie com o token
                    res.setHeader('Set-Cookie', [
                        `token=${token}; HttpOnly; Max-Age=${TEMPO_SESSAO / 1000}; Path=/; SameSite=Lax`,
                        `authenticated=true; Max-Age=${TEMPO_SESSAO / 1000}; Path=/; SameSite=Lax`
                    ]);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, token }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Erro interno' }));
            }
        });
        return;
    }

    // ============================================
    // ROTA: /api/logout (POST) - Remove cookie
    // ============================================
    if (pathname === '/api/logout' && req.method === 'POST') {
        const cookies = req.headers.cookie ? req.headers.cookie.split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v;
            return acc;
        }, {}) : {};
        const token = cookies.token;
        destruirSessao(token);
        res.setHeader('Set-Cookie', [
            'token=; Max-Age=0; Path=/',
            'authenticated=; Max-Age=0; Path=/'
        ]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Logout realizado' }));
        return;
    }

    // ============================================
    // ROTA: /api/usuarios (GET) - Verifica cookie
    // ============================================
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        const cookies = req.headers.cookie ? req.headers.cookie.split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v;
            return acc;
        }, {}) : {};
        const token = cookies.token;

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
    // ROTA: /dashboard - Verifica cookie
    // ============================================
    if (pathname === '/dashboard') {
        const cookies = req.headers.cookie ? req.headers.cookie.split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v;
            return acc;
        }, {}) : {};
        const token = cookies.token;

        if (!token || !validarSessao(token)) {
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return;
        }
        serveStatic('./public/index.html', res);
        return;
    }

    // ============================================
    // ROTA: / (RAIZ) - Login
    // ============================================
    if (pathname === '/') {
        serveStatic('./public/login.html', res);
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
        const playlist = '#EXTM3U\n#EXTINF:-1,Teste Canal\nhttp://exemplo.com/stream.ts';
        res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
        res.end(playlist);
        return;
    }

    // ============================================
    // ARQUIVOS ESTÁTICOS
    // ============================================
    let filePath = './public' + pathname;
    try {
        if (fs.existsSync(filePath)) { serveStatic(filePath, res); return; }
    } catch {}
    res.writeHead(404);
    res.end('Rota não encontrada');
});

server.listen(PORT, () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Autenticação por Cookie');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('==================================================');
});
