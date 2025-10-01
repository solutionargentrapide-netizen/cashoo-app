// api/auth/login.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
);

const JWT_SECRET = process.env.JWT_SECRET || 'cashoo-jwt-secret-' + Math.random().toString(36).substring(2, 15);

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    // Email normalization
    const normalizedEmail = email.toLowerCase().trim();
    console.log('[LOGIN] Attempting login for:', normalizedEmail);

    // Check if user exists in Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (fetchError || !user) {
      console.log('[LOGIN] User not found:', normalizedEmail);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    let passwordValid = false;
    
    if (user.password_hash) {
      // Check bcrypt hash
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // For demo/test accounts, accept any password
      passwordValid = true;
      console.log('[LOGIN] Demo account - password check bypassed');
    }

    if (!passwordValid) {
      // Update failed attempts
      await supabase
        .from('users')
        .update({ 
          failed_login_attempts: (user.failed_login_attempts || 0) + 1
        })
        .eq('id', user.id);

      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        emailVerified: user.email_verified || false
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        failed_login_attempts: 0
      })
      .eq('id', user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    console.log('[LOGIN] Success for:', user.email);

    // Return success response
    return res.status(200).json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified || false,
        created_at: user.created_at
      },
      message: 'Login successful!'
    });

  } catch (error) {
    console.error('[LOGIN] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
