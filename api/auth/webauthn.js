// api/auth/webauthn.js - Authentification biométrique
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
  );

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, email, credential, challenge } = req.body;

  try {
    switch (action) {
      case 'register':
        // Début de l'enregistrement WebAuthn
        const challengeBuffer = Buffer.from(Date.now().toString()).toString('base64');
        
        const publicKeyCredentialCreationOptions = {
          challenge: challengeBuffer,
          rp: {
            name: "CASHOO",
            id: "cashoo.ai",
          },
          user: {
            id: Buffer.from(email).toString('base64'),
            name: email,
            displayName: email.split('@')[0]
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },  // ES256
            { alg: -257, type: "public-key" } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "direct"
        };

        // Sauvegarder le challenge en DB
        await supabase
          .from('webauthn_challenges')
          .insert({
            email,
            challenge: challengeBuffer,
            type: 'registration',
            expires_at: new Date(Date.now() + 300000).toISOString() // 5 minutes
          });

        res.json({
          success: true,
          options: publicKeyCredentialCreationOptions
        });
        break;

      case 'verify-registration':
        // Vérifier et enregistrer la credential
        const { data: savedChallenge } = await supabase
          .from('webauthn_challenges')
          .select('*')
          .eq('email', email)
          .eq('challenge', challenge)
          .eq('type', 'registration')
          .single();

        if (!savedChallenge) {
          return res.status(400).json({ error: 'Invalid challenge' });
        }

        // Sauvegarder la credential
        await supabase
          .from('webauthn_credentials')
          .insert({
            user_email: email,
            credential_id: credential.id,
            public_key: credential.publicKey,
            counter: 0,
            created_at: new Date().toISOString()
          });

        // Créer le token JWT
        const token = jwt.sign(
          { email, webauthn: true },
          process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
          { expiresIn: '7d' }
        );

        res.json({
          success: true,
          message: 'Biometric authentication registered successfully',
          token
        });
        break;

      case 'login':
        // Début de l'authentification
        const loginChallenge = Buffer.from(Date.now().toString()).toString('base64');

        // Récupérer les credentials de l'utilisateur
        const { data: credentials } = await supabase
          .from('webauthn_credentials')
          .select('credential_id')
          .eq('user_email', email);

        if (!credentials || credentials.length === 0) {
          return res.status(400).json({ error: 'No biometric authentication found' });
        }

        const publicKeyCredentialRequestOptions = {
          challenge: loginChallenge,
          allowCredentials: credentials.map(cred => ({
            id: cred.credential_id,
            type: 'public-key',
            transports: ['internal']
          })),
          userVerification: "required",
          timeout: 60000
        };

        // Sauvegarder le challenge
        await supabase
          .from('webauthn_challenges')
          .insert({
            email,
            challenge: loginChallenge,
            type: 'authentication',
            expires_at: new Date(Date.now() + 300000).toISOString()
          });

        res.json({
          success: true,
          options: publicKeyCredentialRequestOptions
        });
        break;

      case 'verify-login':
        // Vérifier l'authentification
        const { data: authChallenge } = await supabase
          .from('webauthn_challenges')
          .select('*')
          .eq('email', email)
          .eq('challenge', challenge)
          .eq('type', 'authentication')
          .single();

        if (!authChallenge) {
          return res.status(400).json({ error: 'Invalid challenge' });
        }

        // Vérifier la credential
        const { data: storedCredential } = await supabase
          .from('webauthn_credentials')
          .select('*')
          .eq('user_email', email)
          .eq('credential_id', credential.id)
          .single();

        if (!storedCredential) {
          return res.status(400).json({ error: 'Invalid credential' });
        }

        // Mettre à jour le counter
        await supabase
          .from('webauthn_credentials')
          .update({ 
            counter: storedCredential.counter + 1,
            last_used: new Date().toISOString()
          })
          .eq('credential_id', credential.id);

        // Créer le token JWT
        const authToken = jwt.sign(
          { email, webauthn: true },
          process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long',
          { expiresIn: '7d' }
        );

        // Récupérer l'utilisateur
        const { data: user } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email)
          .single();

        res.json({
          success: true,
          message: 'Biometric authentication successful',
          token: authToken,
          user: user || { email }
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('WebAuthn error:', error);
    res.status(500).json({ 
      error: 'WebAuthn operation failed',
      details: error.message 
    });
  }
};
