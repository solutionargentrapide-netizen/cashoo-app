// api/auth/verify.js - Vérification du token JWT
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

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
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        valid: false,
        error: 'No token provided' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      console.log('[VERIFY] JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          valid: false,
          error: 'Token expired',
          expired: true
        });
      }
      
      return res.status(401).json({ 
        valid: false,
        error: 'Invalid token' 
      });
    }

    // Check if user still exists in database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, email_verified, last_login, created_at')
      .eq('id', decoded.userId)
      .single();

    if (fetchError || !user) {
      console.log('[VERIFY] User not found:', decoded.userId);
      return res.status(401).json({ 
        valid: false,
        error: 'User not found' 
      });
    }

    // Check if session is still valid
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('token', token)
      .single();

    if (sessionError || !session) {
      console.log('[VERIFY] Session not found for user:', user.id);
      // Session doesn't exist but token is valid - create new session
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
    } else {
      // Check if session expired
      const expiryDate = new Date(session.expires_at);
      if (expiryDate < new Date()) {
        console.log('[VERIFY] Session expired for user:', user.id);
        
        // Delete expired session
        await supabase
          .from('sessions')
          .delete()
          .eq('id', session.id);
        
        return res.status(401).json({ 
          valid: false,
          error: 'Session expired',
          expired: true
        });
      }
    }

    console.log('[VERIFY] Token valid for user:', user.email);

    // Return user info
    return res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        memberSince: user.created_at
      },
      tokenInfo: {
        issuedAt: new Date(decoded.iat * 1000).toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('[VERIFY] Error:', error);
    return res.status(500).json({ 
      valid: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
