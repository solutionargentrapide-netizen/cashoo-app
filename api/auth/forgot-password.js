// api/auth/forgot-password.js
// Demande de réinitialisation de mot de passe
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Initialisation Supabase
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email requis' 
      });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ 
        error: 'Format d\'email invalide' 
      });
    }

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, email_verified')
      .eq('email', normalizedEmail)
      .single();

    // Note: Pour la sécurité, on retourne toujours le même message
    // même si l'utilisateur n'existe pas (pour éviter l'énumération d'emails)
    const successMessage = 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.';

    if (!user) {
      // Logger la tentative pour un email inexistant
      await supabase
        .from('auth_logs')
        .insert({
          action: 'password_reset_requested_unknown',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { email: normalizedEmail },
          created_at: new Date().toISOString()
        });

      // Retourner le même message de succès pour la sécurité
      return res.json({
        success: true,
        message: successMessage
      });
    }

    // Vérifier si l'email est vérifié
    if (!user.email_verified) {
      // On peut décider de permettre quand même la réinitialisation
      // ou de demander d'abord la vérification de l'email
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Expire dans 1 heure

    // Sauvegarder le token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetExpires.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Logger la demande
    await supabase
      .from('auth_logs')
      .insert({
        user_id: user.id,
        action: 'password_reset_requested',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { 
          email: user.email,
          expires_at: resetExpires.toISOString()
        },
        created_at: new Date().toISOString()
      });

    // TODO: Envoyer l'email avec le lien de réinitialisation
    // Dans un environnement de production, utilisez un service d'email
    const resetLink = `https://www.cashoo.ai/reset-password?token=${resetToken}&email=${normalizedEmail}`;
    
    // En développement, afficher le lien
    if (process.env.NODE_ENV !== 'production') {
      console.log('Lien de réinitialisation:', resetLink);
      
      return res.json({
        success: true,
        message: successMessage,
        // En dev seulement
        resetLink: resetLink
      });
    }

    // En production, retourner seulement le message
    res.json({
      success: true,
      message: successMessage
    });

  } catch (error) {
    console.error('Erreur forgot password:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la demande de réinitialisation',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};
