/**
 * Modelo de Usuário - IPTV Manager Pro
 * @version 1.0.0
 */

const { supabase } = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Classe Modelo de Usuário
 * Gerencia todas as operações relacionadas a usuários no banco de dados
 */
class UserModel {

  /**
   * Cria um novo usuário no banco de dados
   * @param {Object} userData - Dados do usuário
   * @returns {Object} Usuário criado
   */
  static async create(userData) {
    try {
      const { username, email, password, plano = 'teste', meta_data = {} } = userData;

      // Validar dados obrigatórios
      if (!username) throw new Error('Username é obrigatório');
      if (!password) throw new Error('Password é obrigatório');

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Calcular data de expiração
      const dataExpiracao = this.calculateExpiration(plano);

      // Inserir no banco de dados
      const { data, error } = await supabase
        .from('usuarios')
        .insert({
          username,
          email: email || null,
          password_hash: passwordHash,
          plano,
          data_expiracao: dataExpiracao,
          meta_data: meta_data || {},
          status: 'ativo',
          ativo: true
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Erro ao criar usuário: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error in UserModel.create:', error);
      throw error;
    }
  }

  /**
   * Busca um usuário pelo username
   * @param {string} username - Nome de usuário
   */
  static async findByUsername(username) {
    try {
      if (!username) return null;

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
        throw new Error('Erro ao buscar usuário: ' + error.message);
      }

      return data || null;
    } catch (error) {
      console.error('Error in UserModel.findByUsername:', error);
      throw error;
    }
  }

  /**
   * Busca um usuário pelo ID
   * @param {string} id - UUID do usuário
   */
  static async findById(id) {
    try {
      if (!id) return null;

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
        throw new Error('Erro ao buscar usuário: ' + error.message);
      }

      return data || null;
    } catch (error) {
      console.error('Error in UserModel.findById:', error);
      throw error;
    }
  }

  /**
   * Lista usuários com paginação e filtros
   * @param {Object} options - Opções de busca
   * @returns {Object} Lista de usuários e paginação
   */
  static async list(options = {}) {
    try {
      const { page = 1, limit = 50, status, plano, search } = options;
      const offset = (page - 1) * limit;

      let query = supabase.from('usuarios').select('*', { count: 'exact' });

      // Aplicar filtros
      if (status) query = query.eq('status', status);
      if (plano) query = query.eq('plano', plano);
      if (search) query = query.ilike('username', '%' + search + '%');

      // Ordenação e paginação
      query = query.order('data_criacao', { ascending: false });
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Erro ao listar usuários: ' + error.message);
      }

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      console.error('Error in UserModel.list:', error);
      throw error;
    }
  }

  /**
   * Atualiza um usuário existente
   * @param {string} id - UUID do usuário
   * @param {Object} updates - Campos para atualizar
   * @returns {Object} Usuário atualizado
   */
  static async update(id, updates) {
    try {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Erro ao atualizar usuário: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error in UserModel.update:', error);
      throw error;
    }
  }

  /**
   * Desativa um usuário (soft delete)
   * @param {string} id - UUID do usuário
   * @returns {Object} Usuário desativado
   */
  static async delete(id) {
    try {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('usuarios')
        .update({
          status: 'inativo',
          ativo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Erro ao desativar usuário: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error in UserModel.delete:', error);
      throw error;
    }
  }

  /**
   * Calcula a data de expiração baseado no plano
   * @param {string} plano - Plano do usuário
   * @returns {Date} Data de expiração
   */
  static calculateExpiration(plano) {
    const now = new Date();
    const expirationMap = {
      teste: 2 * 60 * 60 * 1000,
      mensal: 30 * 24 * 60 * 60 * 1000,
      trimestral: 120 * 24 * 60 * 60 * 1000,
      anual: 365 * 24 * 60 * 60 * 1000
    };
    const duration = expirationMap[plano] || expirationMap.teste;
    return new Date(now.getTime() + duration);
  }

  /**
   * Verifica se o usuário está ativo
   * @param {Object} user - Objeto do usuário
   * @returns {boolean} True se ativo
   */
  static isActive(user) {
    if (!user) return false;
    if (user.status !== 'ativo') return false;
    if (user.ativo === false) return false;
    if (user.data_expiracao && new Date() > new Date(user.data_expiracao)) return false;
    return true;
  }
}

module.exports = UserModel;
