// ============================================
// IPTV MANAGER PRO - AGREGADOR DE SERVIDORES
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// SERVIDORES ESTÁVEIS (VECTOR PLAYER)
// ============================================
const SERVERS = [
    {
        id: 1,
        url: 'http://stv.sstv.cx:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'SSTV'
    },
    {
        id: 2,
        url: 'http://stv.cx:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'STV'
    },
    {
        id: 3,
        url: 'http://ssapp.ch:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'SSApp'
    },
    {
        id: 4,
        url: 'http://play.dnsrot.vip:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'DNSRot'
    }
];

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
// FUNÇÃO: BUSCAR CANAIS DE UM SERVIDOR
// ============================================
async function buscarCanaisServer(server) {
    try {
        console.log(`📡 [${server.nome}] A buscar canais...`);
        const urlPlaylist = `${server.url}/get.php?username=${server.usuario}&password=${server.senha}&type=m3u_plus&output=ts`;
        
        const response = await fetch(urlPlaylist, { timeout: 15000 });
        if (!response.ok) {
            console.log(`⚠️ ${server.nome} indisponível (status: ${response.status})`);
            return [];
        }
        
        const playlist = await response.text();
        console.log(`✅ ${server.nome}: ${playlist.length} bytes`);
        
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
                canalAtual = { nome, url: '', logo, origem: server.nome };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                if (linhaLimpa.startsWith('http://') || linhaLimpa.startsWith('https://')) {
                    canalAtual.url = linhaLimpa;
                    canais.push(canalAtual);
                }
                canalAtual = null;
            }
        }
        console.log(`✅ ${server.nome}: ${canais.length} canais`);
        return canais;
    } catch (error) {
        console.error(`❌ ${server.nome}: ${error.message}`);
        return [];
    }
}

// ============================================
// FUNÇÃO: BUSCAR TODOS OS SERVIDORES EM PARALELO
// ============================================
async function buscarTodosServidores() {
    console.log('🚀 A buscar canais de todos os servidores em paralelo...');
    
    const resultados = await Promise.all(
        SERVERS.map(server => buscarCanaisServer(server))
    );
    
    const todosCanais = [];
    const vistos = new Set();
    
    resultados.forEach((canais, index) => {
        const nomeServer = SERVERS[index].nome;
        let adicionados = 0;
        for (const canal of canais) {
            const key = canal.nome + '|' + canal.url;
            if (!vistos.has(key)) {
                vistos.add(key);
                todosCanais.push(canal);
                adicionados++;
            }
        }
        console.log(`📊 ${nomeServer}: ${adicionados} canais únicos`);
    });
    
    console.log(`✅ Total: ${todosCanais.length} canais únicos`);
    return todosCanais;
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST M3U
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    console.log(`📡 Gerando playlist para ${usuario.username}...`);

    const canais = await buscarTodosServidores();

    if (canais.length === 0) {
        console.log('⚠️ Nenhum canal encontrado');
        return '#EXTM3U\n#EXTINF:-1,⚠️ Nenhum canal disponível\n';
    }

    // Limitar a 5000 canais
    const canaisSelecionados = canais.slice(0, 5000);

    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro\n`;
    playlist += `#PLAYLIST: ${usuario.username} - ${usuario.plano.toUpperCase()}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;

    // Organizar por servidor de origem
    const grupos = {};
    canaisSelecionados.forEach(canal => {
        const grupo = canal.origem || '📡 Vector';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });

    // Ordenar grupos
    const ordemGrupos = ['SSTV', 'STV', 'SSApp', 'DNSRot'];
    const gruposOrdenados = [];
    for (const grupo of ordemGrupos) {
        if (grupos[grupo]) {
            gruposOrdenados.push(grupo);
            delete grupos[grupo];
        }
    }
    for (const grupo of Object.keys(grupos).sort()) {
        gruposOrdenados.push(grupo);
    }

    for (const grupo of gruposOrdenados) {
        const canaisDoGrupo = grupos[grupo] || [];
        playlist += `#EXTINF:-1 tvg-logo="",📁 📡 ${grupo}\n`;
        playlist += `#EXTGRP:${grupo}\n`;
        
        canaisDoGrupo.forEach(canal => {
            const logo = canal.logo || '';
            const nome = canal.nome || 'Canal';
            playlist += `#EXTINF:-1 tvg-logo="${logo}",${nome}\n`;
            playlist += `${canal.url}\n`;
        });
        playlist += '\n';
    }

    console.log(`✅ Playlist gerada com ${canaisSelecionados.length} canais`);
    return playlist;
}

// ============================================
// CARREGAR USUÁRIOS
// ============================================
try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
    console.log(`✅ Usuários carregados: ${usuarios.length}`);
} catch (err) {
    console.error(`❌ Erro ao carregar JSON: ${err.message}`);
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
    console.log(`✅ Usuários de emergência criados: ${usuarios.length}`);
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

    // ===== PLAYLIST (M3U e Xtream Codes) =====
    if (pathname === '/playlist.m3u' || pathname === '/get.php') {
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

setInterval(() => {
    try { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); } catch (err) { }
}, 30000);
