// api/auth/login.js - Version simplifiée sans colonnes problématiques
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.EYjHqSSD1wnghW8yI3LJj88VUtMIxaZ_hv1-FQ8i1DA'
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
    const { email, password } = req.body;
    
    // Validation basique
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Récupérer l'utilisateur
    let { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Si pas de password dans la requête mais l'utilisateur n'a pas de password_hash (ancien système)
    if (!password && !user.password_hash) {
      // Ancien système sans mot de passe - on accepte
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        'cashoo-jwt-secret-change-this-in-production',
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email }
      });
    }

    // Nouveau système avec mot de passe
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Vérifier le mot de passe (hash base64 temporaire)
    const passwordHash = Buffer.from(password).toString('base64');
    
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Créer le token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'cashoo-jwt-secret-change-this-in-production',
      { expiresIn: '7d' }
    );

    // Créer la session
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
};
