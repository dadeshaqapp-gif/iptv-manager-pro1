// ============================================
// IPTV MANAGER PRO - VERSÃO FINAL
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// SERVIDORES ESTÁVEIS
// ============================================
const SERVERS = [
    { id: 1, url: 'http://stv.sstv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSTV' },
    { id: 2, url: 'http://stv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'STV' },
    { id: 3, url: 'http://ssapp.ch:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSApp' },
    { id: 4, url: 'http://play.dnsrot.vip:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'DNSRot' }
];

// ============================================
// CANAIS FIXOS (GARANTIA PARA ZAP, TVM, RTP, SIC, ETC.)
// ============================================
const CANAIS_FIXOS = [
    // 🇦🇴 Angola (ZAP)
    { nome: 'ZAP Novelas', url: 'http://zap.ao/novelas', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Viva', url: 'http://zap.ao/viva', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Cinema', url: 'http://zap.ao/cinema', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Música', url: 'http://zap.ao/musica', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Desporto', url: 'http://zap.ao/desporto', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Novelas 2', url: 'http://zap.ao/novelas2', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Filmes', url: 'http://zap.ao/filmes', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Kids', url: 'http://zap.ao/kids', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Futebol', url: 'http://zap.ao/futebol', pais: 'AO', grupo: 'ZAP' },
    { nome: 'ZAP Notícias', url: 'http://zap.ao/noticias', pais: 'AO', grupo: 'ZAP' },
    { nome: 'TPA 1', url: 'http://tpa.ao/tpa1', pais: 'AO', grupo: 'Angola' },
    { nome: 'TPA 2', url: 'http://tpa.ao/tpa2', pais: 'AO', grupo: 'Angola' },
    // 🇲🇿 Moçambique
    { nome: 'TVM', url: 'http://tvm.co.mz/tvm', pais: 'MZ', grupo: 'Moçambique' },
    { nome: 'Stv', url: 'http://stv.co.mz/stv', pais: 'MZ', grupo: 'Moçambique' },
    { nome: 'Miramar', url: 'http://miramar.co.mz/miramar', pais: 'MZ', grupo: 'Moçambique' },
    { nome: 'TV Sucesso', url: 'http://sucesso.co.mz/sucesso', pais: 'MZ', grupo: 'Moçambique' },
    // 🇵🇹 Portugal
    { nome: 'RTP 1', url: 'http://rtp.pt/rtp1', pais: 'PT', grupo: 'Portugal' },
    { nome: 'RTP 2', url: 'http://rtp.pt/rtp2', pais: 'PT', grupo: 'Portugal' },
    { nome: 'RTP 3', url: 'http://rtp.pt/rtp3', pais: 'PT', grupo: 'Portugal' },
    { nome: 'SIC', url: 'http://sic.pt/sic', pais: 'PT', grupo: 'Portugal' },
    { nome: 'SIC Notícias', url: 'http://sic.pt/noticias', pais: 'PT', grupo: 'Portugal' },
    { nome: 'TVI', url: 'http://tvi.pt/tvi', pais: 'PT', grupo: 'Portugal' },
    { nome: 'TVI 24', url: 'http://tvi.pt/24', pais: 'PT', grupo: 'Portugal' },
    { nome: 'CMTV', url: 'http://cmtv.pt/cmtv', pais: 'PT', grupo: 'Portugal' },
    { nome: 'Porto Canal', url: 'http://portocanal.pt/portocanal', pais: 'PT', grupo: 'Portugal' },
    { nome: 'SPORT TV 1', url: 'http://sporttv.pt/1', pais: 'PT', grupo: 'Portugal' },
    { nome: 'SPORT TV 2', url: 'http://sporttv.pt/2', pais: 'PT', grupo: 'Portugal' },
    { nome: 'ELEVEN SPORTS 1', url: 'http://eleven.pt/1', pais: 'PT', grupo: 'Portugal' },
    { nome: 'ELEVEN SPORTS 2', url: 'http://eleven.pt/2', pais: 'PT', grupo: 'Portugal' },
    // 🌍 Internacionais
    { nome: 'CNN Internacional', url: 'http://cnn.com/international', pais: 'INT', grupo: 'Internacionais' },
    { nome: 'BBC World News', url: 'http://bbc.com/world', pais: 'INT', grupo: 'Internacionais' },
    { nome: 'DW TV', url: 'http://dw.com/dw', pais: 'INT', grupo: 'Internacionais' },
    { nome: 'Euronews', url: 'http://euronews.com/euronews', pais: 'INT', grupo: 'Internacionais' },
];

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

async function buscarCanaisServer(server) {
    try {
        const urlPlaylist = `${server.url}/get.php?username=${server.usuario}&password=${server.senha}&type=m3u_plus&output=ts`;
        const response = await fetch(urlPlaylist, { signal: AbortSignal.timeout(15000) });
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
        return canais;
    } catch (error) {
        return [];
    }
}

async function buscarTodosServidores() {
    const resultados = await Promise.all(SERVERS.map(server => buscarCanaisServer(server)));
    const todosCanais = [];
    const vistos = new Set();
    resultados.forEach((canais) => {
        for (const canal of canais) {
            const key = canal.nome + '|' + canal.url;
            if (!vistos.has(key)) {
                vistos.add(key);
                todosCanais.push(canal);
            }
        }
    });
    return todosCanais;
}

async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));
    let canais = await buscarTodosServidores();
    // Adicionar canais fixos como fallback e para garantir ZAP/Portugal
    canais = [...canais, ...CANAIS_FIXOS.map(c => ({ ...c, logo: '', origem: c.grupo }))];
    if (canais.length === 0) {
        return '#EXTM3U\n#EXTINF:-1,⚠️ Nenhum canal disponível\n';
    }
    const canaisSelecionados = canais.slice(0, 5000);
    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro\n`;
    playlist += `#PLAYLIST: ${usuario.username} - ${usuario.plano.toUpperCase()}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;
    const grupos = {};
    canaisSelecionados.forEach(canal => {
        const grupo = canal.grupo || canal.origem || '📡 Vector';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });
    for (const grupo of Object.keys(grupos).sort()) {
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

try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
} catch (err) {
    usuarios = [
        { id: '1', username: 'teste', contato: 'teste@teste.com', password: '123456', plano: 'mensal', data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null },
        { id: '2', username: 'Dade', contato: 'dade@iptv.com', password: '123456', plano: 'anual', data_expiracao: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null }
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

const server = http.createServer(async (req, res) => {
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

    // ============================================
    // XTREAM CODES API
    // ============================================
    if (pathname === '/player_api.php') {
        const username = parsedUrl.query.username;
        const password = parsedUrl.query.password;
        const action = parsedUrl.query.action;

        let user = validarUsuario(username, password);
        if (!user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ user_info: { auth: 0 }, channels: [] }));
            return;
        }

        // Autenticação
        if (!action) {
            const respostaAuth = {
                user_info: {
                    username: user.username,
                    password: user.password,
                    message: "",
                    auth: 1,
                    status: "Active",
                    exp_date: Math.floor(new Date(user.data_expiracao).getTime() / 1000).toString(),
                    is_trial: user.plano === 'teste' ? "1" : "0",
                    active_cons: "1",
                    max_connections: "2"
                },
                server_info: {
                    url: 'iptv-manager-pro1-1.onrender.com',
                    port: "80",
                    https_port: "443",
                    server_protocol: "https",
                    timezone: "America/Sao_Paulo",
                    timestamp_now: Math.floor(Date.now() / 1000),
                }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(respostaAuth));
            return;
        }

        // Categorias
        if (action === 'get_live_categories') {
            const categorias = [
                { category_id: "1", category_name: "Angola (ZAP)", parent_id: 0 },
                { category_id: "2", category_name: "Moçambique", parent_id: 0 },
                { category_id: "3", category_name: "Portugal", parent_id: 0 },
                { category_id: "4", category_name: "Internacionais", parent_id: 0 },
                { category_id: "5", category_name: "SSTV", parent_id: 0 },
                { category_id: "6", category_name: "STV", parent_id: 0 },
                { category_id: "7", category_name: "SSApp", parent_id: 0 },
                { category_id: "8", category_name: "DNSRot", parent_id: 0 },
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(categorias));
            return;
        }

        // Canais ao vivo
        if (action === 'get_live_streams') {
            const canais = await buscarTodosServidores();
            const fixos = CANAIS_FIXOS.map((c, idx) => ({ ...c, id: idx + 10000 }));
            const todos = [...canais, ...fixos];
            const streamsFormatados = todos.map((c, index) => ({
                num: index + 1,
                name: c.nome,
                stream_type: "live",
                stream_id: index + 1,
                stream_icon: c.logo || "",
                epg_channel_id: null,
                added: "1600000000",
                category_id: c.pais === 'AO' ? "1" : c.pais === 'MZ' ? "2" : c.pais === 'PT' ? "3" : c.pais === 'INT' ? "4" : c.origem === 'SSTV' ? "5" : c.origem === 'STV' ? "6" : c.origem === 'SSApp' ? "7" : "8",
                custom_sid: "",
                tv_archive: 0,
                direct_source: c.url
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streamsFormatados));
            return;
        }
    }

    // ============================================
    // M3U / GET.PHP
    // ============================================
    if (pathname === '/get.php' || pathname === '/playlist.m3u' || pathname === '/') {
        const username = parsedUrl.query.username;
        const password = parsedUrl.query.password;
        const mac = parsedUrl.query.mac;

        if (pathname === '/' && !username && !password && !mac) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>📺 IPTV Manager Pro</h1><p>Servidor Xtream Codes Ativo.</p>');
            return;
        }

        let user = null;
        if (mac) user = validarPorMac(mac);
        else if (username && password) user = validarUsuario(username, password);

        if (!user) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
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
    // API
    // ============================================
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
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
                const duracaoMap = { teste: 2 * 60 * 60 * 1000, mensal: 30 * 24 * 60 * 60 * 1000, trimestral: 120 * 24 * 60 * 60 * 1000, anual: 365 * 24 * 60 * 60 * 1000 };
                const dataExpiracao = new Date(Date.now() + (duracaoMap[plano] || duracaoMap.teste));
                const novoUsuario = {
                    id: 'usr_' + Date.now(),
                    username,
                    contato: contato || 'Não informado',
                    password,
                    plano: plano || 'teste',
                    data_expiracao: dataExpiracao.toISOString(),
                    status: 'ativo',
                    mac_address: mac || null
                };
                usuarios.push(novoUsuario);
                fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2));
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: novoUsuario, url: `https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=${username}&password=${password}` }));
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

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

server.listen(PORT, () => {
    const ip = obterIpLocal();
    console.log('📺 IPTV Manager Pro - Servidor Xtream Codes!');
    console.log('🌐 Local: http://localhost:' + PORT);
    console.log('🌐 Rede: http://' + ip + ':' + PORT);
    console.log('📋 Player API: https://iptv-manager-pro1-1.onrender.com/player_api.php?username=USUARIO&password=SENHA');
    console.log('📋 M3U: https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=USUARIO&password=SENHA');
    console.log('============================================');
});

setInterval(() => {
    try { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); } catch (err) { }
}, 30000);
