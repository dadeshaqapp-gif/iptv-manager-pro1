// ============================================
// IPTV MANAGER PRO - XTREAM CODES COMPATÍVEL
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// Cache global e trava de segurança contra loops
let cacheCanais = [];
let cacheUltimaAtualizacao = 0;
let carregandoCanais = false;
const TEMPO_MINIMO_RETRY_MS = 5 * 60 * 1000; // 5 minutos entre tentativas em caso de falha

// ============================================
// SERVIDORES ESTÁVEIS DE ORIGEM
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

// Busca canais simulando um aplicativo IPTV legítimo para evitar bloqueios
async function buscarCanaisServer(server) {
    try {
        console.log(`📡 [${server.nome}] Conectando ao servidor...`);
        const urlPlaylist = `${server.url}/get.php?username=${server.usuario}&password=${server.senha}&type=m3u_plus&output=ts`;
        
        const response = await fetch(urlPlaylist, {
            method: 'GET',
            headers: {
                'User-Agent': 'IPTVSmartersPlayer/3.1.5 (Linux; Android 10)',
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            signal: AbortSignal.timeout(12000) // Timeout de 12 segundos por servidor
        });

        if (!response.ok) {
            console.log(`⚠️ [${server.nome}] Indisponível (Status HTTP: ${response.status})`);
            return [];
        }

        const playlist = await response.text();
        if (!playlist || !playlist.includes('#EXTM3U')) {
            console.log(`⚠️ [${server.nome}] Resposta inválida (Não é uma lista M3U)`);
            return [];
        }

        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;

        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const matchNome = linhaLimpa.match(/,([^,]+)$/);
                const nome = matchNome ? matchNome[1].trim() : 'Canal';
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
        console.log(`✅ [${server.nome}] Sucesso: ${canais.length} canais carregados`);
        return canais;
    } catch (error) {
        console.error(`❌ [${server.nome}] Erro de conexão: ${error.message}`);
        return [];
    }
}

// Atualização de cache segura com trava e proteção contra tempestade de requisições
async function atualizarCacheCanais() {
    if (carregandoCanais) return;
    
    // Trava imediatamente
    carregandoCanais = true;
    cacheUltimaAtualizacao = Date.now();
    console.log('🚀 [CACHE] Iniciando atualização de canais em segundo plano...');

    try {
        // Executa requisições em paralelo com tratamento individual
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

        if (todosCanais.length > 0) {
            cacheCanais = todosCanais;
            console.log(`🎉 [CACHE] Concluído: Total de ${cacheCanais.length} canais prontos!`);
        } else {
            console.log('⚠️ [CACHE] Todos os servidores externos falharam. Mantendo estado atual.');
            // Se nenhum canal for retornado, adicionamos um canal informativo para evitar erro nos players
            if (cacheCanais.length === 0) {
                cacheCanais = [{
                    nome: "⚠️ Servidores Temporariamente Indisponíveis",
                    url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                    logo: "",
                    origem: "SSTV"
                }];
            }
        }
    } catch (e) {
        console.error('❌ [CACHE] Erro geral ao atualizar:', e.message);
    } finally {
        carregandoCanais = false;
    }
}

function obterCanais() {
    const tempoDecorrido = Date.now() - cacheUltimaAtualizacao;
    if (tempoDecorrido > TEMPO_MINIMO_RETRY_MS && !carregandoCanais) {
        atualizarCacheCanais();
    }
    return cacheCanais;
}

// Carregar usuários
try {
    const data = fs.readFileSync('usuarios.json', 'utf8');
    usuarios = JSON.parse(data);
    console.log(`✅ Usuários carregados com sucesso: ${usuarios.length}`);
} catch (err) {
    usuarios = [
        { id: '1', username: 'teste', contato: 'teste@teste.com', password: '123456', plano: 'mensal', data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'ativo', mac_address: null }
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
    
    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro\n`;
    playlist += `#PLAYLIST: ${usuario.username} - ${usuario.plano.toUpperCase()}\n`;
    playlist += `#EXTINF:-1,📅 Expira em: ${diasRestantes} dias\n\n`;

    const grupos = {};
    canais.forEach(canal => {
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

// Servidor HTTP Principal
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

    // ===== ROTA DE REPRODUÇÃO DE STREAM (REDIRECIONAMENTO DIRETO PARA VECTOR / TV GARDEN) =====
    const liveMatch = pathname.match(/^\/live\/([^\/]+)\/([^\/]+)\/(\d+)(\.[a-zA-Z0-9]+)?$/) ||
                      pathname.match(/^\/([^\/]+)\/([^\/]+)\/(\d+)(\.[a-zA-Z0-9]+)?$/);

    if (liveMatch) {
        const username = liveMatch[1];
        const password = liveMatch[2];
        const streamId = parseInt(liveMatch[3], 10);

        const user = validarUsuario(username, password);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Acesso negado: Credenciais inválidas ou assinatura expirada.');
            return;
        }

        const canais = obterCanais();
        const canal = canais[streamId - 1];
        
        if (!canal || !canal.url) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Canal indisponível no momento.');
            return;
        }

        // Redireciona o aplicativo diretamente para a fonte do vídeo
        res.writeHead(302, { 'Location': canal.url });
        res.end();
        return;
    }

    // ===== PROTOCOLO XTREAM CODES API (PLAYER_API.PHP) =====
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

        // 1. Autenticação Inicial
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

        // 2. Categorias de Canais
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

        // 3. Lista de Canais ao Vivo
        if (action === 'get_live_streams') {
            const canais = obterCanais();
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

        // 4. VODs e Séries (Garante retorno limpo para não travar o Vector Player)
        if (action === 'get_vod_categories' || action === 'get_series_categories' ||
            action === 'get_vod_streams' || action === 'get_series') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }
    }

    // ===== ROTA /GET.PHP E PLAYLIST M3U =====
    if (pathname === '/get.php' || pathname === '/playlist.m3u' || pathname === '/') {
        const username = reqUrl.searchParams.get('username');
        const password = reqUrl.searchParams.get('password');
        const mac = reqUrl.searchParams.get('mac');

        if (pathname === '/' && !username && !password && !mac) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h3>IPTV Manager Pro Online</h3><p>Servidor Xtream Codes de Alta Performance Ativo.</p>');
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

    // ===== API INTERNA DE USUÁRIOS =====
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: usuarios }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
});

// Inicialização com pré-carregamento imediato do cache
server.listen(PORT, async () => {
    console.log('==================================================');
    console.log('📺 IPTV Manager Pro - Servidor Xtream Codes Ativo!');
    console.log(`🌐 Porta: ${PORT}`);
    console.log('⚡ Efetuando pré-carregamento de canais...');
    console.log('==================================================');
    await atualizarCacheCanais();
});

// Atualização programada a cada 20 minutos
setInterval(() => {
    atualizarCacheCanais();
}, 20 * 60 * 1000);
