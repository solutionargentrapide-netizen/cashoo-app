// CASHOO Banking Dashboard - JavaScript Corrigé
// Version complète avec gestion d'authentification

// Configuration
const API_URL = '/api';
let authToken = localStorage.getItem('cashoo_token');
let currentUser = null;
let loginId = null;

// Vérifier l'authentification au chargement
window.onload = () => {
    console.log('App loaded. Token exists:', !!authToken);
    
    // Si on a un token, vérifier s'il est valide
    if (authToken) {
        verifyAuth();
    } else {
        // Pas de token, afficher le formulaire de login
        showLoginForm();
    }
};

// Fonction de connexion
async function login(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password') ? document.getElementById('password').value : '';
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
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Connexion réussie
            authToken = data.token;
            currentUser = data.user;
            
            // Sauvegarder le token
            localStorage.setItem('cashoo_token', authToken);
            localStorage.setItem('cashoo_user', JSON.stringify(currentUser));
            
            message.innerHTML = '<div class="success">Login successful!</div>';
            
            // Afficher le dashboard après un court délai
            setTimeout(() => {
                showDashboard();
            }, 500);
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        message.innerHTML = `<div class="error">${error.message}</div>`;
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
            // Token valide, afficher le dashboard
            currentUser = { 
                id: data.userId, 
                email: data.email 
            };
            localStorage.setItem('cashoo_user', JSON.stringify(currentUser));
            showDashboard();
            loadAccounts();
        } else {
            // Token invalide, retour au login
            console.log('Token invalid, showing login form');
            logout();
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        logout();
    }
}

// Afficher le formulaire de login
function showLoginForm() {
    console.log('Showing login form');
    const loginForm = document.getElementById('loginForm');
    const dashboard = document.getElementById('dashboard');
    
    if (loginForm) loginForm.style.display = 'block';
    if (dashboard) {
        dashboard.style.display = 'none';
        dashboard.classList.remove('active');
    }
}

// Afficher le tableau de bord
function showDashboard() {
    console.log('Showing dashboard');
    const loginForm = document.getElementById('loginForm');
    const dashboard = document.getElementById('dashboard');
    
    if (loginForm) loginForm.style.display = 'none';
    if (dashboard) {
        dashboard.style.display = 'block';
        dashboard.classList.add('active');
    }
    
    // Afficher l'email de l'utilisateur
    if (currentUser && currentUser.email) {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
    }
    
    // Charger les comptes
    loadAccounts();
}

// Déconnexion
function logout() {
    console.log('Logging out...');
    
    // Effacer les données locales
    localStorage.removeItem('cashoo_token');
    localStorage.removeItem('cashoo_user');
    authToken = null;
    currentUser = null;
    
    // Réinitialiser l'interface
    showLoginForm();
    
    // Réinitialiser les champs
    const emailField = document.getElementById('email');
    if (emailField) emailField.value = '';
    
    const loginMessage = document.getElementById('loginMessage');
    if (loginMessage) loginMessage.innerHTML = '';
}

// Connecter un compte bancaire via Flinks
async function connectBank() {
    if (!authToken) {
        alert('Please login first');
        return;
    }

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
        console.error('Failed to connect to banking service:', error);
        alert('Failed to connect to banking service');
    }
}

// Gérer le callback Flinks
function handleFlinksCallback(event) {
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
    if (!authToken) {
        alert('Please login first');
        return;
    }

    if (!loginId) {
        loginId = prompt('Enter your Flinks LoginId:');
        if (!loginId) return;
    }

    const syncBtn = document.getElementById('syncBtn');
    const connectBtn = document.getElementById('connectBtn');
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
    }

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
            
            const lastSyncElement = document.getElementById('lastSync');
            if (lastSyncElement) {
                lastSyncElement.textContent = `Last synced: ${new Date(data.syncTime).toLocaleString()}`;
            }
            
            if (connectBtn) connectBtn.style.display = 'none';
            if (syncBtn) {
                syncBtn.style.display = 'inline-block';
                syncBtn.disabled = false;
                syncBtn.textContent = 'Refresh Data';
            }
        } else {
            throw new Error(data.error || 'Sync failed');
        }
    } catch (error) {
        console.error('Sync failed:', error);
        alert(`Sync failed: ${error.message}`);
        
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Refresh Data';
        }
    }
}

// Charger les comptes en cache
async function loadAccounts() {
    if (!authToken) return;

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
                const lastSyncElement = document.getElementById('lastSync');
                if (lastSyncElement) {
                    lastSyncElement.textContent = `Last synced: ${new Date(data.lastSync).toLocaleString()}`;
                }
                
                const connectBtn = document.getElementById('connectBtn');
                const syncBtn = document.getElementById('syncBtn');
                if (connectBtn) connectBtn.style.display = 'none';
                if (syncBtn) syncBtn.style.display = 'inline-block';
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
    const totalBalanceElement = document.getElementById('totalBalance');
    if (totalBalanceElement) {
        totalBalanceElement.textContent = `$${balance.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }

    // Afficher les comptes
    const accountsList = document.getElementById('accountsList');
    if (accountsList) {
        if (data.accounts && data.accounts.length > 0) {
            accountsList.innerHTML = data.accounts.map(account => `
                <div class="account-item">
                    <h3>${account.name || account.id}</h3>
                    <p style="color: #666; margin-bottom: 10px;">
                        ${account.type} - ${account.institution || 'Bank'}
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
                </div>
            `).join('');
        } else {
            accountsList.innerHTML = '<div class="loading">No accounts connected yet</div>';
        }
    }

    // Afficher les transactions
    const transactionsList = document.getElementById('transactionsList');
    if (transactionsList) {
        if (data.transactions && data.transactions.length > 0) {
            transactionsList.innerHTML = data.transactions.slice(0, 50).map(tx => `
                <div class="transaction-item">
                    <div class="transaction-details">
                        <div class="transaction-description">
                            ${tx.description || 'Transaction'}
                        </div>
                        <div class="transaction-date">
                            ${new Date(tx.date).toLocaleDateString()} - ${tx.category || 'Other'}
                        </div>
                    </div>
                    <div class="amount ${tx.amount >= 0 ? 'positive' : 'negative'}">
                        ${tx.amount >= 0 ? '+' : ''}$${Math.abs(tx.amount).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } else {
            transactionsList.innerHTML = '<div class="loading">No transactions available</div>';
        }
    }
}

// Fonction utilitaire pour les erreurs
function handleError(error) {
    console.error('Error:', error);
    if (error.response?.status === 401) {
        logout();
    }
}

// Export des fonctions pour l'utilisation globale
window.login = login;
window.logout = logout;
window.connectBank = connectBank;
window.syncAccounts = syncAccounts;
window.closeFlinks = closeFlinks;
