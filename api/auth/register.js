// api/auth/register.js
// Inscription sécurisée avec mot de passe et vérification email
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Initialisation Supabase avec les bonnes clés
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.EYjHqSSD1wnghW8yI3LJj88VUtMIxaZ_hv1-FQ8i1DA'
  );

  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://www.cashoo.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, confirmPassword } = req.body;

    // Validation des entrées
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Email et mot de passe requis' 
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Format d\'email invalide' 
      });
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins 8 caractères' 
      });
    }

    // Vérifier la complexité du mot de passe
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial' 
      });
    }

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Les mots de passe ne correspondent pas' 
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Cet email est déjà enregistré' 
      });
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Générer un token de vérification
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Créer l'utilisateur
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        email_verified: false,
        verification_token: verificationToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erreur création utilisateur:', createError);
      return res.status(500).json({ 
        error: 'Erreur lors de la création du compte' 
      });
    }

    // Logger l'inscription
    await supabase
      .from('auth_logs')
      .insert({
        user_id: newUser.id,
        action: 'registration',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { email: email.toLowerCase() },
        created_at: new Date().toISOString()
      });

    // TODO: Envoyer l'email de vérification
    // Dans un environnement de production, utilisez un service comme SendGrid ou AWS SES
    // Pour le test, on affiche juste le lien
    const verificationLink = `https://www.cashoo.ai/verify-email?token=${verificationToken}&email=${email}`;
    console.log('Lien de vérification:', verificationLink);

    // Créer un token JWT temporaire (valide 1 heure seulement tant que l'email n'est pas vérifié)
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        emailVerified: false
      },
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production',
      { 
        expiresIn: '1h' 
      }
    );

    // Créer une session temporaire
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await supabase
      .from('sessions')
      .insert({
        user_id: newUser.id,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    // Retourner le succès
    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Veuillez vérifier votre email.',
      user: {
        id: newUser.id,
        email: newUser.email,
        emailVerified: false
      },
      token,
      verificationRequired: true,
      // En dev seulement, retourner le lien de vérification
      ...(process.env.NODE_ENV !== 'production' && { verificationLink })
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'inscription',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
