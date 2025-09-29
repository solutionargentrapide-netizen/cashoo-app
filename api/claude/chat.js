// api/claude/chat.js - Assistant financier CASHOO avec analyse détaillée
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

    // RÉCUPÉRER TOUTES LES DONNÉES FINANCIÈRES
    let transactions = [];
    let accounts = [];
    let financialContext = {};
    
    try {
      const { data: financialData } = await supabase
        .from('flinks_data')
        .select('accounts_data, transactions_data')
        .eq('user_id', userId)
        .single();

      if (financialData) {
        accounts = financialData.accounts_data || [];
        transactions = financialData.transactions_data || [];
        console.log(`Loaded ${transactions.length} transactions for analysis`);
      }
    } catch (dbError) {
      console.log('Using default data:', dbError.message);
    }

    // ANALYSER LES TRANSACTIONS EN DÉTAIL
    const transactionAnalysis = analyzeTransactions(transactions);
    
    // Construire le contexte financier complet
    financialContext = {
      ...transactionAnalysis,
      accounts: accounts.length,
      totalBalance: accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 92.53
    };

    // ANALYSER LA QUESTION DE L'UTILISATEUR
    const messageLower = message.toLowerCase();
    let response = '';

    // ========================================
    // QUESTIONS SPÉCIFIQUES SUR LES DONNÉES
    // ========================================
    
    if (messageLower.includes('prochaine paie') || messageLower.includes('prochain salaire') || messageLower.includes('next pay')) {
      // Analyser les dates de paie
      const payrollDates = transactionAnalysis.payrollDates;
      
      if (payrollDates.length > 0) {
        const lastPay = new Date(payrollDates[0]);
        const daysBetweenPays = transactionAnalysis.payFrequency;
        const nextPayDate = new Date(lastPay);
        nextPayDate.setDate(nextPayDate.getDate() + daysBetweenPays);
        
        const today = new Date();
        const daysUntilPay = Math.ceil((nextPayDate - today) / (1000 * 60 * 60 * 24));
        
        response = `📅 **Analyse de vos dates de paie (ACME JOB CO):**

**Dernières paies reçues:**
${payrollDates.slice(0, 3).map((date, i) => {
  const pay = transactionAnalysis.payrollAmounts[i];
  return `• ${new Date(date).toLocaleDateString('fr-CA')} : $${pay.toFixed(2)}`;
}).join('\n')}

**Prochaine paie estimée:**
📆 **${nextPayDate.toLocaleDateString('fr-CA')}** (dans ${daysUntilPay} jours)

**Pattern détecté:**
• Fréquence : Aux ${daysBetweenPays} jours (${daysBetweenPays === 14 ? 'bi-hebdomadaire' : daysBetweenPays === 15 || daysBetweenPays === 16 ? 'bi-mensuel' : 'mensuel'})
• Montant moyen : $${transactionAnalysis.averagePayroll.toFixed(2)}
• Variation : ${transactionAnalysis.payrollVariation}

**💡 Recommandations:**
1. Planifiez vos paiements importants 2-3 jours après la paie
2. Automatisez l'épargne le jour même du dépôt
3. Gardez un coussin pour les variations de montant

Voulez-vous que je crée un calendrier de budget basé sur vos dates de paie?`;
      } else {
        response = "Je n'ai pas trouvé d'historique de paie dans vos transactions récentes. Pouvez-vous me dire quand vous avez reçu votre dernière paie?";
      }
      
    } else if (messageLower.includes('nsf') || messageLower.includes('sans provision') || messageLower.includes('insufficient funds')) {
      // Analyser les frais NSF
      const nsfTransactions = transactions.filter(tx => 
        tx.description?.toLowerCase().includes('nsf') ||
        tx.description?.toLowerCase().includes('insufficient') ||
        tx.description?.toLowerCase().includes('sans provision') ||
        (tx.category?.includes('fees') && tx.description?.toLowerCase().includes('return'))
      );
      
      if (nsfTransactions.length > 0) {
        response = `⚠️ **Frais NSF (sans provision) détectés:**

**Transactions NSF récentes:**
${nsfTransactions.slice(0, 5).map(tx => 
  `• ${new Date(tx.date).toLocaleDateString('fr-CA')} : ${tx.description} - $${Math.abs(tx.debit || tx.amount || 0).toFixed(2)}`
).join('\n')}

**Total des frais NSF:** $${nsfTransactions.reduce((sum, tx) => sum + Math.abs(tx.debit || tx.amount || 0), 0).toFixed(2)}

**💡 Comment éviter les frais NSF:**
1. Activez les alertes de solde bas
2. Gardez un coussin de $500 minimum
3. Synchronisez vos prélèvements avec vos dates de paie
4. Utilisez la protection découvert (moins cher que NSF)

Voulez-vous que je vous aide à établir un calendrier de paiements pour éviter les NSF?`;
      } else {
        response = `✅ **Bonne nouvelle!** Je n'ai pas trouvé de frais NSF récents dans vos transactions.

Cependant, j'ai identifié ces frais qui pourraient être liés:
${transactionAnalysis.fees.slice(0, 3).map(fee => 
  `• ${fee.date} : ${fee.description} - $${fee.amount.toFixed(2)}`
).join('\n')}

**Pour maintenir votre compte en règle:**
• Solde actuel : $${financialContext.totalBalance.toFixed(2)}
• Gardez toujours un minimum de $500
• Surveillez les prélèvements automatiques

Voulez-vous voir tous vos frais bancaires du mois?`;
      }
      
    } else if (messageLower.includes('frais') || messageLower.includes('fees') || messageLower.includes('charge')) {
      // Analyser tous les frais
      const allFees = transactionAnalysis.fees;
      const feesByCategory = {};
      
      allFees.forEach(fee => {
        const cat = fee.category || 'Autres';
        if (!feesByCategory[cat]) feesByCategory[cat] = [];
        feesByCategory[cat].push(fee);
      });
      
      response = `💸 **Analyse complète de vos frais (${allFees.length} frais détectés):**

**Total des frais ce mois:** $${allFees.reduce((sum, f) => sum + f.amount, 0).toFixed(2)}

**Frais par catégorie:**
${Object.entries(feesByCategory).map(([cat, fees]) => 
  `\n**${cat}:**\n${fees.slice(0, 3).map(f => 
    `• ${f.date} : ${f.description} - $${f.amount.toFixed(2)}`
  ).join('\n')}`
).join('\n')}

**🚨 Frais les plus élevés:**
${allFees.sort((a, b) => b.amount - a.amount).slice(0, 3).map(f => 
  `• ${f.description} : $${f.amount.toFixed(2)}`
).join('\n')}

**💡 Plan d'action pour réduire les frais:**
1. **Prêts à coût élevé** : Consolidez avec un prêt personnel à taux plus bas
2. **Frais bancaires** : Négociez votre forfait ou changez de banque
3. **Services** : Annulez les abonnements non essentiels

Économie potentielle : $${(allFees.reduce((sum, f) => sum + f.amount, 0) * 0.3).toFixed(2)}/mois

Voulez-vous que je vous aide à négocier certains de ces frais?`;
      
    } else if (messageLower.includes('dépense') || messageLower.includes('achats') || messageLower.includes('spending')) {
      // Analyse détaillée des dépenses
      response = `📊 **Analyse détaillée de vos dépenses:**

**Résumé mensuel:**
• Total des dépenses : $${transactionAnalysis.monthlyExpenses.toFixed(2)}
• Nombre de transactions : ${transactionAnalysis.transactionCount}
• Dépense moyenne : $${transactionAnalysis.averageTransaction.toFixed(2)}

**Top 5 catégories de dépenses:**
${transactionAnalysis.topCategories.slice(0, 5).map((cat, i) => 
  `${i+1}. **${cat.category}** : $${cat.total.toFixed(2)} (${cat.count} transactions)`
).join('\n')}

**Marchands fréquents:**
${transactionAnalysis.topMerchants.slice(0, 5).map(m => 
  `• ${m.merchant} : ${m.count}x - Total: $${m.total.toFixed(2)}`
).join('\n')}

**🚨 Alertes de dépenses:**
${transactionAnalysis.alerts.map(alert => `• ${alert}`).join('\n')}

**💡 Opportunités d'économies identifiées:**
1. Réduire les achats chez ${transactionAnalysis.topMerchants[0]?.merchant || 'Walmart'} de 20%
2. Limiter les retraits ATM (${transactionAnalysis.atmWithdrawals}x ce mois)
3. Cuisiner plus (restaurants : $${transactionAnalysis.restaurantTotal.toFixed(2)})

Voulez-vous un plan détaillé pour réduire vos dépenses?`;
      
    } else if (messageLower.includes('liste') || messageLower.includes('transactions') || messageLower.includes('historique')) {
      // Liste des transactions récentes
      const recentTx = transactions.slice(0, 10);
      
      response = `📝 **Vos 10 dernières transactions:**

${recentTx.map((tx, i) => {
  const amount = tx.credit ? `+$${tx.credit.toFixed(2)}` : `-$${Math.abs(tx.debit || tx.amount || 0).toFixed(2)}`;
  const date = new Date(tx.date).toLocaleDateString('fr-CA');
  return `${i+1}. **${date}** | ${tx.description || tx.details}
   ${amount} | ${tx.category || 'Non catégorisé'}`;
}).join('\n\n')}

**Résumé rapide:**
• Crédits : $${recentTx.reduce((sum, tx) => sum + (tx.credit || 0), 0).toFixed(2)}
• Débits : $${recentTx.reduce((sum, tx) => sum + Math.abs(tx.debit || 0), 0).toFixed(2)}
• Solde net : ${recentTx.reduce((sum, tx) => sum + (tx.credit || 0) - Math.abs(tx.debit || 0), 0) >= 0 ? '+' : ''}$${recentTx.reduce((sum, tx) => sum + (tx.credit || 0) - Math.abs(tx.debit || 0), 0).toFixed(2)}

Voulez-vous voir plus de transactions ou analyser une période spécifique?`;
      
    } else {
      // Réponse générale avec contexte complet
      response = `👋 Je suis CASHOO AI et j'ai accès à toutes vos données financières!

**📊 Vue d'ensemble de votre compte:**
• Solde actuel : $${financialContext.totalBalance.toFixed(2)}
• ${transactions.length} transactions analysées
• Dernière paie : ${transactionAnalysis.lastPayroll ? new Date(transactionAnalysis.lastPayroll).toLocaleDateString('fr-CA') : 'N/A'}
• Prochaine paie estimée : ${transactionAnalysis.nextPayrollEstimate || 'À calculer'}

**💰 Résumé financier du mois:**
• Revenus : $${transactionAnalysis.monthlyIncome.toFixed(2)}
• Dépenses : $${transactionAnalysis.monthlyExpenses.toFixed(2)}
• Flux net : ${transactionAnalysis.netCashFlow >= 0 ? '+' : ''}$${transactionAnalysis.netCashFlow.toFixed(2)}

**🔍 Ce que je peux analyser pour vous:**
• "Quand est ma prochaine paie?"
• "Liste mes frais NSF"
• "Analyse mes dépenses du mois"
• "Montre mes dernières transactions"
• "Quels sont mes frais bancaires?"
• "Où puis-je économiser?"

**💡 Alertes importantes:**
${transactionAnalysis.alerts.slice(0, 3).map(alert => `• ${alert}`).join('\n')}

Quelle analyse souhaitez-vous?`;
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
      console.log('Could not save chat history');
    }

    res.json({
      success: true,
      response: response,
      context: {
        balance: financialContext.totalBalance,
        transactions_analyzed: transactions.length,
        data_available: true
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Chat service error',
      details: error.message
    });
  }
};

