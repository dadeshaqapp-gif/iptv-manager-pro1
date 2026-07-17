/** 
 * Controlador de Autentica‡Æo 
 * IPTV Manager Pro 
 */ 
 
const UserModel = require('../models/User'); 
const { generateToken, verifyToken } = require('../config/auth'); 
const bcrypt = require('bcrypt'); 
 
class AuthController { 
  static async login(req, res) { 
    try { 
      const { username, password } = req.body; 
 
      const user = await UserModel.findByUsername(username); 
      if (!user) { 
        return res.status(401).json({ error: 'Credenciais inv lidas' }); 
      } 
 
      const senhaValida = await bcrypt.compare(password, user.password_hash); 
      if (!senhaValida) { 
        return res.status(401).json({ error: 'Credenciais inv lidas' }); 
      } 
 
      if (!UserModel.isActive(user)) { 
        return res.status(403).json({ error: 'Conta inativa ou expirada' }); 
      } 
 
      const token = generateToken({ 
        userId: user.id, 
        username: user.username, 
        plano: user.plano 
      }); 
 
      delete user.password_hash; 
 
      return res.json({ 
        success: true, 
        user, 
        token, 
        expiresIn: '7d' 
      }); 
    } catch (error) { 
      console.error('Login error:', error); 
      return res.status(500).json({ 
        error: 'Erro ao fazer login', 
        message: error.message 
      }); 
    } 
  } 
 
  static async validate(req, res) { 
    try { 
      const { token } = req.body; 
 
      if (!token) { 
        return res.status(400).json({ error: 'Token obrigat¢rio' }); 
      } 
 
      const decoded = verifyToken(token); 
      if (!decoded) { 
        return res.status(401).json({ error: 'Token inv lido ou expirado' }); 
      } 
 
      const user = await UserModel.findById(decoded.userId); 
      if (!user || !UserModel.isActive(user)) { 
        return res.status(403).json({ error: 'Usu rio inv lido ou inativo' }); 
      } 
 
      return res.json({ 
        success: true, 
        valid: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          plano: user.plano, 
          status: user.status, 
          data_expiracao: user.data_expiracao 
        } 
      }); 
    } catch (error) { 
      console.error('Validate error:', error); 
      return res.status(500).json({ 
        error: 'Erro ao validar token', 
        message: error.message 
      }); 
    } 
  } 
} 
 
