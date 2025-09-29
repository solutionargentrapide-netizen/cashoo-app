// api/inverite/connect.js - Connexion Inverite
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier l'authentification
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Vérifier le JWT
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long'
    );
    
    // Récupérer les paramètres du body
    const { firstname, lastname, email } = req.body;
    
    // Configuration Inverite
    const INVERITE_SITE_ID = process.env.INVERITE_SITE_ID || 'solutionargentrapide';
    const INVERITE_API_URL = process.env.INVERITE_API_URL || 'https://live.inverite.com';
    const INVERITE_API_KEY = process.env.INVERITE_API_KEY || '0a0092a83081e0e1b947a07a5ee60053f20';
    
    // Créer l'URL iframe Inverite avec les paramètres
    const params = new URLSearchParams({
      site: INVERITE_SITE_ID,
      referenceid: `CASHOO_${decoded.userId}`,
      email: email || decoded.email,
      firstname: firstname || '',
      lastname: lastname || '',
      language_pref: 'fr',
      hide_logo: 'false'
    });

    // Retourner l'URL de l'iframe et les informations nécessaires
    res.json({
      success: true,
      iframeUrl: `${INVERITE_API_URL}/customer/web/create?${params.toString()}`,
      apiKey: INVERITE_API_KEY,
      siteId: INVERITE_SITE_ID,
      requestGuid: `CASHOO_${decoded.userId}_${Date.now()}`,
      message: 'Inverite iframe URL generated successfully'
    });
    
  } catch (error) {
    console.error('Inverite connect error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate Inverite URL', 
      details: error.message 
    });
  }
};
