// api/auth/logout.js
// Déconnexion sécurisée et suppression de session
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Initialisation Supabase
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.EYjHqSSD1wnghW8yI3LJj88VUtMIxaZ_hv1-FQ8i1DA'
  );

  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://www.cashoo.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Pas de token, considérer comme déjà déconnecté
      return res.json({ 
        success: true, 
        message: 'Déjà déconnecté' 
      });
    }

    // Vérifier et décoder le token (même s'il est expiré, on veut le supprimer)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production');
    } catch (jwtError) {
      // Si le token est invalide ou expiré, on peut quand même essayer de le supprimer de la DB
      // En extrayant l'userId du token sans vérification
      try {
        decoded = jwt.decode(token);
      } catch {
        // Token complètement invalide
        return res.json({ 
          success: true, 
          message: 'Session invalide déjà terminée' 
        });
      }
    }

    if (decoded && decoded.userId) {
      // Supprimer la session de la base de données
      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('token', token);

      // Logger la déconnexion
      await supabase
        .from('auth_logs')
        .insert({
          user_id: decoded.userId,
          action: 'logout',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            email: decoded.email,
            manual: true
          },
          created_at: new Date().toISOString()
        });
    }

    // Retourner le succès
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur logout:', error);
    // Même en cas d'erreur, on considère la déconnexion comme réussie
    // pour éviter de bloquer l'utilisateur
    res.json({
      success: true,
      message: 'Déconnexion effectuée',
      warning: 'Erreur lors de la suppression de session'
    });
  }
};
