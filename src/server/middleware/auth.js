/** 
 * Middleware de Autentica‡Æo 
 * IPTV Manager Pro 
 */ 
 
const { verifyToken } = require('../config/auth'); 
const { supabase } = require('../config/database'); 
 
async function authenticate(req, res, next) { 
  try { 
    const authHeader = req.headers.authorization; 
    if (!authHeader || !authHeader.startsWith('Bearer ')) { 
      return res.status(401).json({ error: 'Authentication required' }); 
    } 
 
    const token = authHeader.split(' ')[1]; 
    const decoded = verifyToken(token); 
    if (!decoded) { 
      return res.status(401).json({ error: 'Invalid token' }); 
    } 
 
    const { data: user, error } = await supabase 
      .from('usuarios') 
      .select('id, username, email, plano, status, data_expiracao') 
      .eq('id', decoded.userId) 
      .single(); 
 
    if (error || !user) { 
      return res.status(401).json({ error: 'User not found' }); 
    } 
 
    if (user.status !== 'ativo') { 
      return res.status(403).json({ error: 'Account inactive' }); 
    } 
 
      return res.status(403).json({ error: 'Subscription expired' }); 
    } 
 
    req.user = user; 
    req.token = token; 
    next(); 
  } catch (error) { 
    return res.status(500).json({ error: 'Internal server error' }); 
  } 
} 
 
function requireAdmin(req, res, next) { 
  if (!req.user) { 
    return res.status(401).json({ error: 'Authentication required' }); 
  } 
    return res.status(403).json({ error: 'Admin access required' }); 
  } 
  next(); 
} 
 
module.exports = { authenticate, requireAdmin }; 
