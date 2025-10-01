// CASHOO Banking Dashboard - Main JavaScript

// ========================================
// CONFIGURATION
// ========================================
const API_URL = '/api';
const APP_NAME = 'CASHOO';

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

// Get stored auth token
function getAuthToken() {
    return localStorage.getItem('cashoo_token') || sessionStorage.getItem('cashoo_token');
}

// Get stored user
function getCurrentUser() {
    const userStr = localStorage.getItem('cashoo_user') || sessionStorage.getItem('cashoo_user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getAuthToken();
}

// Store authentication data
function storeAuthData(token, user, remember = true) {
    if (remember) {
        localStorage.setItem('cashoo_token', token);
        localStorage.setItem('cashoo_user', JSON.stringify(user));
    } else {
        sessionStorage.setItem('cashoo_token', token);
        sessionStorage.setItem('cashoo_user', JSON.stringify(user));
    }
}

// Clear authentication data
function clearAuthData() {
    localStorage.removeItem('cashoo_token');
    localStorage.removeItem('cashoo_user');
    sessionStorage.removeItem('cashoo_token');
    sessionStorage.removeItem('cashoo_user');
}

// Verify authentication
async function verifyAuth() {
    const token = getAuthToken();
    if (!token) return false;

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        return data.valid === true;
    } catch (error) {
        console.error('Auth verification failed:', error);
        return false;
    }
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    clearAuthData();
    window.location.href = '/login.html';
}

// ========================================
// API FUNCTIONS
// ========================================

// Generic API request function
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API request failed for ${endpoint}:`, error);
        throw error;
    }
}

// Login API call
async function loginAPI(email, password) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

// Register API call
async function registerAPI(userData) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
}

// Forgot password API call
async function forgotPasswordAPI(email) {
    return apiRequest('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
}

// Get Flinks data
async function getFlinksData(requestId) {
    return apiRequest('/flinks/getJson', {
        method: 'POST',
        body: JSON.stringify({ requestId })
    });
}

// Claude AI chat
async function claudeChat(message, context = {}) {
    return apiRequest('/claude/chat', {
        method: 'POST',
        body: JSON.stringify({ message, context })
    });
}

// ========================================
// UI FUNCTIONS
// ========================================

// Show loading state on button
function showButtonLoading(buttonId, loadingText = 'Loading...') {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="loading-spinner-small"></span> ${loadingText}`;
}

// Hide loading state on button
function hideButtonLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || 'Submit';
}

// Show alert message
function showAlert(message, type = 'info', containerId = 'alertBox') {
    const alertBox = document.getElementById(containerId);
    if (!alertBox) {
        console.warn(`Alert container ${containerId} not found`);
        return;
    }
    
    alertBox.className = `alert alert-${type} show`;
    alertBox.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 5000);
}

// Show/hide modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

// ========================================
// FORMATTING FUNCTIONS
// ========================================

// Format currency
function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
}

// Format date
function formatDate(dateStr, format = 'short') {
    const date = new Date(dateStr);
    
    if (format === 'short') {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } else if (format === 'long') {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        return date.toLocaleDateString();
    }
}

// Format relative time
function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// ========================================
// VALIDATION FUNCTIONS
// ========================================

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate password strength
function validatePassword(password) {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    return {
        isValid: minLength && hasUpper && hasLower && hasNumber,
        strength: [minLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length,
        details: {
            minLength,
            hasUpper,
            hasLower,
            hasNumber,
            hasSpecial
        }
    };
}

// ========================================
// FINANCIAL ANALYSIS FUNCTIONS
// ========================================

// Calculate monthly stats from transactions
function calculateMonthlyStats(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let income = 0;
    let expenses = 0;
    
    transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            const amount = tx.amount || tx.credit || -(tx.debit || 0);
            if (amount > 0) {
                income += amount;
            } else {
                expenses += Math.abs(amount);
            }
        }
    });
    
    return {
        income,
        expenses,
        netCashFlow: income - expenses
    };
}

// Categorize transaction
function categorizeTransaction(description) {
    if (!description) return 'Other';
    
    const desc = description.toLowerCase();
    
    const categories = {
        'Groceries': ['grocery', 'walmart', 'metro', 'loblaws', 'sobeys'],
        'Dining': ['restaurant', 'cafe', 'coffee', 'tim hortons', 'mcdonald', 'subway'],
        'Transport': ['gas', 'petro', 'esso', 'shell', 'uber', 'lyft', 'parking'],
        'Utilities': ['hydro', 'electricity', 'water', 'internet', 'phone', 'bell', 'rogers'],
        'Housing': ['rent', 'mortgage', 'property'],
        'Entertainment': ['netflix', 'spotify', 'cinema', 'movie', 'game'],
        'Shopping': ['amazon', 'ebay', 'store', 'mall'],
        'Healthcare': ['pharmacy', 'doctor', 'hospital', 'dental'],
        'Income': ['payroll', 'salary', 'deposit', 'transfer in'],
        'Fees': ['fee', 'charge', 'nsf', 'interest'],
        'ATM': ['atm', 'withdrawal', 'cash']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            return category;
        }
    }
    
    return 'Other';
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize page based on authentication status
async function initializePage() {
    const isAuthPage = window.location.pathname.includes('login') || 
                      window.location.pathname.includes('register') || 
                      window.location.pathname.includes('forgot');
    
    if (!isAuthPage) {
        // Protected pages - require authentication
        const isValid = await verifyAuth();
        if (!isValid) {
            window.location.href = '/login.html';
            return;
        }
        
        // Load user info
        const user = getCurrentUser();
        if (user) {
            updateUserDisplay(user);
        }
    } else {
        // Auth pages - redirect if already logged in
        if (isAuthenticated()) {
            const isValid = await verifyAuth();
            if (isValid) {
                window.location.href = '/dashboard.html';
            }
        }
    }
}

// Update user display in header
function updateUserDisplay(user) {
    const emailElement = document.getElementById('userEmail');
    const avatarElement = document.getElementById('userAvatar');
    
    if (emailElement) {
        emailElement.textContent = user.email;
    }
    
    if (avatarElement) {
        const initials = user.email.substring(0, 2).toUpperCase();
        avatarElement.textContent = initials;
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    console.log(`🚀 ${APP_NAME} initialized`);
    initializePage();
});

// Handle modal close clicks
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
    if (e.target.classList.contains('modal-close')) {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
});

// ========================================
// EXPORTS (for use in other scripts)
// ========================================
window.CASHOO = {
    // Auth functions
    getAuthToken,
    getCurrentUser,
    isAuthenticated,
    storeAuthData,
    clearAuthData,
    verifyAuth,
    requireAuth,
    logout,
    
    // API functions
    apiRequest,
    loginAPI,
    registerAPI,
    forgotPasswordAPI,
    getFlinksData,
    claudeChat,
    
    // UI functions
    showAlert,
    showModal,
    hideModal,
    showButtonLoading,
    hideButtonLoading,
    togglePasswordVisibility,
    
    // Formatting functions
    formatCurrency,
    formatDate,
    formatRelativeTime,
    
    // Validation functions
    validateEmail,
    validatePassword,
    
    // Financial functions
    calculateMonthlyStats,
    categorizeTransaction
};
