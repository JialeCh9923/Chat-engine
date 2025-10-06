/**
 * Chat Engine Tax Filing Portal
 * Main application with authentication, session management, and all features
 */

class TaxFilingPortal {
    constructor() {
        this.api = new ChatEngineAPI();
        this.currentView = 'dashboard';
        this.isConnected = false;
        this.refreshIntervals = new Map();
        
        // Initialize the portal
        this.init();
    }

    async init() {
        // Load stored credentials
        this.api.loadStoredCredentials();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check API connection
        await this.checkConnection();
        
        // Setup SSE connection
        this.setupSSE();
        
        // Load initial data
        await this.loadDashboard();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // API Key Modal
        document.getElementById('connectApiKey').addEventListener('click', () => {
            this.showApiKeyModal();
        });

        document.getElementById('saveApiKey').addEventListener('click', () => {
            this.saveApiKey();
        });

        // Session Modal
        document.getElementById('createSessionBtn').addEventListener('click', () => {
            this.showSessionModal();
        });

        document.getElementById('saveSession').addEventListener('click', () => {
            this.createSession();
        });

        // Tax Form Modal
        document.getElementById('createTaxFormBtn').addEventListener('click', () => {
            this.showTaxFormModal();
        });

        document.getElementById('saveTaxForm').addEventListener('click', () => {
            this.createTaxForm();
        });

        // Document Upload
        this.setupDocumentUpload();

        // Chat Interface
        this.setupChatInterface();

        // Search and Filters
        this.setupSearchAndFilters();

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });
    }

    setupSSE() {
        // SSE Event Listeners
        this.api.addEventListener('connected', () => {
            this.showToast('Real-time updates connected', 'success');
            this.updateConnectionStatus(true);
        });

        this.api.addEventListener('disconnected', () => {
            this.showToast('Real-time updates disconnected', 'warning');
            this.updateConnectionStatus(false);
        });

        this.api.addEventListener('job_update', (data) => {
            this.handleJobUpdate(data);
        });

        this.api.addEventListener('document_processed', (data) => {
            this.handleDocumentProcessed(data);
        });

        this.api.addEventListener('conversation_update', (data) => {
            this.handleConversationUpdate(data);
        });

        this.api.addEventListener('tax_form_update', (data) => {
            this.handleTaxFormUpdate(data);
        });

        this.api.addEventListener('session_update', (data) => {
            this.handleSessionUpdate(data);
        });
    }

    setupDocumentUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        if (!uploadArea || !fileInput) return;

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileUpload(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileUpload(files);
        });
    }

    setupChatInterface() {
        const chatInput = document.getElementById('chatInput');
        const sendMessageBtn = document.getElementById('sendMessage');
        
        if (!chatInput || !sendMessageBtn) return;

        sendMessageBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }

    setupSearchAndFilters() {
        const searchInputs = document.querySelectorAll('.search-input');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        searchInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleSearch(e.target.value, e.target.dataset.target);
            });
        });

        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilter(e.target.dataset.filter, e.target.dataset.target);
            });
        });
    }

    // Authentication
    showApiKeyModal() {
        document.getElementById('apiKeyModal').style.display = 'block';
        document.getElementById('apiKeyInput').value = this.api.apiKey || '';
    }

    async saveApiKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        
        if (!this.api.validateApiKey(apiKey)) {
            this.showToast('Please enter a valid API key (minimum 10 characters)', 'error');
            return;
        }

        try {
            this.api.setApiKey(apiKey);
            
            // Test the API key
            const health = await this.api.checkHealth();
            
            this.showToast('API key connected successfully!', 'success');
            this.closeModals();
            
            // Refresh current view
            this.refreshCurrentView();
            
        } catch (error) {
            this.showToast('Failed to connect with API key: ' + error.message, 'error');
        }
    }

    // Connection Management
    async checkConnection() {
        try {
            const health = await this.api.checkHealth();
            this.isConnected = true;
            this.updateConnectionStatus(true);
            return true;
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            return false;
        }
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        const statusElement = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectApiKey');
        
        if (connected) {
            statusElement.className = 'status-indicator status-connected';
            statusElement.textContent = 'Connected';
            connectBtn.textContent = 'Change API Key';
        } else {
            statusElement.className = 'status-indicator status-disconnected';
            statusElement.textContent = 'Disconnected';
            connectBtn.textContent = 'Connect API Key';
        }
    }

    // View Management
    switchView(view) {
        this.currentView = view;
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected section
        document.getElementById(`${view}Section`).style.display = 'block';
        
        // Load view-specific data
        this.loadViewData(view);
    }

    async loadViewData(view) {
        try {
            switch (view) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'sessions':
                    await this.loadSessions();
                    break;
                case 'conversations':
                    await this.loadConversations();
                    break;
                case 'documents':
                    await this.loadDocuments();
                    break;
                case 'tax-forms':
                    await this.loadTaxForms();
                    break;
                case 'jobs':
                    await this.loadJobs();
                    break;
                case 'real-time':
                    await this.loadRealTimeUpdates();
                    break;
            }
        } catch (error) {
            this.showToast(`Failed to load ${view}: ${error.message}`, 'error');
        }
    }

    // Dashboard
    async loadDashboard() {
        if (!this.isConnected) return;
        
        try {
            // Load all statistics
            const [sessionStats, conversationStats, jobStats, taxFormStats] = await Promise.all([
                this.api.getSessionStats(),
                this.api.getConversationStats(),
                this.api.getJobQueueStats(),
                this.api.getTaxFormStats()
            ]);
            
            this.updateDashboardStats({
                sessions: sessionStats,
                conversations: conversationStats,
                jobs: jobStats,
                taxForms: taxFormStats
            });
            
            // Load recent items
            const recentSessions = await this.api.getSessions({ limit: 5 });
            const recentJobs = await this.api.getJobs({ limit: 5 });
            
            this.updateRecentItems({
                sessions: recentSessions,
                jobs: recentJobs
            });
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    updateDashboardStats(stats) {
        // Update stat cards
        document.getElementById('totalSessions').textContent = stats.sessions?.total || 0;
        document.getElementById('activeSessions').textContent = stats.sessions?.active || 0;
        document.getElementById('totalConversations').textContent = stats.conversations?.total || 0;
        document.getElementById('totalJobs').textContent = stats.jobs?.total || 0;
        document.getElementById('completedJobs').textContent = stats.jobs?.completed || 0;
        document.getElementById('totalTaxForms').textContent = stats.taxForms?.total || 0;
        
        // Update charts if available
        if (window.Chart) {
            this.updateCharts(stats);
        }
    }

    updateRecentItems(items) {
        // Update recent sessions
        const sessionsList = document.getElementById('recentSessions');
        if (sessionsList && items.sessions) {
            sessionsList.innerHTML = items.sessions.map(session => `
                <div class="recent-item">
                    <div class="item-info">
                        <div class="item-title">${session.title}</div>
                        <div class="item-meta">${this.api.formatDate(session.createdAt)}</div>
                    </div>
                    <div class="item-status status-${session.status}">${session.status}</div>
                </div>
            `).join('');
        }
        
        // Update recent jobs
        const jobsList = document.getElementById('recentJobs');
        if (jobsList && items.jobs) {
            jobsList.innerHTML = items.jobs.map(job => `
                <div class="recent-item">
                    <div class="item-info">
                        <div class="item-title">${job.type}</div>
                        <div class="item-meta">${this.api.formatDuration(job.createdAt, job.updatedAt)}</div>
                    </div>
                    <div class="item-status status-${job.status}">${job.status}</div>
                </div>
            `).join('');
        }
    }

    // Session Management
    showSessionModal() {
        if (!this.api.apiKey) {
            this.showToast('Please connect your API key first', 'warning');
            this.showApiKeyModal();
            return;
        }
        
        document.getElementById('sessionModal').style.display = 'block';
    }

    async createSession() {
        const title = document.getElementById('sessionTitle').value.trim();
        const description = document.getElementById('sessionDescription').value.trim();
        
        if (!title) {
            this.showToast('Please enter a session title', 'error');
            return;
        }
        
        try {
            const session = await this.api.createSession({
                title,
                description,
                status: 'active'
            });
            
            this.api.setSessionId(session.id);
            this.showToast('Session created successfully!', 'success');
            this.closeModals();
            
            // Refresh sessions view
            if (this.currentView === 'sessions') {
                this.loadSessions();
            }
            
        } catch (error) {
            this.showToast('Failed to create session: ' + error.message, 'error');
        }
    }

    async loadSessions() {
        if (!this.isConnected) return;
        
        try {
            const sessions = await this.api.getSessions();
            this.renderSessions(sessions);
        } catch (error) {
            this.showToast('Failed to load sessions: ' + error.message, 'error');
        }
    }

    renderSessions(sessions) {
        const container = document.getElementById('sessionsList');
        if (!container) return;
        
        container.innerHTML = sessions.map(session => `
            <div class="session-card" data-session-id="${session.id}">
                <div class="card-header">
                    <h3>${session.title}</h3>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-outline" onclick="portal.selectSession('${session.id}')">
                            Select
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="portal.editSession('${session.id}')">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="portal.deleteSession('${session.id}')">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <p>${session.description || 'No description'}</p>
                    <div class="session-meta">
                        <span class="status-badge status-${session.status}">${session.status}</span>
                        <span class="date">${this.api.formatDate(session.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    selectSession(sessionId) {
        this.api.setSessionId(sessionId);
        this.showToast('Session selected', 'success');
        
        // Update UI to show selected session
        document.querySelectorAll('.session-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-session-id="${sessionId}"]`).classList.add('selected');
    }

    // Conversations
    async loadConversations() {
        if (!this.isConnected || !this.api.sessionId) {
            this.showToast('Please select a session first', 'warning');
            return;
        }
        
        try {
            const conversations = await this.api.getConversations(this.api.sessionId);
            this.renderConversations(conversations);
        } catch (error) {
            this.showToast('Failed to load conversations: ' + error.message, 'error');
        }
    }

    renderConversations(conversations) {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        container.innerHTML = conversations.map(conversation => `
            <div class="conversation-card" data-conversation-id="${conversation.id}">
                <div class="conversation-header">
                    <h4>${conversation.title}</h4>
                    <span class="status-badge status-${conversation.status}">${conversation.status}</span>
                </div>
                <div class="conversation-preview">
                    ${conversation.messages?.[0]?.content?.substring(0, 100) || 'No messages yet'}...
                </div>
                <div class="conversation-meta">
                    <span>${this.api.formatDate(conversation.createdAt)}</span>
                    <button class="btn btn-sm btn-primary" onclick="portal.openConversation('${conversation.id}')">
                        Open
                    </button>
                </div>
            </div>
        `).join('');
    }

    async sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.api.sessionId) {
            this.showToast('Please select a session first', 'warning');
            return;
        }
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        input.value = '';
        
        try {
            // Create conversation if needed
            if (!this.currentConversationId) {
                const conversation = await this.api.createConversation({
                    sessionId: this.api.sessionId,
                    title: 'Tax Filing Assistance',
                    status: 'active'
                });
                this.currentConversationId = conversation.id;
            }
            
            // Send message
            const response = await this.api.sendMessage(this.currentConversationId, message);
            
            // Add AI response to chat
            this.addChatMessage(response.message || response.content || 'Response received', 'assistant');
            
        } catch (error) {
            this.showToast('Failed to send message: ' + error.message, 'error');
            this.addChatMessage('Sorry, I encountered an error processing your message.', 'assistant');
        }
    }

    addChatMessage(content, sender) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${sender}`;
        messageDiv.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Document Upload
    async handleFileUpload(files) {
        if (!this.api.sessionId) {
            this.showToast('Please select a session first', 'warning');
            return;
        }
        
        for (const file of files) {
            try {
                this.showUploadProgress(file.name, 0);
                
                const result = await this.api.uploadDocument(file, this.api.sessionId, {
                    originalName: file.name,
                    size: file.size,
                    type: file.type
                });
                
                this.showUploadProgress(file.name, 100);
                this.showToast(`File "${file.name}" uploaded successfully!`, 'success');
                
                // Refresh documents list
                if (this.currentView === 'documents') {
                    this.loadDocuments();
                }
                
            } catch (error) {
                this.showToast(`Failed to upload "${file.name}": ${error.message}`, 'error');
                this.showUploadProgress(file.name, -1);
            }
        }
    }

    showUploadProgress(filename, progress) {
        const uploadProgress = document.getElementById('uploadProgress');
        if (!uploadProgress) return;
        
        if (progress === -1) {
            // Error state
            uploadProgress.innerHTML = `
                <div class="upload-item error">
                    <span>${filename} - Upload failed</span>
                </div>
            `;
        } else if (progress === 100) {
            // Complete
            uploadProgress.innerHTML = `
                <div class="upload-item success">
                    <span>${filename} - Upload complete</span>
                </div>
            `;
        } else {
            // In progress
            uploadProgress.innerHTML = `
                <div class="upload-item">
                    <span>${filename}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }
    }

    // Tax Forms
    showTaxFormModal() {
        if (!this.api.sessionId) {
            this.showToast('Please select a session first', 'warning');
            return;
        }
        
        document.getElementById('taxFormModal').style.display = 'block';
    }

    async createTaxForm() {
        const formType = document.getElementById('taxFormType').value;
        const taxYear = document.getElementById('taxYear').value;
        
        if (!formType || !taxYear) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const taxForm = await this.api.createTaxForm(this.api.sessionId, {
                formType,
                taxYear: parseInt(taxYear),
                status: 'draft'
            });
            
            this.showToast('Tax form created successfully!', 'success');
            this.closeModals();
            
            // Refresh tax forms view
            if (this.currentView === 'tax-forms') {
                this.loadTaxForms();
            }
            
        } catch (error) {
            this.showToast('Failed to create tax form: ' + error.message, 'error');
        }
    }

    async loadTaxForms() {
        if (!this.isConnected || !this.api.sessionId) {
            this.showToast('Please select a session first', 'warning');
            return;
        }
        
        try {
            const taxForms = await this.api.getTaxFormsBySession(this.api.sessionId);
            this.renderTaxForms(taxForms);
        } catch (error) {
            this.showToast('Failed to load tax forms: ' + error.message, 'error');
        }
    }

    renderTaxForms(taxForms) {
        const container = document.getElementById('taxFormsList');
        if (!container) return;
        
        container.innerHTML = taxForms.map(form => `
            <div class="tax-form-card" data-form-id="${form.id}">
                <div class="form-header">
                    <h4>${form.formType} - ${form.taxYear}</h4>
                    <div class="form-actions">
                        <button class="btn btn-sm btn-outline" onclick="portal.calculateTaxes('${form.id}')">
                            Calculate
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="portal.editTaxForm('${form.id}')">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="portal.deleteTaxForm('${form.id}')">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="form-body">
                    <div class="form-status">
                        <span class="status-badge status-${form.status}">${form.status}</span>
                        <span class="form-date">${this.api.formatDate(form.createdAt)}</span>
                    </div>
                    <div class="form-calculations">
                        ${form.calculations ? `
                            <div class="calculation-summary">
                                <span>Total Income: $${form.calculations.totalIncome || 0}</span>
                                <span>Tax Owed: $${form.calculations.taxOwed || 0}</span>
                            </div>
                        ` : '<div class="no-calculations">No calculations yet</div>'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Jobs
    async loadJobs() {
        if (!this.isConnected) return;
        
        try {
            const jobs = await this.api.getJobs();
            this.renderJobs(jobs);
        } catch (error) {
            this.showToast('Failed to load jobs: ' + error.message, 'error');
        }
    }

    renderJobs(jobs) {
        const container = document.getElementById('jobsList');
        if (!container) return;
        
        container.innerHTML = jobs.map(job => `
            <div class="job-card" data-job-id="${job.id}">
                <div class="job-header">
                    <h4>${job.type}</h4>
                    <div class="job-actions">
                        ${job.status === 'pending' || job.status === 'running' ? `
                            <button class="btn btn-sm btn-outline" onclick="portal.cancelJob('${job.id}')">
                                Cancel
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="job-body">
                    <div class="job-status">
                        <span class="status-badge status-${job.status}">${job.status}</span>
                        <span class="job-date">${this.api.formatDate(job.createdAt)}</span>
                    </div>
                    <div class="job-progress">
                        ${job.progress ? `
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${job.progress}%"></div>
                            </div>
                            <span class="progress-text">${job.progress}%</span>
                        ` : ''}
                    </div>
                    ${job.error ? `<div class="job-error">${job.error}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Real-time Updates
    async loadRealTimeUpdates() {
        if (!this.isConnected) return;
        
        // Connect SSE if not already connected
        if (!this.api.isSSEConnected()) {
            this.api.connectSSE(this.api.sessionId);
        }
        
        this.updateRealTimeStatus();
    }

    updateRealTimeStatus() {
        const statusElement = document.getElementById('realTimeStatus');
        const eventsContainer = document.getElementById('realTimeEvents');
        
        if (this.api.isSSEConnected()) {
            statusElement.innerHTML = '<span class="status-indicator status-connected">Connected</span>';
        } else {
            statusElement.innerHTML = '<span class="status-indicator status-disconnected">Disconnected</span>';
        }
    }

    // Event Handlers
    handleJobUpdate(data) {
        this.showToast(`Job ${data.jobId} updated: ${data.status}`, 'info');
        if (this.currentView === 'jobs') {
            this.loadJobs();
        }
        this.addRealTimeEvent('job_update', data);
    }

    handleDocumentProcessed(data) {
        this.showToast(`Document processed: ${data.documentId}`, 'success');
        if (this.currentView === 'documents') {
            this.loadDocuments();
        }
        this.addRealTimeEvent('document_processed', data);
    }

    handleConversationUpdate(data) {
        if (this.currentView === 'conversations') {
            this.loadConversations();
        }
        this.addRealTimeEvent('conversation_update', data);
    }

    handleTaxFormUpdate(data) {
        if (this.currentView === 'tax-forms') {
            this.loadTaxForms();
        }
        this.addRealTimeEvent('tax_form_update', data);
    }

    handleSessionUpdate(data) {
        if (this.currentView === 'sessions') {
            this.loadSessions();
        }
        this.addRealTimeEvent('session_update', data);
    }

    addRealTimeEvent(type, data) {
        const eventsContainer = document.getElementById('realTimeEvents');
        if (!eventsContainer) return;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'real-time-event';
        eventDiv.innerHTML = `
            <div class="event-type">${type}</div>
            <div class="event-time">${new Date().toLocaleTimeString()}</div>
            <div class="event-data">${JSON.stringify(data, null, 2)}</div>
        `;
        
        eventsContainer.insertBefore(eventDiv, eventsContainer.firstChild);
        
        // Keep only last 50 events
        while (eventsContainer.children.length > 50) {
            eventsContainer.removeChild(eventsContainer.lastChild);
        }
    }

    // Utility Methods
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Reset forms
        document.querySelectorAll('.modal form').forEach(form => {
            form.reset();
        });
    }

    refreshCurrentView() {
        this.loadViewData(this.currentView);
    }

    // Search and Filter Handlers
    handleSearch(query, target) {
        // Implement search logic based on target
        console.log(`Searching "${query}" in ${target}`);
    }

    handleFilter(filter, target) {
        // Implement filter logic based on target and filter
        console.log(`Applying filter "${filter}" to ${target}`);
    }
}

// Initialize the portal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.portal = new TaxFilingPortal();
});