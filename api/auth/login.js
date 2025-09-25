// api/auth/login.js - VERSION CORRIGÉE AVEC ANON KEY
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Utilise la clé ANON qui fonctionne
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.QfHPKnzpZ0d6XkPYdVxPd3rbt2Np-x0IbYbzcVLnJqk'
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
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ email })
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      user = newUser;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'cashoo-jwt-secret-change-this-in-production',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
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
        email: user.email
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
};
