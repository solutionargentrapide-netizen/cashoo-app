module.exports = async (req, res) => {
  // DEBUG - À RETIRER APRÈS
  console.log('ENV CHECK:', {
    url_exists: !!process.env.SUPABASE_URL,
    key_exists: !!process.env.SUPABASE_SERVICE_KEY,
    jwt_exists: !!process.env.JWT_SECRET,
    url_value: process.env.SUPABASE_URL?.substring(0, 20) + '...',
    key_length: process.env.SUPABASE_SERVICE_KEY?.length
  });

  // Initialiser Supabase DANS la fonction
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Reste du code...

// api/auth/login.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Initialiser Supabase DANS la fonction
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Configuration CORS
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
      process.env.JWT_SECRET,
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
