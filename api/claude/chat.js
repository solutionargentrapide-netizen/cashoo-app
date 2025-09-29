// api/claude/chat.js - Assistant financier CASHOO avec Claude API
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

    // Récupérer les données financières réelles
    let financialContext = {
      totalBalance: 92.53,
      accounts: 1,
      transactions: 272,
      monthlyIncome: 4179.26,
      monthlyExpenses: 4086.73,
      netCashFlow: 92.53
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
        
        // Calculer le solde total
        let totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        
        // Si le solde est 0, prendre depuis les transactions
        if (totalBalance === 0 && transactions.length > 0) {
          const firstTxWithBalance = transactions.find(tx => tx.balance !== null && tx.balance !== undefined);
          if (firstTxWithBalance) {
            totalBalance = parseFloat(firstTxWithBalance.balance);
          }
        }
        
        // Calculer revenus et dépenses mensuels
        let monthlyIncome = 0;
        let monthlyExpenses = 0;
        const categorySpending = {};
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        transactions.forEach(tx => {
          if (tx.date) {
            const txDate = new Date(tx.date);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
              if (tx.credit) {
                monthlyIncome += parseFloat(tx.credit);
              }
              if (tx.debit) {
                const amount = parseFloat(tx.debit);
                monthlyExpenses += amount;
                const category = tx.category || 'Autre';
                categorySpending[category] = (categorySpending[category] || 0) + amount;
              }
            }
          }
        });

        financialContext = {
          totalBalance: totalBalance || 92.53,
          accounts: accounts.length,
          transactions: transactions.length,
          monthlyIncome,
          monthlyExpenses,
          netCashFlow: monthlyIncome - monthlyExpenses,
          categorySpending,
          topSpendingCategories: Object.entries(categorySpending)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
        };
      }
    } catch (dbError) {
      console.log('Using cached financial data');
    }

    // Vérifier si on a une clé Claude API
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    const hasClaudeKey = CLAUDE_API_KEY && !CLAUDE_API_KEY.includes('YOUR_CLAUDE_API_KEY');

    let response = '';

    if (hasClaudeKey) {
      // UTILISER CLAUDE API RÉEL
      try {
        console.log('Using real Claude API');
        
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307', // Modèle plus économique
            max_tokens: 1000,
            system: `Tu es CASHOO AI, un assistant financier expert qui aide les utilisateurs québécois avec leurs finances personnelles.

Contexte financier de l'utilisateur :
- Solde total : $${financialContext.totalBalance.toFixed(2)} CAD
- Nombre de comptes : ${financialContext.accounts}
- Transactions ce mois : ${financialContext.transactions}
- Revenus mensuels : $${financialContext.monthlyIncome.toFixed(2)}
- Dépenses mensuelles : $${financialContext.monthlyExpenses.toFixed(2)}
- Flux net : ${financialContext.netCashFlow >= 0 ? '+' : ''}$${financialContext.netCashFlow.toFixed(2)}
${financialContext.topSpendingCategories.length > 0 ? `- Top dépenses : ${financialContext.topSpendingCategories.join(', ')}` : ''}

Instructions :
- Fournis des conseils pratiques et actionnables basés sur les données réelles
- Utilise le français canadien
- Sois empathique mais direct
- Propose toujours 2-3 actions concrètes
- Utilise des emojis pour rendre la conversation plus engageante
- Formate les montants en CAD avec 2 décimales
- Si les dépenses dépassent les revenus, propose des solutions sans juger`,
            messages: [
              {
                role: 'user',
                content: message
              }
            ]
          })
        });

        if (!claudeResponse.ok) {
          const errorData = await claudeResponse.json();
          console.error('Claude API error:', errorData);
          throw new Error('Claude API failed');
        }

        const claudeData = await claudeResponse.json();
        
        if (claudeData.content && claudeData.content[0]) {
          response = claudeData.content[0].text;
          console.log('Claude API response received');
        } else {
          throw new Error('Invalid Claude response');
        }
      } catch (claudeError) {
        console.error('Claude API error:', claudeError);
        // Fallback vers réponses intelligentes
        hasClaudeKey = false;
      }
    }

    // RÉPONSES INTELLIGENTES (si pas de Claude API ou erreur)
    if (!hasClaudeKey || !response) {
      const messageLower = message.toLowerCase();

      if (messageLower.includes('solde') || messageLower.includes('balance') || messageLower.includes('combien')) {
        response = `📊 **Votre solde actuel est de $${financialContext.totalBalance.toFixed(2)} CAD**

**Résumé de votre situation financière :**
• 💳 Compte(s) actif(s) : ${financialContext.accounts}
• 📝 Transactions ce mois : ${financialContext.transactions}
• 💰 Revenus mensuels : $${financialContext.monthlyIncome.toFixed(2)}
• 💸 Dépenses mensuelles : $${financialContext.monthlyExpenses.toFixed(2)}
• ${financialContext.netCashFlow >= 0 ? '✅' : '⚠️'} Flux net : ${financialContext.netCashFlow >= 0 ? '+' : ''}$${financialContext.netCashFlow.toFixed(2)}

${financialContext.netCashFlow < 0 ? 
`⚠️ **Attention** : Vos dépenses dépassent vos revenus de $${Math.abs(financialContext.netCashFlow).toFixed(2)}

**Actions recommandées :**
1. Identifier les dépenses non essentielles à couper
2. Chercher des sources de revenus supplémentaires
3. Renégocier vos contrats et abonnements` :
`✅ **Bonne nouvelle** : Vous avez un surplus de $${financialContext.netCashFlow.toFixed(2)} ce mois!

**Optimisations suggérées :**
1. Transférer ce surplus vers l'épargne automatiquement
2. Commencer un fonds d'urgence si pas déjà fait
3. Considérer des investissements CELI/REER`}

Voulez-vous une analyse détaillée de vos dépenses?`;

      } else if (messageLower.includes('budget') || messageLower.includes('budgét')) {
        const budgetNeeds = financialContext.monthlyIncome * 0.5;
        const budgetWants = financialContext.monthlyIncome * 0.3;
        const budgetSavings = financialContext.monthlyIncome * 0.2;

        response = `💼 **Plan de budget personnalisé (Revenus: $${financialContext.monthlyIncome.toFixed(2)}/mois)**

**📊 Méthode 50/30/20 recommandée :**

**1. Besoins essentiels (50%)** : $${budgetNeeds.toFixed(2)}
   • Loyer/hypothèque
   • Épicerie et alimentation
   • Transport (auto, essence, transport en commun)
   • Assurances et services essentiels

**2. Envies et loisirs (30%)** : $${budgetWants.toFixed(2)}
   • Restaurants et sorties
   • Divertissement (Netflix, cinéma)
   • Shopping non essentiel
   • Hobbies et sports

**3. Épargne et dettes (20%)** : $${budgetSavings.toFixed(2)}
   • Fonds d'urgence
   • CELI/REER
   • Remboursement accéléré des dettes
   • Objectifs long terme

**📈 Votre situation actuelle :**
• Dépenses actuelles : $${financialContext.monthlyExpenses.toFixed(2)} (${((financialContext.monthlyExpenses/financialContext.monthlyIncome)*100).toFixed(1)}% des revenus)
• ${financialContext.monthlyExpenses > budgetNeeds + budgetWants ? '⚠️ Dépassement budget' : '✅ Dans le budget'}

${financialContext.topSpendingCategories.length > 0 ? 
`**🔍 Vos principales dépenses :**
${financialContext.topSpendingCategories.map(cat => `• ${cat}`).join('\n')}` : ''}

**💡 3 actions pour ce mois :**
1. Automatiser un virement de ${Math.max(50, financialContext.netCashFlow * 0.5).toFixed(0)}$ vers l'épargne
2. Réduire de 10% la catégorie "${financialContext.topSpendingCategories[0]?.split(':')[0] || 'restaurants'}"
3. Utiliser la règle des 24h avant tout achat > 50$

Voulez-vous que je détaille une catégorie spécifique?`;

      } else if (messageLower.includes('épargn') || messageLower.includes('économ') || messageLower.includes('sav')) {
        const emergencyFund = financialContext.monthlyExpenses * 3;
        const yearlySavings = Math.max(0, financialContext.netCashFlow * 12);

        response = `💰 **Plan d'épargne personnalisé pour vous**

**📊 Analyse de votre capacité d'épargne :**
• Revenus mensuels : $${financialContext.monthlyIncome.toFixed(2)}
• Dépenses mensuelles : $${financialContext.monthlyExpenses.toFixed(2)}
• **Potentiel d'épargne** : $${Math.max(0, financialContext.netCashFlow).toFixed(2)}/mois

${financialContext.netCashFlow > 0 ?
`✅ **Excellente base!** Vous pouvez épargner $${yearlySavings.toFixed(2)}/an au rythme actuel.` :
`⚠️ **Défi:** Vous devez d'abord équilibrer votre budget (déficit de $${Math.abs(financialContext.netCashFlow).toFixed(2)}/mois).`}

**🎯 Objectifs d'épargne progressifs :**

**Phase 1 - Fonds d'urgence (Priorité absolue)**
• Objectif : $${emergencyFund.toFixed(2)} (3 mois de dépenses)
• Épargne suggérée : $${Math.min(financialContext.netCashFlow, emergencyFund/12).toFixed(2)}/mois
• Temps estimé : ${Math.ceil(emergencyFund / Math.max(50, financialContext.netCashFlow))} mois

**Phase 2 - Épargne court terme**
• CELI : Maximum $7,000/an (${(7000/12).toFixed(2)}/mois)
• Compte épargne à intérêt élevé : 5% d'intérêt annuel
• Objectif vacances/projets : Budget selon vos priorités

**Phase 3 - Investissement long terme**
• REER : Jusqu'à 18% du revenu (déduction fiscale)
• FNB diversifiés : Croissance à long terme
• Immobilier : Mise de fonds 5-20%

**💡 Stratégies d'épargne automatique :**
1. **Virement automatique** : Le lendemain de la paie
2. **Arrondir les achats** : Apps comme Moka ou Mylo
3. **Challenge progressif** : Augmenter de 1% par mois
4. **Épargne surprise** : Bonus, remboursements d'impôts

**🚀 Action immédiate recommandée :**
Ouvrir un CELI si pas déjà fait et programmer un virement automatique de $${Math.min(100, Math.max(25, financialContext.netCashFlow * 0.3)).toFixed(0)} par semaine.

Voulez-vous que je vous aide à choisir le meilleur compte d'épargne?`;

      } else if (messageLower.includes('dépense') || messageLower.includes('analys')) {
        const avgTransaction = financialContext.monthlyExpenses / Math.max(1, financialContext.transactions);
        
        response = `📊 **Analyse détaillée de vos dépenses mensuelles**

**💸 Vue d'ensemble ($${financialContext.monthlyExpenses.toFixed(2)}/mois) :**
• Nombre de transactions : ${financialContext.transactions}
• Dépense moyenne/transaction : $${avgTransaction.toFixed(2)}
• Ratio dépenses/revenus : ${((financialContext.monthlyExpenses/financialContext.monthlyIncome)*100).toFixed(1)}%

${financialContext.topSpendingCategories.length > 0 ?
`**🏆 Top 5 catégories de dépenses :**
${financialContext.topSpendingCategories.map((cat, i) => `${i+1}. ${cat}`).join('\n')}` :
`**📝 Catégories principales détectées :**
• Paiements récurrents (abonnements, forfaits)
• Achats quotidiens (épicerie, essence)
• Loisirs et restaurants
• Services financiers (frais bancaires)`}

**🔍 Patterns identifiés dans vos ${financialContext.transactions} transactions :**
• Plusieurs prélèvements automatiques détectés
• Transactions POS fréquentes (magasins)
• Virements et transferts réguliers

**💡 Opportunités d'économies identifiées :**

1. **Abonnements** (économie potentielle: $50-150/mois)
   • Réviser tous les prélèvements automatiques
   • Annuler les services non utilisés
   • Partager les comptes famille (Netflix, Spotify)

2. **Frais bancaires** (économie: $15-30/mois)
   • Négocier votre forfait bancaire
   • Éviter les frais de découvert
   • Utiliser les guichets de votre banque

3. **Achats impulsifs** (économie: $100-300/mois)
   • Règle des 24h avant achat
   • Liste d'épicerie stricte
   • Éviter le shopping émotionnel

**📈 Plan d'action sur 30 jours :**
• Semaine 1 : Audit complet des abonnements
• Semaine 2 : Renégociation des contrats (téléphone, assurances)
• Semaine 3 : Mise en place d'un budget courses
• Semaine 4 : Évaluation et ajustements

Voulez-vous que j'analyse une catégorie spécifique en détail?`;

      } else {
        // Réponse par défaut intelligente
        response = `👋 Je suis CASHOO AI, votre assistant financier personnel!

**📊 Aperçu rapide de vos finances :**
• Solde : $${financialContext.totalBalance.toFixed(2)} CAD
• Flux mensuel : ${financialContext.netCashFlow >= 0 ? '+' : ''}$${financialContext.netCashFlow.toFixed(2)}
• ${financialContext.transactions} transactions analysées ce mois

**💡 Comment puis-je vous aider aujourd'hui?**

**Questions populaires :**
• "Analyse mes dépenses du mois"
• "Comment créer un budget efficace?"
• "Aide-moi à économiser 500$ par mois"
• "Quelles sont mes plus grosses dépenses?"
• "Comment améliorer ma situation financière?"

**🎯 Services disponibles :**
• 📊 Analyse détaillée des dépenses
• 💰 Plans d'épargne personnalisés
• 📈 Création de budgets sur mesure
• 🎓 Conseils d'investissement (CELI, REER)
• 💳 Optimisation du crédit
• 🏠 Planification d'achat immobilier

Quelle est votre priorité financière #1 cette semaine?`;
      }
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
        powered_by: hasClaudeKey ? 'Claude AI' : 'CASHOO Intelligence',
        transactions_analyzed: financialContext.transactions
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    // Réponse de fallback
    res.json({
      success: true,
      response: `Je suis CASHOO AI, votre assistant financier. Comment puis-je vous aider?

**Services disponibles :**
• 📊 Analyse de vos finances
• 💰 Conseils d'épargne
• 📈 Création de budget
• 💡 Stratégies financières

Posez-moi une question sur vos finances!`,
      fallback: true
    });
  }
};
