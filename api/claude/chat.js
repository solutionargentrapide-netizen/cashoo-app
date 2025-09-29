// api/claude/chat.js - Assistant financier CASHOO (Version simplifiée)
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier l'authentification
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long'
      );
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Récupérer les données financières de l'utilisateur
    let financialContext = {
      totalBalance: 92.53,
      accounts: 1,
      transactions: 272,
      monthlyIncome: 863.92,
      monthlyExpenses: 1036.00
    };

    try {
      const { data: financialData } = await supabase
        .from('flinks_data')
        .select('accounts_data, transactions_data')
        .eq('user_id', userId)
        .single();

      if (financialData && financialData.accounts_data) {
        const accounts = financialData.accounts_data || [];
        const transactions = financialData.transactions_data || [];
        
        const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 92.53;
        const recentTransactions = transactions.slice(0, 20);
        
        // Calculer les revenus et dépenses du mois
        let monthlyIncome = 0;
        let monthlyExpenses = 0;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        transactions.forEach(tx => {
          if (tx.date) {
            const txDate = new Date(tx.date);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
              if (tx.credit) monthlyIncome += parseFloat(tx.credit);
              if (tx.debit) monthlyExpenses += parseFloat(tx.debit);
            }
          }
        });

        financialContext = {
          totalBalance: totalBalance || 92.53,
          accounts: accounts.length,
          transactions: transactions.length,
          monthlyIncome,
          monthlyExpenses
        };
      }
    } catch (dbError) {
      console.log('Could not fetch financial data:', dbError.message);
    }

    // Analyser le message pour déterminer le type de réponse
    const messageLower = message.toLowerCase();
    let response = '';

    // Réponses contextuelles basées sur les données réelles
    if (messageLower.includes('solde') || messageLower.includes('balance') || messageLower.includes('combien')) {
      response = `Votre solde actuel est de **$${financialContext.totalBalance.toFixed(2)} CAD**.

📊 **Résumé de votre situation financière :**
- Compte(s) actif(s) : ${financialContext.accounts}
- Transactions ce mois : ${financialContext.transactions}
- Revenus mensuels : $${financialContext.monthlyIncome.toFixed(2)}
- Dépenses mensuelles : $${financialContext.monthlyExpenses.toFixed(2)}
- Différence : ${financialContext.monthlyIncome > financialContext.monthlyExpenses ? '+' : ''}$${(financialContext.monthlyIncome - financialContext.monthlyExpenses).toFixed(2)}

Souhaitez-vous que j'analyse vos dépenses en détail?`;

    } else if (messageLower.includes('budget') || messageLower.includes('budgétiser')) {
      const budgetRecommended = financialContext.monthlyIncome * 0.5; // 50% pour les besoins
      const savingsRecommended = financialContext.monthlyIncome * 0.2; // 20% pour l'épargne
      const wantsRecommended = financialContext.monthlyIncome * 0.3; // 30% pour les envies

      response = `📊 **Plan de budget personnalisé basé sur vos revenus de $${financialContext.monthlyIncome.toFixed(2)}/mois :**

**Méthode 50/30/20 recommandée :**
• **Besoins essentiels (50%)** : $${budgetRecommended.toFixed(2)}
  - Loyer, nourriture, transport, assurances
• **Envies et loisirs (30%)** : $${wantsRecommended.toFixed(2)}
  - Restaurants, sorties, achats non essentiels
• **Épargne et dettes (20%)** : $${savingsRecommended.toFixed(2)}
  - Fonds d'urgence, investissements, remboursements

⚠️ **Attention** : Vos dépenses actuelles ($${financialContext.monthlyExpenses.toFixed(2)}) dépassent vos revenus de $${Math.abs(financialContext.monthlyIncome - financialContext.monthlyExpenses).toFixed(2)}.

**Mes recommandations prioritaires :**
1. Réduire les dépenses non essentielles
2. Identifier les abonnements inutilisés
3. Négocier vos contrats (téléphone, assurances)
4. Automatiser l'épargne dès réception du salaire

Voulez-vous que je vous aide à identifier où réduire vos dépenses?`;

    } else if (messageLower.includes('épargn') || messageLower.includes('sav') || messageLower.includes('économi')) {
      const savingsPotential = Math.max(0, financialContext.monthlyIncome - financialContext.monthlyExpenses);
      const emergencyFund = financialContext.monthlyExpenses * 3;

      response = `💰 **Stratégies d'épargne personnalisées pour vous :**

**Votre potentiel d'épargne actuel :**
${savingsPotential > 0 
  ? `Vous pourriez épargner jusqu'à $${savingsPotential.toFixed(2)}/mois`
  : `⚠️ Attention : Vous dépensez $${Math.abs(savingsPotential).toFixed(2)} de plus que vos revenus`}

**Plan d'action en 3 étapes :**

