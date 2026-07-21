// ============================================
// IPTV MANAGER PRO - MÚLTIPLOS PAÍSES
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8888;
let usuarios = [];

// ============================================
// CANAIS FIXOS POR PAÍS
// ============================================
const CANAIS_FIXOS = [
    // ===== 🇦🇴 ANGOLA =====
    { nome: 'ZAP Novelas', url: 'http://zap.ao/novelas', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Viva', url: 'http://zap.ao/viva', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Cinema', url: 'http://zap.ao/cinema', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Música', url: 'http://zap.ao/musica', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Desporto', url: 'http://zap.ao/desporto', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Novelas 2', url: 'http://zap.ao/novelas2', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Filmes', url: 'http://zap.ao/filmes', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Kids', url: 'http://zap.ao/kids', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Futebol', url: 'http://zap.ao/futebol', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Notícias', url: 'http://zap.ao/noticias', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Aventura', url: 'http://zap.ao/aventura', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Vida', url: 'http://zap.ao/vida', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP Comedy', url: 'http://zap.ao/comedy', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'ZAP 360', url: 'http://zap.ao/360', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'Rádio Nacional Angola', url: 'http://zap.ao/rna', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'TPA 1', url: 'http://tpa.ao/tpa1', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'TPA 2', url: 'http://tpa.ao/tpa2', pais: 'AO', grupo: '🇦🇴 Angola' },
    { nome: 'TPA Internacional', url: 'http://tpa.ao/internacional', pais: 'AO', grupo: '🇦🇴 Angola' },
    
    // ===== 🇲🇿 MOÇAMBIQUE =====
    { nome: 'TVM', url: 'http://tvm.co.mz/tvm', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'TVM Internacional', url: 'http://tvm.co.mz/internacional', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'Stv', url: 'http://stv.co.mz/stv', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'Miramar', url: 'http://miramar.co.mz/miramar', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'Rádio Moçambique', url: 'http://rm.co.mz/rm', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'TV Sucesso', url: 'http://sucesso.co.mz/sucesso', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'TV Globo Moçambique', url: 'http://globo.co.mz/globo', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'ZAP Moçambique', url: 'http://zap.co.mz/zap', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'Maningue Magic', url: 'http://maningue.co.mz/magic', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    { nome: 'Top TV', url: 'http://top.co.mz/top', pais: 'MZ', grupo: '🇲🇿 Moçambique' },
    
    // ===== 🇵🇹 PORTUGAL =====
    { nome: 'RTP 1', url: 'http://rtp.pt/rtp1', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'RTP 2', url: 'http://rtp.pt/rtp2', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'RTP 3', url: 'http://rtp.pt/rtp3', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'RTP Internacional', url: 'http://rtp.pt/internacional', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'RTP Açores', url: 'http://rtp.pt/acores', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'RTP Madeira', url: 'http://rtp.pt/madeira', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SIC', url: 'http://sic.pt/sic', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SIC Notícias', url: 'http://sic.pt/noticias', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SIC Radical', url: 'http://sic.pt/radical', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SIC Mulher', url: 'http://sic.pt/mulher', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SIC K', url: 'http://sic.pt/k', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'TVI', url: 'http://tvi.pt/tvi', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'TVI 24', url: 'http://tvi.pt/24', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'TVI Reality', url: 'http://tvi.pt/reality', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'TVI Ficção', url: 'http://tvi.pt/ficcao', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'CMTV', url: 'http://cmtv.pt/cmtv', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'Porto Canal', url: 'http://portocanal.pt/portocanal', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'Canal 11', url: 'http://canal11.pt/canal11', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SPORT TV 1', url: 'http://sporttv.pt/1', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SPORT TV 2', url: 'http://sporttv.pt/2', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SPORT TV 3', url: 'http://sporttv.pt/3', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SPORT TV 4', url: 'http://sporttv.pt/4', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'SPORT TV 5', url: 'http://sporttv.pt/5', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'ELEVEN SPORTS 1', url: 'http://eleven.pt/1', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'ELEVEN SPORTS 2', url: 'http://eleven.pt/2', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'ELEVEN SPORTS 3', url: 'http://eleven.pt/3', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'ELEVEN SPORTS 4', url: 'http://eleven.pt/4', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'ELEVEN SPORTS 5', url: 'http://eleven.pt/5', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'CNN Portugal', url: 'http://cnn.pt/cnn', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'Eurosport 1', url: 'http://eurosport.pt/1', pais: 'PT', grupo: '🇵🇹 Portugal' },
    { nome: 'Eurosport 2', url: 'http://eurosport.pt/2', pais: 'PT', grupo: '🇵🇹 Portugal' },
    
    // ===== 🇧🇷 BRASIL =====
    { nome: 'TV Globo HD', url: 'http://globo.com/globo', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Globo News', url: 'http://globo.com/news', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Globo Play', url: 'http://globo.com/play', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'SBT HD', url: 'http://sbt.com/sbt', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Record TV HD', url: 'http://record.com/record', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Band HD', url: 'http://band.com/band', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'CNN Brasil', url: 'http://cnnbrasil.com/cnn', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Rede TV', url: 'http://redetv.com/redetv', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'TV Cultura', url: 'http://cultura.com/cultura', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Cartoon Network BR', url: 'http://cartoon.com/br', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'Discovery Channel BR', url: 'http://discovery.com/br', pais: 'BR', grupo: '🇧🇷 Brasil' },
    { nome: 'National Geographic BR', url: 'http://natgeo.com/br', pais: 'BR', grupo: '🇧🇷 Brasil' },
    
    // ===== 🇫🇷 FRANÇA =====
    { nome: 'TF1', url: 'http://tf1.fr/tf1', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'France 2', url: 'http://france.tv/2', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'France 3', url: 'http://france.tv/3', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'France 4', url: 'http://france.tv/4', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'France 5', url: 'http://france.tv/5', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'France 24', url: 'http://france24.com/france24', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'M6', url: 'http://m6.fr/m6', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'Canal+', url: 'http://canalplus.fr/canal', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'BFM TV', url: 'http://bfmtv.com/bfm', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'LCI', url: 'http://lci.fr/lci', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'Euronews FR', url: 'http://euronews.com/fr', pais: 'FR', grupo: '🇫🇷 França' },
    { nome: 'TV5 Monde', url: 'http://tv5monde.com/tv5', pais: 'FR', grupo: '🇫🇷 França' },
    
    // ===== 🇩🇪 ALEMANHA =====
    { nome: 'Das Erste', url: 'http://daserste.de/das', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'ZDF', url: 'http://zdf.de/zdf', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'RTL', url: 'http://rtl.de/rtl', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'ProSieben', url: 'http://prosieben.de/pro', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'SAT.1', url: 'http://sat1.de/sat1', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'VOX', url: 'http://vox.de/vox', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'N-TV', url: 'http://n-tv.de/ntv', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    { nome: 'Deutsche Welle', url: 'http://dw.com/dw', pais: 'DE', grupo: '🇩🇪 Alemanha' },
    
    // ===== 🇪🇸 ESPANHA =====
    { nome: 'La 1', url: 'http://rtve.es/la1', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'La 2', url: 'http://rtve.es/la2', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'Antena 3', url: 'http://antena3.com/antena3', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'Cuatro', url: 'http://cuatro.com/cuatro', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'Telecinco', url: 'http://telecinco.com/telecinco', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'La Sexta', url: 'http://lasexta.com/lasexta', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: '24h', url: 'http://rtve.es/24h', pais: 'ES', grupo: '🇪🇸 Espanha' },
    { nome: 'CNN Espanhol', url: 'http://cnn.com/es', pais: 'ES', grupo: '🇪🇸 Espanha' },
    
    // ===== 🇬🇧 REINO UNIDO =====
    { nome: 'BBC One', url: 'http://bbc.co.uk/one', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'BBC Two', url: 'http://bbc.co.uk/two', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'BBC Three', url: 'http://bbc.co.uk/three', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'BBC Four', url: 'http://bbc.co.uk/four', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'BBC News', url: 'http://bbc.co.uk/news', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'ITV', url: 'http://itv.com/itv', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'Channel 4', url: 'http://channel4.com/4', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'Sky News', url: 'http://sky.com/news', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'CNN International', url: 'http://cnn.com/international', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    { nome: 'Euronews EN', url: 'http://euronews.com/en', pais: 'GB', grupo: '🇬🇧 Reino Unido' },
    
    // ===== 🇮🇹 ITÁLIA =====
    { nome: 'RAI 1', url: 'http://rai.it/1', pais: 'IT', grupo: '🇮🇹 Itália' },
    { nome: 'RAI 2', url: 'http://rai.it/2', pais: 'IT', grupo: '🇮🇹 Itália' },
    { nome: 'RAI 3', url: 'http://rai.it/3', pais: 'IT', grupo: '🇮🇹 Itália' },
    { nome: 'RAI News', url: 'http://rai.it/news', pais: 'IT', grupo: '🇮🇹 Itália' },
    { nome: 'Sky TG24', url: 'http://sky.it/tg24', pais: 'IT', grupo: '🇮🇹 Itália' },
    { nome: 'Mediaset', url: 'http://mediaset.it/mediaset', pais: 'IT', grupo: '🇮🇹 Itália' },
    
    // ===== 🇺🇸 EUA =====
    { nome: 'ABC', url: 'http://abc.com/abc', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'CBS', url: 'http://cbs.com/cbs', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'NBC', url: 'http://nbc.com/nbc', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'FOX', url: 'http://fox.com/fox', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'CNN', url: 'http://cnn.com/cnn', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'MSNBC', url: 'http://msnbc.com/msnbc', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'HBO', url: 'http://hbo.com/hbo', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'Discovery Channel', url: 'http://discovery.com/discovery', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'National Geographic', url: 'http://natgeo.com/natgeo', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'History Channel', url: 'http://history.com/history', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'Cartoon Network', url: 'http://cartoon.com/cartoon', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'ESPN', url: 'http://espn.com/espn', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'ESPN 2', url: 'http://espn.com/2', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'TNT', url: 'http://tnt.com/tnt', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'TBS', url: 'http://tbs.com/tbs', pais: 'US', grupo: '🇺🇸 EUA' },
    { nome: 'MTV', url: 'http://mtv.com/mtv', pais: 'US', grupo: '🇺🇸 EUA' },
    
    // ===== 🌍 INTERNACIONAIS =====
    { nome: 'CNN International', url: 'http://cnn.com/international', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'BBC World News', url: 'http://bbc.com/world', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'DW TV', url: 'http://dw.com/dw', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'Euronews', url: 'http://euronews.com/euronews', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'RT', url: 'http://rt.com/rt', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'Al Jazeera', url: 'http://aljazeera.com/aljazeera', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'France 24 EN', url: 'http://france24.com/en', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'TRT World', url: 'http://trt.com/world', pais: 'INT', grupo: '🌍 Internacionais' },
    { nome: 'CGTN', url: 'http://cgtn.com/cgtn', pais: 'INT', grupo: '🌍 Internacionais' },
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
// FUNÇÃO: GERAR PLAYLIST M3U
// ============================================
async function gerarPlaylistM3U(usuario) {
    const expiracao = new Date(usuario.data_expiracao);
    const diasRestantes = Math.ceil((expiracao - new Date()) / (1000 * 60 * 60 * 24));

    console.log(`📡 Gerando playlist para ${usuario.username}...`);

    let playlist = '#EXTM3U\n';
    playlist += `#PLAYLIST: IPTV Manager Pro - ${usuario.username}\n`;
    playlist += `#EXTINF:-1,Plano: ${usuario.plano.toUpperCase()} | Expira em: ${diasRestantes} dias\n\n`;

    // Agrupar canais por país
    const grupos = {};
    CANAIS_FIXOS.forEach(canal => {
        const grupo = canal.grupo || '📺 Outros';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(canal);
    });

    // Ordenar grupos (países)
    const ordemGrupos = ['🇦🇴 Angola', '🇲🇿 Moçambique', '🇵🇹 Portugal', '🇧🇷 Brasil', '🇫🇷 França', '🇩🇪 Alemanha', '🇪🇸 Espanha', '🇬🇧 Reino Unido', '🇮🇹 Itália', '🇺🇸 EUA', '🌍 Internacionais', '📺 Outros'];
    const gruposOrdenados = ordemGrupos.filter(g => grupos[g]);
    
    // Adicionar grupos não listados no final
    for (const grupo of Object.keys(grupos).sort()) {
        if (!ordemGrupos.includes(grupo)) {
            gruposOrdenados.push(grupo);
        }
    }

    for (const grupo of gruposOrdenados) {
        const canaisDoGrupo = grupos[grupo] || [];
        playlist += `#EXTINF:-1 tvg-logo="",📁 ${grupo}\n`;
        playlist += `#EXTGRP:${grupo}\n`;

        canaisDoGrupo.forEach(canal => {
            playlist += `#EXTINF:-1 tvg-logo="",${canal.nome}\n`;
            playlist += `${canal.url}\n`;
        });
        playlist += '\n';
    }

    console.log(`✅ Playlist gerada com ${CANAIS_FIXOS.length} canais`);
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
