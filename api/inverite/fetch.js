// api/inverite/fetch.js - Récupérer les données Inverite
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const axios = require('axios');

module.exports = async (req, res) => {
  // Initialisation Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk'
  );

  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier l'authentification
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Vérifier le JWT
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long'
    );
    const userId = decoded.userId;

    // Configuration Inverite
    const INVERITE_API_KEY = process.env.INVERITE_API_KEY || '0a0092a83081e0e1b947a07a5ee60053f20';
    const INVERITE_API_URL = process.env.INVERITE_API_URL || 'https://live.inverite.com';
    
    // Si on a un GUID spécifique, le récupérer
    const requestGuid = req.body?.guid || req.query?.guid;
    
    if (requestGuid) {
      try {
        // Appeler l'API Inverite pour récupérer les données
        const response = await axios.get(
          `${INVERITE_API_URL}/api/v2/fetch/${requestGuid}`,
          {
            headers: {
              'Auth': INVERITE_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );

        const inveriteData = response.data;
        
        // Formater les données pour CASHOO
        const formattedAccounts = [];
        const formattedTransactions = [];
        
        if (inveriteData.accounts && Array.isArray(inveriteData.accounts)) {
          // Formater les comptes Inverite
          inveriteData.accounts.forEach(account => {
            formattedAccounts.push({
              id: account.account || 'INVERITE-' + Date.now(),
              name: account.bank || 'Verified Account',
              type: account.type || 'chequing',
              balance: parseFloat(account.available_balance || 0),
              currency: 'CAD',
              institution: account.bank || 'Unknown Bank',
              transit: account.transit || '',
              account: account.account || ''
            });
            
            // Extraire les transactions
            if (account.transactions && Array.isArray(account.transactions)) {
              account.transactions.forEach(tx => {
                formattedTransactions.push({
                  id: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: account.account,
                  amount: tx.credit ? parseFloat(tx.credit) : -parseFloat(tx.debit || 0),
                  credit: tx.credit || null,
                  debit: tx.debit || null,
                  description: tx.details || 'Transaction',
                  date: tx.date,
                  category: tx.category || 'Other',
                  balance: tx.balance || null
                });
              });
            }
          });
        }
        
        // Sauvegarder dans Supabase
        await supabase
          .from('flinks_data')
          .upsert({
            user_id: userId,
            login_id: 'INVERITE-' + requestGuid,
            request_id: requestGuid,
            accounts_data: formattedAccounts,
            transactions_data: formattedTransactions,
            last_sync: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        // Retourner les données formatées
        res.json({
          success: true,
          accounts: formattedAccounts,
          transactions: formattedTransactions.slice(0, 100), // Limiter à 100 transactions
          summary: {
            totalBalance: formattedAccounts.reduce((sum, acc) => sum + acc.balance, 0),
            accountCount: formattedAccounts.length,
            transactionCount: formattedTransactions.length,
            verifiedBy: 'Inverite',
            verificationDate: new Date().toISOString()
          },
          rawData: inveriteData // Données brutes pour debug
        });
        
      } catch (apiError) {
        console.error('Inverite API error:', apiError.response?.data || apiError.message);
        
        // Retourner une erreur mais ne pas crasher
        res.status(500).json({
          success: false,
          error: 'Failed to fetch Inverite data',
          details: apiError.response?.data || apiError.message
        });
      }
    } else {
      // Si pas de GUID, récupérer les dernières données en cache
      const { data: cachedData, error } = await supabase
        .from('flinks_data')
        .select('*')
        .eq('user_id', userId)
        .like('login_id', 'INVERITE-%')
        .order('last_sync', { ascending: false })
        .limit(1)
        .single();

      if (cachedData) {
        res.json({
          success: true,
          accounts: cachedData.accounts_data || [],
          transactions: cachedData.transactions_data || [],
          lastSync: cachedData.last_sync,
          cached: true
        });
      } else {
        res.json({
          success: false,
          accounts: [],
          transactions: [],
          message: 'No Inverite verification data found'
        });
      }
    }

  } catch (error) {
    console.error('Inverite fetch error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch Inverite data', 
      details: error.message 
    });
  }
};
