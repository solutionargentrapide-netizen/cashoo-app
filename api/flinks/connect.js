// api/flinks/connect.js - VERSION CORRIGÉE
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // UTILISE LE MÊME SECRET QUE login.js
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long');

    const params = new URLSearchParams({
      customerId: process.env.FLINKS_CUSTOMER_ID || 'aeca04b8-0164-453f-88f7-07252d7042bd',
      redirectUrl: process.env.APP_URL ? `${process.env.APP_URL}/flinks-callback` : 'https://www.cashoo.ai/flinks-callback',
      demo: 'false',
      language: 'en'
    });

    const flinksUrl = `${process.env.FLINKS_CONNECT_DOMAIN || 'https://solutionargentrapide-iframe.private.fin.ag/v2/'}?${params.toString()}`;

    res.json({
      success: true,
      url: flinksUrl
    });

  } catch (error) {
    console.error('Flinks connect error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to generate Flinks URL' });
  }
};
