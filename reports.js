const reports = {
  async init() {
    ui.showLoader();
    let employees = [], attendance = [], leaveRequests = [], payroll = [];
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        employees = await APIAdapter.getData('employees');
        attendance = await APIAdapter.getData('attendance');
        leaveRequests = await APIAdapter.getData('leaveRequests');
        payroll = await APIAdapter.getData('payroll_exports');
      } else {
        employees = db.getCollection('employees') || [];
        attendance = db.getCollection('attendance') || [];
        leaveRequests = db.getCollection('leaveRequests') || [];
        payroll = db.getCollection('payroll') || [];
      }
    } catch (e) { console.warn('Reports load failed', e); employees = db.getCollection('employees') || []; }

    const totalEmployees = Array.isArray(employees) ? employees.length : 0;
    const presentToday = Array.isArray(attendance) ? attendance.filter(a => a.date === new Date().toISOString().split('T')[0]).length : 0;
    const pendingLeave = Array.isArray(leaveRequests) ? leaveRequests.filter(l => l.status === 'Pending').length : 0;

    ui.moduleShell('Reports', 'Analytics and exports', '<button class="btn btn-outline" onclick="reports.init()">Refresh</button>', `
      <section class="content-card">
        <div class="table-header"><div><h2>Overview</h2><p>Quick operational metrics</p></div></div>
        <div class="stats-grid">
          <div class="stat-card"><strong>${totalEmployees}</strong><small>Total employees</small></div>
          <div class="stat-card"><strong>${presentToday}</strong><small>Present today</small></div>
          <div class="stat-card"><strong>${pendingLeave}</strong><small>Pending leave</small></div>
        </div>
        <canvas id="reports-chart" style="max-width:700px;margin-top:20px"></canvas>
      </section>
    `);

    // draw a small chart if Chart.js is available
    try {
      const ctx = document.getElementById('reports-chart').getContext('2d');
      if (window.Chart && ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Employees','Present','Pending Leave'],
            datasets: [{ label: 'Count', data: [totalEmployees, presentToday, pendingLeave], backgroundColor: ['#3b82f6','#10b981','#f59e0b'] }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) { /* ignore chart errors */ }
  }
};

window.reports = reports;
