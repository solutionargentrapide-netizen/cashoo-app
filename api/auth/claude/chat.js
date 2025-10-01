// api/claude/chat.js - Assistant financier IA CASHOO
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const JWT_SECRET = process.env.JWT_SECRET || 'cashoo-jwt-secret-' + Math.random().toString(36).substring(2, 15);

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
);

module.exports = async (req, res) => {
  // CORS Headers
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    console.log('[CLAUDE] Processing message for user:', userId);

    // Récupérer les données financières de l'utilisateur
    let financialData = {};
    let transactions = [];
    let accounts = [];
    
    try {
      // Récupérer les données Flinks
      const { data: flinksData } = await supabase
        .from('flinks_data')
        .select('accounts_data, transactions_data')
        .eq('user_id', userId)
        .single();

      if (flinksData) {
        accounts = flinksData.accounts_data || [];
        transactions = flinksData.transactions_data || [];
      }

      // Récupérer les données Inverite
      const { data: inveriteData } = await supabase
        .from('inverite_data')
        .select('accounts_data, transactions_data')
        .eq('user_id', userId)
        .single();

      if (inveriteData && !accounts.length) {
        accounts = inveriteData.accounts_data || [];
        transactions = inveriteData.transactions_data || [];
      }
    } catch (dbError) {
      console.log('[CLAUDE] No financial data found:', dbError.message);
    }

    // Analyser les données financières
    const analysis = analyzeFinancialData(accounts, transactions);
    
    // Générer une réponse basée sur le message et le contexte
    const response = generateAIResponse(message, analysis, context);

    // Sauvegarder l'historique de conversation
    try {
      await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          message: message,
          response: response,
          context: { analysis, ...context },
          created_at: new Date().toISOString()
        });
    } catch (saveError) {
      console.log('[CLAUDE] Could not save chat history');
    }

    // Retourner la réponse
    return res.status(200).json({
      success: true,
      response: response,
      analysis: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[CLAUDE] Error:', error);
    return res.status(500).json({ 
      error: 'AI service error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Analyser les données financières
function analyzeFinancialData(accounts, transactions) {
  const analysis = {
    totalBalance: 0,
    accountCount: accounts.length,
    transactionCount: transactions.length,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    netCashFlow: 0,
    topCategories: [],
    recentTransactions: [],
    alerts: [],
    recommendations: []
  };

  // Calculer le solde total
  accounts.forEach(account => {
    analysis.totalBalance += account.balance || 0;
  });

  // Analyser les transactions du mois en cours
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const categoryTotals = {};

  transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    
    if (isCurrentMonth) {
      const amount = tx.amount || tx.credit || -(tx.debit || 0);
      
      if (amount > 0) {
        analysis.monthlyIncome += amount;
      } else {
        analysis.monthlyExpenses += Math.abs(amount);
        
        // Catégoriser les dépenses
        const category = tx.category || detectCategory(tx.description);
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(amount);
      }
    }
  });

  // Calculer le flux net
  analysis.netCashFlow = analysis.monthlyIncome - analysis.monthlyExpenses;

  // Top catégories de dépenses
  analysis.topCategories = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Transactions récentes
  analysis.recentTransactions = transactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount || tx.credit || -(tx.debit || 0),
      category: tx.category || detectCategory(tx.description)
    }));

  // Générer des alertes
  if (analysis.totalBalance < 100) {
    analysis.alerts.push('⚠️ Solde faible - Risque de frais NSF');
  }
  
  if (analysis.netCashFlow < 0) {
    analysis.alerts.push(`📉 Déficit mensuel de ${Math.abs(analysis.netCashFlow).toFixed(2)}$`);
  }
  
  if (analysis.monthlyExpenses > analysis.monthlyIncome * 1.1) {
    analysis.alerts.push('💸 Dépenses supérieures aux revenus de 10%+');
  }

  // Générer des recommandations
  if (analysis.topCategories.length > 0) {
    const topCategory = analysis.topCategories[0];
    analysis.recommendations.push(
      `Réduire les dépenses en ${topCategory.category} (${topCategory.total.toFixed(2)}$/mois)`
    );
  }
  
  if (analysis.totalBalance < 500) {
    analysis.recommendations.push('Constituer un fonds d\'urgence de 500$');
  }
  
  if (analysis.netCashFlow > 100) {
    analysis.recommendations.push('Automatiser l\'épargne de 100$/mois');
  }

  return analysis;
}

// Détecter la catégorie d'une transaction
function detectCategory(description) {
  if (!description) return 'Autre';
  
  const desc = description.toLowerCase();
  
  if (desc.includes('grocery') || desc.includes('walmart') || desc.includes('metro')) {
    return 'Épicerie';
  } else if (desc.includes('restaurant') || desc.includes('tim hortons') || desc.includes('mcdonald')) {
    return 'Restaurant';
  } else if (desc.includes('gas') || desc.includes('petro') || desc.includes('esso')) {
    return 'Transport';
  } else if (desc.includes('hydro') || desc.includes('bell') || desc.includes('rogers')) {
    return 'Factures';
  } else if (desc.includes('rent') || desc.includes('mortgage')) {
    return 'Logement';
  } else if (desc.includes('payroll') || desc.includes('salary') || desc.includes('deposit')) {
    return 'Revenu';
  } else if (desc.includes('fee') || desc.includes('charge')) {
    return 'Frais';
  } else if (desc.includes('transfer')) {
    return 'Transfert';
  } else if (desc.includes('atm') || desc.includes('withdrawal')) {
    return 'Retrait';
  } else {
    return 'Autre';
  }
}

