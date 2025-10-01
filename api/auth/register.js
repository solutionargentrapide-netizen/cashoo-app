// api/auth/register.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configuration
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
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');

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
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format' 
      });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters' 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('[REGISTER] New registration attempt:', normalizedEmail);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      console.log('[REGISTER] User already exists:', normalizedEmail);
      return res.status(409).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate unique user ID
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    // Create user in database
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        first_name: firstName || null,
        last_name: lastName || null,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        failed_login_attempts: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('[REGISTER] Create error:', createError);
      
      // Handle duplicate key error
      if (createError.code === '23505') {
        return res.status(409).json({ 
          success: false,
          error: 'User already exists' 
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create account',
        details: createError.message 
      });
    }

    console.log('[REGISTER] User created successfully:', newUser.id);

    // Generate welcome JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id,
        email: newUser.email,
        emailVerified: false
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create initial session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: newUser.id,
        token: token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    // Log registration event
    await supabase
      .from('auth_logs')
      .insert({
        user_id: newUser.id,
        action: 'register',
        ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        metadata: { email: normalizedEmail },
        created_at: new Date().toISOString()
      });

    // Send verification email (if email service configured)
    // await sendVerificationEmail(newUser.email, newUser.id);

    // Return success
    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Please verify your email.',
      token: token,
      user: {
        id: newUser.id,
        email: newUser.email,
        emailVerified: false,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      }
    });

  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
