// CASHOO Banking Dashboard - UNIFIED VERSION
// Configuration
const API_URL = '/api';
let authToken = localStorage.getItem('cashoo_token');
let currentUser = null;
let loginId = null;
let currentProvider = null;

// Check authentication on load
window.onload = () => {
    console.log('App loaded. Token exists:', !!authToken);
    if (authToken) {
        verifyAuth();
    }
};

// ========================================
// AUTHENTICATION - UNIFIED API
// ========================================

async function login(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const button = document.getElementById('loginBtn');
    const message = document.getElementById('loginMessage');

    button.disabled = true;
    button.textContent = 'Signing in...';
    message.innerHTML = '';

    try {
        // USE UNIFIED API
        const response = await fetch(`${API_URL}/auth?action=login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                action: 'login',
                email,
                password 
            })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('cashoo_token', authToken);
            localStorage.setItem('cashoo_user', JSON.stringify(currentUser));
            
            message.innerHTML = '<div class="success">Login successful!</div>';
            setTimeout(() => {
                showDashboard();
            }, 1000);
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        message.innerHTML = `<div class="error">${error.message}</div>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Sign In';
    }
}

async function verifyAuth() {
    console.log('Verifying authentication...');
    
    try {
        // USE UNIFIED API
        const response = await fetch(`${API_URL}/auth?action=verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'verify' })
        });

        const data = await response.json();
        console.log('Verify response:', data);

        if (data.valid) {
            currentUser = { 
                id: data.userId, 
                email: data.email,
                emailVerified: data.emailVerified 
            };
            localStorage.setItem('cashoo_user', JSON.stringify(currentUser));
            showDashboard();
            
            // Load Inverite data if exists
            checkForInveriteData();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        logout();
    }
}

function logout() {
    // Call logout API
    if (authToken) {
        fetch(`${API_URL}/auth?action=logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'logout' })
        });
    }
    
    localStorage.removeItem('cashoo_token');
    localStorage.removeItem('cashoo_user');
    authToken = null;
    currentUser = null;
    loginId = null;
    
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('email').value = '';
    document.getElementById('loginMessage').innerHTML = '';
}

function showDashboard() {
    console.log('Showing dashboard');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userEmail').textContent = currentUser.email;
    loadAccounts();
}

// ========================================
// CHECK FOR EXISTING DATA
// ========================================

async function checkForInveriteData() {
    console.log('Checking for existing Inverite data...');
    
    try {
        const response = await fetch(`${API_URL}/inverite/fetch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        
        if (data.success && data.accounts && data.accounts.length > 0) {
            console.log('Found cached Inverite data!');
            displayInveriteData(data);
            document.getElementById('lastSync').textContent = 
                `Verified via Inverite: ${new Date(data.lastSync || Date.now()).toLocaleString()}`;
            document.getElementById('connectBtn').style.display = 'none';
            document.getElementById('inveriteBtn').style.display = 'none';
            document.getElementById('syncBtn').style.display = 'inline-block';
        }
    } catch (error) {
        console.log('No cached Inverite data found');
    }
}

// ========================================
// FLINKS INTEGRATION
// ========================================

async function connectBank() {
    currentProvider = 'flinks';
    showStatus('Connecting to Flinks...', 'info');
    
    try {
        const response = await fetch(`${API_URL}/flinks/connect`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        
        if (data.url) {
            document.getElementById('iframeTitle').textContent = 'Flinks Bank Connection';
            document.getElementById('universalFrame').src = data.url;
            document.getElementById('iframeContainer').classList.add('active');
            
            window.addEventListener('message', handleFlinksCallback);
            showStatus('Complete the connection in the window', 'info');
        } else {
            throw new Error('Failed to get Flinks URL');
        }
    } catch (error) {
        console.error('Flinks connection error:', error);
        showStatus('Failed to connect to Flinks', 'error');
    }
}

function handleFlinksCallback(event) {
    if (event.data && event.data.loginId) {
        loginId = event.data.loginId;
        closeIframe();
        syncAccounts();
        showStatus('Flinks connected! Synchronizing...', 'success');
    } else if (event.data && event.data.error) {
        showStatus('Flinks connection failed: ' + event.data.error, 'error');
        closeIframe();
    }
}

async function syncAccounts() {
    if (!loginId) {
        loginId = prompt('Enter your Flinks LoginId (or "demo" for demo):');
        if (!loginId) return;
    }

    const syncBtn = document.getElementById('syncBtn');
    const connectBtn = document.getElementById('connectBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Synchronizing...';
    showStatus('Synchronizing your accounts...', 'info');

    try {
        const response = await fetch(`${API_URL}/flinks/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ loginId })
        });

        const data = await response.json();

        if (data.success) {
            displayAccountsData(data.data);
            document.getElementById('lastSync').textContent = 
                `Last sync: ${new Date(data.syncTime).toLocaleString()}`;
            connectBtn.style.display = 'none';
            syncBtn.style.display = 'inline-block';
            
            if (data.demo) {
                showStatus('Demo data loaded', 'warning');
            } else {
                showStatus('Accounts synchronized!', 'success');
            }
        } else {
            throw new Error(data.error || 'Sync failed');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showStatus(`Failed: ${error.message}`, 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Refresh';
    }
}

