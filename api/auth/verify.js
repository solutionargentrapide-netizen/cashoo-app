// api/auth/verify.js
// Vérification du token JWT et des sessions
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        valid: false, 
        error: 'No token provided' 
      });
    }

    // Vérifier le token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production');
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          valid: false, 
          error: 'Token expired',
          expired: true
        });
      }
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid token' 
      });
    }

    // Vérifier si la session existe dans la base de données
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, users(id, email, email_verified)')
      .eq('token', token)
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Session not found' 
      });
    }

    // Vérifier si la session n'a pas expiré
    if (new Date(session.expires_at) < new Date()) {
      // Supprimer la session expirée
      await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);

      return res.status(401).json({ 
        valid: false, 
        error: 'Session expired',
        expired: true
      });
    }

    // Récupérer les informations complètes de l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, email_verified, last_login, created_at')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      return res.status(401).json({ 
        valid: false, 
        error: 'User not found' 
      });
    }

    // Vérifier si l'email correspond
    if (user.email !== decoded.email) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Token user mismatch' 
      });
    }

    // Si l'utilisateur a des privilèges restreints (email non vérifié)
    if (decoded.restricted && !user.email_verified) {
      return res.json({
        valid: true,
        restricted: true,
        emailVerified: false,
        userId: user.id,
        email: user.email,
        message: 'Email verification required for full access'
      });
    }

    // Token valide et session active
    res.json({
      valid: true,
      userId: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      lastLogin: user.last_login,
      memberSince: user.created_at,
      sessionExpires: session.expires_at
    });

  } catch (error) {
    console.error('Erreur vérification token:', error);
    res.status(500).json({ 
      valid: false,
      error: 'Server error during verification',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