// Générer une réponse IA
function generateAIResponse(message, analysis, context) {
  const messageLower = message.toLowerCase();
  
  // Réponses contextuelles basées sur la question
  if (messageLower.includes('solde') || messageLower.includes('balance')) {
    return `Votre solde total est de **${analysis.totalBalance.toFixed(2)}$** réparti sur ${analysis.accountCount} compte(s).

${analysis.alerts.length > 0 ? '**Alertes:**\n' + analysis.alerts.join('\n') : ''}

Voulez-vous voir le détail par compte?`;
  }
  
  if (messageLower.includes('dépense') || messageLower.includes('expense')) {
    return `Vos dépenses ce mois-ci s'élèvent à **${analysis.monthlyExpenses.toFixed(2)}$**.

**Top 3 catégories:**
${analysis.topCategories.slice(0, 3).map((cat, i) => 
  `${i+1}. ${cat.category}: ${cat.total.toFixed(2)}$`
).join('\n')}

${analysis.netCashFlow < 0 ? 
  `⚠️ Vous dépensez ${Math.abs(analysis.netCashFlow).toFixed(2)}$ de plus que vos revenus.` : 
  `✅ Vous avez un surplus de ${analysis.netCashFlow.toFixed(2)}$ ce mois-ci.`}`;
  }
  
  if (messageLower.includes('conseil') || messageLower.includes('advice') || messageLower.includes('recommandation')) {
    return `Basé sur votre situation financière, voici mes recommandations:

${analysis.recommendations.map((rec, i) => `${i+1}. ${rec}`).join('\n')}

**Points d'attention:**
${analysis.alerts.join('\n')}

Souhaitez-vous un plan d'action détaillé?`;
  }
  
  if (messageLower.includes('transaction')) {
    const recentTx = analysis.recentTransactions.slice(0, 5);
    return `Voici vos 5 dernières transactions:

${recentTx.map(tx => {
  const amount = tx.amount >= 0 ? `+${tx.amount.toFixed(2)}$` : `${tx.amount.toFixed(2)}$`;
  return `• ${new Date(tx.date).toLocaleDateString()} - ${tx.description}
  ${amount} [${tx.category}]`;
}).join('\n\n')}

Total des transactions: ${analysis.transactionCount}`;
  }
  
  if (messageLower.includes('budget')) {
    return `**Analyse budgétaire du mois:**

📊 **Revenus:** ${analysis.monthlyIncome.toFixed(2)}$
📉 **Dépenses:** ${analysis.monthlyExpenses.toFixed(2)}$
💰 **Solde net:** ${analysis.netCashFlow >= 0 ? '+' : ''}${analysis.netCashFlow.toFixed(2)}$

**Répartition des dépenses:**
${analysis.topCategories.map(cat => {
  const percentage = ((cat.total / analysis.monthlyExpenses) * 100).toFixed(1);
  return `• ${cat.category}: ${cat.total.toFixed(2)}$ (${percentage}%)`;
}).join('\n')}

${analysis.netCashFlow < 0 ? 
  '⚠️ **Action requise:** Réduire les dépenses ou augmenter les revenus' :
  '✅ **Bon travail!** Continuez à maintenir ce surplus'}`;
  }
  
  if (messageLower.includes('aide') || messageLower.includes('help')) {
    return `Je suis votre assistant financier CASHOO! Je peux vous aider avec:

**📊 Analyses disponibles:**
• "Quel est mon solde?" - Vue d'ensemble de vos comptes
• "Analyse mes dépenses" - Détail de vos dépenses mensuelles
• "Montre mes transactions" - Historique récent
• "Donne-moi des conseils" - Recommandations personnalisées
• "Créé un budget" - Plan budgétaire mensuel
• "Où puis-je économiser?" - Opportunités d'économies

**État actuel:**
• Solde: ${analysis.totalBalance.toFixed(2)}$
• Flux mensuel: ${analysis.netCashFlow >= 0 ? '+' : ''}${analysis.netCashFlow.toFixed(2)}$

Que souhaitez-vous analyser?`;
  }
  
  // Réponse générique intelligente
  return `D'après votre demande "${message}", voici ce que je peux vous dire:

**📊 Situation actuelle:**
• Solde total: ${analysis.totalBalance.toFixed(2)}$
• Revenus mensuels: ${analysis.monthlyIncome.toFixed(2)}$
• Dépenses mensuelles: ${analysis.monthlyExpenses.toFixed(2)}$
• Flux net: ${analysis.netCashFlow >= 0 ? '+' : ''}${analysis.netCashFlow.toFixed(2)}$

${analysis.alerts.length > 0 ? '**⚠️ Alertes:**\n' + analysis.alerts.join('\n') + '\n' : ''}

${analysis.recommendations.length > 0 ? '**💡 Recommandations:**\n' + analysis.recommendations.join('\n') : ''}

Comment puis-je vous aider davantage?`;
}
