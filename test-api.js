// test-api.js - Script de test pour vérifier les endpoints API

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = 'test@cashoo.ai';
const TEST_PASSWORD = 'TestPassword123!';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

// Test results
let passed = 0;
let failed = 0;
let token = null;

// Helper function to test an endpoint
async function testEndpoint(name, method, endpoint, data = {}, headers = {}) {
    try {
        console.log(`${colors.blue}Testing: ${name}${colors.reset}`);
        
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (method !== 'GET') {
            config.data = data;
        }

        const response = await axios(config);
        
        console.log(`${colors.green}✓ ${name} - Success${colors.reset}`);
        console.log(`  Status: ${response.status}`);
        console.log(`  Response:`, response.data);
        passed++;
        
        return response.data;
    } catch (error) {
        console.log(`${colors.red}✗ ${name} - Failed${colors.reset}`);
        console.log(`  Error: ${error.response?.data?.error || error.message}`);
        failed++;
        return null;
    }
}

// Main test suite
async function runTests() {
    console.log(`${colors.yellow}========================================${colors.reset}`);
    console.log(`${colors.yellow}CASHOO API Test Suite${colors.reset}`);
    console.log(`${colors.yellow}========================================${colors.reset}\n`);

    // Test 1: Register
    console.log(`${colors.yellow}1. AUTHENTICATION TESTS${colors.reset}\n`);
    
    const registerData = await testEndpoint(
        'Register New User',
        'POST',
        '/api/auth/register',
        {
            email: TEST_EMAIL + '.' + Date.now(),
            password: TEST_PASSWORD,
            firstName: 'Test',
            lastName: 'User'
        }
    );

    if (registerData && registerData.token) {
        token = registerData.token;
    }

    // Test 2: Login
    const loginData = await testEndpoint(
        'Login User',
        'POST',
        '/api/auth/login',
        {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        }
    );

    if (loginData && loginData.token) {
        token = loginData.token;
    }

    // Test 3: Forgot Password
    await testEndpoint(
        'Forgot Password',
        'POST',
        '/api/auth/forgot',
        {
            email: TEST_EMAIL
        }
    );

    // Test 4: Flinks API (requires authentication)
    if (token) {
        console.log(`\n${colors.yellow}2. FLINKS API TESTS${colors.reset}\n`);
        
        await testEndpoint(
            'Get Flinks Data',
            'POST',
            '/api/flinks/getJson',
            {
                requestId: 'test-request-id-12345'
            },
            {
                'Authorization': `Bearer ${token}`
            }
        );
    }

    // Print summary
    console.log(`\n${colors.yellow}========================================${colors.reset}`);
    console.log(`${colors.yellow}TEST SUMMARY${colors.reset}`);
    console.log(`${colors.yellow}========================================${colors.reset}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`Total: ${passed + failed}`);
    
    if (failed === 0) {
        console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}`);
    } else {
        console.log(`\n${colors.red}⚠️  Some tests failed. Please check the errors above.${colors.reset}`);
    }
}

// Health check
async function healthCheck() {
    try {
        console.log(`${colors.blue}Checking API health...${colors.reset}`);
        const response = await axios.get(BASE_URL);
        console.log(`${colors.green}✓ API is running${colors.reset}\n`);
        return true;
    } catch (error) {
        console.log(`${colors.red}✗ API is not responding at ${BASE_URL}${colors.reset}`);
        console.log(`  Make sure the server is running with: npm run dev\n`);
        return false;
    }
}

// Run the tests
(async () => {
    const isHealthy = await healthCheck();
    if (isHealthy) {
        await runTests();
    }
    process.exit(failed > 0 ? 1 : 0);
})();
