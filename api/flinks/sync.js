// api/flinks/sync.js
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Initialiser Supabase DANS la fonction
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Configuration Axios pour Flinks
  const flinksAPI = axios.create({
    baseURL: `${process.env.FLINKS_API_DOMAIN}/v3`,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.FLINKS_X_API_KEY
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ error: 'LoginId required' });
    }

    const authResponse = await flinksAPI.post('/Authorize', {
      LoginId: loginId,
      MostRecentCached: true
    });

    if (!authResponse.data.RequestId) {
      throw new Error('No RequestId received from Flinks');
    }

    const requestId = authResponse.data.RequestId;
    await new Promise(resolve => setTimeout(resolve, 2000));

    const accountsResponse = await flinksAPI.post('/GetAccountsDetail', {
      RequestId: requestId,
      DaysOfTransactions: 'Days90'
    });

    const accounts = accountsResponse.data.Accounts || [];
    const transactions = extractTransactions(accounts);

    const { error: saveError } = await supabase
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

    if (saveError) {
      throw saveError;
    }

    const formattedData = formatAccountsData(accountsResponse.data);
    
    res.json({
      success: true,
      data: formattedData,
      syncTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('Flinks sync error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Sync failed', 
      details: error.response?.data?.Message || error.message 
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
