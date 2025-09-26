// api/auth/login.js - VERSION FINALE FONCTIONNELLE
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
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Looking for user:', normalizedEmail);

    // IMPORTANT: Utiliser 'users' sans le préfixe 'public.'
    let { data: user, error } = await supabase
      .from('users')  // ← PAS de public. devant
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error) {
      console.log('Supabase error:', error);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user) {
      console.log('No user found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('User found:', user.email);
    console.log('Has password hash:', !!user.password_hash);

    // Si pas de mot de passe requis (ancien système)
    if (!password && !user.password_hash) {
      console.log('No password system - allowing login');
      
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
        { expiresIn: '7d' }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase
        .from('sessions')  // ← PAS de public. devant
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString()
        });

      await supabase
        .from('users')  // ← PAS de public. devant
        .update({ 
          last_login: new Date().toISOString()
        })
        .eq('id', user.id);

      return res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email }
      });
    }

    // Si mot de passe fourni mais pas de hash en DB
    if (password && !user.password_hash) {
      return res.status(401).json({ error: 'Please login without password or reset your password' });
    }

    // Si pas de mot de passe fourni mais hash existe
    if (!password && user.password_hash) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Vérifier le mot de passe
    const isValidPassword = verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      
      // Incrémenter les tentatives échouées
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      
      await supabase
        .from('users')  // ← PAS de public. devant
        .update({ 
          failed_login_attempts: newAttempts 
        })
        .eq('id', user.id);
      
      return res.status(401).json({ 
        error: 'Invalid email or password',
        remainingAttempts: Math.max(0, 5 - newAttempts)
      });
    }

    console.log('Password correct - login successful');

    // Login réussi - réinitialiser les tentatives
    await supabase
      .from('users')  // ← PAS de public. devant
      .update({ 
        last_login: new Date().toISOString(),
        failed_login_attempts: 0
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
      .from('sessions')  // ← PAS de public. devant
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString()
      });

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

// Fonction pour vérifier le mot de passe
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
    
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}
