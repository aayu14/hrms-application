const leave = {
  async init() {
    ui.showLoader();
    let requests = [];
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        requests = await APIAdapter.getData('leaveRequests');
      } else {
        requests = db.getCollection('leaveRequests') || [];
      }
    } catch (e) {
      console.warn('Failed to load leave requests', e);
      requests = db.getCollection('leaveRequests') || [];
    }

    ui.moduleShell('Leave Management', 'Approve and manage leave requests', '<button class="btn btn-primary" onclick="leave.refresh()"><i class="fas fa-sync"></i> Refresh</button>', `
      <section class="content-card">
        <div class="table-header"><div><h2>Leave Requests</h2><p>Pending and historical requests</p></div></div>
        <div id="leave-table"></div>
      </section>
    `);

    ui.renderTable('leave-table', [
      { key: 'employeeName', label: 'Employee' },
      { key: 'type', label: 'Type' },
      { key: 'startDate', label: 'Start' },
      { key: 'endDate', label: 'End' },
      { key: 'days', label: 'Days' },
      { key: 'status', label: 'Status', render: r => ui.badge(r.status) },
      { key: 'actions', label: 'Actions', render: r => (r.status === 'Pending' ? `
            <button class="btn btn-sm btn-success" onclick="leave.updateStatus('${r.id}','Approved')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="leave.updateStatus('${r.id}','Rejected')">Reject</button>
          ` : '') }
    ], requests || []);
  },

  async refresh() { await this.init(); },

  async updateStatus(id, status) {
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        await APIAdapter.update('leaveRequests', id, { status });
      } else if (window.Attendance && Attendance.updateLeaveStatus) {
        await Attendance.updateLeaveStatus(id, status);
      } else {
        const arr = db.getCollection('leaveRequests') || [];
        const idx = arr.findIndex(x => x.id === id);
        if (idx !== -1) { arr[idx].status = status; db.set('leaveRequests', arr); }
      }
      ui.showNotification('Leave updated', 'success');
      this.init();
    } catch (e) { console.error('Failed to update leave', e); ui.showNotification('Failed to update leave','error'); }
  }
};

window.leave = leave;
