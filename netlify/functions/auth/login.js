/** 
 * Netlify Function - Login 
 * POST /api/auth/login 
 */ 
 
const AuthController = require('../../../src/server/controllers/authController'); 
 
exports.handler = async (event) =
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
      json: (data) =
      status: (code) = json: (data) = statusCode: code, ...data }) }) 
    }; 
 
    const result = await AuthController.login(req, res); 
 
      return { 
        statusCode: result.statusCode, 
        headers, 
      }; 
    } 
 
    return { 
      statusCode: 200, 
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
