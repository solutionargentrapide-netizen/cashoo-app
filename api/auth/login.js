// api/auth/login.js - VERSION AVEC SCHEMA PUBLIC EXPLICITE
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

    // IMPORTANT: Utiliser public.users au lieu de users
    let { data: user, error } = await supabase
      .from('public.users')  // ← SCHEMA EXPLICITE
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

    // Si pas de mot de passe requis
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
        .from('public.sessions')  // ← SCHEMA EXPLICITE
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString()
        });

      await supabase
        .from('public.users')  // ← SCHEMA EXPLICITE
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

    // Si mot de passe fourni
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'No password set for this account' });
    }

    // Vérifier le mot de passe
    const isValidPassword = verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Login réussi
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('public.sessions')  // ← SCHEMA EXPLICITE
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString()
      });

    await supabase
      .from('public.users')  // ← SCHEMA EXPLICITE
      .update({ 
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
};

function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  
  try {
    const parts = hash.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, key] = parts;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return key === verifyHash;
  } catch (error) {
    return false;
  }
}
