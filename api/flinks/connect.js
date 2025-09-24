// api/flinks/connect.js
// Fonction serverless pour obtenir l'URL Flinks iframe
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Configuration CORS
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
    // Vérifier le token JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Construire l'URL Flinks
    const params = new URLSearchParams({
      customerId: process.env.FLINKS_CUSTOMER_ID,
      redirectUrl: `${process.env.APP_URL || 'https://cashoo.ai'}/flinks-callback`,
      demo: 'false',
      language: 'en'
    });

    const flinksUrl = `${process.env.FLINKS_CONNECT_DOMAIN}?${params.toString()}`;

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
