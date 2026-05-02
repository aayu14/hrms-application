/**
 * API Adapter Module
 * Manages switching between local storage and external API (NetSuite)
 * Provides a unified interface for data operations
 */

const APIAdapter = {
    // Configuration
    mode: 'local', // 'local' or 'api'
    apiBaseUrl: 'http://localhost:4000/api',
    cacheEnabled: true,
    cacheTimeout: 300000, // 5 minutes
    cache: {},

    /**
     * Initialize the adapter
     */
    init(config = {}) {
        this.mode = config.mode || 'local';
        this.apiBaseUrl = config.apiBaseUrl || this.apiBaseUrl;
        this.cacheEnabled = config.cacheEnabled !== false;
        console.log(`APIAdapter initialized in ${this.mode} mode`);
    },

    /**
     * Switch mode
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`APIAdapter switched to ${mode} mode`);
    },

    /**
     * Get data - routes based on mode
     */
    async getData(collection, query = {}) {
        if (this.mode === 'local') {
            return this._getLocalData(collection);
        } else {
            return this._getAPIData(collection, query);
        }
    },

    /**
     * Get data from local storage
     */
    _getLocalData(collection) {
        return db.getCollection(collection) || [];
    },

    /**
     * Get data from API
     */
    async _getAPIData(collection, query = {}) {
        // Check cache first
        const cacheKey = `${collection}_${JSON.stringify(query)}`;
        if (this.cacheEnabled && this.cache[cacheKey]) {
            const cachedData = this.cache[cacheKey];
            if (Date.now() - cachedData.timestamp < this.cacheTimeout) {
                return cachedData.data;
            }
        }

        try {
            const endpoint = this._mapCollectionToEndpoint(collection);
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            if (this.cacheEnabled) {
                this.cache[cacheKey] = {
                    data,
                    timestamp: Date.now()
                };
            }

            return data;
        } catch (error) {
            console.error('APIAdapter Error:', error);
            // Fallback to local data on API error
            return this._getLocalData(collection);
        }
    },

    /**
     * Create data
     */
    async create(collection, item) {
        if (this.mode === 'local') {
            return db.create(collection, item);
        } else {
            return this._postAPIData(collection, item);
        }
    },

    /**
     * Update data
     */
    async update(collection, id, fields) {
        if (this.mode === 'local') {
            return db.update(collection, id, fields);
        } else {
            return this._updateAPIData(collection, id, fields);
        }
    },

    /**
     * Delete data
     */
    async delete(collection, id) {
        if (this.mode === 'local') {
            return db.delete(collection, id);
        } else {
            return this._deleteAPIData(collection, id);
        }
    },

    /**
     * Post data to API
     */
    async _postAPIData(collection, item) {
        try {
            const endpoint = this._mapCollectionToEndpoint(collection);
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(item)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            this._invalidateCache(collection);
            return data;
        } catch (error) {
            console.error('APIAdapter POST Error:', error);
            throw error;
        }
    },

    /**
     * Update data via API
     */
    async _updateAPIData(collection, id, fields) {
        try {
            const endpoint = this._mapCollectionToEndpoint(collection);
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${this.apiBaseUrl}${endpoint}/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(fields)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            this._invalidateCache(collection);
            return data;
        } catch (error) {
            console.error('APIAdapter PATCH Error:', error);
            throw error;
        }
    },

    /**
     * Delete data via API
     */
    async _deleteAPIData(collection, id) {
        try {
            const endpoint = this._mapCollectionToEndpoint(collection);
            const token = localStorage.getItem('hrms_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${this.apiBaseUrl}${endpoint}/${id}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            this._invalidateCache(collection);
            return { success: true };
        } catch (error) {
            console.error('APIAdapter DELETE Error:', error);
            throw error;
        }
    },

    /**
     * Map collection names to API endpoints
     */
    _mapCollectionToEndpoint(collection) {
        const mapping = {
            employees: '/employees',
            attendance: '/attendance',
            payroll: '/payroll_exports',
            leaveRequests: '/leave_requests',
            recruitment: '/candidates',
            documents: '/documents',
            performance: '/performance_reviews'
            ,users: '/users'
            ,roles: '/roles'
            ,integrations: '/integrations'
        };
        return mapping[collection] || `/${collection}`;
    },

    /**
     * Invalidate cache for a collection
     */
    _invalidateCache(collection) {
        Object.keys(this.cache).forEach(key => {
            if (key.startsWith(collection)) {
                delete this.cache[key];
            }
        });
    },

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache = {};
    },

    /**
     * Get cache status
     */
    getCacheStatus() {
        return {
            enabled: this.cacheEnabled,
            entries: Object.keys(this.cache).length,
            mode: this.mode
        };
    }
};

// Export
window.APIAdapter = APIAdapter;
