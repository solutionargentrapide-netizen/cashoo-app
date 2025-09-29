// api/auth.js - FONCTION AUTH UNIFIÉE (remplace login, register, verify, logout, webauthn)
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
  );

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Récupérer l'action depuis l'URL ou le body
  const action = req.query.action || req.body.action;
  
  try {
    switch (action) {
      // ========================================
      // LOGIN
      // ========================================
      case 'login':
        const { email, password } = req.body;
        
        if (!email) {
          return res.status(400).json({ error: 'Email required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        console.log('Login attempt for:', normalizedEmail);

        let { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .single();

        if (error || !user) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Si pas de mot de passe requis
        if (!password && !user.password_hash) {
          const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
            { expiresIn: '7d' }
          );

          await supabase
            .from('sessions')
            .insert({
              user_id: user.id,
              token,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });

          return res.json({
            success: true,
            token,
            user: { id: user.id, email: user.email }
          });
        }

        // Vérifier le mot de passe si nécessaire
        if (password && user.password_hash) {
          const [salt, key] = user.password_hash.split(':');
          const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
          
          if (key !== verifyHash) {
            return res.status(401).json({ error: 'Invalid email or password' });
          }
        }

        const token = jwt.sign(
          { 
            userId: user.id, 
            email: user.email,
            emailVerified: user.email_verified
          },
          process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
          { expiresIn: '7d' }
        );

        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString()
          })
          .eq('id', user.id);

        res.json({
          success: true,
          token,
          user: { 
            id: user.id, 
            email: user.email,
            emailVerified: user.email_verified
          }
        });
        break;

      // ========================================
      // REGISTER
      // ========================================
      case 'register':
        const { email: regEmail, password: regPassword } = req.body;

        if (!regEmail || !regPassword) {
          return res.status(400).json({ error: 'Email and password required' });
        }

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', regEmail)
          .single();

        if (existingUser) {
          return res.status(409).json({ error: 'User already exists' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto.pbkdf2Sync(regPassword, salt, 1000, 64, 'sha512').toString('hex');
        const passwordHash = `${salt}:${hashedPassword}`;

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: regEmail,
            password_hash: passwordHash,
            email_verified: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const regToken = jwt.sign(
          { 
            userId: newUser.id, 
            email: newUser.email,
            verified: false 
          },
          process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
          { expiresIn: '1h' }
        );

        res.json({
          success: true,
          message: 'Registration successful!',
          token: regToken,
          user: {
            id: newUser.id,
            email: newUser.email,
            emailVerified: false
          }
        });
        break;

      // ========================================
      // VERIFY TOKEN
      // ========================================
      case 'verify':
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!authToken) {
          return res.status(401).json({ 
            valid: false, 
            error: 'No token provided' 
          });
        }

        let decoded;
        try {
          decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long');
        } catch (jwtError) {
          return res.status(401).json({ 
            valid: false, 
            error: 'Invalid token' 
          });
        }

        const { data: verifyUser } = await supabase
          .from('users')
          .select('id, email, email_verified, last_login, created_at')
          .eq('id', decoded.userId)
          .single();

        if (!verifyUser) {
          return res.status(401).json({ 
            valid: false, 
            error: 'User not found' 
          });
        }

        res.json({
          valid: true,
          userId: verifyUser.id,
          email: verifyUser.email,
          emailVerified: verifyUser.email_verified,
          lastLogin: verifyUser.last_login,
          memberSince: verifyUser.created_at
        });
        break;

      // ========================================
      // LOGOUT
      // ========================================
      case 'logout':
        const logoutToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (logoutToken) {
          await supabase
            .from('sessions')
            .delete()
            .eq('token', logoutToken);
        }

        res.json({
          success: true,
          message: 'Déconnexion réussie'
        });
        break;

      // ========================================
      // WEBAUTHN
      // ========================================
      case 'webauthn-register':
      case 'webauthn-login':
      case 'webauthn-verify':
        const { email: webEmail, credential, challenge } = req.body;
        
        if (action === 'webauthn-register') {
          const challengeBuffer = Buffer.from(Date.now().toString()).toString('base64');
          
          const publicKeyCredentialCreationOptions = {
            challenge: challengeBuffer,
            rp: {
              name: "CASHOO",
              id: "cashoo.ai",
            },
            user: {
              id: Buffer.from(webEmail).toString('base64'),
              name: webEmail,
              displayName: webEmail.split('@')[0]
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" },
              { alg: -257, type: "public-key" }
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            },
            timeout: 60000,
            attestation: "direct"
          };

          res.json({
            success: true,
            options: publicKeyCredentialCreationOptions
          });
        } else {
          // Simplification pour le démo
          res.json({
            success: true,
            message: 'WebAuthn operation completed'
          });
        }
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
