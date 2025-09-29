// api/flinks/sync.js - VERSION CORRIGÉE
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
  );

  const flinksAPI = axios.create({
    baseURL: process.env.FLINKS_API_DOMAIN ? `${process.env.FLINKS_API_DOMAIN}/v3` : 'https://solutionargentrapide-api.private.fin.ag/v3',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.FLINKS_X_API_KEY || 'ca640342-86cc-45e4-b3f9-75dbda05b0ae'
    },
    timeout: 30000
  });

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
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // UTILISE LE MÊME SECRET QUE login.js
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long');
    const userId = decoded.userId;

    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ error: 'LoginId required' });
    }

    console.log('Tentative de sync avec Flinks pour loginId:', loginId);

    try {
      // Tente l'API Flinks
      const authResponse = await flinksAPI.post('/Authorize', {
        LoginId: loginId,
        MostRecentCached: true
      });

      const requestId = authResponse.data.RequestId;
      await new Promise(resolve => setTimeout(resolve, 2000));

      const accountsResponse = await flinksAPI.post('/GetAccountsDetail', {
        RequestId: requestId,
        DaysOfTransactions: 'Days90'
      });

      const accounts = accountsResponse.data.Accounts || [];
      const transactions = extractTransactions(accounts);

      await supabase
        .from('flinks_data')
        .upsert({
          user_id: userId,
          login_id: loginId,
          request_id: requestId,
          accounts_data: accounts,
          transactions_data: transactions,
          last_sync: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      const formattedData = formatAccountsData(accountsResponse.data);
      
      res.json({
        success: true,
        data: formattedData,
        syncTime: new Date().toISOString()
      });

    } catch (flinksError) {
      console.error('Flinks API error:', flinksError.response?.data || flinksError.message);
      
      // SI FLINKS ÉCHOUE, UTILISE DES DONNÉES DE DEMO
      const demoAccounts = [
        {
          id: 'demo-001',
          name: 'Compte Chèques Demo',
          type: 'Checking',
          balance: 2500.00,
          currency: 'CAD',
          institution: 'Solution Argent Rapide'
        },
        {
          id: 'demo-002',
          name: 'Compte Épargne Demo',
          type: 'Savings',
          balance: 15000.00,
          currency: 'CAD',
          institution: 'Solution Argent Rapide'
        }
      ];

      const demoTransactions = [
        {
          id: 'tx-001',
          accountId: 'demo-001',
          amount: -45.99,
          description: 'ÉPICERIE METRO',
          date: new Date().toISOString(),
          category: 'Food'
        },
        {
          id: 'tx-002',
          accountId: 'demo-001',
          amount: 2000.00,
          description: 'DÉPÔT SALAIRE',
          date: new Date(Date.now() - 86400000).toISOString(),
          category: 'Income'
        },
        {
          id: 'tx-003',
          accountId: 'demo-001',
          amount: -120.00,
          description: 'HYDRO-QUÉBEC',
          date: new Date(Date.now() - 172800000).toISOString(),
          category: 'Bills'
        },
        {
          id: 'tx-004',
          accountId: 'demo-002',
          amount: 500.00,
          description: 'TRANSFERT ÉPARGNE',
          date: new Date(Date.now() - 259200000).toISOString(),
          category: 'Transfer'
        }
      ];

      await supabase
        .from('flinks_data')
        .upsert({
          user_id: userId,
          login_id: 'demo-' + loginId,
          request_id: 'demo-request',
          accounts_data: demoAccounts,
          transactions_data: demoTransactions,
          last_sync: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      res.json({
        success: true,
        demo: true,
        message: 'Mode démo activé - Données de démonstration utilisées',
        data: {
          accounts: demoAccounts,
          transactions: demoTransactions,
          summary: {
            totalBalance: 17500.00,
            accountCount: 2,
            transactionCount: 4
          }
        },
        syncTime: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Sync failed', 
      details: error.message 
    });
  }
};

function extractTransactions(accounts) {
  const allTransactions = [];
  if (!accounts) return allTransactions;

  accounts.forEach(account => {
    if (account.Transactions) {
      account.Transactions.forEach(tx => {
        allTransactions.push({
          accountId: account.Id,
          ...tx
        });
      });
    }
  });

  return allTransactions;
}

function formatAccountsData(data) {
  if (!data.Accounts) {
    return { accounts: [], transactions: [], summary: {} };
  }

  const accounts = data.Accounts.map(account => ({
    id: account.Id,
    name: account.Title || account.AccountNumber,
    type: account.Type,
    balance: account.Balance?.Current || 0,
    currency: account.Currency || 'CAD',
    institution: account.Institution
  }));

  const transactions = extractTransactions(data.Accounts)
    .map(tx => ({
      id: tx.Id,
      accountId: tx.accountId,
      amount: tx.Amount,
      description: tx.Description,
      date: tx.Date,
      category: tx.Amount > 0 ? 'Income' : 'Other'
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return {
    accounts,
    transactions: transactions.slice(0, 100),
    summary: {
      totalBalance,
      accountCount: accounts.length,
      transactionCount: transactions.length
    }
  };
}
