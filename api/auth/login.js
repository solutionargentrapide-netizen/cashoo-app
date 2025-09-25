// api/auth/login.js - VERSION DEBUG
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // DEBUG - TEMPORAIRE
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  console.log('DEBUG ENV:', {
    url_exists: !!url,
    key_exists: !!key,
    url_start: url ? url.substring(0, 30) : 'UNDEFINED',
    key_start: key ? key.substring(0, 30) : 'UNDEFINED'
  });

  // Si les variables n'existent pas, retourne une erreur claire
  if (!url || !key) {
    return res.status(500).json({ 
      error: 'ENV VARS MISSING',
      details: {
        url: !!url,
        key: !!key
      }
    });
  }

  // Initialiser Supabase
  const supabase = createClient(url, key);

  // Reste du code CORS...
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
      process.env.JWT_SECRET || 'default-jwt-secret-for-testing',
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
