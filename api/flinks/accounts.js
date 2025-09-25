const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const supabase = createClient(
    'https://tvfqfjfkmccyrpfkkfva.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4NzMsImV4cCI6MjA3NDMxNTg3M30.EYjHqSSD1wnghW8yI3LJj88VUtMIxaZ_hv1-FQ8i1DA'
  );

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, 'cashoo-jwt-secret-change-this-in-production');
    const userId = decoded.userId;

    const { data, error } = await supabase
      .from('flinks_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.json({ 
        accounts: [], 
        transactions: [],
        lastSync: null 
      });
    }

    res.json({
      accounts: data.accounts_data || [],
      transactions: data.transactions_data || [],
      lastSync: data.last_sync
    });

  } catch (error) {
    console.error('Get accounts error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
};
