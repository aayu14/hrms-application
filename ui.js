const ui = {
    init() {
        this.bindGlobalSearch();
        this.bindThemeToggle();
    },

    updateActiveNav(view) {
        document.querySelectorAll('[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        const current = document.getElementById('current-page');
        if (current) current.textContent = this.title(view);
    },

    title(value) {
        return value.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    },

    showLoader() {
        const app = document.getElementById('app-content');
        if (!app) return;
        app.innerHTML = `
            <div class="loader-container">
                <div class="spinner"></div>
                <p>Loading HR workspace...</p>
            </div>
        `;
    },

    hideLoader() {},

    renderDashboard(stats) {
        const data = db.getAllData();
        const pendingLeave = data.leaveRequests.filter(item => item.status === 'Pending').length;
        const expiringDocs = data.documents.filter(item => item.status === 'Expiring Soon').length;

        this.setContent(`
            <section class="page-head">
                <div>
                    <p class="eyebrow">Workspace overview</p>
                    <h1>HR command center</h1>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="App.route('reports')"><i class="fas fa-download"></i> Export</button>
                    <button class="btn btn-primary" onclick="App.route('employees')"><i class="fas fa-user-plus"></i> Add Employee</button>
                </div>
            </section>

            <section class="stats-grid">
                ${this.statCard('Employees', stats.totalEmployees, 'fas fa-users', '+8% this quarter', 'success')}
                ${this.statCard('Present Today', stats.presentToday, 'fas fa-calendar-check', 'Live attendance', 'info')}
                ${this.statCard('Payroll Pending', stats.pendingPayroll, 'fas fa-money-check-alt', 'Needs approval', 'warning')}
                ${this.statCard('Leave Requests', pendingLeave, 'fas fa-plane-departure', 'Awaiting action', 'danger')}
                ${this.statCard('Expiring Docs', expiringDocs, 'fas fa-file-circle-exclamation', 'Review soon', 'warning')}
            </section>

            <section class="dashboard-grid">
                <div class="content-card">
                    <div class="table-header">
                        <div>
                            <h2>Approval Queue</h2>
                            <p>Leave, payroll, and document checks</p>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="App.route('leave')">Review</button>
                    </div>
                    ${this.approvalList(data)}
                </div>
                <div class="content-card">
                    <div class="table-header">
                        <div>
                            <h2>Department Health</h2>
                            <p>Headcount split across teams</p>
                        </div>
                    </div>
                    ${this.departmentBars(data.employees)}
                </div>
            </section>

            <section class="content-card mt-4">
                <div class="table-header">
                    <div>
                        <h2>Recent Audit Activity</h2>
                        <p>Compliance trail for key actions</p>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="App.route('audit')">View Logs</button>
                </div>
                ${this.auditTimeline(data.auditLogs.slice(0, 5))}
            </section>
        `);
    },

    statCard(label, value, icon, note, tone) {
        return `
            <article class="stat-card">
                <div class="stat-icon ${tone}"><i class="${icon}"></i></div>
                <span class="label">${label}</span>
                <strong class="value">${value}</strong>
                <small>${note}</small>
            </article>
        `;
    },

    approvalList(data) {
        const items = [
            ...data.leaveRequests.filter(item => item.status === 'Pending').map(item => ({ icon: 'fa-plane-departure', title: item.employeeName, meta: `${item.type} · ${item.days} day(s)`, status: item.status })),
            ...data.payroll.filter(item => item.status === 'Pending').map(item => ({ icon: 'fa-money-check-alt', title: item.employeeName, meta: `${item.month} ${item.year} · INR ${item.net.toLocaleString()}`, status: item.status })),
            ...data.documents.filter(item => item.status !== 'Verified').map(item => ({ icon: 'fa-file-lines', title: item.employeeName, meta: `${item.type} · ${item.expiry}`, status: item.status }))
        ].slice(0, 6);

        if (!items.length) return '<div class="empty-state">No approvals pending.</div>';
        return `<div class="list-stack">${items.map(item => `
            <div class="list-row">
                <span class="row-icon"><i class="fas ${item.icon}"></i></span>
                <div><strong>${item.title}</strong><small>${item.meta}</small></div>
                ${this.badge(item.status)}
            </div>
        `).join('')}</div>`;
    },

    departmentBars(employees) {
        const counts = employees.reduce((acc, employee) => {
            acc[employee.department] = (acc[employee.department] || 0) + 1;
            return acc;
        }, {});
        const max = Math.max(...Object.values(counts), 1);
        return `<div class="bar-list">${Object.entries(counts).map(([department, count]) => `
            <div class="bar-row">
                <div><strong>${department}</strong><span>${count} employee(s)</span></div>
                <div class="bar-track"><span style="width:${(count / max) * 100}%"></span></div>
            </div>
        `).join('')}</div>`;
    },

    auditTimeline(logs) {
        return `<div class="timeline">${logs.map(log => `
            <div class="timeline-item">
                <span></span>
                <div><strong>${log.action}</strong><small>${log.actor} · ${log.module} · ${log.time}</small></div>
            </div>
        `).join('')}</div>`;
    },

    renderTable(containerId, columns, data, actionGenerator = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!data || !data.length) {
            container.innerHTML = '<div class="empty-state">No records found. Try changing filters or adding a record.</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col.label}</th>`).join('')}
                            ${actionGenerator ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => `
                            <tr>
                                ${columns.map(col => `<td>${col.render ? col.render(item) : (item[col.key] ?? '-')}</td>`).join('')}
                                ${actionGenerator ? `<td><div class="actions">${actionGenerator(item)}</div></td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    moduleShell(title, subtitle, actions, body) {
        this.setContent(`
            <section class="page-head">
                <div>
                    <p class="eyebrow">${subtitle}</p>
                    <h1>${title}</h1>
                </div>
                <div class="header-actions">${actions || ''}</div>
            </section>
            ${body}
        `);
    },

    badge(status) {
        const className = String(status).toLowerCase().replace(/\s+/g, '-');
        return `<span class="badge badge-${className}">${status}</span>`;
    },

    setContent(html) {
        const app = document.getElementById('app-content');
        if (app) app.innerHTML = html;
    },

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    },

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
        return container;
    },

    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};
        return Object.fromEntries(new FormData(form).entries());
    },

    bindGlobalSearch() {
        const input = document.getElementById('global-search');
        if (!input) return;
        input.addEventListener('input', event => {
            const query = event.target.value.trim().toLowerCase();
            document.querySelectorAll('[data-search-row]').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        });
    },

    bindThemeToggle() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        button.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            button.innerHTML = document.body.classList.contains('dark-mode') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }
};

window.ui = ui;
window.UI = ui;
