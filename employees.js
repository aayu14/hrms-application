const employees = {
  async init() {
    ui.showLoader();
    let employeesData = [];
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        employeesData = await APIAdapter.getData('employees');
      } else {
        employeesData = db.getCollection('employees') || [];
      }
    } catch (err) {
      console.error('Failed to load employees', err);
      employeesData = db.getCollection('employees') || [];
    }

    ui.moduleShell('Employees', 'Directory and profile management', '<button class="btn btn-primary" onclick="employees.showCreate()"><i class="fas fa-user-plus"></i> Add Employee</button>', `
      <section class="content-card">
        <div class="table-header"><div><h2>Employee Directory</h2><p>All active employees</p></div></div>
        <div id="employees-table"></div>
      </section>
    `);

    ui.renderTable('employees-table', [
      { key: 'employee_number', label: 'Emp #' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'role', label: 'Role' },
      { key: 'actions', label: 'Actions', render: item => `
          <button class="btn btn-sm btn-outline" onclick="employees.deleteEmployee('${item.id}')">Delete</button>
        ` }
    ], employeesData || []);
  },

  showCreate() {
    if (document.getElementById('employee-create-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'employee-create-modal';
    modal.style = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:8px;min-width:420px;">
        <h3 style="margin-top:0">Add Employee</h3>
        <form id="employee-create-form">
          <div style="margin-bottom:8px"><input name="employee_number" placeholder="Employee Number" required style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="name" placeholder="Full name" required style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="email" type="email" placeholder="Email" style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="department" placeholder="Department" style="width:100%;padding:8px" /></div>
          <div style="text-align:right"><button type="submit" style="padding:8px 12px">Create</button></div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('employee-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = { employee_number: f.employee_number.value.trim(), name: f.name.value.trim(), email: f.email.value.trim(), department: f.department.value.trim() };
      try {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
          await APIAdapter.create('employees', payload);
        } else {
          db.create('employees', payload);
        }
        ui.showNotification('Employee added', 'success');
        const m = document.getElementById('employee-create-modal'); if (m) m.remove();
        this.init();
      } catch (err) {
        console.error(err);
        ui.showNotification('Failed to create employee', 'error');
      }
    });
  },

  async deleteEmployee(id) {
    if (!confirm('Delete this employee?')) return;
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        await APIAdapter.delete('employees', id);
      } else {
        db.delete('employees', id);
      }
      ui.showNotification('Employee deleted', 'success');
      this.init();
    } catch (err) {
      console.error(err);
      ui.showNotification('Failed to delete employee', 'error');
    }
  }
};

window.employees = employees;
