// api/auth/verify-email.js
// Vérification de l'email pour activer le compte
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Récupérer le token et l'email depuis les paramètres ou le body
    const token = req.query.token || req.body.token;
    const email = req.query.email || req.body.email;

    if (!token || !email) {
      return res.status(400).json({ 
        error: 'Token et email requis pour la vérification' 
      });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('verification_token', token)
      .single();

    if (userError || !user) {
      // Logger la tentative échouée
      await supabase
        .from('auth_logs')
        .insert({
          action: 'email_verification_failed',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            email: normalizedEmail,
            reason: 'invalid_token_or_email'
          },
          created_at: new Date().toISOString()
        });

      return res.status(400).json({ 
        error: 'Token de vérification invalide ou expiré' 
      });
    }

    // Vérifier si l'email est déjà vérifié
    if (user.email_verified) {
      return res.status(200).json({ 
        success: true,
        message: 'Email déjà vérifié',
        alreadyVerified: true
      });
    }

    // Marquer l'email comme vérifié
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null, // Supprimer le token utilisé
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Logger la vérification réussie
    await supabase
      .from('auth_logs')
      .insert({
        user_id: user.id,
        action: 'email_verified',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { email: user.email },
        created_at: new Date().toISOString()
      });

    // Créer un nouveau token JWT complet maintenant que l'email est vérifié
    const jwtToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        emailVerified: true
      },
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production',
      { 
        expiresIn: '7d' 
      }
    );

    // Créer une nouvelle session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: jwtToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    // Retourner le succès
    res.json({
      success: true,
      message: 'Email vérifié avec succès',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la vérification',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
