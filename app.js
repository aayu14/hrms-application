document.addEventListener('DOMContentLoaded', () => App.init());

const App = {
    init() {
        db.init();
        // Initialize API adapter to use backend API by default (falls back via shim)
        if (window.APIAdapter && typeof APIAdapter.init === 'function') {
            APIAdapter.init({ mode: 'api', apiBaseUrl: window.__API_BASE__ || '/api' });
        }
        // Fetch NetSuite config from server (if available) so settings show saved values
        if (window.NetSuiteConfig && typeof NetSuiteConfig.fetchServerConfig === 'function') {
            NetSuiteConfig.fetchServerConfig().catch(()=>{});
        }
        ui.init();
        this.bindNavigation();
        this.route(location.hash.replace('#', '') || 'dashboard', false);
    },

    bindNavigation() {
        document.querySelectorAll('[data-view]').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                this.route(link.dataset.view);
            });
        });

        window.addEventListener('popstate', event => {
            this.renderView(event.state?.view || 'dashboard');
        });
    },

    route(view, pushState = true) {
        if (pushState) history.pushState({ view }, '', `#${view}`);
        this.renderView(view);
    },

    renderView(view) {
        ui.updateActiveNav(view);
        ui.showLoader();

        const routes = {
            dashboard: () => this.handleDashboard(),
            employees: () => employees.init(),
            attendance: () => attendance.init(),
            payroll: () => payroll.init(),
            leave: () => leave.init(),
            reports: () => reports.init(),
            recruitment: () => recruitment.init(),
            performance: () => performance.init(),
            documents: () => documents.init(),
            settings: () => settings.init(),
            users: () => users && users.init && users.init(),
            audit: () => audit.init()
        };

        try {
            (routes[view] || routes.dashboard)();
        } catch (error) {
            console.error(`Error loading ${view}`, error);
            ui.showNotification('Failed to load view', 'error');
            this.handleDashboard();
        }
    },

    handleDashboard() {
        (async () => {
            ui.showLoader();
            const date = new Date().toISOString().split('T')[0];
            let totalEmployees = db.getCount('employees');
            let presentToday = db.getAttendanceCount(date);
            let pendingPayroll = db.getPendingPayrollCount();
            try {
                if (window.APIAdapter && APIAdapter.mode === 'api') {
                    const emps = await APIAdapter.getData('employees');
                    totalEmployees = Array.isArray(emps) ? emps.length : totalEmployees;
                    const attendance = await APIAdapter.getData('attendance');
                    presentToday = Array.isArray(attendance) ? attendance.filter(a => a.date && a.date.startsWith(date)).length : presentToday;
                    const payroll = await APIAdapter.getData('payroll_exports');
                    pendingPayroll = Array.isArray(payroll) ? payroll.filter(p => p.status === 'pending').length : pendingPayroll;
                }
            } catch (e) { console.warn('Dashboard API load failed', e); }

            ui.renderDashboard({ totalEmployees, presentToday, pendingPayroll });
        })();
    }
};

const recruitment = {
    async init() {
        ui.showLoader();
        let candidates = [];
        try {
            if (window.APIAdapter && APIAdapter.mode === 'api') {
                candidates = await APIAdapter.getData('recruitment');
            } else {
                candidates = db.getCollection('recruitment') || [];
            }
        } catch (e) { console.warn('Failed to load candidates', e); candidates = db.getCollection('recruitment') || []; }

        if (!candidates || candidates.length === 0) {
            ui.moduleShell('Recruitment Pipeline', 'Hiring and onboarding', '<button class="btn btn-primary"><i class="fas fa-user-plus"></i> New Candidate</button>', `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>No Recruitment Data</h3>
                    <p>To see candidates here, either:</p>
                    <ul>
                        <li>Connect to NetSuite (go to Settings)</li>
                        <li>Or add candidates manually</li>
                    </ul>
                </div>
            `);
            return;
        }

        const stages = ['Screening', 'Interview', 'Offer'];
        ui.moduleShell('Recruitment Pipeline', 'Hiring and onboarding', '<button class="btn btn-primary"><i class="fas fa-user-plus"></i> New Candidate</button>', `
            <section class="kanban">
                ${stages.map(stage => `
                    <div class="kanban-column">
                        <h2>${stage}</h2>
                        ${candidates.filter(candidate => candidate.stage === stage).map(candidate => `
                            <article class="mini-card">
                                <strong>${candidate.name || 'N/A'}</strong>
                                <span>${candidate.role || 'No Role'}</span>
                                <small>Owner: ${candidate.owner || 'Unassigned'}</small>
                            </article>
                        `).join('') || '<div class="empty-state compact">No candidates</div>'}
                    </div>
                `).join('')}
            </section>
        `);
    }
};

