// ============================================
// IPTV MANAGER PRO - COM LOGIN
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 8888;

// ============================================
// CONFIGURAÇÃO DE LOGIN
// ============================================
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'iptv2024';  // Podes mudar depois

// Sessões: armazenar tokens temporários
const sessoes = {};
const TEMPO_SESSAO = 24 * 60 * 60 * 1000; // 24 horas

// ============================================
// FUNÇÕES DE SESSÃO
// ============================================
function gerarToken() {
    return crypto.randomBytes(32).toString('hex');
}

function criarSessao() {
    const token = gerarToken();
    sessoes[token] = {
        criado_em: Date.now(),
        valido: true
    };
    // Limpar sessões antigas
    for (const [key, sessao] of Object.entries(sessoes)) {
        if (Date.now() - sessao.criado_em > TEMPO_SESSAO) {
            delete sessoes[key];
        }
    }
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
    if (token && sessoes[token]) {
        delete sessoes[token];
    }
}

// ============================================
// SERVIDORES E CANAIS (MANTIDOS)
// ============================================
// ... (o código dos servidores e canais continua igual)

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
// CRIAR SERVIDOR
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
    // ROTA DE LOGIN
    // ============================================
    if (pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const dados = JSON.parse(body);
                const { username, password } = dados;

                if (username === ADMIN_USER && password === ADMIN_PASS) {
                    const token = criarSessao();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        token: token,
                        message: 'Login realizado com sucesso!'
                    }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Credenciais inválidas'
                    }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
        return;
    }

    // ============================================
    // ROTA DE LOGOUT
    // ============================================
    if (pathname === '/api/logout' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        destruirSessao(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Logout realizado' }));
        return;
    }

    // ============================================
    // VERIFICAR AUTENTICAÇÃO PARA ROTAS PROTEGIDAS
    // ============================================
    const isProtected = pathname === '/' || pathname === '/dashboard' || pathname === '/api/usuarios';

    if (isProtected) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        // Se for a página de login, servir normalmente
        if (pathname === '/' && !token) {
            // Servir página de login
            let filePath = './public/login.html';
            if (!fs.existsSync(filePath)) {
                // Se não existir login.html, criar
                const loginHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPTV Manager Pro - Login</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0a0e17; color: #e0e0e0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
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

        // Verificar token para páginas protegidas
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
    }

    // ============================================
    // ROTAS DA API (MANTIDAS)
    // ============================================
    // ... (código das rotas /api/usuarios, /playlist.m3u, /player_api.php, etc.)
    
    // ============================================
    // ARQUIVOS ESTÁTICOS
    // ============================================
    let filePath = '.' + pathname;
    if (filePath === './') filePath = './public/index.html';
    if (filePath === './dashboard') filePath = './public/index.html';
    if (!filePath.startsWith('./public')) filePath = './public' + pathname;

    // Verificar se o arquivo existe
    try {
        await fs.promises.access(filePath);
        serveStatic(filePath, res);
    } catch {
        res.writeHead(404);
        res.end('Arquivo não encontrado');
    }
});

server.listen(PORT, async () => {
    console.log('📺 IPTV Manager Pro - Servidor com Login!');
    console.log('🌐 Local: http://localhost:' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('============================================');
});
