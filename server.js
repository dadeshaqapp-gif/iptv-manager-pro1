// ============================================
// IPTV MANAGER PRO - COM WHATSAPP
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

function gerarToken() { return crypto.randomBytes(32).toString('hex'); }
function criarSessao() { const token = gerarToken(); sessoes[token] = { criado_em: Date.now(), valido: true }; return token; }
function validarSessao(token) { if (!token) return false; const sessao = sessoes[token]; if (!sessao || !sessao.valido) return false; return true; }

function gerarSenhaAleatoria(tamanho = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    let senha = '';
    for (let i = 0; i < tamanho; i++) senha += chars.charAt(Math.floor(Math.random() * chars.length));
    return senha;
}

function calcularExpiracao(plano) {
    const agora = new Date();
    const duracaoMap = {
        teste: 2 * 60 * 60 * 1000,
        mensal: 30 * 24 * 60 * 60 * 1000,
        trimestral: 90 * 24 * 60 * 60 * 1000,
        anual: 365 * 24 * 60 * 60 * 1000
    };
    return new Date(agora.getTime() + (duracaoMap[plano] || duracaoMap.mensal));
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
// WHATSAPP NOTIFICATIONS
// ============================================
const CONTATO_PROVEDOR = '879641990';

function formatarNumeroWhatsApp(numero) {
    // Remove caracteres não numéricos
    const limpo = numero.replace(/\D/g, '');
    // Adiciona código do país se não tiver (258 = Moçambique)
    if (limpo.startsWith('8') && limpo.length === 9) {
        return `258${limpo}`;
    }
    return limpo;
}

function gerarMensagemRenovacao(usuario, plano, novaData) {
    const dataFormatada = new Date(novaData).toLocaleDateString('pt-PT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const emoji = plano === 'teste' ? '🎯' : plano === 'mensal' ? '📅' : plano === 'trimestral' ? '📆' : '📅';
    const planoTexto = plano.toUpperCase();
    return `🔔 ${emoji} Sua assinatura IPTV foi renovada!

Olá ${usuario.username}, sua assinatura ${planoTexto} foi atualizada com sucesso!

📅 Nova data de expiração: ${dataFormatada}
📱 Para renovar: Contacte o Provedor ${CONTATO_PROVEDOR}

Aproveite os seus canais! 📺`;
}

async function enviarWhatsApp(numero, mensagem) {
    const numeroFormatado = formatarNumeroWhatsApp(numero);
    console.log(`📱 Enviando WhatsApp para ${numeroFormatado}...`);
    console.log(`📝 Mensagem: ${mensagem}`);

    // TODO: Integrar com WhatsApp Cloud API
    // Por enquanto, apenas log
    return { success: true, message: 'Simulação de envio' };
}

async function notificarRenovacao(usuario, plano, novaData) {
    if (!usuario.contato) {
        console.log(`⚠️ Usuário ${usuario.username} não tem contato para notificação`);
        return;
    }
    const mensagem = gerarMensagemRenovacao(usuario, plano, novaData);
    await enviarWhatsApp(usuario.contato, mensagem);
}

// ============================================
// DADOS: USUÁRIOS E CANAIS
// ============================================
let usuarios = [];
try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
    console.log(`✅ ${usuarios.length} usuários carregados`);
} catch {
    usuarios = [];
    fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
}

const CANAIS_FALLBACK = [
    { nome: 'ZAP Novelas', url: 'http://zap.ao/novelas', origem: 'ZAP' },
    { nome: 'ZAP Viva', url: 'http://zap.ao/viva', origem: 'ZAP' },
    { nome: 'ZAP Cinema', url: 'http://zap.ao/cinema', origem: 'ZAP' },
    { nome: 'RTP 1', url: 'http://rtp.pt/rtp1', origem: 'Portugal' },
    { nome: 'SIC', url: 'http://sic.pt/sic', origem: 'Portugal' },
    { nome: 'TVI', url: 'http://tvi.pt/tvi', origem: 'Portugal' },
    { nome: 'CNN Internacional', url: 'http://cnn.com/international', origem: 'Internacional' },
    { nome: 'BBC World News', url: 'http://bbc.com/world', origem: 'Internacional' },
];

function validarUsuario(username, password) {
    return usuarios.find(u => u.username === username && u.password === password) || null;
}

function validarPorMac(mac) {
    if (!mac) return null;
    return usuarios.find(u => u.mac_address === mac) || null;
}

function salvarUsuarios() { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); }

