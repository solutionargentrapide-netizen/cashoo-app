// api/auth/register.js - Version sans bcryptjs
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Initialisation Supabase avec les vraies clés
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.EYjHqSSD1wnghW8yI3LJj88VUtMIxaZ_hv1-FQ8i1DA'
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
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validation mot de passe (minimum 8 caractères)
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash du mot de passe avec crypto (alternative à bcrypt)
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hashedPassword}`;

    // Générer un token de vérification
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Créer l'utilisateur
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        email_verified: false,
        verification_token: verificationToken,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Create user error:', createError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Créer un token JWT temporaire
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        verified: false 
      },
      'cashoo-jwt-secret-change-this-in-production',
      { expiresIn: '1h' }
    );

    // Log de l'inscription
    await supabase
      .from('auth_logs')
      .insert({
        user_id: newUser.id,
        action: 'register',
        ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { email }
      });

    res.json({
      success: true,
      message: 'Registration successful! Please verify your email.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        emailVerified: false
      },
      verificationRequired: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed', 
      details: error.message 
    });
  }
};

// Fonction helper pour vérifier le mot de passe
function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return key === verifyHash;
}