const performance = {
    async init() {
        ui.showLoader();
        let employeesData = [];
        try {
            if (window.APIAdapter && APIAdapter.mode === 'api') {
                employeesData = await APIAdapter.getData('employees');
            } else {
                employeesData = db.getCollection('employees') || [];
            }
        } catch (e) { console.warn('Failed to load employees for performance', e); employeesData = db.getCollection('employees') || []; }

        ui.moduleShell('Performance', 'Goals, reviews, and ratings', '<button class="btn btn-primary"><i class="fas fa-star"></i> Start Review</button>', `
            <section class="content-card">
                <div class="table-header"><div><h2>Review Snapshot</h2><p>Quarterly performance tracking</p></div></div>
                <div id="performance-table"></div>
            </section>
        `);
        ui.renderTable('performance-table', [
            { key: 'name', label: 'Employee' },
            { key: 'department', label: 'Department' },
            { key: 'role', label: 'Role' },
            { key: 'rating', label: 'Rating', render: item => `${item.rating || '4.1'} / 5` },
            { key: 'goals', label: 'Goals', render: () => ui.badge('On Track') }
        ], employeesData);
    }
};

const documents = {
    async init() {
        ui.showLoader();
        let docs = [];
        try {
            if (window.APIAdapter && APIAdapter.mode === 'api') {
                docs = await APIAdapter.getData('documents');
            } else {
                docs = db.getCollection('documents') || [];
            }
        } catch (e) { console.warn('Failed to load documents', e); docs = db.getCollection('documents') || []; }

        ui.moduleShell('Documents', 'Secure employee files and expiry reminders', '<button class="btn btn-primary"><i class="fas fa-upload"></i> Upload</button>', `
            <section class="content-card">
                <div class="table-header"><div><h2>Document Register</h2><p>Verification and compliance status</p></div></div>
                <div id="documents-table"></div>
            </section>
        `);
        ui.renderTable('documents-table', [
            { key: 'employeeName', label: 'Employee' },
            { key: 'type', label: 'Document' },
            { key: 'expiry', label: 'Expiry' },
            { key: 'status', label: 'Status', render: item => ui.badge(item.status) }
        ], docs);
    }
};

