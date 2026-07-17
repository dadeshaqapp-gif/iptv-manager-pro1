/**
 * Controlador de Usuários - IPTV Manager Pro
 * @version 1.0.0
 */

const UserModel = require('../models/User');
const bcrypt = require('bcrypt');

/**
 * Controlador de Usuários
 * Gerencia todas as operações CRUD de usuários
 */
class UserController {

  /**
   * Cria um novo usuário
   * POST /api/users/create
   */
  static async create(req, res) {
    try {
      const { username, password, plano = 'teste', email } = req.body;

      // Validações
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username é obrigatório'
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password é obrigatório'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password deve ter pelo menos 6 caracteres'
        });
      }

      // Verificar se usuário já existe
      const existingUser = await UserModel.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Usuário já existe'
        });
      }

      // Criar usuário
      const user = await UserModel.create({
        username,
        password,
        plano,
        email
      });

      // Remover dados sensíveis
      delete user.password_hash;

      return res.status(201).json({
        success: true,
        data: user,
        message: 'Usuário criado com sucesso!'
      });
    } catch (error) {
      console.error('Error in UserController.create:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar usuário',
        message: error.message
      });
    }
  }

  /**
   * Lista todos os usuários com paginação
   * GET /api/users/list
   */
  static async list(req, res) {
    try {
      const { page, limit, status, plano, search } = req.query;

      const result = await UserModel.list({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        status,
        plano,
        search
      });

      // Remover dados sensíveis
      result.data = result.data.map(user => {
        delete user.password_hash;
        return user;
      });

      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error in UserController.list:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar usuários',
        message: error.message
      });
    }
  }

  /**
   * Busca um usuário pelo ID
   * GET /api/users/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID é obrigatório'
        });
      }

      const user = await UserModel.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      delete user.password_hash;

      return res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error in UserController.getById:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar usuário',
        message: error.message
      });
    }
  }

  /**
   * Atualiza um usuário existente
   * PUT /api/users/:id
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { username, email, plano, status, password } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID é obrigatório'
        });
      }

      // Verificar se usuário existe
      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Preparar dados para atualização
      const updates = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (plano) updates.plano = plano;
      if (status) updates.status = status;
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            error: 'Password deve ter pelo menos 6 caracteres'
          });
        }
        updates.password_hash = await bcrypt.hash(password, 10);
      }

      // Atualizar usuário
      const user = await UserModel.update(id, updates);

      delete user.password_hash;

      return res.json({
        success: true,
        data: user,
        message: 'Usuário atualizado com sucesso!'
      });
    } catch (error) {
      console.error('Error in UserController.update:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar usuário',
        message: error.message
      });
    }
  }

  /**
   * Desativa um usuário (soft delete)
   * DELETE /api/users/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID é obrigatório'
        });
      }

      // Verificar se usuário existe
      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Desativar usuário
      await UserModel.delete(id);

      return res.json({
        success: true,
        message: 'Usuário desativado com sucesso!'
      });
    } catch (error) {
      console.error('Error in UserController.delete:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao desativar usuário',
        message: error.message
      });
    }
  }
}

module.exports = UserController;
