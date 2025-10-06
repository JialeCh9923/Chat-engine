const ChatEngineAPI = require('./api-client');

/**
 * Portal Integration Test
 * Simple test to verify portal connectivity and API integration
 */

class PortalTest {
    constructor() {
        this.api = new ChatEngineAPI();
        this.tests = [];
        this.results = [];
    }

    async runTests() {
        console.log('🚀 Starting Portal Integration Tests...\n');
        
        // Test 1: API Connection
        await this.testConnection();
        
        // Test 2: Health Check
        await this.testHealthCheck();
        
        // Test 3: Session Management
        await this.testSessionManagement();
        
        // Test 4: API Key Validation
        await this.testApiKeyValidation();
        
        // Test 5: Error Handling
        await this.testErrorHandling();
        
        // Display results
        this.displayResults();
    }

    async testConnection() {
        console.log('📡 Testing API Connection...');
        try {
            const response = await fetch('http://localhost:3000/api/health');
            const data = await response.json();
            
            if (response.ok && data.status === 'healthy') {
                this.addResult('Connection Test', true, 'API server is accessible');
                console.log('✅ API Connection: SUCCESS');
            } else {
                this.addResult('Connection Test', false, 'API server returned unexpected response');
                console.log('❌ API Connection: FAILED');
            }
        } catch (error) {
            this.addResult('Connection Test', false, error.message);
            console.log('❌ API Connection: FAILED -', error.message);
        }
    }

    async testHealthCheck() {
        console.log('🏥 Testing Health Check Endpoint...');
        try {
            const health = await this.api.checkHealth();
            
            if (health.status === 'healthy') {
                this.addResult('Health Check', true, 'All services are healthy');
                console.log('✅ Health Check: SUCCESS');
            } else {
                this.addResult('Health Check', false, 'Health check returned unhealthy status');
                console.log('❌ Health Check: FAILED');
            }
        } catch (error) {
            this.addResult('Health Check', false, error.message);
            console.log('❌ Health Check: FAILED -', error.message);
        }
    }

    async testSessionManagement() {
        console.log('📋 Testing Session Management...');
        try {
            // Test session creation
            const session = await this.api.createSession({
                title: 'Test Session',
                description: 'Portal integration test session',
                status: 'active'
            });
            
            if (session.id) {
                this.addResult('Session Creation', true, 'Session created successfully');
                console.log('✅ Session Creation: SUCCESS');
                
                // Test session retrieval
                const retrieved = await this.api.getSession(session.id);
                if (retrieved.id === session.id) {
                    this.addResult('Session Retrieval', true, 'Session retrieved successfully');
                    console.log('✅ Session Retrieval: SUCCESS');
                } else {
                    this.addResult('Session Retrieval', false, 'Session retrieval failed');
                    console.log('❌ Session Retrieval: FAILED');
                }
                
                // Test session listing
                const sessions = await this.api.getSessions();
                if (Array.isArray(sessions)) {
                    this.addResult('Session Listing', true, 'Sessions listed successfully');
                    console.log('✅ Session Listing: SUCCESS');
                } else {
                    this.addResult('Session Listing', false, 'Session listing failed');
                    console.log('❌ Session Listing: FAILED');
                }
                
                // Test session deletion
                await this.api.deleteSession(session.id);
                this.addResult('Session Deletion', true, 'Session deleted successfully');
                console.log('✅ Session Deletion: SUCCESS');
                
            } else {
                this.addResult('Session Creation', false, 'Session creation failed');
                console.log('❌ Session Creation: FAILED');
            }
        } catch (error) {
            this.addResult('Session Management', false, error.message);
            console.log('❌ Session Management: FAILED -', error.message);
        }
    }

    async testApiKeyValidation() {
        console.log('🔑 Testing API Key Validation...');
        
        // Test valid API key format
        const validKey = 'test-api-key-12345';
        const isValid = this.api.validateApiKey(validKey);
        
        if (isValid) {
            this.addResult('API Key Validation', true, 'Valid API key format accepted');
            console.log('✅ API Key Validation: SUCCESS');
        } else {
            this.addResult('API Key Validation', false, 'Valid API key format rejected');
            console.log('❌ API Key Validation: FAILED');
        }
        
        // Test invalid API key format
        const invalidKey = 'short';
        const isInvalid = !this.api.validateApiKey(invalidKey);
        
        if (isInvalid) {
            this.addResult('Invalid Key Rejection', true, 'Invalid API key format rejected');
            console.log('✅ Invalid Key Rejection: SUCCESS');
        } else {
            this.addResult('Invalid Key Rejection', false, 'Invalid API key format accepted');
            console.log('❌ Invalid Key Rejection: FAILED');
        }
    }

    async testErrorHandling() {
        console.log('⚠️ Testing Error Handling...');
        
        // Test error handling with invalid endpoint
        try {
            await this.api.request('/invalid-endpoint');
            this.addResult('Error Handling', false, 'Invalid endpoint did not throw error');
            console.log('❌ Error Handling: FAILED');
        } catch (error) {
            this.addResult('Error Handling', true, 'Invalid endpoint properly handled');
            console.log('✅ Error Handling: SUCCESS');
        }
        
        // Test error message formatting
        const errorResult = this.api.handleError(new Error('Test error'), 'Test Context');
        
        if (errorResult.success === false && errorResult.error && errorResult.context) {
            this.addResult('Error Formatting', true, 'Error properly formatted');
            console.log('✅ Error Formatting: SUCCESS');
        } else {
            this.addResult('Error Formatting', false, 'Error formatting failed');
            console.log('❌ Error Formatting: FAILED');
        }
    }

    addResult(testName, success, message) {
        this.results.push({
            name: testName,
            success: success,
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    displayResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' .repeat(50));
        
        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        const total = this.results.length;
        
        this.results.forEach(result => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - ${result.name}: ${result.message}`);
        });
        
        console.log('\n' + '=' .repeat(50));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Portal integration is working correctly.');
        } else {
            console.log(`\n⚠️ ${failed} test(s) failed. Please check the error messages above.`);
        }
        
        // Display portal usage instructions
        console.log('\n🚀 Portal Usage Instructions:');
        console.log('1. Open portal/index.html in your browser');
        console.log('2. Click "Connect API Key" and enter any key (minimum 10 characters)');
        console.log('3. Click "Create Session" to start a new tax filing session');
        console.log('4. Use the navigation to explore all features');
        console.log('5. Check the Real-time section for live updates');
    }
}

// Run tests when script loads
if (typeof window !== 'undefined') {
    // Browser environment
    window.runPortalTests = () => {
        const tester = new PortalTest();
        tester.runTests();
    };
} else {
    // Node.js environment
    const tester = new PortalTest();
    tester.runTests().then(() => {
        console.log('\n✨ Portal integration test completed!');
    });
}