// ============================================
// IPTV MANAGER PRO - MÚLTIPLOS SERVIDORES VECTOR
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// SERVIDORES VECTOR PLAYER (ESTÁVEIS)
// ============================================
const SERVERS_VECTOR = [
    {
        id: 1,
        url: 'http://stv.sstv.cx:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'SSTV Server'
    },
    {
        id: 2,
        url: 'http://stv.cx:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'STV Server'
    },
    {
        id: 3,
        url: 'http://ssapp.ch:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'SSApp Server'
    },
    {
        id: 4,
        url: 'http://play.dnsrot.vip:80',
        usuario: 'Farleyjm',
        senha: 'yz6ncyyfadu',
        nome: 'DNSRot Server'
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
// FUNÇÃO: BUSCAR CANAIS DE UM SERVIDOR VECTOR
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
        console.log(`✅ ${server.nome}: Playlist baixada (${playlist.length} bytes)`);
        
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        let count = 0;
        
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const matchNome = linhaLimpa.match(/,([^,]+)$/);
                const nome = matchNome ? matchNome[1] : 'Canal';
                const matchLogo = linhaLimpa.match(/tvg-logo="([^"]+)"/);
                const logo = matchLogo ? matchLogo[1] : '';
                canalAtual = { nome, url: '', logo, grupo: server.nome };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                if (linhaLimpa.startsWith('http://') || linhaLimpa.startsWith('https://')) {
                    canalAtual.url = linhaLimpa;
                    canais.push(canalAtual);
                    count++;
                }
                canalAtual = null;
            }
        }
        console.log(`✅ ${server.nome}: ${count} canais encontrados`);
        return canais;
    } catch (error) {
        console.error(`❌ Erro no ${server.nome}:`, error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: BUSCAR TODOS OS SERVIDORES VECTOR
// ============================================
async function buscarTodosServidoresVector() {
    const todosCanais = [];
    const vistos = new Set();
    
    for (const server of SERVERS_VECTOR) {
        const canais = await buscarCanaisServer(server);
        let adicionados = 0;
        
        for (const canal of canais) {
            const key = canal.nome + '|' + canal.url;
            if (!vistos.has(key)) {
                vistos.add(key);
                todosCanais.push(canal);
                adicionados++;
            }
        }
        console.log(`📊 ${server.nome}: ${adicionados} canais únicos adicionados`);
    }
    
    console.log(`✅ Total: ${todosCanais.length} canais únicos de todos os servidores`);
    return todosCanais;
}

// ============================================
// FUNÇÃO: BUSCAR CANAIS DO TV GARDEN (COMPLEMENTO)
// ============================================
async function buscarCanaisTVGarden() {
    try {
        console.log('📡 [TV GARDEN] A buscar canais complementares...');
        const url = 'https://iptv-org.github.io/iptv/index.m3u';
        const response = await fetch(url);
        if (!response.ok) {
            console.log('⚠️ TV Garden indisponível');
            return [];
        }
        const playlist = await response.text();
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        let count = 0;

        const paisesInteresse = ['AO', 'MZ', 'PT', 'BR', 'FR', 'ES', 'GB', 'US', 'DE', 'IT'];
        const categoriasInteresse = ['movies', 'series', 'sports', 'news', 'music', 'kids'];

        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const matchNome = linhaLimpa.match(/,([^,]+)$/);
                const nome = matchNome ? matchNome[1] : 'Canal';
                const matchGrupo = linhaLimpa.match(/group-title="([^"]+)"/);
                const grupo = matchGrupo ? matchGrupo[1] : '';
                const matchLogo = linhaLimpa.match(/tvg-logo="([^"]+)"/);
                const logo = matchLogo ? matchLogo[1] : '';
                
                let isInteresse = false;
                if (grupo) {
                    const grupoLower = grupo.toLowerCase();
                    for (const pais of paisesInteresse) {
                        if (grupoLower.includes(pais.toLowerCase())) isInteresse = true;
                    }
                    for (const cat of categoriasInteresse) {
                        if (grupoLower.includes(cat)) isInteresse = true;
                    }
                }
                if (isInteresse) {
                    canalAtual = { nome, url: '', logo, grupo };
                } else {
                    canalAtual = null;
                }
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                if (linhaLimpa.startsWith('http://') || linhaLimpa.startsWith('https://')) {
                    canalAtual.url = linhaLimpa;
                    canais.push(canalAtual);
                    count++;
                }
                canalAtual = null;
            }
        }
        console.log(`✅ TV Garden: ${count} canais complementares`);
        return canais;
    } catch (error) {
        console.error('❌ Erro no TV Garden:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST M3U (ORGANIZADA)
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    console.log(`📡 Gerando playlist para ${usuario.username}...`);

    // 1. Buscar todos os servidores Vector
    let canais = await buscarTodosServidoresVector();
    console.log(`📊 Vector: ${canais.length} canais`);

    // 2. Se tiver poucos canais, buscar TV Garden
    if (canais.length < 100) {
        console.log('⚠️ Poucos canais Vector, buscando complemento...');
        const tvGarden = await buscarCanaisTVGarden();
        canais = [...canais, ...tvGarden];
        console.log(`📊 Total: ${canais.length} canais`);
    }

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
        let grupo = canal.grupo || '📡 Vector Player';
        if (grupo.includes('SSTV')) grupo = '📡 SSTV Server';
        if (grupo.includes('STV')) grupo = '📡 STV Server';
        if (grupo.includes('SSApp')) grupo = '📡 SSApp Server';
        if (grupo.includes('DNSRot')) grupo = '📡 DNSRot Server';
        if (grupo.includes('TV Garden')) grupo = '🌍 TV Garden';
        
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });

    // Ordenar grupos
    const ordemGrupos = [
        '📡 SSTV Server',
        '📡 STV Server',
        '📡 SSApp Server',
        '📡 DNSRot Server',
        '🌍 TV Garden',
        '📺 Outros'
    ];

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
        playlist += `#EXTINF:-1 tvg-logo="",📁 ${grupo}\n`;
        playlist += `#EXTGRP:${grupo}\n`;
        
        canaisDoGrupo.forEach(canal => {
            const logo = canal.logo || '';
            const nome = canal.nome || 'Canal';
            const urlCanal = canal.url || '#';
            playlist += `#EXTINF:-1 tvg-logo="${logo}",${nome}\n`;
            playlist += `${urlCanal}\n`;
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
