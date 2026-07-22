// ============================================
// IPTV MANAGER PRO - XTREAM CODES COMPATÍVEL
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// Cache global em memória para resposta instantânea aos players
let cacheCanais = [];
let cacheUltimaAtualizacao = 0;
let carregandoCanais = false;

// ============================================
// SERVIDORES ESTÁVEIS (VECTOR PLAYER)
// ============================================
const SERVERS = [
    { id: 1, url: 'http://stv.sstv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSTV' },
    { id: 2, url: 'http://stv.cx:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'STV' },
    { id: 3, url: 'http://ssapp.ch:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'SSApp' },
    { id: 4, url: 'http://play.dnsrot.vip:80', usuario: 'Farleyjm', senha: 'yz6ncyyfadu', nome: 'DNSRot' }
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
        console.log(`📡 [${server.nome}] A buscar canais...`);
        const urlPlaylist = `${server.url}/get.php?username=${server.usuario}&password=${server.senha}&type=m3u_plus&output=ts`;
        const response = await fetch(urlPlaylist, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            console.log(`⚠️ ${server.nome} indisponível (${response.status})`);
            return [];
        }
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
        console.log(`✅ ${server.nome}: ${canais.length} canais`);
        return canais;
    } catch (error) {
        console.error(`❌ ${server.nome}: ${error.message}`);
        return [];
    }
}

async function atualizarCacheCanais() {
    if (carregandoCanais) return;
    carregandoCanais = true;
    console.log('🚀 Atualizando cache de canais em segundo plano...');
    try {
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
        cacheCanais = todosCanais;
        cacheUltimaAtualizacao = Date.now();
        console.log(`✅ Cache atualizado com ${cacheCanais.length} canais únicos!`);
    } catch (e) {
        console.error('❌ Erro ao atualizar cache:', e.message);
    } finally {
        carregandoCanais = false;
    }
}

function obterCanais() {
    if (cacheCanais.length === 0 || (Date.now() - cacheUltimaAtualizacao > 20 * 60 * 1000)) {
        atualizarCacheCanais();
    }
    return cacheCanais;
}

try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
    console.log(`✅ Usuários carregados: ${usuarios.length}`);
} catch (err) {
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
    let canais = obterCanais();
    if (canais.length === 0) {
        await atualizarCacheCanais();
        canais = cacheCanais;
    }
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

const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ===== ROTA DE REPRODUÇÃO DE STREAM (AO VIVO) =====
    const liveMatch = pathname.match(/^\/live\/([^\/]+)\/([^\/]+)\/(\d+)(\.[a-zA-Z0-9]+)?$/) ||
                      pathname.match(/^\/([^\/]+)\/([^\/]+)\/(\d+)(\.[a-zA-Z0-9]+)?$/);

    if (liveMatch) {
        const username = liveMatch[1];
        const password = liveMatch[2];
        const streamId = parseInt(liveMatch[3], 10);

        const user = validarUsuario(username, password);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Acesso negado: Credenciais inválidas ou conta expirada.');
            return;
        }

        const canais = obterCanais();
        const canal = canais[streamId - 1];
        if (!canal || !canal.url) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Canal não encontrado ou indisponível.');
            return;
        }

        res.writeHead(302, { 'Location': canal.url });
        res.end();
        return;
    }

    // ===== XTREAM CODES API =====
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
            const respostaAuth = {
                user_info: {
                    username: user.username,
                    password: user.password,
                    message: "Autenticado com sucesso",
                    auth: 1,
                    status: "Active",
                    exp_date: Math.floor(new Date(user.data_expiracao).getTime() / 1000).toString(),
                    is_trial: user.plano === 'teste' ? "1" : "0",
                    active_cons: "1",
                    created_at: "1600000000",
                    max_connections: "2"
                },
                server_info: {
                    url: req.headers.host ? req.headers.host.split(':')[0] : "iptv-manager-pro1-1.onrender.com",
                    port: "80",
                    https_port: "443",
                    server_protocol: "https",
                    rtmp_port: "8880",
                    timezone: "America/Sao_Paulo",
                    timestamp_now: Math.floor(Date.now() / 1000),
                    time_now: new Date().toISOString()
                }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(respostaAuth));
            return;
        }

        if (action === 'get_live_categories') {
            const categorias = [
                { category_id: "1", category_name: "SSTV", parent_id: 0 },
                { category_id: "2", category_name: "STV", parent_id: 0 },
                { category_id: "3", category_name: "SSApp", parent_id: 0 },
                { category_id: "4", category_name: "DNSRot", parent_id: 0 }
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(categorias));
            return;
        }

        if (action === 'get_live_streams') {
            let canais = obterCanais();
            if (canais.length === 0) {
                await atualizarCacheCanais();
                canais = cacheCanais;
            }

            const categoryMap = { 'SSTV': '1', 'STV': '2', 'SSApp': '3', 'DNSRot': '4' };

            const streamsFormatados = canais.map((c, index) => {
                const id = index + 1;
                return {
                    num: id,
                    name: c.nome,
                    stream_type: "live",
                    stream_id: id,
                    stream_icon: c.logo || "",
                    epg_channel_id: "",
                    added: "1600000000",
                    category_id: categoryMap[c.origem] || "1",
                    custom_sid: "",
                    tv_archive: 0,
                    container_extension: "ts",
                    direct_source: c.url
                };
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streamsFormatados));
            return;
        }

        if (action === 'get_vod_categories' || action === 'get_series_categories' ||
            action === 'get_vod_streams' || action === 'get_series') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }
    }

    // ===== GET.PHP / PLAYLIST M3U =====
    if (pathname === '/get.php' || pathname === '/playlist.m3u' || pathname === '/') {
        const username = reqUrl.searchParams.get('username');
        const password = reqUrl.searchParams.get('password');
        const mac = reqUrl.searchParams.get('mac');

        if (pathname === '/' && !username && !password && !mac) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h3>IPTV Manager Pro Online</h3><p>Servidor Xtream Codes Ativo com Cache e Streaming.</p>');
            return;
        }

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

    // ===== API: USUARIOS =====
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

server.listen(PORT, async () => {
    console.log('📺 IPTV Manager Pro - Servidor Xtream Codes de Alta Performance');
    console.log('⚡ Carregando cache de canais na inicialização...');
    await atualizarCacheCanais();
    console.log('🚀 Pronto para atender Vector Player, TV Garden e todos os players Xtream!');
});

setInterval(() => {
    atualizarCacheCanais();
}, 20 * 60 * 1000);
