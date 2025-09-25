// api/flinks/connect.js
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

    // MÊME SECRET QUE DANS login.js
    const decoded = jwt.verify(token, 'cashoo-jwt-secret-change-this-in-production');

    const params = new URLSearchParams({
      customerId: 'aeca04b8-0164-453f-88f7-07252d7042bd',
      redirectUrl: 'https://www.cashoo.ai/flinks-callback',
      demo: 'false',
      language: 'en'
    });

    const flinksUrl = `https://solutionargentrapide-iframe.private.fin.ag/v2/?${params.toString()}`;

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
