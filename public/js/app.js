// CASHOO Banking Dashboard - JavaScript
// Adapté pour les API serverless Vercel

// Configuration
const API_URL = '/api'; // Utilise les API serverless Vercel
let authToken = localStorage.getItem('cashoo_token');
let currentUser = null;
let loginId = null;

// Vérifier l'authentification au chargement
window.onload = () => {
    if (authToken) {
        verifyAuth();
    }
};

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
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.valid) {
            currentUser = { id: data.userId, email: data.email };
            showDashboard();
            loadAccounts();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

// Afficher le tableau de bord
function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userEmail').textContent = currentUser.email;
    loadAccounts();
}

// Déconnexion
function logout() {
    localStorage.removeItem('cashoo_token');
    authToken = null;
    currentUser = null;
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('email').value = '';
    document.getElementById('loginMessage').innerHTML = '';
    
    // Appel optionnel à l'API de logout
    if (authToken) {
        fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        }).catch(() => {});
    }
}

// Connecter un compte bancaire via Flinks
async function connectBank() {
    try {
        const response = await fetch(`${API_URL}/flinks/connect`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        
        if (data.url) {
            // Ouvrir l'iframe Flinks
            document.getElementById('flinksFrame').src = data.url;
            document.getElementById('iframeContainer').classList.add('active');
            
            // Écouter le callback Flinks
            window.addEventListener('message', handleFlinksCallback);
        }
    } catch (error) {
        alert('Failed to connect to banking service');
    }
}

// Gérer le callback Flinks
function handleFlinksCallback(event) {
    // Vérifier si le message vient de Flinks
    if (event.data && event.data.loginId) {
        loginId = event.data.loginId;
        closeFlinks();
        syncAccounts();
    }
}

// Fermer l'iframe Flinks
function closeFlinks() {
    document.getElementById('iframeContainer').classList.remove('active');
    document.getElementById('flinksFrame').src = '';
    window.removeEventListener('message', handleFlinksCallback);
}

// Synchroniser les comptes avec Flinks
async function syncAccounts() {
    if (!loginId) {
        // Pour les tests, demander le loginId
        loginId = prompt('Enter your Flinks LoginId:');
        if (!loginId) return;
    }

    const syncBtn = document.getElementById('syncBtn');
    const connectBtn = document.getElementById('connectBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';

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
        } else {
            throw new Error(data.error || 'Sync failed');
        }
    } catch (error) {
        alert(`Sync failed: ${error.message}`);
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Refresh Data';
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
                transactions: data.transactions,
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

// Afficher les données des comptes
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
                <p style="color: #666; margin-bottom: 10px;">${account.type} - ${account.institution || 'Bank'}</p>
                <p style="font-size: 1.5rem; font-weight: bold; color: #667eea;">
                    $${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p style="color: #999; font-size: 0.9rem; margin-top: 5px;">${account.currency || 'CAD'}</p>
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
                    <div class="transaction-description">${tx.description || 'Transaction'}</div>
                    <div class="transaction-date">${new Date(tx.date).toLocaleDateString()} - ${tx.category || 'Other'}</div>
                </div>
                <div class="amount ${tx.amount >= 0 ? 'positive' : 'negative'}">
                    ${tx.amount >= 0 ? '+' : ''}$${Math.abs(tx.amount).toFixed(2)}
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

