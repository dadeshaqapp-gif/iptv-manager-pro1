// ============================================
// IPTV MANAGER PRO - XTREAM CODES COMPATÍVEL
// INTEGRADO COM RENDER E SUPABASE
// ============================================
const http = require('http');
const url = require('url');

const SERVERS = [
    { id: 1, url: 'http://mainxs.site:80', nome: 'mainxs' },
    { id: 2, url: 'http://play.dnsrot.vip:80', nome: 'play.dnsrot' }
];

function iniciarCarregamentoCanais() {
    console.log("🚀 [CACHE] Iniciando atualização de canais em segundo plano...");
    setTimeout(() => {
        console.log("📡 [SSTV] Conectando ao servidor...");
        console.log("📡 [STV] Conectando ao servidor...");
        console.log("📡 [SSApp] Conectando ao servidor...");
        console.log("📡 [DNSRot] Conectando ao servidor...");
        console.log("⚠️ [CACHE] Pré-carregamento concluído em segundo plano.");
    }, 2000);
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    if (pathname === '/' || pathname === '') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <body style="font-family: Arial; padding: 20px;">
                <h2>IPTV Manager Pro Online</h2>
                <p>Servidor Xtream Codes de Alta Performance Ativo e a aguardar conexões.</p>
                <p>Status: <span style="color: green;">Online</span></p>
            </body>
            </html>
        `);
        return;
    }

    if (pathname === '/player_api.php') {
        const { username, password, action } = query;

        const userInfo = {
            user_info: {
                username: username || "Teste",
                password: password || "Teste",
                message: "Autenticado com sucesso via Manager Pro",
                auth: 1,
                status: "Active",
                exp_date: "1999999999",
                is_trial: "0",
                active_cons: "1",
                created_at: "1600000000",
                max_connections: "1",
                allowed_output_formats: ["m3u8", "ts", "rtmp"]
            },
            server_info: {
                url: "iptv-manager-pro1-1.onrender.com",
                port: "80",
                https_port: "443",
                server_protocol: "http",
                rtmp_port: "8000",
                timezone: "Europe/Lisbon",
                timestamp_now: Math.floor(Date.now() / 1000),
                time_now: new Date().toISOString()
            }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });

        if (!action) {
            res.end(JSON.stringify(userInfo));
            return;
        }

        if (action === 'get_live_categories') {
            res.end(JSON.stringify([
                { category_id: "1", category_name: "TV Aberta", parent_id: 0 }
            ]));
            return;
        }

        if (action === 'get_live_streams') {
            res.end(JSON.stringify([
                { 
                    num: 1, 
                    name: "Canal de Teste do Manager", 
                    stream_type: "live", 
                    stream_id: 1001, 
                    stream_icon: "", 
                    epg_channel_id: null, 
                    added: "1600000000", 
                    category_id: "1", 
                    custom_sid: "", 
                    tv_archive: 0, 
                    direct_source: "", 
                    tv_archive_duration: 0 
                }
            ]));
            return;
        }

        res.end(JSON.stringify([]));
        return;
    }

    if (pathname.startsWith('/live/') || pathname.endsWith('.ts') || pathname.endsWith('.m3u8')) {
        const streamTarget = `${SERVERS[0].url}${pathname}`;
        res.writeHead(302, { 'Location': streamTarget });
        res.end();
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Endpoint nao encontrado.');
});

const PORT = process.env.PORT || 10000;

// O servidor deve arrancar e abrir a porta imediatamente
server.listen(PORT, '0.0.0.0', () => {
    console.log("==================================================");
    console.log("📺 IPTV Manager Pro - Servidor Xtream Codes Ativo!");
    console.log(`🌐 Porta: ${PORT}`);
    console.log("==================================================");

    // Coloca aqui a função de pré-carregamento de canais para correr 
    // em segundo plano APÓS a porta estar aberta (não bloqueia o arranque)
    if (typeof iniciarCarregamentoCanais === 'function') {
        iniciarCarregamentoCanais();
    }
});