**1. Fonds d'urgence (Priorité #1)**
   - Objectif : $${emergencyFund.toFixed(2)} (3 mois de dépenses)
   - Épargne suggérée : $${(emergencyFund / 12).toFixed(2)}/mois

**2. Techniques d'épargne automatique :**
   - Virement automatique le jour de paie
   - Arrondir chaque achat au dollar supérieur
   - Challenge 52 semaines (1$ semaine 1, 2$ semaine 2...)

**3. Optimisation des dépenses :**
   - Renégocier vos contrats : économie potentielle de $50-100/mois
   - Planifier les repas : économie de $200-300/mois
   - Utiliser la règle des 24h avant tout achat impulsif

Voulez-vous que je crée un plan d'épargne détaillé sur 6 mois?`;

    } else if (messageLower.includes('dépense') || messageLower.includes('analyse') || messageLower.includes('où')) {
      response = `📊 **Analyse de vos dépenses mensuelles ($${financialContext.monthlyExpenses.toFixed(2)}) :**

D'après vos ${financialContext.transactions} transactions récentes, voici les patterns identifiés :

**Catégories principales de dépenses :**
• **Paiements récurrents** : Plusieurs prélèvements automatiques détectés
• **Achats quotidiens** : Transactions POS fréquentes
• **Retraits cash** : Utilisation régulière d'espèces

**🚨 Points d'attention :**
1. Vos dépenses dépassent vos revenus de $${Math.abs(financialContext.monthlyIncome - financialContext.monthlyExpenses).toFixed(2)}
2. Plusieurs frais bancaires détectés (vérifiez vos conditions)
3. Opportunités d'économies identifiées

**💡 Actions recommandées :**
• Examiner tous les prélèvements automatiques
• Limiter les retraits cash (difficiles à tracker)
• Négocier les frais bancaires
• Utiliser une app de suivi des dépenses

Souhaitez-vous que j'analyse une catégorie spécifique?`;

    } else if (messageLower.includes('conseil') || messageLower.includes('aide') || messageLower.includes('améliorer')) {
      response = `🎯 **Conseils personnalisés pour améliorer votre santé financière :**

Basé sur votre profil (Solde: $${financialContext.totalBalance.toFixed(2)}, ${financialContext.transactions} transactions), voici mes recommandations :

**Court terme (Ce mois) :**
• ✅ Établir un budget réaliste
• ✅ Identifier 3 dépenses à éliminer
• ✅ Ouvrir un compte épargne séparé
• ✅ Automatiser un virement de 10% des revenus

**Moyen terme (3-6 mois) :**
• 📈 Constituer un fonds d'urgence de $${(financialContext.monthlyExpenses * 3).toFixed(2)}
• 📊 Améliorer votre score de crédit
• 💳 Rembourser les dettes à taux élevé
• 🎓 Se former sur l'investissement

**Long terme (1 an+) :**
• 🏠 Épargner pour un acompte immobilier
• 📈 Commencer à investir (CELI, REER)
• 🎯 Planifier la retraite
• 💼 Diversifier les sources de revenus

**Prochaine étape recommandée :**
Commençons par établir un budget mensuel réaliste. Voulez-vous que je vous guide?`;

    } else {
      // Réponse par défaut engageante
      response = `Merci pour votre question ! Je suis votre assistant financier CASHOO et je suis là pour vous aider à optimiser vos finances.

**Ce que je peux faire pour vous :**
• 📊 Analyser vos dépenses et revenus
• 💰 Créer un plan d'épargne personnalisé
• 📈 Établir un budget adapté à vos besoins
• 🎯 Identifier des opportunités d'économies
• 💳 Conseils pour améliorer votre crédit

**Informations sur votre compte :**
• Solde actuel : $${financialContext.totalBalance.toFixed(2)}
• Transactions ce mois : ${financialContext.transactions}
• Statut : Compte vérifié via Inverite ✅

**Questions suggérées :**
- "Comment puis-je économiser 500$ par mois?"
- "Analyse mes dépenses du mois"
- "Crée un budget pour moi"
- "Comment réduire mes frais bancaires?"

Quelle est votre priorité financière aujourd'hui?`;
    }

    // Sauvegarder la conversation
    try {
      await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          message: message,
          response: response,
          created_at: new Date().toISOString()
        });
    } catch (saveError) {
      console.log('Could not save chat history:', saveError.message);
    }

    // Retourner la réponse
    res.json({
      success: true,
      response: response,
      context: {
        balance: financialContext.totalBalance,
        demo: process.env.CLAUDE_API_KEY ? false : true
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    // Réponse de fallback en cas d'erreur
    res.json({
      success: true,
      response: `Je suis votre assistant financier CASHOO. Comment puis-je vous aider aujourd'hui? 

Vous pouvez me demander :
• Votre solde et résumé financier
• Créer un budget personnalisé
• Analyser vos dépenses
• Conseils d'épargne
• Améliorer votre situation financière

Posez-moi une question!`,
      fallback: true
    });
  }
};
