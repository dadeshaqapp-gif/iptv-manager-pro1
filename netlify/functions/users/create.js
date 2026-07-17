/**
 * Netlify Function - Create User
 * POST /api/users/create
 */

const UserController = require('../../../src/server/controllers/userController');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const req = { body };
    const res = {
      json: (data) => data,
      status: (code) => ({ json: (data) => ({ statusCode: code, ...data }) })
    };

    const result = await UserController.create(req, res);

    if (result && result.statusCode) {
      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify(result.json || result)
      };
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
