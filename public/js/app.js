// CASHOO Banking Dashboard - JavaScript avec Flinks + Inverite
// Configuration
const API_URL = '/api';
let authToken = localStorage.getItem('cashoo_token');
let currentUser = null;
let loginId = null;
let currentProvider = null; // 'flinks' ou 'inverite'

// Vérifier l'authentification au chargement
window.onload = () => {
    console.log('App loaded. Token exists:', !!authToken);
    if (authToken) {
        verifyAuth();
    }
};

// ========================================
// AUTHENTICATION
// ========================================

// Fonction de connexion
async function login(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const button = document.getElementById('loginBtn');
    const message = document.getElementById('loginMessage');

    button.disabled = true;
    button.textContent = 'Logging in...';
    message.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
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
        button.textContent = 'Access Dashboard';
    }
}

// Vérifier l'authentification
async function verifyAuth() {
    console.log('Verifying authentication...');
    
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
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
            loadAccounts();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        logout();
    }
}

// Déconnexion
function logout() {
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

// Afficher le tableau de bord
function showDashboard() {
    console.log('Showing dashboard');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userEmail').textContent = currentUser.email;
    loadAccounts();
}

// ========================================
// FLINKS INTEGRATION
// ========================================

// Connecter un compte bancaire via Flinks
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
            // Ouvrir l'iframe Flinks
            document.getElementById('iframeTitle').textContent = 'Flinks Bank Connection';
            document.getElementById('universalFrame').src = data.url;
            document.getElementById('iframeContainer').classList.add('active');
            
            // Écouter le callback Flinks
            window.addEventListener('message', handleFlinksCallback);
            showStatus('Please complete the connection in the popup', 'info');
        } else {
            throw new Error('Failed to get Flinks URL');
        }
    } catch (error) {
        console.error('Flinks connection error:', error);
        showStatus('Failed to connect to Flinks', 'error');
    }
}

// Gérer le callback Flinks
function handleFlinksCallback(event) {
    // Vérifier si le message vient de Flinks
    if (event.data && event.data.loginId) {
        loginId = event.data.loginId;
        closeIframe();
        syncAccounts();
        showStatus('Flinks connected successfully! Syncing accounts...', 'success');
    } else if (event.data && event.data.error) {
        showStatus('Flinks connection failed: ' + event.data.error, 'error');
        closeIframe();
    }
}

// Synchroniser les comptes avec Flinks
async function syncAccounts() {
    if (!loginId) {
        // Pour les tests, demander le loginId
        loginId = prompt('Enter your Flinks LoginId (or use "demo" for demo data):');
        if (!loginId) return;
    }

    const syncBtn = document.getElementById('syncBtn');
    const connectBtn = document.getElementById('connectBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    showStatus('Syncing your accounts...', 'info');

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
                `Last synced: ${new Date(data.syncTime).toLocaleString()}`;
            connectBtn.style.display = 'none';
            syncBtn.style.display = 'inline-block';
            
            if (data.demo) {
                showStatus('Demo data loaded (Flinks API unavailable)', 'warning');
            } else {
                showStatus('Accounts synced successfully!', 'success');
            }
        } else {
            throw new Error(data.error || 'Sync failed');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showStatus(`Sync failed: ${error.message}`, 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Refresh Data';
    }
}

// ========================================
// INVERITE INTEGRATION
// ========================================

// Connecter via Inverite
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
            // Ouvrir l'iframe Inverite
            document.getElementById('iframeTitle').textContent = 'Inverite Bank Verification';
            document.getElementById('universalFrame').src = data.iframeUrl;
            document.getElementById('iframeContainer').classList.add('active');
            
            // Écouter les messages Inverite
            window.addEventListener('message', handleInveriteMessage);
            showStatus('Please complete verification in the popup', 'info');
        } else {
            throw new Error('Failed to get Inverite URL');
        }
    } catch (error) {
        console.error('Inverite connection error:', error);
        showStatus('Failed to connect to Inverite', 'error');
    }
}

