/**
 * NetSuite Integration Module
 * Handles all communications with NetSuite API
 */

const NetSuiteConfig = {
    STORAGE_KEY: 'netsuite_config_v1',
    API_VERSION: '1.0',

    // Synchronous read (local fallback)
    getConfig() {
        const config = localStorage.getItem(this.STORAGE_KEY);
        return config ? JSON.parse(config) : null;
    },

    // Synchronous write (store minimal non-secret fields locally)
    saveConfig(config) {
        // store only non-secret fields locally for UI convenience
        const safe = {
            realm: config.realm,
            consumerId: config.consumerId,
            tokenId: config.tokenId,
            netsuiteEnabled: true
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safe));
    },

    // Save full config to backend (secrets stored server-side)
    async saveConfigServer(config) {
        try {
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/integrations/netsuite/config', {
                method: 'POST',
                headers,
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            // persist safe copy locally
            this.saveConfig(config);
            return json;
        } catch (err) {
            console.warn('Failed to save NetSuite config to server:', err.message);
            // fallback to localStorage (last resort)
            this.saveConfig(config);
            return null;
        }
    },

    // Fetch config from server and persist safe copy locally
    async fetchServerConfig() {
        try {
            const token = localStorage.getItem('hrms_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/integrations/netsuite/config', { headers });
            if (!res.ok) return null;
            const cfg = await res.json();
            if (cfg) this.saveConfig(cfg);
            return cfg;
        } catch (err) {
            console.warn('Failed to fetch NetSuite config from server:', err.message);
            return null;
        }
    },

    // Validate configuration (local or server)
    isConfigured() {
        const config = this.getConfig();
        return !!(config && config.realm && config.consumerId && config.tokenId);
    },

    // Clear configuration (server + local)
    async clearConfig() {
        try {
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            await fetch('/api/integrations/netsuite/config', { method: 'POST', headers, body: JSON.stringify({}) });
        } catch (err) {
            console.warn('Failed to clear server NetSuite config:', err.message);
        }
        localStorage.removeItem(this.STORAGE_KEY);
    }
};

const NetSuiteAPI = {
    // Base configuration
    config: null,
    baseUrl: 'https://api.netsuite.com/rest/api/v2',

    /**
     * Initialize NetSuite API with credentials
     */
    init(realm, consumerId, consumerSecret, tokenId, tokenSecret) {
        this.config = {
            realm,
            consumerId,
            consumerSecret,
            tokenId,
            tokenSecret,
            signature: this._generateSignature()
        };

        // Save full config to backend (async) and keep a safe local copy for UI
        NetSuiteConfig.saveConfigServer(this.config).catch(() => {});
        NetSuiteConfig.saveConfig(this.config);

        return { success: true, message: 'NetSuite configured successfully' };
    },

    /**
     * Generate OAuth signature (simplified for frontend)
     * In production, this should be done on backend for security
     */
    _generateSignature() {
        // This is a placeholder - actual implementation requires OAuth 1.0
        // In production, you should use a backend service
        return 'backend_signature_required';
    },

    /**
     * Make authenticated API request
     * Note: Direct API calls from frontend are not recommended due to CORS and security
     * This demonstrates the structure - use a backend proxy in production
     */
    async request(method, endpoint, data = null) {
        const config = NetSuiteConfig.getConfig();
        if (!config) {
            return { success: false, error: 'NetSuite not configured' };
        }

        try {
            // In production, call your backend proxy
            const proxyUrl = '/api/netsuite'; // Your backend endpoint
            
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ method, endpoint, data })
            });

            if (!response.ok) {
                return { success: false, error: `API Error: ${response.statusText}` };
            }

            const result = await response.json();
            return { success: true, data: result };
        } catch (error) {
            console.error('NetSuite API Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetch employees from NetSuite
     * Endpoint: /employee
     */
    async getEmployees(limit = 100, offset = 0) {
        return this.request('GET', `/employee?limit=${limit}&offset=${offset}`);
    },

    /**
     * Fetch specific employee
     */
    async getEmployee(employeeId) {
        return this.request('GET', `/employee/${employeeId}`);
    },

    /**
     * Create new employee
     */
    async createEmployee(employeeData) {
        return this.request('POST', '/employee', employeeData);
    },

    /**
     * Update employee
     */
    async updateEmployee(employeeId, employeeData) {
        return this.request('PATCH', `/employee/${employeeId}`, employeeData);
    },

    /**
     * Fetch payroll records
     */
    async getPayroll(limit = 100, offset = 0) {
        return this.request('GET', `/payroll?limit=${limit}&offset=${offset}`);
    },

    /**
     * Fetch time tracking/attendance data
     */
    async getTimeTracking(employeeId, startDate, endDate) {
        return this.request('GET', `/timetracking/timesheets?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`);
    },

    /**
     * Fetch leave requests
     */
    async getLeaveRequests(limit = 100, offset = 0) {
        return this.request('GET', `/leave?limit=${limit}&offset=${offset}`);
    },

    /**
     * Submit leave request
     */
    async submitLeaveRequest(leaveData) {
        return this.request('POST', '/leave', leaveData);
    },

    /**
     * Fetch recruitment/job records
     */
    async getJobOpenings(limit = 100, offset = 0) {
        return this.request('GET', `/job?limit=${limit}&offset=${offset}`);
    },

    /**
     * Fetch candidates
     */
    async getCandidates(limit = 100, offset = 0) {
        return this.request('GET', `/candidate?limit=${limit}&offset=${offset}`);
    },

    /**
     * Fetch performance reviews
     */
    async getPerformanceReviews(limit = 100, offset = 0) {
        return this.request('GET', `/performancereview?limit=${limit}&offset=${offset}`);
    },

    /**
     * Sync data from NetSuite to local storage
     */
    async syncData(dataTypes = ['employees', 'payroll', 'attendance']) {
        const syncResults = {};

        for (const dataType of dataTypes) {
            try {
                let result;
                switch (dataType) {
                    case 'employees':
                        result = await this.getEmployees();
                        break;
                    case 'payroll':
                        result = await this.getPayroll();
                        break;
                    case 'attendance':
                        result = await this.getTimeTracking(null, null, null);
                        break;
                    case 'leave':
                        result = await this.getLeaveRequests();
                        break;
                    case 'recruitment':
                        result = await this.getCandidates();
                        break;
                    default:
                        result = { success: false, error: 'Unknown data type' };
                }

                if (result.success && result.data) {
                    db.set(dataType, result.data);
                    syncResults[dataType] = { synced: true, count: result.data.length || 0 };
                } else {
                    syncResults[dataType] = { synced: false, error: result.error };
                }
            } catch (error) {
                syncResults[dataType] = { synced: false, error: error.message };
            }
        }

        return syncResults;
    }
};

// Export for use
window.NetSuiteAPI = NetSuiteAPI;
window.NetSuiteConfig = NetSuiteConfig;
