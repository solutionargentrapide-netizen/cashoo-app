// api/inverite/fetch.js - VERSION CORRIGÉE - Extraction correcte des soldes
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
        console.log('Raw Inverite response structure:', {
          hasAccounts: !!inveriteData.accounts,
          accountCount: inveriteData.accounts?.length,
          firstAccountKeys: inveriteData.accounts?.[0] ? Object.keys(inveriteData.accounts[0]) : []
        });
        
        // Formater les données pour CASHOO
        const formattedAccounts = [];
        const formattedTransactions = [];
        let latestBalance = 0; // Suivre le dernier solde des transactions
        
        if (inveriteData.accounts && Array.isArray(inveriteData.accounts)) {
          // Formater les comptes Inverite
          inveriteData.accounts.forEach(account => {
            // CORRECTION: Extraire le vrai solde
            let accountBalance = 0;
            
            // Vérifier différentes propriétés possibles pour le solde
            if (account.available_balance !== undefined) {
              accountBalance = parseFloat(account.available_balance);
            } else if (account.current_balance !== undefined) {
              accountBalance = parseFloat(account.current_balance);
            } else if (account.balance !== undefined) {
              accountBalance = parseFloat(account.balance);
            }
            
            // Si toujours 0, essayer de prendre le solde de la dernière transaction
            if (accountBalance === 0 && account.transactions && account.transactions.length > 0) {
              // Trouver la transaction la plus récente avec un solde
              for (let tx of account.transactions) {
                if (tx.balance !== undefined && tx.balance !== null && tx.balance !== '') {
                  accountBalance = parseFloat(tx.balance);
                  break; // Prendre le premier solde trouvé (le plus récent)
                }
              }
            }
            
            console.log(`Account ${account.account || account.id}: Balance = ${accountBalance}`);
            
            formattedAccounts.push({
              id: account.account || account.id || 'INVERITE-' + Date.now(),
              name: account.name || account.bank || 'Verified Account',
              type: account.type || 'chequing',
              balance: accountBalance, // Utiliser le solde calculé
              currency: 'CAD',
              institution: account.bank || account.institution || 'Bank',
              transit: account.transit || '',
              account: account.account || '',
              rawData: {
                available_balance: account.available_balance,
                current_balance: account.current_balance,
                balance: account.balance
              }
            });
            
            // Extraire les transactions
            if (account.transactions && Array.isArray(account.transactions)) {
              account.transactions.forEach((tx, index) => {
                // Parser les montants
                let credit = null;
                let debit = null;
                let balance = null;
                
                if (tx.credit !== undefined && tx.credit !== null && tx.credit !== '') {
                  credit = parseFloat(tx.credit);
                }
                if (tx.debit !== undefined && tx.debit !== null && tx.debit !== '') {
                  debit = parseFloat(tx.debit);
                }
                if (tx.balance !== undefined && tx.balance !== null && tx.balance !== '') {
                  balance = parseFloat(tx.balance);
                  // Garder trace du dernier solde connu
                  if (index === 0) {
                    latestBalance = balance;
                  }
                }
                
                formattedTransactions.push({
                  id: `INV-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: account.account || account.id,
                  amount: credit ? credit : (debit ? -debit : 0),
                  credit: credit,
                  debit: debit,
                  description: tx.details || tx.description || 'Transaction',
                  date: tx.date,
                  category: tx.category || (credit ? 'Income' : 'Expense'),
                  balance: balance
                });
              });
            }
          });
        }
        
        // Si le solde du compte est 0 mais qu'on a un solde de transaction, utiliser celui-ci
        if (formattedAccounts.length > 0 && formattedAccounts[0].balance === 0 && latestBalance !== 0) {
          console.log(`Updating account balance from latest transaction: ${latestBalance}`);
          formattedAccounts[0].balance = latestBalance;
        }
        
        // Calculer le solde total réel
        const totalBalance = formattedAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        console.log(`Total calculated balance: ${totalBalance}`);
        
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
            totalBalance: totalBalance,
            accountCount: formattedAccounts.length,
            transactionCount: formattedTransactions.length,
            verifiedBy: 'Inverite',
            verificationDate: new Date().toISOString(),
            latestTransactionBalance: latestBalance
          },
          debug: {
            firstAccount: formattedAccounts[0],
            totalCalculated: totalBalance,
            transactionBalances: formattedTransactions.slice(0, 5).map(tx => ({
              date: tx.date,
              balance: tx.balance
            }))
          }
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
      // Si pas de GUID, récupérer les derniÃ¨res données en cache
      const { data: cachedData, error } = await supabase
        .from('flinks_data')
        .select('*')
        .eq('user_id', userId)
        .like('login_id', 'INVERITE-%')
        .order('last_sync', { ascending: false })
        .limit(1)
        .single();

      if (cachedData && cachedData.accounts_data) {
        // Recalculer le solde si nécessaire à partir des transactions
        let accounts = cachedData.accounts_data;
        
        if (accounts && accounts[0] && accounts[0].balance === 0 && cachedData.transactions_data && cachedData.transactions_data.length > 0) {
          // Trouver le dernier solde dans les transactions
          const lastBalancedTransaction = cachedData.transactions_data.find(tx => tx.balance !== null && tx.balance !== undefined);
          if (lastBalancedTransaction) {
            accounts[0].balance = lastBalancedTransaction.balance;
            console.log(`Updated cached account balance from transaction: ${accounts[0].balance}`);
          }
        }
        
        const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        
        res.json({
          success: true,
          accounts: accounts,
          transactions: cachedData.transactions_data || [],
          lastSync: cachedData.last_sync,
          cached: true,
          summary: {
            totalBalance: totalBalance,
            accountCount: accounts.length,
            transactionCount: (cachedData.transactions_data || []).length,
            verifiedBy: 'Inverite'
          }
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
