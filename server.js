// ============================================
// IPTV MANAGER PRO - COM SUPABASE
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 8888;

// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
const SUPABASE_URL = 'https://oqzvockroewijqxainsq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7QTF8jU1apZzyKUqC...';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// PLAYLIST IPTV-ORG (TV GARDEN)
// ============================================
const PLAYLIST_IPTV_ORG = 'https://iptv-org.github.io/iptv/index.m3u';

// ============================================
// SERVIDOR FIXO (FALLBACK)
// ============================================
const SERVIDOR_FIXO = {
    url: 'http://play.dnsrot.vip:80',
    usuario: 'Farleyjm',
    senha: 'yz6ncyyfadu'
};

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
// FUNÇÃO: BUSCAR CANAIS DO SERVIDOR (FALLBACK)
// ============================================
async function buscarCanaisDoServidor() {
    try {
        const urlBase = SERVIDOR_FIXO.url.replace(/\/$/, '');
        const urlPlaylist = `${urlBase}/get.php?username=${SERVIDOR_FIXO.usuario}&password=${SERVIDOR_FIXO.senha}&type=m3u_plus&output=ts`;
        
        console.log(`📡 Baixando playlist do servidor fixo...`);
        
        const response = await fetch(urlPlaylist);
        if (!response.ok) {
            console.error('❌ Erro ao baixar playlist:', response.status);
            return [];
        }
        
        const playlist = await response.text();
        console.log(`✅ Playlist baixada com sucesso (${playlist.length} bytes)`);
        
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
        
        console.log(`✅ ${canais.length} canais encontrados`);
        return canais;
    } catch (error) {
        console.error('❌ Erro ao buscar canais:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: BUSCAR CANAIS DO IPTV-ORG (TV GARDEN)
// ============================================
async function buscarCanaisIPTVOrg() {
    try {
        console.log('📡 Baixando playlist do IPTV-org (TV Garden)...');
        
        const response = await fetch(PLAYLIST_IPTV_ORG);
        if (!response.ok) {
            console.error('❌ Erro ao baixar playlist IPTV-org:', response.status);
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
        
        console.log(`✅ ${canais.length} canais encontrados no IPTV-org`);
        return canais;
    } catch (error) {
        console.error('❌ Erro ao buscar playlist IPTV-org:', error.message);
        return [];
    }
}

// ============================================
// FUNÇÃO: GERAR PLAYLIST M3U
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    let canais = await buscarCanaisIPTVOrg();
    
    if (canais.length === 0) {
        console.log('⚠️ Usando servidor fixo como fallback...');
        canais = await buscarCanaisDoServidor();
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
// FUNÇÕES DE VALIDAÇÃO COM SUPABASE
// ============================================
async function validarUsuario(username, password) {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();
    
    if (error || !data) {
        console.error('Erro ao validar usuário:', error);
        return null;
    }
    if (new Date() > new Date(data.data_expiracao)) return null;
    return data;
}

async function validarPorMac(mac) {
    if (!mac) return null;
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('mac_address', mac)
        .single();
    
    if (error || !data) {
        console.error('Erro ao validar MAC:', error);
        return null;
    }
    if (new Date() > new Date(data.data_expiracao)) return null;
    return data;
}

// ============================================
// FUNÇÃO: LISTAR USUÁRIOS
// ============================================
async function listarUsuarios() {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*');
    
    if (error) {
        console.error('Erro ao listar usuários:', error);
        return [];
    }
    return data;
}

// ============================================
// FUNÇÃO: CRIAR USUÁRIO
// ============================================
async function criarUsuario(dados) {
    const { username, password, plano, contato, mac } = dados;
    
    const duracaoMap = {
        teste: 2 * 60 * 60 * 1000,
        mensal: 30 * 24 * 60 * 60 * 1000,
        trimestral: 120 * 24 * 60 * 60 * 1000,
        anual: 365 * 24 * 60 * 60 * 1000
    };
    const dataExpiracao = new Date(Date.now() + (duracaoMap[plano] || duracaoMap.teste));

    const { data, error } = await supabase
        .from('usuarios')
        .insert([{
            username,
            password,
            contato: contato || 'Não informado',
            plano: plano || 'teste',
            data_expiracao: dataExpiracao.toISOString(),
            status: 'ativo',
            mac_address: mac || null
        }])
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar usuário:', error);
        throw new Error(error.message);
    }
    return data;
}

// ============================================
// FUNÇÃO: EXCLUIR USUÁRIO
// ============================================
async function excluirUsuario(id) {
    const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
    
    if (error) throw new Error(error.message);
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

        let userPromise = null;
        if (mac) userPromise = validarPorMac(mac);
        else if (username && password) userPromise = validarUsuario(username, password);

        if (!userPromise) {
            res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Erro: Credenciais inválidas ou assinatura expirada');
            return;
        }

        userPromise.then(user => {
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
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Erro ao validar credenciais: ' + err.message);
        });
        return;
    }

    // ===== API: USUARIOS =====
    if (pathname === '/api/usuarios' && req.method === 'GET') {
        listarUsuarios().then(usuarios => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: usuarios }));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        });
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

                criarUsuario({ username, password, plano, contato, mac }).then(novoUsuario => {
                    const ip = obterIpLocal();
                    const urlGerada = `https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=${novoUsuario.username}&password=${novoUsuario.password}`;

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: novoUsuario,
                        url: urlGerada,
                        message: 'Usuário criado com sucesso!'
                    }));
                }).catch(err => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                });
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
        excluirUsuario(id).then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Usuário excluído' }));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        });
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
    console.log('📺 IPTV Manager Pro - Servidor rodando com Supabase!');
    console.log('🌐 Local: http://localhost:' + PORT);
    console.log('🌐 Rede: http://' + ip + ':' + PORT);
    console.log('📋 Playlist: https://iptv-manager-pro1-1.onrender.com/playlist.m3u?username=USUARIO&password=SENHA');
    console.log('============================================');
});