function criarUsuario(dados) {
    const { username, password, plano, contato, mac } = dados;
    const dataExpiracao = calcularExpiracao(plano);
    const novoUsuario = {
        id: 'usr_' + Date.now(),
        username,
        password: password || gerarSenhaAleatoria(10),
        contato: contato || null,
        plano: plano || 'teste',
        data_expiracao: dataExpiracao.toISOString(),
        status: 'ativo',
        mac_address: mac || null,
        criado_em: new Date().toISOString()
    };
    usuarios.push(novoUsuario);
    salvarUsuarios();
    return novoUsuario;
}

function renovarUsuario(id, plano) {
    const user = usuarios.find(u => u.id === id);
    if (!user) throw new Error('Usuário não encontrado');
    const dataExpiracao = calcularExpiracao(plano);
    user.data_expiracao = dataExpiracao.toISOString();
    user.plano = plano;
    user.status = 'ativo';
    salvarUsuarios();
    return user;
}

function excluirUsuario(id) {
    const index = usuarios.findIndex(u => u.id === id);
    if (index === -1) throw new Error('Usuário não encontrado');
    usuarios.splice(index, 1);
    salvarUsuarios();
}

async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));
    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro - ${usuario.username}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;
    const grupos = {};
    CANAIS_FALLBACK.forEach(canal => {
        const grupo = canal.origem || 'Canais';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });
    for (const grupo of Object.keys(grupos)) {
        playlist += `#EXTINF:-1 tvg-logo="",📁 ${grupo}\n`;
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
                if (dados.username === ADMIN_USER && dados.password === ADMIN_PASS) {
                    const token = criarSessao();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, token }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas' }));
                }
            } catch { res.writeHead(500); res.end(); }
        });
        return;
    }

    // ===== USUARIOS =====
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

    // ===== CRIAR =====
    if (pathname === '/api/criar' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const dados = JSON.parse(body);
                const { username, password, plano, contato, mac } = dados;
                if (!username) throw new Error('Username é obrigatório');
                if (usuarios.some(u => u.username === username)) throw new Error('Username já existe');
                const novo = criarUsuario({ username, password: password || gerarSenhaAleatoria(10), plano, contato, mac });
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: novo }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // ===== RENOVAR =====
    if (pathname === '/api/renovar' && req.method === 'PUT') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const dados = JSON.parse(body);
                const { id, plano } = dados;
                if (!id || !plano) throw new Error('ID e plano são obrigatórios');
                const user = renovarUsuario(id, plano);
                
                // Enviar notificação WhatsApp
                await notificarRenovacao(user, plano, user.data_expiracao);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: user, notificacao: 'Enviada' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // ===== NOTIFICAR (ENVIAR WHATSAPP MANUALMENTE) =====
    if (pathname === '/api/notificar' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const dados = JSON.parse(body);
                const { id } = dados;
                const user = usuarios.find(u => u.id === id);
                if (!user) throw new Error('Usuário não encontrado');
                if (!user.contato) throw new Error('Usuário não tem contato');
                
                const mensagem = gerarMensagemRenovacao(user, user.plano, user.data_expiracao);
                await enviarWhatsApp(user.contato, mensagem);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Notificação enviada!' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // ===== EXCLUIR =====
    if (pathname.startsWith('/api/excluir/') && req.method === 'DELETE') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
        const id = pathname.replace('/api/excluir/', '');
        try {
            excluirUsuario(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Usuário excluído' }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // ===== DASHBOARD =====
    if (pathname === '/dashboard') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validarSessao(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado', redirect: '/' }));
            return;
        }
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

    // ===== ESTÁTICOS =====
    let filePath = '.' + pathname;
    if (!filePath.startsWith('./public')) filePath = './public' + pathname;
    try {
        if (fs.existsSync(filePath)) { serveStatic(filePath, res); return; }
    } catch {}
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

server.listen(PORT, () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Com WhatsApp');
    console.log('🌐 Porta: ' + PORT);
    console.log('🔑 Admin: admin / iptv2024');
    console.log('📱 WhatsApp: ' + CONTATO_PROVEDOR);
    console.log('==================================================');
});
