// api/inverite/connect.js
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Vérifier l'authentification
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Créer l'URL iframe Inverite
    const inveriteUrl = `${process.env.INVERITE_API_URL}/customer/web/create`;
    const params = new URLSearchParams({
      site: process.env.INVERITE_SITE_ID,
      referenceid: `CASHOO_${decoded.userId}`,
      email: decoded.email,
      firstname: req.body.firstname || '',
      lastname: req.body.lastname || '',
      language_pref: 'fr'
    });

    res.json({
      success: true,
      iframeUrl: `${inveriteUrl}?${params}`,
      apiKey: process.env.INVERITE_API_KEY
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