// ========================================
// INVERITE INTEGRATION
// ========================================

async function connectInverite() {
    currentProvider = 'inverite';
    showStatus('Connecting to Inverite...', 'info');
    
    try {
        const response = await fetch(`${API_URL}/inverite/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstname: currentUser.email.split('@')[0] || 'User',
                lastname: 'CASHOO',
                email: currentUser.email
            })
        });

        const data = await response.json();
        
        if (data.iframeUrl) {
            document.getElementById('iframeTitle').textContent = 'Inverite Bank Verification';
            document.getElementById('universalFrame').src = data.iframeUrl;
            document.getElementById('iframeContainer').classList.add('active');
            
            window.addEventListener('message', handleInveriteMessage);
            showStatus('Complete verification in the window', 'info');
        } else {
            throw new Error('Failed to get Inverite URL');
        }
    } catch (error) {
        console.error('Inverite connection error:', error);
        showStatus('Failed to connect to Inverite', 'error');
    }
}

function handleInveriteMessage(event) {
    console.log('=== INVERITE MESSAGE ===');
    console.log('Origin:', event.origin);
    console.log('Data:', event.data);
    
    if (event.origin.includes('inverite.com')) {
        console.log('Inverite message received:', event.data);
        
        if (event.data === 'success') {
            console.log('Inverite verification successful!');
            closeIframe();
            showStatus('Verification complete! Fetching data...', 'success');
            fetchInveriteData('339703B7-9B97-4FDC-8727-D04357A08DAD');
            
        } else if (event.data.type === 'ibv.request.completed') {
            const guid = event.data.content?.request?.guid;
            console.log('Inverite completed with GUID:', guid);
            closeIframe();
            showStatus('Verification complete! Fetching data...', 'success');
            
            if (guid) {
                fetchInveriteData(guid);
            } else {
                fetchInveriteData();
            }
            
        } else if (event.data.type === 'ibv.data_collection.started') {
            showStatus('Inverite is processing your bank data...', 'info');
            
        } else if (event.data === 'error' || event.data.verified === 0) {
            showStatus('Inverite verification failed', 'error');
            closeIframe();
        }
    }
}

async function fetchInveriteData(guid) {
    showStatus('Fetching data...', 'info');
    
    try {
        const url = guid ? `/api/inverite/fetch?guid=${guid}` : '/api/inverite/fetch';
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guid: guid || null })
        });

        const data = await response.json();
        console.log('Inverite data received:', data);
        
        if (data.success && data.accounts) {
            displayInveriteData(data);
            
            document.getElementById('lastSync').textContent = 
                `Verified via Inverite: ${new Date().toLocaleString()}`;
            showStatus('Data loaded successfully!', 'success');
            
            document.getElementById('connectBtn').style.display = 'none';
            document.getElementById('inveriteBtn').style.display = 'none';
            document.getElementById('syncBtn').style.display = 'inline-block';
            
        } else if (data.error) {
            showStatus('Error: ' + data.error, 'error');
        } else {
            showStatus('No data available. Retry in a few seconds.', 'warning');
            setTimeout(() => fetchInveriteData(guid), 3000);
        }
    } catch (error) {
        console.error('Failed to fetch Inverite data:', error);
        showStatus('Fetch failed: ' + error.message, 'error');
    }
}

// ========================================
// DISPLAY INVERITE DATA
// ========================================

function displayInveriteData(data) {
    console.log('Displaying Inverite data:', data);
    
    // Calculate real total balance
    let totalBalance = 0;
    if (data.summary && data.summary.totalBalance !== undefined) {
        totalBalance = data.summary.totalBalance;
    } else if (data.accounts && data.accounts.length > 0) {
        totalBalance = data.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    }
    
    // If balance is 0, look in transactions
    if (totalBalance === 0 && data.transactions && data.transactions.length > 0) {
        const firstTxWithBalance = data.transactions.find(tx => tx.balance !== null && tx.balance !== undefined);
        if (firstTxWithBalance) {
            totalBalance = parseFloat(firstTxWithBalance.balance);
        }
    }
    
    // Display total balance
    document.getElementById('totalBalance').textContent = 
        `$${totalBalance.toLocaleString('en-CA', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;

    // Display accounts
    const accountsList = document.getElementById('accountsList');
    if (data.accounts && data.accounts.length > 0) {
        accountsList.innerHTML = data.accounts.map(account => {
            const balance = account.balance || totalBalance || 0;
            return `
                <div class="account-item">
                    <h3>${account.name || account.id}</h3>
                    <p style="color: #666; margin-bottom: 10px;">
                        ${account.type || 'Account'} - ${account.institution || account.bank || 'Bank'}
                    </p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">
                        $${balance.toLocaleString('en-CA', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}
                    </p>
                    <p style="color: #999; font-size: 0.9rem; margin-top: 5px;">
                        ${account.currency || 'CAD'}
                    </p>
                    ${account.transit ? `<p style="color: #888; font-size: 0.8rem;">Transit: ${account.transit}</p>` : ''}
                    ${account.account ? `<p style="color: #888; font-size: 0.8rem;">Account: ${account.account}</p>` : ''}
                </div>
            `;
        }).join('');
    } else {
        accountsList.innerHTML = '<div class="loading">No accounts found</div>';
    }

    // Display transactions
    const transactionsList = document.getElementById('transactionsList');
    if (data.transactions && data.transactions.length > 0) {
        transactionsList.innerHTML = data.transactions.slice(0, 50).map(tx => {
            let amount = 0;
            let isCredit = false;
            
            if (tx.credit !== null && tx.credit !== undefined) {
                amount = parseFloat(tx.credit);
                isCredit = true;
            } else if (tx.debit !== null && tx.debit !== undefined) {
                amount = parseFloat(tx.debit);
                isCredit = false;
            } else if (tx.amount !== null && tx.amount !== undefined) {
                amount = Math.abs(parseFloat(tx.amount));
                isCredit = parseFloat(tx.amount) > 0;
            }
            
            return `
                <div class="transaction-item">
                    <div class="transaction-details">
                        <div class="transaction-description">
                            ${tx.description || tx.details || 'Transaction'}
                        </div>
                        <div class="transaction-date">
                            ${new Date(tx.date).toLocaleDateString('en-CA')} 
                            ${tx.category ? `- ${tx.category}` : ''}
                        </div>
                    </div>
                    <div class="amount ${isCredit ? 'positive' : 'negative'}">
                        ${isCredit ? '+' : '-'}$${amount.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        transactionsList.innerHTML = '<div class="loading">No transactions found</div>';
    }
    
    // Calculate statistics if function exists
    if (typeof calculateStats === 'function') {
        calculateStats(data.transactions);
    }
}

// ========================================
// SHARED FUNCTIONS
// ========================================

function closeIframe() {
    document.getElementById('iframeContainer').classList.remove('active');
    document.getElementById('universalFrame').src = '';
    
    window.removeEventListener('message', handleFlinksCallback);
    window.removeEventListener('message', handleInveriteMessage);
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('connectionStatus');
    const statusMsg = document.getElementById('statusMessage');
    
    statusDiv.style.display = 'block';
    statusMsg.textContent = message;
    
    switch(type) {
        case 'success':
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            statusDiv.style.background = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.style.border = '1px solid #f5c6cb';
            break;
        case 'warning':
            statusDiv.style.background = '#fff3cd';
            statusDiv.style.color = '#856404';
            statusDiv.style.border = '1px solid #ffeaa7';
            break;
        default:
            statusDiv.style.background = '#d1ecf1';
            statusDiv.style.color = '#0c5460';
            statusDiv.style.border = '1px solid #bee5eb';
    }
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/flinks/accounts`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.accounts && data.accounts.length > 0) {
            displayAccountsData({
                accounts: data.accounts,
                transactions: data.transactions || [],
                summary: {
                    totalBalance: data.accounts.reduce((sum, acc) => 
                        sum + (acc.balance || 0), 0)
                }
            });
            
            if (data.lastSync) {
                document.getElementById('lastSync').textContent = 
                    `Last sync: ${new Date(data.lastSync).toLocaleString()}`;
                document.getElementById('connectBtn').style.display = 'none';
                document.getElementById('syncBtn').style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

function displayAccountsData(data) {
    const balance = data.summary?.totalBalance || 0;
    document.getElementById('totalBalance').textContent = 
        `$${balance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const accountsList = document.getElementById('accountsList');
    if (data.accounts && data.accounts.length > 0) {
        accountsList.innerHTML = data.accounts.map(account => `
            <div class="account-item">
                <h3>${account.name || account.id}</h3>
                <p style="color: #666; margin-bottom: 10px;">
                    ${account.type || 'Account'} - ${account.institution || account.bank || 'Bank'}
                </p>
                <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">
                    $${(account.balance || 0).toLocaleString('en-CA', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    })}
                </p>
                <p style="color: #999; font-size: 0.9rem; margin-top: 5px;">
                    ${account.currency || 'CAD'}
                </p>
            </div>
        `).join('');
    } else {
        accountsList.innerHTML = '<div class="loading">No accounts found</div>';
    }

    const transactionsList = document.getElementById('transactionsList');
    if (data.transactions && data.transactions.length > 0) {
        transactionsList.innerHTML = data.transactions.slice(0, 50).map(tx => `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-description">
                        ${tx.description || tx.details || 'Transaction'}
                    </div>
                    <div class="transaction-date">
                        ${new Date(tx.date).toLocaleDateString('en-CA')} 
                        ${tx.category ? `- ${tx.category}` : ''}
                    </div>
                </div>
                <div class="amount ${(tx.amount || tx.credit || 0) >= 0 ? 'positive' : 'negative'}">
                    ${tx.credit ? '+' : ''}${tx.debit ? '-' : ''}
                    $${Math.abs(tx.amount || tx.credit || tx.debit || 0).toFixed(2)}
                </div>
            </div>
        `).join('');
    } else {
        transactionsList.innerHTML = '<div class="loading">No transactions found</div>';
    }
}

function handleError(error) {
    console.error('Error:', error);
    if (error.response?.status === 401) {
        logout();
    }
}

// Utility function to reload Inverite data
window.refreshInveriteData = function() {
    fetchInveriteData('339703B7-9B97-4FDC-8727-D04357A08DAD');
}

console.log('🚀 CASHOO App v2.0 - Unified API');
console.log('💡 Tip: Use refreshInveriteData() to reload data');