const settings = {
    init() {
        const config = db.getAllData().settings;
        ui.moduleShell('Settings', 'Roles, policies, and workflow configuration', '<button class="btn btn-primary"><i class="fas fa-save"></i> Save</button>', `
            <section class="settings-grid">
                <div class="content-card settings-panel">
                    <h2><i class="fas fa-cloud"></i> NetSuite Integration</h2>
                    <div class="netsuite-config">
                        <div class="form-group">
                            <label>Realm</label>
                            <input type="text" id="netsuite-realm" placeholder="e.g., 12345678" value="${NetSuiteConfig.getConfig()?.realm || ''}">
                        </div>
                        <div class="form-group">
                            <label>Consumer Key</label>
                            <input type="password" id="netsuite-consumer-id" placeholder="OAuth Consumer Key" value="${NetSuiteConfig.getConfig()?.consumerId || ''}">
                        </div>
                        <div class="form-group">
                            <label>Consumer Secret</label>
                            <input type="password" id="netsuite-consumer-secret" placeholder="OAuth Consumer Secret" value="">
                        </div>
                        <div class="form-group">
                            <label>Token ID</label>
                            <input type="password" id="netsuite-token-id" placeholder="OAuth Token ID" value="${NetSuiteConfig.getConfig()?.tokenId || ''}">
                        </div>
                        <div class="form-group">
                            <label>Token Secret</label>
                            <input type="password" id="netsuite-token-secret" placeholder="OAuth Token Secret" value="">
                        </div>
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="settings.connectNetSuite()"><i class="fas fa-plug"></i> Connect NetSuite</button>
                            <button class="btn btn-outline" onclick="settings.syncNetSuite()"><i class="fas fa-sync"></i> Sync Data</button>
                            <button class="btn btn-outline btn-danger" onclick="settings.disconnectNetSuite()"><i class="fas fa-unlink"></i> Disconnect</button>
                        </div>
                        <div id="netsuite-status" class="status-message"></div>
                    </div>
                </div>
                
                ${this.panel('Roles', config.roles)}
                ${this.panel('Departments', config.departments)}
                ${this.panel('Leave Types', config.leaveTypes)}
                <div class="content-card settings-panel">
                    <h2>Approval Rules</h2>
                    <label>Approval levels</label>
                    <input type="number" value="${config.approvalLevels}" min="1" max="5">
                    <label class="toggle-row"><input type="checkbox" checked> Require audit note for payroll changes</label>
                    <label class="toggle-row"><input type="checkbox" checked> Notify manager for leave requests</label>
                </div>
            </section>
        `);
    },

    /**
     * Connect to NetSuite
     */
    connectNetSuite() {
        const realm = document.getElementById('netsuite-realm').value;
        const consumerId = document.getElementById('netsuite-consumer-id').value;
        const consumerSecret = document.getElementById('netsuite-consumer-secret').value;
        const tokenId = document.getElementById('netsuite-token-id').value;
        const tokenSecret = document.getElementById('netsuite-token-secret').value;

        if (!realm || !consumerId || !consumerSecret || !tokenId || !tokenSecret) {
            ui.showNotification('Please fill in all NetSuite credentials', 'error');
            return;
        }

        const result = NetSuiteAPI.init(realm, consumerId, consumerSecret, tokenId, tokenSecret);
        
        if (result.success) {
            ui.showNotification('NetSuite connected successfully!', 'success');
            document.getElementById('netsuite-status').innerHTML = '<p class="success">✓ Connected to NetSuite</p>';
            
            // Update settings
            const config = db.getAllData();
            config.settings.netsuiteEnabled = true;
            config.settings.dataSource = 'netsuite';
            db.saveAll(config);
        } else {
            ui.showNotification('Failed to connect NetSuite', 'error');
        }
    },

    /**
     * Sync data from NetSuite
     */
    async syncNetSuite() {
        if (!NetSuiteConfig.isConfigured()) {
            ui.showNotification('NetSuite not configured. Please configure first.', 'error');
            return;
        }

        ui.showLoader();
        document.getElementById('netsuite-status').innerHTML = '<p>Syncing data from NetSuite...</p>';

        try {
            const syncResults = await NetSuiteAPI.syncData(['employees', 'payroll', 'attendance', 'leave', 'recruitment']);
            
            let message = 'Sync Results:\n';
            Object.entries(syncResults).forEach(([dataType, result]) => {
                if (result.synced) {
                    message += `✓ ${dataType}: ${result.count} records\n`;
                } else {
                    message += `✗ ${dataType}: ${result.error}\n`;
                }
            });

            console.log(message);
            ui.showNotification('NetSuite data synced successfully!', 'success');
            document.getElementById('netsuite-status').innerHTML = `<p class="success">✓ Last synced: ${new Date().toLocaleString()}</p>`;
        } catch (error) {
            console.error('Sync error:', error);
            ui.showNotification('Failed to sync NetSuite data: ' + error.message, 'error');
            document.getElementById('netsuite-status').innerHTML = '<p class="error">✗ Sync failed</p>';
        } finally {
            ui.hideLoader();
        }
    },

    /**
     * Disconnect from NetSuite
     */
    disconnectNetSuite() {
        if (confirm('Are you sure you want to disconnect from NetSuite?')) {
            NetSuiteConfig.clearConfig();
            
            const config = db.getAllData();
            config.settings.netsuiteEnabled = false;
            config.settings.dataSource = 'local';
            db.saveAll(config);
            
            document.getElementById('netsuite-status').innerHTML = '<p class="warning">Disconnected from NetSuite</p>';
            ui.showNotification('Disconnected from NetSuite', 'success');
        }
    },

    panel(title, values) {
        return `
            <div class="content-card settings-panel">
                <h2>${title}</h2>
                <div class="chip-list">${values.map(value => `<span class="chip">${value}</span>`).join('')}</div>
                <div class="inline-add"><input placeholder="Add ${title.toLowerCase()}"><button class="btn btn-outline btn-sm">Add</button></div>
            </div>
        `;
    }
};

const audit = {
    init() {
        ui.moduleShell('Audit Logs', 'Compliance trail for sensitive actions', '<button class="btn btn-outline"><i class="fas fa-filter"></i> Filter</button>', `
            <section class="content-card">
                <div class="table-header"><div><h2>System Activity</h2><p>Who changed what and when</p></div></div>
                <div id="audit-table"></div>
            </section>
        `);
        ui.renderTable('audit-table', [
            { key: 'time', label: 'Time' },
            { key: 'actor', label: 'Actor' },
            { key: 'module', label: 'Module' },
            { key: 'action', label: 'Action' }
        ], db.getCollection('auditLogs'));
    }
};

window.App = App;
