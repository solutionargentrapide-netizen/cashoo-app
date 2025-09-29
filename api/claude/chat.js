// api/claude/chat.js - Assistant financier Claude AI
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long'
    );
    const userId = decoded.userId;

    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Récupérer les données financières de l'utilisateur pour le contexte
    const { data: financialData } = await supabase
      .from('flinks_data')
      .select('accounts_data, transactions_data')
      .eq('user_id', userId)
      .single();

    // Construire le contexte financier
    let financialContext = '';
    if (financialData) {
      const accounts = financialData.accounts_data || [];
      const transactions = financialData.transactions_data || [];
      
      const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      const recentTransactions = transactions.slice(0, 10);
      
      // Analyser les dépenses par catégorie
      const spending = {};
      transactions.forEach(tx => {
        if (tx.debit) {
          const category = tx.category || 'Other';
          spending[category] = (spending[category] || 0) + parseFloat(tx.debit);
        }
      });

      financialContext = `
        User Financial Context:
        - Total Balance: $${totalBalance.toFixed(2)}
        - Number of accounts: ${accounts.length}
        - Recent transactions: ${recentTransactions.length}
        - Main spending categories: ${Object.keys(spending).join(', ')}
        - Total monthly spending: $${Object.values(spending).reduce((a, b) => a + b, 0).toFixed(2)}
      `;
    }

    // Configuration Claude API
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'YOUR_CLAUDE_API_KEY_HERE';
    const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

    // Si pas de clé Claude, utiliser une réponse simulée
    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === 'YOUR_CLAUDE_API_KEY_HERE') {
      // Mode démo sans Claude API
      const demoResponses = {
        budget: `Based on your financial data, I can see you have a total balance of $${financialData ? accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toFixed(2) : '0.00'}. Here are my recommendations:

1. **Track your spending**: Monitor your daily expenses to identify areas where you can cut back.
2. **Set a budget**: Allocate specific amounts for different categories like groceries, entertainment, and savings.
3. **Emergency fund**: Aim to save at least 3-6 months of expenses.
4. **Automate savings**: Set up automatic transfers to your savings account.

Would you like me to analyze a specific aspect of your finances?`,
        
        savings: `Looking at your transaction history, here are personalized savings strategies:

1. **Reduce recurring expenses**: Review your subscriptions and cancel unused services.
2. **50/30/20 Rule**: Allocate 50% for needs, 30% for wants, and 20% for savings.
3. **Round-up savings**: Consider rounding up purchases to save the difference.
4. **High-yield savings**: Move your emergency fund to a high-yield savings account.

What's your primary savings goal?`,
        
        default: `I'm here to help you manage your finances better! I can assist with:

• Budget planning and tracking
• Savings strategies
• Spending analysis
• Financial goal setting
• Investment basics
• Debt management

What would you like to explore today?`
      };

      // Déterminer le type de question
      let response = demoResponses.default;
      if (message.toLowerCase().includes('budget')) {
        response = demoResponses.budget;
      } else if (message.toLowerCase().includes('save') || message.toLowerCase().includes('saving')) {
        response = demoResponses.savings;
      }

      // Sauvegarder la conversation
      await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          message: message,
          response: response,
          created_at: new Date().toISOString()
        });

      return res.json({
        success: true,
        response: response,
        demo: true
      });
    }

    // Appel réel à Claude API
    try {
      const claudeResponse = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1000,
          messages: [
            {
              role: 'system',
              content: `You are CASHOO AI, a helpful financial assistant. You have access to the user's financial data and provide personalized advice.
              
              ${financialContext}
              
              Provide helpful, actionable financial advice. Be specific and reference the user's actual financial situation when relevant.`
            },
            {
              role: 'user',
              content: message
            }
          ]
        })
      });

      const claudeData = await claudeResponse.json();
      
      if (claudeData.content && claudeData.content[0]) {
        const aiResponse = claudeData.content[0].text;

        // Sauvegarder la conversation
        await supabase
          .from('chat_history')
          .insert({
            user_id: userId,
            message: message,
            response: aiResponse,
            created_at: new Date().toISOString()
          });

        res.json({
          success: true,
          response: aiResponse
        });
      } else {
        throw new Error('Invalid Claude API response');
      }
    } catch (claudeError) {
      console.error('Claude API error:', claudeError);
      
      // Fallback to demo response
      const fallbackResponse = `I'm analyzing your financial data... You currently have a balance of $${
        financialData ? accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toFixed(2) : '0.00'
      }. How can I help you manage your finances better today?`;

      res.json({
        success: true,
        response: fallbackResponse,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error.message
    });
  }
};
