/**
 * Integration Framework
 * Unified system for connecting to external software (APIs)
 * Supports: NetSuite, Slack, HubSpot, Salesforce, Paychex, QuickBooks, etc.
 */

const IntegrationManager = {
    integrations: {},
    hooks: {},

    /**
     * Register a new integration
     */
    register(name, config) {
        if (!config.init || !config.sync) {
            throw new Error('Integration must have init and sync methods');
        }
        
        this.integrations[name] = {
            ...config,
            enabled: false,
            lastSync: null,
            status: 'disabled',
            config: {}
        };
        
        console.log(`✓ Integration registered: ${name}`);
    },

    /**
     * Initialize integration
     */
    async init(name, credentials = {}) {
        if (!this.integrations[name]) {
            throw new Error(`Integration not found: ${name}`);
        }

        try {
            const integration = this.integrations[name];
            integration.config = credentials;
            
            await integration.init(credentials);
            
            integration.enabled = true;
            integration.status = 'connected';
            
            this.saveIntegrationConfig(name, credentials);
            this.log('System', `Connected to ${name}`, 'Integration');
            
            return { success: true, message: `${name} connected` };
        } catch (error) {
            this.integrations[name].status = 'error';
            console.error(`Integration error (${name}):`, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync data from integration
     */
    async sync(name, dataTypes = []) {
        if (!this.integrations[name]) {
            throw new Error(`Integration not found: ${name}`);
        }

        if (!this.integrations[name].enabled) {
            throw new Error(`Integration not enabled: ${name}`);
        }

        try {
            const integration = this.integrations[name];
            const results = await integration.sync(dataTypes);
            
            integration.lastSync = new Date().toISOString();
            this.saveIntegrationConfig(name, integration.config);
            this.log('System', `Synced data from ${name}`, 'Integration');
            
            return { success: true, data: results };
        } catch (error) {
            console.error(`Sync error (${name}):`, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Disconnect integration
     */
    disconnect(name) {
        if (!this.integrations[name]) {
            throw new Error(`Integration not found: ${name}`);
        }

        this.integrations[name].enabled = false;
        this.integrations[name].status = 'disconnected';
        this.integrations[name].config = {};
        
        localStorage.removeItem(`integration_${name}`);
        this.log('System', `Disconnected from ${name}`, 'Integration');
        
        return { success: true };
    },

    /**
     * Get integration status
     */
    getStatus(name) {
        const integration = this.integrations[name];
        if (!integration) return null;
        
        return {
            name,
            enabled: integration.enabled,
            status: integration.status,
            lastSync: integration.lastSync,
            dataTypes: integration.dataTypes || []
        };
    },

    /**
     * Get all integrations
     */
    getAll() {
        return Object.keys(this.integrations).map(name => this.getStatus(name));
    },

    /**
     * Save integration configuration
     */
    saveIntegrationConfig(name, config) {
        // If API mode is enabled, persist to backend integrations table, otherwise fallback to localStorage
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            (async () => {
                try {
                    const list = await APIAdapter.getData('integrations') || [];
                    const existing = (list || []).find(i => i.name === name);
                    if (existing) {
                        await APIAdapter.update('integrations', existing.id, { config, enabled: true });
                    } else {
                        await APIAdapter.create('integrations', { name, key: name, config, enabled: true });
                    }
                } catch (err) {
                    console.warn('Failed to persist integration config to API:', err.message);
                    localStorage.setItem(`integration_${name}`, JSON.stringify(config));
                }
            })();
            return;
        }
        localStorage.setItem(`integration_${name}`, JSON.stringify(config));
    },

    /**
     * Load integration configuration
     */
    loadIntegrationConfig(name) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            // Try server first
            try {
                const list = APIAdapter.getData('integrations');
                if (list && typeof list.then === 'function') {
                    // async
                    return list.then(arr => {
                        const found = (arr || []).find(i => i.name === name);
                        return found ? found.config : null;
                    }).catch(() => null);
                } else {
                    const found = (list || []).find(i => i.name === name);
                    return found ? found.config : null;
                }
            } catch (err) {
                // fallback to localStorage
            }
        }
        const stored = localStorage.getItem(`integration_${name}`);
        return stored ? JSON.parse(stored) : null;
    },

    /**
     * Register hook for events
     */
    hook(event, callback) {
        if (!this.hooks[event]) {
            this.hooks[event] = [];
        }
        this.hooks[event].push(callback);
    },

    /**
     * Trigger hooks
     */
    async trigger(event, data) {
        if (!this.hooks[event]) return;
        
        for (const callback of this.hooks[event]) {
            try {
                await callback(data);
            } catch (error) {
                console.error(`Hook error (${event}):`, error);
            }
        }
    },

    /**
     * Log integration activity
     */
    log(actor, action, module) {
        if (typeof db !== 'undefined') {
            db.log(actor, action, module);
        }
    }
};

// ============================================
// INTEGRATION: NetSuite (Already implemented)
// ============================================

const NetSuiteIntegration = {
    name: 'NetSuite',
    dataTypes: ['employees', 'payroll', 'attendance', 'leave', 'recruitment'],
    
    async init(credentials) {
        return NetSuiteAPI.init(
            credentials.realm,
            credentials.consumerId,
            credentials.consumerSecret,
            credentials.tokenId,
            credentials.tokenSecret
        );
    },

    async sync(dataTypes = []) {
        const types = dataTypes.length ? dataTypes : this.dataTypes;
        return NetSuiteAPI.syncData(types);
    }
};

// ============================================
// INTEGRATION: Slack
// ============================================

const SlackIntegration = {
    name: 'Slack',
    dataTypes: ['notifications', 'alerts', 'approvals'],
    webhook: null,

    async init(credentials) {
        if (!credentials.webhookUrl) {
            throw new Error('Slack webhook URL required');
        }
        this.webhook = credentials.webhookUrl;
        return { success: true };
    },

    async sync(dataTypes = []) {
        // Slack is primarily for outbound notifications
        return { success: true, message: 'Slack integration synced' };
    },

    /**
     * Send message to Slack
     */
    async sendMessage(channel, message, attachments = []) {
        try {
            const payload = {
                channel,
                text: message,
                attachments
            };

            const response = await fetch(this.webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            return { success: response.ok };
        } catch (error) {
            console.error('Slack error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Notify on employee leave request
     */
    async notifyLeaveRequest(employeeName, leaveType, days) {
        return this.sendMessage('#hr', `Leave Request: ${employeeName} requested ${days} days of ${leaveType}`, [
            {
                color: '#FF9900',
                fields: [
                    { title: 'Employee', value: employeeName, short: true },
                    { title: 'Type', value: leaveType, short: true },
                    { title: 'Days', value: days.toString(), short: true }
                ]
            }
        ]);
    },

    /**
     * Notify on payroll approval
     */
    async notifyPayrollApproval(count, total) {
        return this.sendMessage('#finance', `Payroll Approved: ${count} employees, Total: $${total}`, [
            {
                color: '#00AA00',
                fields: [
                    { title: 'Employee Count', value: count.toString(), short: true },
                    { title: 'Total Amount', value: `$${total.toFixed(2)}`, short: true }
                ]
            }
        ]);
    }
};

// ============================================
// INTEGRATION: HubSpot (CRM)
// ============================================

const HubSpotIntegration = {
    name: 'HubSpot',
    dataTypes: ['candidates', 'leads'],
    apiKey: null,
    baseUrl: 'https://api.hubapi.com',

    async init(credentials) {
        if (!credentials.apiKey) {
            throw new Error('HubSpot API key required');
        }
        this.apiKey = credentials.apiKey;
        return { success: true };
    },

    async sync(dataTypes = []) {
        const results = {};

        if (dataTypes.includes('candidates') || dataTypes.length === 0) {
            try {
                const candidates = await this.getCandidates();
                db.set('recruitment', candidates);
                results.candidates = { synced: true, count: candidates.length };
            } catch (error) {
                results.candidates = { synced: false, error: error.message };
            }
        }

        return results;
    },

    /**
     * Get candidates from HubSpot
     */
    async getCandidates() {
        const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts?limit=100`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch candidates');

        const data = await response.json();
        
        return data.results.map(contact => ({
            id: contact.id,
            name: contact.properties.firstname?.value + ' ' + (contact.properties.lastname?.value || ''),
            email: contact.properties.email?.value,
            phone: contact.properties.phone?.value,
            stage: contact.properties.hs_pipeline_stage?.value || 'Screening'
        }));
    },

    /**
     * Create new candidate in HubSpot
     */
    async createCandidate(candidateData) {
        const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    firstname: candidateData.name.split(' ')[0],
                    lastname: candidateData.name.split(' ').slice(1).join(' '),
                    email: candidateData.email,
                    phone: candidateData.phone
                }
            })
        });

        if (!response.ok) throw new Error('Failed to create candidate');
        return await response.json();
    }
};

// ============================================
// INTEGRATION: Salesforce
// ============================================

const SalesforceIntegration = {
    name: 'Salesforce',
    dataTypes: ['accounts', 'contacts'],
    instanceUrl: null,
    accessToken: null,

    async init(credentials) {
        if (!credentials.instanceUrl || !credentials.accessToken) {
            throw new Error('Salesforce instance URL and access token required');
        }
        this.instanceUrl = credentials.instanceUrl;
        this.accessToken = credentials.accessToken;
        return { success: true };
    },

    async sync(dataTypes = []) {
        const results = {};

        if (dataTypes.includes('accounts') || dataTypes.length === 0) {
            try {
                const accounts = await this.getAccounts();
                results.accounts = { synced: true, count: accounts.length };
            } catch (error) {
                results.accounts = { synced: false, error: error.message };
            }
        }

        return results;
    },

    /**
     * Query Salesforce SOQL
     */
    async query(soql) {
        const response = await fetch(
            `${this.instanceUrl}/services/data/v57.0/query?q=${encodeURIComponent(soql)}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Salesforce query failed');
        return await response.json();
    },

    /**
     * Get accounts
     */
    async getAccounts() {
        const result = await this.query('SELECT Id, Name, Industry FROM Account LIMIT 100');
        return result.records;
    }
};

// ============================================
// INTEGRATION: Paychex (Payroll)
// ============================================

const PaychexIntegration = {
    name: 'Paychex',
    dataTypes: ['payroll', 'tax_data'],
    clientId: null,
    clientSecret: null,
    accessToken: null,

    async init(credentials) {
        if (!credentials.clientId || !credentials.clientSecret) {
            throw new Error('Paychex client ID and secret required');
        }
        this.clientId = credentials.clientId;
        this.clientSecret = credentials.clientSecret;
        await this.authenticate();
        return { success: true };
    },

    async authenticate() {
        const response = await fetch('https://api.paychex.com/auth/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            })
        });

        const data = await response.json();
        this.accessToken = data.access_token;
    },

    async sync(dataTypes = []) {
        const results = {};

        if (dataTypes.includes('payroll') || dataTypes.length === 0) {
            try {
                const payroll = await this.getPayroll();
                db.set('payroll', payroll);
                results.payroll = { synced: true, count: payroll.length };
            } catch (error) {
                results.payroll = { synced: false, error: error.message };
            }
        }

        return results;
    },

    /**
     * Get payroll data
     */
    async getPayroll() {
        const response = await fetch('https://api.paychex.com/payroll/v1/payrolls', {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Paychex API error');
        const data = await response.json();
        return data.items || [];
    }
};

// ============================================
// INTEGRATION: QuickBooks
// ============================================

const QuickBooksIntegration = {
    name: 'QuickBooks',
    dataTypes: ['expenses', 'invoices'],
    realm: null,
    accessToken: null,

    async init(credentials) {
        if (!credentials.realm || !credentials.accessToken) {
            throw new Error('QuickBooks realm and access token required');
        }
        this.realm = credentials.realm;
        this.accessToken = credentials.accessToken;
        return { success: true };
    },

    async sync(dataTypes = []) {
        const results = {};

        if (dataTypes.includes('expenses') || dataTypes.length === 0) {
            try {
                const expenses = await this.getExpenses();
                results.expenses = { synced: true, count: expenses.length };
            } catch (error) {
                results.expenses = { synced: false, error: error.message };
            }
        }

        return results;
    },

    /**
     * Query QuickBooks
     */
    async query(query) {
        const response = await fetch(
            `https://quickbooks.api.intuit.com/v2/company/${this.realm}/query`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            }
        );

        if (!response.ok) throw new Error('QuickBooks query failed');
        return await response.json();
    },

    /**
     * Get expenses
     */
    async getExpenses() {
        const result = await this.query("SELECT * FROM Bill MAXRESULTS 100");
        return result.QueryResponse?.Bill || [];
    }
};

// ============================================
// INTEGRATION: Google Workspace
// ============================================

const GoogleWorkspaceIntegration = {
    name: 'Google Workspace',
    dataTypes: ['calendar', 'directory'],
    accessToken: null,

    async init(credentials) {
        if (!credentials.accessToken) {
            throw new Error('Google access token required');
        }
        this.accessToken = credentials.accessToken;
        return { success: true };
    },

    async sync(dataTypes = []) {
        return { success: true, message: 'Google Workspace synced' };
    },

    /**
     * Create calendar event
     */
    async createCalendarEvent(title, startTime, endTime, attendees = []) {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                summary: title,
                start: { dateTime: new Date(startTime).toISOString() },
                end: { dateTime: new Date(endTime).toISOString() },
                attendees: attendees.map(email => ({ email }))
            })
        });

        if (!response.ok) throw new Error('Failed to create calendar event');
        return await response.json();
    },

    /**
     * Get employee directory
     */
    async getDirectory() {
        const response = await fetch('https://www.googleapis.com/admin/directory/v1/users', {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch directory');
        return await response.json();
    }
};

// ============================================
// INTEGRATION: Microsoft Teams
// ============================================

const MicrosoftTeamsIntegration = {
    name: 'Microsoft Teams',
    dataTypes: ['notifications'],
    webhookUrl: null,

    async init(credentials) {
        if (!credentials.webhookUrl) {
            throw new Error('Microsoft Teams webhook URL required');
        }
        this.webhookUrl = credentials.webhookUrl;
        return { success: true };
    },

    async sync(dataTypes = []) {
        return { success: true, message: 'Microsoft Teams synced' };
    },

    /**
     * Send adaptive card message
     */
    async sendMessage(title, message, buttons = []) {
        const payload = {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: title,
            themeColor: '4f46e5',
            sections: [{
                activityTitle: title,
                text: message
            }],
            potentialAction: buttons.map(btn => ({
                '@type': 'OpenUri',
                name: btn.label,
                targets: [{ os: 'default', uri: btn.url }]
            }))
        };

        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return { success: response.ok };
    }
};

// ============================================
// Register all integrations
// ============================================

IntegrationManager.register('netsuite', NetSuiteIntegration);
IntegrationManager.register('slack', SlackIntegration);
IntegrationManager.register('hubspot', HubSpotIntegration);
IntegrationManager.register('salesforce', SalesforceIntegration);
IntegrationManager.register('paychex', PaychexIntegration);
IntegrationManager.register('quickbooks', QuickBooksIntegration);
IntegrationManager.register('google-workspace', GoogleWorkspaceIntegration);
IntegrationManager.register('teams', MicrosoftTeamsIntegration);

// Export
window.IntegrationManager = IntegrationManager;
window.SlackIntegration = SlackIntegration;
window.HubSpotIntegration = HubSpotIntegration;
window.SalesforceIntegration = SalesforceIntegration;
