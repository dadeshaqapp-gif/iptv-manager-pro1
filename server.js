// ============================================
// IPTV MANAGER PRO - PRIORIDADE AO SERVIDOR FIXO
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// CONFIGURAÇÃO - FONTES DE PLAYLISTS
// ============================================
const FONTES = {
    MUNDO: 'https://iptv-org.github.io/iptv/index.m3u',
    BRASIL: 'https://iptv-org.github.io/iptv/countries/br.m3u',
    PORTUGAL: 'https://iptv-org.github.io/iptv/countries/pt.m3u',
    PORTUGAL_2: 'https://iptv-org.github.io/iptv/languages/pt.m3u',
    ANGOLA: 'https://iptv-org.github.io/iptv/countries/ao.m3u',
    MOCAMBIQUE: 'https://iptv-org.github.io/iptv/countries/mz.m3u',
    ESPORTE: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    NOTICIAS: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    FILMES: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    INFANTIL: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
};

// ============================================
// SERVIDOR FIXO (VECTOR PLAYER - PRIORITÁRIO)
// ============================================
const SERVIDOR_FIXO = {
    url: 'http://play.dnsrot.vip:80',
    usuario: 'Farleyjm',
    senha: 'yz6ncyyfadu'
};

// ============================================
// CANAIS FIXOS (ZAP, RTP, SIC, TVI, Globo, etc.)
// ============================================
const CANAIS_FIXOS = [
    // Angola - ZAP
    { nome: 'ZAP Novelas', url: 'https://stream.zap.ao/novelas', pais: 'AO' },
    { nome: 'ZAP Viva', url: 'https://stream.zap.ao/viva', pais: 'AO' },
    { nome: 'ZAP Cinema', url: 'https://stream.zap.ao/cinema', pais: 'AO' },
    { nome: 'ZAP Música', url: 'https://stream.zap.ao/musica', pais: 'AO' },
    { nome: 'ZAP Desporto', url: 'https://stream.zap.ao/desporto', pais: 'AO' },
    { nome: 'ZAP Novelas 2', url: 'https://stream.zap.ao/novelas2', pais: 'AO' },
    { nome: 'ZAP Filmes', url: 'https://stream.zap.ao/filmes', pais: 'AO' },
    { nome: 'ZAP Kids', url: 'https://stream.zap.ao/kids', pais: 'AO' },
    
    // Portugal
    { nome: 'RTP 1 HD', url: 'https://stream.rtp.pt/rtp1', pais: 'PT' },
    { nome: 'RTP 2 HD', url: 'https://stream.rtp.pt/rtp2', pais: 'PT' },
    { nome: 'RTP 3 HD', url: 'https://stream.rtp.pt/rtp3', pais: 'PT' },
    { nome: 'RTP Internacional', url: 'https://stream.rtp.pt/internacional', pais: 'PT' },
    { nome: 'RTP Açores', url: 'https://stream.rtp.pt/acores', pais: 'PT' },
    { nome: 'RTP Madeira', url: 'https://stream.rtp.pt/madeira', pais: 'PT' },
    { nome: 'SIC HD', url: 'https://stream.sic.pt/sic', pais: 'PT' },
    { nome: 'SIC Notícias HD', url: 'https://stream.sic.pt/noticias', pais: 'PT' },
    { nome: 'SIC Radical HD', url: 'https://stream.sic.pt/radical', pais: 'PT' },
    { nome: 'SIC Mulher', url: 'https://stream.sic.pt/mulher', pais: 'PT' },
    { nome: 'SIC K', url: 'https://stream.sic.pt/k', pais: 'PT' },
    { nome: 'TVI HD', url: 'https://stream.tvi.pt/tvi', pais: 'PT' },
    { nome: 'TVI 24 HD', url: 'https://stream.tvi.pt/24', pais: 'PT' },
    { nome: 'TVI Reality', url: 'https://stream.tvi.pt/reality', pais: 'PT' },
    { nome: 'TVI Ficção', url: 'https://stream.tvi.pt/ficcao', pais: 'PT' },
    { nome: 'CMTV', url: 'https://stream.cmtv.pt/cmtv', pais: 'PT' },
    { nome: 'Porto Canal', url: 'https://stream.portocanal.pt/portocanal', pais: 'PT' },
    { nome: 'Canal 11', url: 'https://stream.canal11.pt/canal11', pais: 'PT' },
    
    // Brasil
    { nome: 'TV Globo HD', url: 'https://stream.globo.com/globo', pais: 'BR' },
    { nome: 'Globo News', url: 'https://stream.globo.com/news', pais: 'BR' },
    { nome: 'SBT HD', url: 'https://stream.sbt.com/sbt', pais: 'BR' },
    { nome: 'Record TV HD', url: 'https://stream.record.com/record', pais: 'BR' },
    { nome: 'Band HD', url: 'https://stream.band.com/band', pais: 'BR' },
    { nome: 'CNN Brasil', url: 'https://stream.cnnbrasil.com/cnn', pais: 'BR' },
    { nome: 'Globo Play', url: 'https://stream.globo.com/play', pais: 'BR' },
    { nome: 'Rede TV', url: 'https://stream.redetv.com/redetv', pais: 'BR' },
    
    // Moçambique
    { nome: 'TVM', url: 'https://stream.tvm.co.mz/tvm', pais: 'MZ' },
    { nome: 'Stv', url: 'https://stream.stv.co.mz/stv', pais: 'MZ' },
    { nome: 'Miramar', url: 'https://stream.miramar.co.mz/miramar', pais: 'MZ' },
    { nome: 'Rádio Moçambique', url: 'https://stream.rm.co.mz/rm', pais: 'MZ' },
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
// FUNÇÃO: BUSCAR CANAIS DO SERVIDOR FIXO (PRIORITÁRIO)
// ============================================
async function buscarCanaisDoServidor() {
    try {
        const urlBase = SERVIDOR_FIXO.url.replace(/\/$/, '');
        const urlPlaylist = `${urlBase}/get.php?username=${SERVIDOR_FIXO.usuario}&password=${SERVIDOR_FIXO.senha}&type=m3u_plus&output=ts`;
        console.log('📡 [PRIORITÁRIO] Baixando playlist do servidor fixo...');
        const response = await fetch(urlPlaylist);
        if (!response.ok) {
            console.error('❌ Erro ao baixar playlist do servidor fixo:', response.status);
            return [];
        }
        const playlist = await response.text();
        console.log(`✅ [PRIORITÁRIO] Playlist baixada (${playlist.length} bytes)`);
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const match = linhaLimpa.match(/,([^,]+)$/);
                const nome = match ? match[1] : 'Canal';
                const matchLogo = linhaLimpa.match(/tvg-logo="([^"]+)"/);
                const logo = matchLogo ? matchLogo[1] : '';
                canalAtual = { nome, url: '', logo };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                canalAtual.url = linhaLimpa;
                canais.push(canalAtual);
                canalAtual = null;
            }
        }
        console.log(`✅ ${canais.length} canais do servidor fixo`);
        return canais;
    } catch (error) {
        console.error('❌ Erro no servidor fixo:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: BUSCAR CANAIS DO IPTV-ORG (FALLBACK)
// ============================================
async function buscarCanaisIPTVOrg() {
    try {
        console.log('📡 [FALLBACK] Buscando canais do IPTV-org...');
        const response = await fetch(FONTES.PORTUGAL);
        if (!response.ok) {
            console.error('❌ Erro no IPTV-org:', response.status);
            return [];
        }
        const playlist = await response.text();
        console.log(`✅ Playlist IPTV-org baixada (${playlist.length} bytes)`);
        const linhas = playlist.split('\n');
        const canais = [];
        let canalAtual = null;
        for (const linha of linhas) {
            const linhaLimpa = linha.trim();
            if (linhaLimpa.startsWith('#EXTINF:')) {
                const match = linhaLimpa.match(/,([^,]+)$/);
                const nome = match ? match[1] : 'Canal';
                canalAtual = { nome, url: '' };
            } else if (linhaLimpa && !linhaLimpa.startsWith('#') && canalAtual) {
                canalAtual.url = linhaLimpa;
                canais.push(canalAtual);
                canalAtual = null;
            }
        }
        console.log(`✅ ${canais.length} canais do IPTV-org`);
        return canais;
    } catch (error) {
        console.error('❌ Erro IPTV-org:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST M3U (COM PRIORIDADE AO FIXO)
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    console.log(`📡 Gerando playlist para ${usuario.username}...`);

    // 1️⃣ PRIORIDADE: Servidor Fixo (Vector Player)
    let canais = await buscarCanaisDoServidor();
    
    // 2️⃣ FALLBACK: IPTV-org (se o fixo falhar)
    if (canais.length === 0) {
        console.log('⚠️ Servidor fixo falhou, usando IPTV-org como fallback...');
        canais = await buscarCanaisIPTVOrg();
    }

    // 3️⃣ ÚLTIMO RECURSO: Canais Fixos (ZAP, RTP, SIC, etc.)
    if (canais.length === 0) {
        console.log('⚠️ Todas as fontes falharam, usando canais fixos...');
        canais = CANAIS_FIXOS.map(c => ({
            nome: c.nome,
            url: c.url,
            logo: '',
            grupo: `📡 ${c.pais}`
        }));
    }

    // Limitar a 5000 canais para performance
    const canaisSelecionados = canais.slice(0, 5000);

    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro - ${usuario.username}\n`;
    playlist += `#EXTINF:-1,Plano: ${usuario.plano.toUpperCase()} | Expira em: ${diasRestantes} dias\n\n`;

    // Agrupar por grupo
    const grupos = {};
    canaisSelecionados.forEach(canal => {
        const grupo = canal.grupo || 'Canais';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });

    // Ordenar grupos
    const gruposOrdenados = Object.keys(grupos).sort();

    for (const grupo of gruposOrdenados) {
        const canaisDoGrupo = grupos[grupo];
        playlist += `#EXTINF:-1 tvg-logo="",📁 ${grupo}\n`;
        playlist += `#EXTGRP:${grupo}\n`;

        canaisDoGrupo.forEach(canal => {
            const logo = canal.logo || '';
            playlist += `#EXTINF:-1 tvg-logo="${logo}",${canal.nome}\n`;
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

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================
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

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(PORT, () => {
    const ip = obterIpLocal();
    console.log('📺 IPTV Manager Pro - Servidor rodando com prioridade ao servidor fixo!');
    console.log('🌐 Local: http://localhost:' + PORT);
    console.log('🌐 Rede: http://' + ip + ':' + PORT);
    console.log('📋 Playlist: https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=USUARIO&password=SENHA');
    console.log('============================================');
});

// Salvar usuários automaticamente
setInterval(() => {
    try { fs.writeFileSync('usuarios.json', JSON.stringify(usuarios, null, 2)); } catch (err) { }
}, 30000);
