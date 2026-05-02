const users = {
  async init() {
    ui.moduleShell('User Management', 'Create and manage users and roles', '<button class="btn btn-primary" onclick="users.showCreate()"><i class="fas fa-user-plus"></i> New User</button>', `
      <div id="users-table"></div>
      <div id="roles-table" style="margin-top:20px"></div>
    `);

    let usersData = [];
    let rolesData = [];
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        usersData = await APIAdapter.getData('users');
        rolesData = await APIAdapter.getData('roles');
      } else {
        usersData = db.getCollection('users') || [];
        rolesData = db.getCollection('roles') || [];
      }
    } catch (err) { console.warn('Failed to load users/roles', err); }

    ui.renderTable('users-table', [
      { key: 'email', label: 'Email' },
      { key: 'full_name', label: 'Name' },
      { key: 'role_name', label: 'Role' },
      { key: 'is_active', label: 'Active', render: item => item.is_active ? 'Yes' : 'No' },
      { key: 'actions', label: 'Actions', render: item => `
          <button class="btn btn-sm btn-outline" onclick="users.deleteUser('${item.id}')">Delete</button>
        ` }
    ], usersData || []);

    ui.renderTable('roles-table', [
      { key: 'name', label: 'Role' },
      { key: 'permissions', label: 'Permissions', render: r => (r.permissions || []).join(', ') },
      { key: 'actions', label: 'Actions', render: r => `<button class="btn btn-sm btn-outline" onclick="users.deleteRole('${r.id}')">Delete</button>` }
    ], rolesData || []);
  },

  showCreate() {
    if (document.getElementById('user-create-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'user-create-modal';
    modal.style = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:8px;min-width:360px;">
        <h3 style="margin-top:0">Create User</h3>
        <form id="user-create-form">
          <div style="margin-bottom:8px"><input name="email" type="email" placeholder="Email" required style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="full_name" placeholder="Full name" style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="password" type="password" placeholder="Password" required style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:8px"><input name="role" placeholder="Role name (e.g., Admin)" style="width:100%;padding:8px" /></div>
          <div style="text-align:right"><button type="submit" style="padding:8px 12px">Create</button></div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('user-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = { email: f.email.value.trim(), password: f.password.value, full_name: f.full_name.value.trim(), role_name: f.role.value.trim() };
      try {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
          await APIAdapter.create('users', payload);
        } else {
          db.create('users', payload);
        }
        ui.showNotification('User created', 'success');
        const m = document.getElementById('user-create-modal'); if (m) m.remove();
        users.init();
      } catch (err) {
        console.error(err);
        ui.showNotification('Failed to create user', 'error');
      }
    });
  },

  async deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        await APIAdapter.delete('users', id);
      } else {
        db.delete('users', id);
      }
      ui.showNotification('User deleted', 'success');
      this.init();
    } catch (err) { console.error(err); ui.showNotification('Failed to delete user','error'); }
  },

  async deleteRole(id) {
    if (!confirm('Delete this role?')) return;
    try {
      if (window.APIAdapter && APIAdapter.mode === 'api') {
        await APIAdapter.delete('roles', id);
      } else {
        // local fallback
        const roles = db.getCollection('roles') || [];
        db.set('roles', roles.filter(r => r.id !== id));
      }
      ui.showNotification('Role deleted', 'success');
      this.init();
    } catch (err) { console.error(err); ui.showNotification('Failed to delete role','error'); }
  }
};

window.users = users;
