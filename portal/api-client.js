/**
 * Chat Engine Tax Filing API Client
 * Comprehensive client for all API endpoints
 */

class ChatEngineAPI {
    constructor(baseURL = 'http://localhost:3000/api', apiKey = null) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.sessionId = null;
        this.eventSource = null;
        this.eventListeners = new Map();
    }

    // Authentication and Headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }
        
        if (this.sessionId) {
            headers['X-Session-Id'] = this.sessionId;
        }
        
        return headers;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('apiKey', apiKey);
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('sessionId', sessionId);
    }

    loadStoredCredentials() {
        const storedApiKey = localStorage.getItem('apiKey');
        const storedSessionId = localStorage.getItem('sessionId');
        
        if (storedApiKey) {
            this.apiKey = storedApiKey;
        }
        
        if (storedSessionId) {
            this.sessionId = storedSessionId;
        }
    }

    // Generic API Request Method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || error.message || `HTTP ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            throw error;
        }
    }

    // Health Check Endpoints
    async checkHealth() {
        return await this.request('/health');
    }

    async checkServiceHealth(service) {
        const endpoints = {
            sessions: '/sessions/health',
            conversations: '/conversations/health',
            documents: '/documents/health',
            jobs: '/jobs/health',
            taxForms: '/tax-forms/health',
            clients: '/clients/health',
            sse: '/sse/health'
        };
        
        return await this.request(endpoints[service]);
    }

    // Session Management
    async createSession(sessionData) {
        return await this.request('/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
    }

    async getSessions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/sessions${query ? '?' + query : ''}`);
    }

    async getSession(sessionId) {
        return await this.request(`/sessions/${sessionId}`);
    }

    async updateSession(sessionId, updateData) {
        return await this.request(`/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteSession(sessionId) {
        return await this.request(`/sessions/${sessionId}`, {
            method: 'DELETE'
        });
    }

    async getSessionStats() {
        return await this.request('/sessions/stats');
    }

    // Conversation Management
    async createConversation(conversationData) {
        return await this.request('/conversations', {
            method: 'POST',
            body: JSON.stringify(conversationData)
        });
    }

    async getConversations(sessionId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/conversations${query ? '?' + query : ''}`);
    }

    async getConversation(conversationId) {
        return await this.request(`/conversations/${conversationId}`);
    }

    async updateConversation(conversationId, updateData) {
        return await this.request(`/conversations/${conversationId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteConversation(conversationId) {
        return await this.request(`/conversations/${conversationId}`, {
            method: 'DELETE'
        });
    }

    async sendMessage(conversationId, message) {
        return await this.request(`/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    async getConversationStats() {
        return await this.request('/conversations/stats');
    }

    // Document Management
    async uploadDocument(file, sessionId, metadata = {}) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        if (metadata) {
            formData.append('metadata', JSON.stringify(metadata));
        }

        return await this.request('/documents/upload', {
            method: 'POST',
            body: formData,
            headers: {
                'X-API-Key': this.apiKey,
                'X-Session-Id': sessionId
            }
        });
    }

    async getDocuments(sessionId, params = {}) {
        const query = new URLSearchParams({ sessionId, ...params }).toString();
        return await this.request(`/documents${query ? '?' + query : ''}`);
    }

    async getDocument(documentId) {
        return await this.request(`/documents/${documentId}`);
    }

    async deleteDocument(documentId) {
        return await this.request(`/documents/${documentId}`, {
            method: 'DELETE'
        });
    }

    async processDocument(documentId) {
        return await this.request(`/documents/${documentId}/process`, {
            method: 'POST'
        });
    }

    // Job Management
    async createJob(jobData) {
        return await this.request('/jobs', {
            method: 'POST',
            body: JSON.stringify(jobData)
        });
    }

    async getJobs(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/jobs${query ? '?' + query : ''}`);
    }

    async getJob(jobId) {
        return await this.request(`/jobs/${jobId}`);
    }

    async cancelJob(jobId) {
        return await this.request(`/jobs/${jobId}/cancel`, {
            method: 'POST'
        });
    }

    async getJobQueueStats() {
        return await this.request('/jobs/queue/stats');
    }

    // Tax Form Management
    async createTaxForm(sessionId, formData) {
        return await this.request(`/tax-forms/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify(formData)
        });
    }

    async getTaxForm(formId) {
        return await this.request(`/tax-forms/${formId}`);
    }

    async getTaxFormsBySession(sessionId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/tax-forms/session/${sessionId}${query ? '?' + query : ''}`);
    }

    async updateTaxForm(formId, updateData) {
        return await this.request(`/tax-forms/${formId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteTaxForm(formId) {
        return await this.request(`/tax-forms/${formId}`, {
            method: 'DELETE'
        });
    }

    async calculateTaxes(formId) {
        return await this.request(`/tax-forms/${formId}/calculate`, {
            method: 'POST'
        });
    }

    async generateFormSuggestions(sessionId) {
        return await this.request(`/tax-forms/session/${sessionId}/suggestions`, {
            method: 'POST'
        });
    }

    async validateCalculations(formId) {
        return await this.request(`/tax-forms/${formId}/validate`, {
            method: 'POST'
        });
    }

    async exportTaxForm(formId, format = 'json') {
        return await this.request(`/tax-forms/${formId}/export?format=${format}`);
    }

    async importTaxForm(sessionId, importData) {
        return await this.request(`/tax-forms/session/${sessionId}/import`, {
            method: 'POST',
            body: JSON.stringify(importData)
        });
    }

    async getTaxFormStats() {
        return await this.request('/tax-forms/stats');
    }

    // Client Management
    async createClient(clientData) {
        return await this.request('/clients', {
            method: 'POST',
            body: JSON.stringify(clientData)
        });
    }

    async getClients(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/clients${query ? '?' + query : ''}`);
    }

    async getClient(clientId) {
        return await this.request(`/clients/${clientId}`);
    }

    async updateClient(clientId, updateData) {
        return await this.request(`/clients/${clientId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteClient(clientId) {
        return await this.request(`/clients/${clientId}`, {
            method: 'DELETE'
        });
    }

    // Server-Sent Events (SSE)
    connectSSE(sessionId = null) {
        if (this.eventSource) {
            this.disconnectSSE();
        }

        const url = new URL(`${this.baseURL}/sse/connect`);
        if (sessionId) {
            url.searchParams.append('sessionId', sessionId);
        }

        this.eventSource = new EventSource(url.toString(), {
            headers: this.getHeaders()
        });

        this.eventSource.onopen = () => {
            console.log('SSE connection established');
            this.dispatchEvent('connected');
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            this.dispatchEvent('error', error);
        };

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.dispatchEvent('message', data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        // Handle specific event types
        const eventTypes = ['job_update', 'document_processed', 'conversation_update', 'tax_form_update', 'session_update'];
        eventTypes.forEach(eventType => {
            this.eventSource.addEventListener(eventType, (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.dispatchEvent(eventType, data);
                } catch (error) {
                    console.error(`Failed to parse ${eventType} event:`, error);
                }
            });
        });

        return this.eventSource;
    }

    disconnectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.dispatchEvent('disconnected');
        }
    }

    isSSEConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }

    // Event handling for SSE
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    dispatchEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    formatDuration(startDate, endDate) {
        const duration = new Date(endDate) - new Date(startDate);
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Validation helpers
    validateApiKey(apiKey) {
        return apiKey && apiKey.length >= 10;
    }

    validateSessionId(sessionId) {
        return sessionId && /^[a-zA-Z0-9_-]+$/.test(sessionId);
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Error handling
    handleError(error, context = '') {
        console.error(`API Error ${context}:`, error);
        
        let message = 'An unexpected error occurred';
        
        if (error instanceof Error) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        } else if (error && error.message) {
            message = error.message;
        }
        
        return {
            success: false,
            error: message,
            context
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatEngineAPI;
} else if (typeof window !== 'undefined') {
    window.ChatEngineAPI = ChatEngineAPI;
}