// Gérer les callbacks Inverite
function handleInveriteMessage(event) {
    // Vérifier si le message vient d'Inverite
    if (event.origin.includes('inverite.com')) {
        console.log('Inverite message received:', event.data);
        
        // Gérer les différents types de messages Inverite
        if (event.data === 'success') {
            console.log('Inverite verification successful!');
            closeIframe();
            showStatus('Inverite verification completed! Fetching data...', 'success');
            
            // Récupérer le GUID de la requête
            // Le GUID est dans l'URL : 339703B7-9B97-4FDC-8727-D04357A08DAD
            fetchInveriteData('339703B7-9B97-4FDC-8727-D04357A08DAD');
            
        } else if (event.data.type === 'ibv.request.completed') {
            // Nouveau format de message avec le GUID
            const guid = event.data.content?.request?.guid;
            console.log('Inverite completed with GUID:', guid);
            closeIframe();
            showStatus('Inverite verification completed! Fetching data...', 'success');
            
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

// Récupérer les données Inverite
async function fetchInveriteData(guid) {
    showStatus('Fetching verification data...', 'info');
    
    try {
        // Si on a un GUID, l'envoyer avec la requête
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
            displayAccountsData({
                accounts: data.accounts,
                transactions: data.transactions || [],
                summary: data.summary || {
                    totalBalance: data.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
                }
            });
            
            document.getElementById('lastSync').textContent = 
                `Verified via Inverite: ${new Date().toLocaleString()}`;
            showStatus('Verification data loaded successfully!', 'success');
            
            // Masquer le bouton Connect et afficher Refresh
            document.getElementById('connectBtn').style.display = 'none';
            document.getElementById('inveriteBtn').style.display = 'none';
            document.getElementById('syncBtn').style.display = 'inline-block';
            
        } else if (data.error) {
            showStatus('Error: ' + data.error, 'error');
        } else {
            showStatus('No verification data available yet. Try again in a few seconds.', 'warning');
            // Réessayer après 3 secondes
            setTimeout(() => fetchInveriteData(guid), 3000);
        }
    } catch (error) {
        console.error('Failed to fetch Inverite data:', error);
        showStatus('Failed to fetch verification data: ' + error.message, 'error');
    }
}

// ========================================
// SHARED FUNCTIONS
// ========================================

// Fermer l'iframe (universel)
function closeIframe() {
    document.getElementById('iframeContainer').classList.remove('active');
    document.getElementById('universalFrame').src = '';
    
    // Retirer tous les listeners
    window.removeEventListener('message', handleFlinksCallback);
    window.removeEventListener('message', handleInveriteMessage);
}

// Afficher un message de statut
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('connectionStatus');
    const statusMsg = document.getElementById('statusMessage');
    
    statusDiv.style.display = 'block';
    statusMsg.textContent = message;
    
    // Appliquer le style selon le type
    statusDiv.className = '';
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
    
    // Masquer après 5 secondes pour les messages de succès
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Charger les comptes en cache
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
                    `Last synced: ${new Date(data.lastSync).toLocaleString()}`;
                document.getElementById('connectBtn').style.display = 'none';
                document.getElementById('syncBtn').style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

// Afficher les données des comptes (universel)
function displayAccountsData(data) {
    // Mettre à jour le solde total
    const balance = data.summary?.totalBalance || 0;
    document.getElementById('totalBalance').textContent = 
        `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Afficher les comptes
    const accountsList = document.getElementById('accountsList');
    if (data.accounts && data.accounts.length > 0) {
        accountsList.innerHTML = data.accounts.map(account => `
            <div class="account-item">
                <h3>${account.name || account.id}</h3>
                <p style="color: #666; margin-bottom: 10px;">
                    ${account.type || 'Account'} - ${account.institution || account.bank || 'Bank'}
                </p>
                <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">
                    $${(account.balance || 0).toLocaleString('en-US', { 
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
        `).join('');
    } else {
        accountsList.innerHTML = '<div class="loading">No accounts found</div>';
    }

    // Afficher les transactions
    const transactionsList = document.getElementById('transactionsList');
    if (data.transactions && data.transactions.length > 0) {
        transactionsList.innerHTML = data.transactions.slice(0, 50).map(tx => `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-description">
                        ${tx.description || tx.details || 'Transaction'}
                    </div>
                    <div class="transaction-date">
                        ${new Date(tx.date).toLocaleDateString()} 
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

// Fonction utilitaire pour les erreurs
function handleError(error) {
    console.error('Error:', error);
    if (error.response?.status === 401) {
        logout();
    }
}

// Test de connexion au chargement
console.log('CASHOO App initialized with Flinks + Inverite support');
