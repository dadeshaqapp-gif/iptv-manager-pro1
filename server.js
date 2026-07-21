// ============================================
// IPTV MANAGER PRO - DIAGNÓSTICO
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;

// ============================================
// CARREGAR USUÁRIOS DO JSON
// ============================================
let usuarios = [];
try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
    console.log(`✅ [DIAG] Usuários carregados do JSON: ${usuarios.length}`);
    console.log(`✅ [DIAG] Conteúdo: ${JSON.stringify(usuarios)}`);
} catch (err) {
    console.error(`❌ [DIAG] Erro ao carregar JSON: ${err.message}`);
    // Criar usuários de emergência
    usuarios = [
        {
            id: '1',
            username: 'teste',
            contato: 'teste@teste.com',
            password: '123456',
            plano: 'mensal',
            data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'ativo',
            mac_address: null
        },
        {
            id: '2',
            username: 'Dade',
            contato: 'dade@iptv.com',
            password: '123456',
            plano: 'anual',
            data_expiracao: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'ativo',
            mac_address: null
        }
    ];
    fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
    console.log(`✅ [DIAG] Usuários de emergência criados: ${usuarios.length}`);
}

// ============================================
// FUNÇÃO: LISTAR USUÁRIOS (COM LOG)
// ============================================
function listarUsuarios() {
    console.log(`📡 [DIAG] listarUsuarios() chamada. Total: ${usuarios.length}`);
    return usuarios;
}

// ============================================
// FUNÇÃO: VALIDAR USUÁRIO
// ============================================
function validarUsuario(username, password) {
    console.log(`🔍 [DIAG] Validando: ${username} / ${password}`);
    const user = usuarios.find(u => u.username === username && u.password === password);
    if (user) {
        console.log(`✅ [DIAG] Usuário encontrado: ${user.username}`);
    } else {
        console.log(`❌ [DIAG] Usuário NÃO encontrado: ${username}`);
    }
    return user || null;
}

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
// PLAYLIST IPTV-ORG
// ============================================
const PLAYLIST_IPTV_ORG = 'https://iptv-org.github.io/iptv/index.m3u';

const SERVIDOR_FIXO = {
    url: 'http://play.dnsrot.vip:80',
    usuario: 'Farleyjm',
    senha: 'yz6ncyyfadu'
};

// ============================================
// FUNÇÃO: BUSCAR CANAIS
// ============================================
async function buscarCanaisIPTVOrg() {
    try {
        console.log('📡 Baixando playlist do IPTV-org...');
        const response = await fetch(PLAYLIST_IPTV_ORG);
        if (!response.ok) {
            console.error('❌ Erro ao baixar playlist:', response.status);
            return [];
        }
        const playlist = await response.text();
        console.log(`✅ Playlist baixada (${playlist.length} bytes)`);
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const matchNome = linhaLimpa.match(/,([^,]+)$/);
                const nome = matchNome ? matchNome[1] : 'Canal';
                const matchLogo = linhaLimpa.match(/tvg-logo="([^"]+)"/);
                const logo = matchLogo ? matchLogo[1] : '';
                canalAtual = { nome, url: '', logo };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                canalAtual.url = linhaLimpa;
                canais.push(canalAtual);
                canalAtual = null;
            }
        }
        console.log(`✅ ${canais.length} canais encontrados`);
        return canais;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    let canais = await buscarCanaisIPTVOrg();
    if (canais.length === 0) {
        console.log('⚠️ Usando servidor fixo como fallback...');
        const urlBase = SERVIDOR_FIXO.url.replace(/\/$/, '');
        const urlPlaylist = `${urlBase}/get.php?username=${SERVIDOR_FIXO.usuario}&password=${SERVIDOR_FIXO.senha}&type=m3u_plus&output=ts`;
        const response = await fetch(urlPlaylist);
        if (!response.ok) {
            console.error('❌ Erro ao baixar playlist:', response.status);
            return [];
        }
        const playlist = await response.text();
        const linhas = playlist.split('\n');
        const canaisFallback = [];
        let canalAtual = null;
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const match = linhaLimpa.match(/,([^,]+)$/);
                const nome = match ? match[1] : 'Canal';
                canalAtual = { nome, url: '' };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                canalAtual.url = linhaLimpa;
                canaisFallback.push(canalAtual);
                canalAtual = null;
            }
        }
        canais = canaisFallback;
        console.log(`✅ ${canais.length} canais do fallback`);
    }

    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro - ${usuario.username}\n`;
    playlist += `#EXTINF:-1,Plano: ${usuario.plano.toUpperCase()} | Expira em: ${diasRestantes} dias\n\n`;

    if (canais.length === 0) {
        playlist += '#EXTINF:-1,⚠️ Nenhum canal disponível\n';
        playlist += 'http://exemplo.com/sem-canal.ts\n';
        return playlist;
    }

    const canaisSelecionados = canais.slice(0, 200);
    canaisSelecionados.forEach(canal => {
        const logo = canal.logo || '';
        playlist += `#EXTINF:-1 tvg-logo="${logo}",${canal.nome}\n`;
        playlist += `${canal.url}\n\n`;
    });

    console.log(`✅ Playlist gerada com ${canaisSelecionados.length} canais`);
    return playlist;
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
        if (mac) {
            user = usuarios.find(u => u.mac_address === mac);
        } else if (username && password) {
            user = validarUsuario(username, password);
        }

        if (!user) {
            console.log(`❌ [DIAG] Playlist negada: ${username || mac}`);
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
        console.log(`📡 [DIAG] Requisição /api/usuarios`);
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
        console.log(`✅ [DIAG] Retornando ${usuariosLimpos.length} usuários`);
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
                const urlPlaylist = `https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=${novoUsuario.username}&password=${novoUsuario.password}`;

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: novoUsuario,
                    url: urlPlaylist,
                    message: 'Usuário criado com sucesso!'
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

server.listen(PORT, () => {
    const ip = obterIpLocal();
    console.log('📺 IPTV Manager Pro - Servidor rodando!');
    console.log('🌐 Local: http://localhost:' + PORT);
    console.log('🌐 Rede: http://' + ip + ':' + PORT);
    console.log('📋 Playlist: https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=USUARIO&password=SENHA');
    console.log('============================================');
});

// Salvar usuários automaticamente
setInterval(() => {
    try { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); } catch (err) {}
}, 30000);
