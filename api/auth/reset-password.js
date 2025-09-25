// api/auth/reset-password.js
// Réinitialisation du mot de passe avec le token
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    // Validation des entrées
    if (!token || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis' 
      });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Validation du nouveau mot de passe
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins 8 caractères' 
      });
    }

    // Vérifier la complexité du mot de passe
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial' 
      });
    }

    // Vérifier que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Les mots de passe ne correspondent pas' 
      });
    }

    // Récupérer l'utilisateur avec le token de réinitialisation
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('reset_token', token)
      .single();

    if (userError || !user) {
      // Logger la tentative échouée
      await supabase
        .from('auth_logs')
        .insert({
          action: 'password_reset_failed',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            email: normalizedEmail,
            reason: 'invalid_token'
          },
          created_at: new Date().toISOString()
        });

      return res.status(400).json({ 
        error: 'Token de réinitialisation invalide ou expiré' 
      });
    }

    // Vérifier si le token n'a pas expiré
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      // Logger l'expiration
      await supabase
        .from('auth_logs')
        .insert({
          user_id: user.id,
          action: 'password_reset_expired',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            expired_at: user.reset_token_expires
          },
          created_at: new Date().toISOString()
        });

      return res.status(400).json({ 
        error: 'Le token de réinitialisation a expiré. Veuillez demander un nouveau lien.' 
      });
    }

    // Vérifier que le nouveau mot de passe n'est pas identique à l'ancien
    if (user.password_hash && await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit être différent de l\'ancien' 
      });
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe et supprimer le token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
        failed_login_attempts: 0, // Réinitialiser les tentatives échouées
        account_locked_until: null, // Débloquer le compte si nécessaire
        email_verified: true, // Marquer l'email comme vérifié par la même occasion
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Logger la réinitialisation réussie
    await supabase
      .from('auth_logs')
      .insert({
        user_id: user.id,
        action: 'password_reset_success',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { email: user.email },
        created_at: new Date().toISOString()
      });

    // Créer un nouveau token JWT pour auto-connexion
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

    // Supprimer toutes les anciennes sessions (sécurité)
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', user.id);

    // Créer la nouvelle session
    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: jwtToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    // Retourner le succès avec auto-connexion
    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Erreur reset password:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la réinitialisation',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