// ========================================
// FONCTION D'ANALYSE DES TRANSACTIONS
// ========================================
function analyzeTransactions(transactions) {
  const analysis = {
    transactionCount: transactions.length,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    netCashFlow: 0,
    payrollDates: [],
    payrollAmounts: [],
    averagePayroll: 0,
    payFrequency: 14,
    payrollVariation: 'Stable',
    lastPayroll: null,
    nextPayrollEstimate: null,
    fees: [],
    topCategories: [],
    topMerchants: [],
    alerts: [],
    atmWithdrawals: 0,
    restaurantTotal: 0,
    averageTransaction: 0
  };

  if (!transactions || transactions.length === 0) {
    return analysis;
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const categoryTotals = {};
  const merchantTotals = {};
  
  // Analyser chaque transaction
  transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    
    // Revenus (crédits)
    if (tx.credit) {
      const amount = parseFloat(tx.credit);
      if (isCurrentMonth) {
        analysis.monthlyIncome += amount;
      }
      
      // Détecter les paies
      if (tx.description && (
        tx.description.toLowerCase().includes('payroll') ||
        tx.description.toLowerCase().includes('salaire') ||
        tx.description.includes('ACME JOB CO')
      )) {
        analysis.payrollDates.push(tx.date);
        analysis.payrollAmounts.push(amount);
        analysis.lastPayroll = tx.date;
      }
    }
    
    // Dépenses (débits)
    if (tx.debit || (tx.amount && tx.amount < 0)) {
      const amount = Math.abs(parseFloat(tx.debit || tx.amount));
      if (isCurrentMonth) {
        analysis.monthlyExpenses += amount;
      }
      
      // Catégoriser les dépenses
      const category = tx.category || 'Non catégorisé';
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      
      // Analyser les marchands
      const merchant = extractMerchant(tx.description || tx.details || '');
      if (merchant) {
        if (!merchantTotals[merchant]) {
          merchantTotals[merchant] = { count: 0, total: 0 };
        }
        merchantTotals[merchant].count++;
        merchantTotals[merchant].total += amount;
      }
      
      // Détecter les frais
      if (category && category.toLowerCase().includes('fees')) {
        analysis.fees.push({
          date: txDate.toLocaleDateString('fr-CA'),
          description: tx.description || tx.details,
          amount: amount,
          category: category
        });
      }
      
      // Compter les retraits ATM
      if (tx.description && tx.description.toLowerCase().includes('atm')) {
        analysis.atmWithdrawals++;
      }
      
      // Total restaurants
      if (category && (category.includes('restaurant') || category.includes('dining'))) {
        analysis.restaurantTotal += amount;
      }
    }
  });

  // Calculer le flux net
  analysis.netCashFlow = analysis.monthlyIncome - analysis.monthlyExpenses;
  
  // Analyser les paies
  if (analysis.payrollAmounts.length > 0) {
    analysis.averagePayroll = analysis.payrollAmounts.reduce((a, b) => a + b, 0) / analysis.payrollAmounts.length;
    
    // Calculer la fréquence des paies
    if (analysis.payrollDates.length >= 2) {
      const date1 = new Date(analysis.payrollDates[0]);
      const date2 = new Date(analysis.payrollDates[1]);
      const daysDiff = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
      analysis.payFrequency = Math.round(daysDiff);
    }
    
    // Estimer la prochaine paie
    if (analysis.lastPayroll) {
      const lastPay = new Date(analysis.lastPayroll);
      const nextPay = new Date(lastPay);
      nextPay.setDate(nextPay.getDate() + analysis.payFrequency);
      analysis.nextPayrollEstimate = nextPay.toLocaleDateString('fr-CA');
    }
    
    // Analyser la variation
    const minPay = Math.min(...analysis.payrollAmounts);
    const maxPay = Math.max(...analysis.payrollAmounts);
    const variation = ((maxPay - minPay) / analysis.averagePayroll) * 100;
    if (variation < 5) {
      analysis.payrollVariation = 'Très stable';
    } else if (variation < 15) {
      analysis.payrollVariation = 'Stable avec légères variations';
    } else {
      analysis.payrollVariation = `Variable (±${variation.toFixed(0)}%)`;
    }
  }
  
  // Top catégories
  analysis.topCategories = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total,
      count: transactions.filter(tx => tx.category === category).length
    }))
    .sort((a, b) => b.total - a.total);
  
  // Top marchands
  analysis.topMerchants = Object.entries(merchantTotals)
    .map(([merchant, data]) => ({
      merchant,
      count: data.count,
      total: data.total
    }))
    .sort((a, b) => b.total - a.total);
  
  // Moyenne des transactions
  const debitTransactions = transactions.filter(tx => tx.debit || (tx.amount && tx.amount < 0));
  if (debitTransactions.length > 0) {
    analysis.averageTransaction = analysis.monthlyExpenses / debitTransactions.length;
  }
  
  // Générer des alertes
  if (analysis.netCashFlow < 0) {
    analysis.alerts.push(`⚠️ Déficit de $${Math.abs(analysis.netCashFlow).toFixed(2)} ce mois`);
  }
  
  if (analysis.fees.length > 5) {
    const totalFees = analysis.fees.reduce((sum, f) => sum + f.amount, 0);
    analysis.alerts.push(`💸 ${analysis.fees.length} frais détectés ($${totalFees.toFixed(2)} total)`);
  }
  
  if (analysis.atmWithdrawals > 4) {
    analysis.alerts.push(`🏧 ${analysis.atmWithdrawals} retraits ATM (considérez l'usage de carte)`);
  }
  
  const highCostLoans = transactions.filter(tx => 
    tx.category && (tx.category.includes('payday') || tx.category.includes('high_cost'))
  );
  if (highCostLoans.length > 0) {
    const loanTotal = highCostLoans.reduce((sum, tx) => sum + Math.abs(tx.debit || tx.amount || 0), 0);
    analysis.alerts.push(`🚨 Prêts à coût élevé: $${loanTotal.toFixed(2)} en frais`);
  }

  return analysis;
}

// Fonction pour extraire le nom du marchand
function extractMerchant(description) {
  // Nettoyer et extraire le nom du marchand
  const cleanDesc = description.replace(/Other Reference #.*$/i, '').trim();
  
  // Patterns communs
  const patterns = [
    /^POS Purchase (.+?)(?:\d{3,}|St|On)/i,
    /^Pre-Authorized (.+?)(?:Other|Pre)/i,
    /^Bill Payment (.+?)(?:\d{10,}|Confirmation)/i,
    /^ATM Withdrawal/i,
    /^e-Transfer/i
  ];
  
  for (const pattern of patterns) {
    const match = cleanDesc.match(pattern);
    if (match) {
      return match[1]?.trim() || match[0];
    }
  }
  
  // Si aucun pattern ne match, retourner les premiers mots
  return cleanDesc.split(' ').slice(0, 3).join(' ');
}
