// api/auth/login.js - VERSION CORRIGÉE
// Compatible avec le hash pbkdf2 utilisé dans register.js

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
  );

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    // Validation basique
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Récupérer l'utilisateur
    let { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, email_verified, failed_login_attempts, account_locked_until')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      console.log('User not found for email:', normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Vérifier si le compte est verrouillé
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      const lockTime = new Date(user.account_locked_until);
      return res.status(423).json({ 
        error: 'Account locked due to too many failed attempts',
        lockedUntil: lockTime.toISOString(),
        remainingTime: Math.ceil((lockTime - new Date()) / 1000 / 60) + ' minutes'
      });
    }

    // ANCIEN SYSTÈME : Si pas de password dans la requête ET pas de password_hash en DB
    if (!password && !user.password_hash) {
      // Ancien système sans mot de passe - on accepte
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
        { expiresIn: '7d' }
      );

      // Créer la session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString()
        });

      // Mettre à jour last_login
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          failed_login_attempts: 0
        })
        .eq('id', user.id);

      return res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email }
      });
    }

    // NOUVEAU SYSTÈME : Vérification du mot de passe
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Vérifier le mot de passe avec la MÊME MÉTHODE que register.js
    const isValidPassword = verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      // Incrémenter les tentatives échouées
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let updateData = { failed_login_attempts: newAttempts };
      
      // Verrouiller après 5 tentatives
      if (newAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 15); // Lock for 15 minutes
        updateData.account_locked_until = lockUntil.toISOString();
        
        await supabase
          .from('users')
          .update(updateData)
          .eq('id', user.id);
        
        return res.status(423).json({ 
          error: 'Account locked due to too many failed attempts',
          lockedUntil: lockUntil.toISOString()
        });
      }
      
      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
      
      return res.status(401).json({ 
        error: 'Invalid email or password',
        remainingAttempts: 5 - newAttempts
      });
    }

    // Mot de passe correct ! Réinitialiser les tentatives
    await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        failed_login_attempts: 0,
        account_locked_until: null
      })
      .eq('id', user.id);

    // Créer le token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        emailVerified: user.email_verified
      },
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
      { expiresIn: '7d' }
    );

    // Créer la session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString()
      });

    // Logger la connexion (optionnel)
    await supabase
      .from('auth_logs')
      .insert({
        user_id: user.id,
        action: 'login',
        ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        metadata: { email: user.email }
      })
      .catch(err => console.log('Could not log login:', err.message));

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};

// FONCTION CRITIQUE : Vérifier le mot de passe
// DOIT être identique à celle utilisée dans register.js
function verifyPassword(password, hash) {
  if (!password || !hash) {
    console.log('Missing password or hash');
    return false;
  }
  
  try {
    // Le hash est stocké comme "salt:hashedPassword"
    const parts = hash.split(':');
    if (parts.length !== 2) {
      console.log('Invalid hash format');
      return false;
    }
    
    const [salt, key] = parts;
    
    // Recréer le hash avec le même algorithme que register.js
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    
    // Comparer les hashs
    const isValid = key === verifyHash;
    
    if (!isValid) {
      console.log('Password verification failed');
    }
    
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}
