// api/flinks/getJson.js
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cashoo-jwt-secret-' + Math.random().toString(36).substring(2, 15);

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'No token provided' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token' 
      });
    }

    const { requestId, loginId } = req.body;

    if (!requestId && !loginId) {
      return res.status(400).json({ 
        success: false,
        error: 'Either requestId or loginId is required' 
      });
    }

    console.log('[FLINKS] Fetching data for:', { requestId, loginId });

    // Flinks API configuration
    const FLINKS_API_URL = process.env.FLINKS_API_URL || 'https://sandboxapi.flinks.io';
    const FLINKS_CUSTOMER_ID = process.env.FLINKS_CUSTOMER_ID || 'your-customer-id';
    const FLINKS_API_KEY = process.env.FLINKS_API_KEY || 'your-api-key';

    let finalRequestId = requestId;

    // If we have loginId but no requestId, authorize first
    if (!requestId && loginId) {
      try {
        const authResponse = await axios.post(
          `${FLINKS_API_URL}/BankingServices/Authorize`,
          {
            LoginId: loginId,
            MostRecentCached: true,
            Institution: 'FlinksCapital'
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${FLINKS_API_KEY}`
            }
          }
        );

        finalRequestId = authResponse.data.RequestId;
        console.log('[FLINKS] Got RequestId from LoginId:', finalRequestId);
        
      } catch (authError) {
        console.error('[FLINKS] Authorization error:', authError.response?.data || authError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to authorize with Flinks',
          details: authError.response?.data
        });
      }
    }

    // Now get the actual account data
    try {
      const accountsResponse = await axios.post(
        `${FLINKS_API_URL}/BankingServices/GetAccounts`,
        {
          RequestId: finalRequestId,
          MostRecent: true,
          WithTransactions: true,
          DaysOfTransactions: 90,
          WithBalance: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FLINKS_API_KEY}`
          }
        }
      );

      const flinksData = accountsResponse.data;
      console.log('[FLINKS] Data retrieved successfully');

      // Format the response
      const formattedData = formatFlinksData(flinksData);

      // Return the formatted data
      return res.status(200).json({
        success: true,
        requestId: finalRequestId,
        data: formattedData,
        raw: process.env.NODE_ENV === 'development' ? flinksData : undefined
      });

    } catch (dataError) {
      console.error('[FLINKS] Get accounts error:', dataError.response?.data || dataError.message);
      
      // Try alternative endpoint (GetStatements)
      try {
        const statementsResponse = await axios.post(
          `${FLINKS_API_URL}/BankingServices/GetStatements`,
          {
            RequestId: finalRequestId,
            MostRecent: true,
            WithHtml: false
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${FLINKS_API_KEY}`
            }
          }
        );

        const statementsData = statementsResponse.data;
        console.log('[FLINKS] Statements retrieved as fallback');

        return res.status(200).json({
          success: true,
          requestId: finalRequestId,
          data: formatStatementsData(statementsData),
          source: 'statements'
        });

      } catch (statementsError) {
        console.error('[FLINKS] Statements error:', statementsError.response?.data || statementsError.message);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to retrieve account data from Flinks',
          details: dataError.response?.data || dataError.message
        });
      }
    }

  } catch (error) {
    console.error('[FLINKS] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Format Flinks GetAccounts response
function formatFlinksData(data) {
  const formatted = {
    accounts: [],
    transactions: [],
    summary: {
      totalBalance: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      accountCount: 0,
      transactionCount: 0
    }
  };

  if (data.Accounts && Array.isArray(data.Accounts)) {
    data.Accounts.forEach(account => {
      const accountData = {
        id: account.Id,
        accountNumber: account.AccountNumber,
        transit: account.TransitNumber,
        institution: account.Institution,
        title: account.Title,
        type: account.Type,
        category: account.Category,
        balance: account.Balance?.Current || 0,
        balanceAvailable: account.Balance?.Available || 0,
        balanceLimit: account.Balance?.Limit || 0,
        currency: account.Currency || 'CAD',
        holder: account.Holder,
        holderName: `${account.Holder?.FirstName || ''} ${account.Holder?.LastName || ''}`.trim()
      };

      formatted.accounts.push(accountData);
      
      // Update summary
      formatted.summary.totalBalance += accountData.balance;
      if (account.Type === 'Loan' || account.Type === 'CreditCard') {
        formatted.summary.totalLiabilities += Math.abs(accountData.balance);
      } else {
        formatted.summary.totalAssets += accountData.balance;
      }

      // Process transactions
      if (account.Transactions && Array.isArray(account.Transactions)) {
        account.Transactions.forEach(tx => {
          formatted.transactions.push({
            id: tx.Id,
            accountId: account.Id,
            date: tx.Date,
            description: tx.Description,
            amount: tx.Amount,
            balance: tx.Balance,
            type: tx.Amount > 0 ? 'credit' : 'debit',
            pending: tx.Pending || false,
            category: detectCategory(tx.Description)
          });
        });
      }
    });

    formatted.summary.accountCount = formatted.accounts.length;
    formatted.summary.transactionCount = formatted.transactions.length;
  }

  return formatted;
}

// Format Flinks GetStatements response as fallback
function formatStatementsData(data) {
  const formatted = {
    accounts: [],
    transactions: [],
    statements: [],
    summary: {
      totalBalance: 0,
      accountCount: 0,
      statementCount: 0
    }
  };

  if (data.Statements && Array.isArray(data.Statements)) {
    data.Statements.forEach((statement, index) => {
      formatted.statements.push({
        id: `stmt_${index}`,
        period: statement.Period,
        accountNumber: statement.AccountNumber,
        balance: statement.ClosingBalance || 0,
        transactions: statement.Transactions?.length || 0
      });

      // Create a virtual account from statement
      formatted.accounts.push({
        id: `stmt_acc_${index}`,
        accountNumber: statement.AccountNumber,
        title: `Account ${statement.AccountNumber}`,
        balance: statement.ClosingBalance || 0,
        currency: 'CAD'
      });

      formatted.summary.totalBalance += (statement.ClosingBalance || 0);
    });

    formatted.summary.accountCount = formatted.accounts.length;
    formatted.summary.statementCount = formatted.statements.length;
  }

  return formatted;
}

// Simple category detection
function detectCategory(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('grocery') || desc.includes('supermarket') || desc.includes('walmart')) {
    return 'Groceries';
  } else if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('coffee')) {
    return 'Dining';
  } else if (desc.includes('gas') || desc.includes('petro') || desc.includes('esso')) {
    return 'Transportation';
  } else if (desc.includes('hydro') || desc.includes('internet') || desc.includes('phone')) {
    return 'Utilities';
  } else if (desc.includes('rent') || desc.includes('mortgage')) {
    return 'Housing';
  } else if (desc.includes('payroll') || desc.includes('salary') || desc.includes('deposit')) {
    return 'Income';
  } else if (desc.includes('fee') || desc.includes('charge')) {
    return 'Fees';
  } else if (desc.includes('transfer')) {
    return 'Transfer';
  } else {
    return 'Other';
  }
}
