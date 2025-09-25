// api/auth/login.js
// Login sécurisé avec mot de passe et protection contre brute force
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

  // Limite de tentatives de connexion
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes en millisecondes

  try {
    const { email, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Validation des entrées
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email et mot de passe requis' 
      });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      // Logger la tentative échouée
      await supabase
        .from('auth_logs')
        .insert({
          action: 'login_failed',
          ip_address: clientIp,
          user_agent: userAgent,
          metadata: { 
            email: normalizedEmail, 
            reason: 'user_not_found' 
          },
          created_at: new Date().toISOString()
        });

      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.account_locked_until) - new Date()) / 60000);
      
      await supabase
        .from('auth_logs')
        .insert({
          user_id: user.id,
          action: 'login_blocked',
          ip_address: clientIp,
          user_agent: userAgent,
          metadata: { reason: 'account_locked', remaining_minutes: remainingTime },
          created_at: new Date().toISOString()
        });

      return res.status(429).json({ 
        error: `Compte temporairement verrouillé. Réessayez dans ${remainingTime} minutes.`,
        lockedUntil: user.account_locked_until
      });
    }

    // Vérifier si l'utilisateur a un mot de passe (pour migration des anciens comptes)
    if (!user.password_hash) {
      return res.status(400).json({ 
        error: 'Ce compte nécessite une réinitialisation du mot de passe',
        requiresPasswordReset: true
      });
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Incrémenter le compteur d'échecs
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      
      // Verrouiller le compte si trop de tentatives
      let updateData = {
        failed_login_attempts: newFailedAttempts,
        updated_at: new Date().toISOString()
      };

      if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_TIME);
        updateData.account_locked_until = lockUntil.toISOString();
        updateData.failed_login_attempts = 0; // Reset pour le prochain cycle
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      // Logger la tentative échouée
      await supabase
        .from('auth_logs')
        .insert({
          user_id: user.id,
          action: 'login_failed',
          ip_address: clientIp,
          user_agent: userAgent,
          metadata: { 
            reason: 'invalid_password',
            attempts: newFailedAttempts,
            locked: newFailedAttempts >= MAX_LOGIN_ATTEMPTS
          },
          created_at: new Date().toISOString()
        });

      if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
        return res.status(429).json({ 
          error: `Trop de tentatives échouées. Compte verrouillé pour ${LOCKOUT_TIME / 60000} minutes.`,
          lockedUntil: updateData.account_locked_until
        });
      }

      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        remainingAttempts: MAX_LOGIN_ATTEMPTS - newFailedAttempts
      });
    }

    // Connexion réussie - Réinitialiser les tentatives échouées
    await supabase
      .from('users')
      .update({
        failed_login_attempts: 0,
        account_locked_until: null,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Vérifier si l'email est vérifié
    if (!user.email_verified) {
      // Créer un token temporaire avec privilèges limités
      const tempToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          emailVerified: false,
          restricted: true
        },
        process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production',
        { 
          expiresIn: '1h' 
        }
      );

      return res.status(200).json({
        success: true,
        warning: 'Email non vérifié',
        emailVerified: false,
        token: tempToken,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: false
        }
      });
    }

    // Créer le token JWT complet
    const token = jwt.sign(
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

    // Créer la session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Supprimer les anciennes sessions de cet utilisateur (optionnel - limite à 5 sessions actives)
    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (existingSessions && existingSessions.length >= 5) {
      // Garder seulement les 4 sessions les plus récentes
      const sessionsToDelete = existingSessions.slice(4).map(s => s.id);
      await supabase
        .from('sessions')
        .delete()
        .in('id', sessionsToDelete);
    }

    // Créer la nouvelle session
    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    // Logger la connexion réussie
    await supabase
      .from('auth_logs')
      .insert({
        user_id: user.id,
        action: 'login_success',
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: { 
          email: user.email,
          session_expires: expiresAt.toISOString()
        },
        created_at: new Date().toISOString()
      });

    // Retourner le succès
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la connexion',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
