// Simple frontend auth helper: renders a login modal and manages JWT
(function () {
  function createLoginModal() {
    if (document.getElementById('hrms-login-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'hrms-login-modal';
    modal.style = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:8px;min-width:320px;">
        <h3 style="margin-top:0">Sign in</h3>
        <form id="hrms-login-form">
          <div style="margin-bottom:8px"><input name="email" type="email" placeholder="Email" required style="width:100%;padding:8px" /></div>
          <div style="margin-bottom:12px"><input name="password" type="password" placeholder="Password" required style="width:100%;padding:8px" /></div>
          <div style="text-align:right"><button type="submit" style="padding:8px 12px">Sign in</button></div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('hrms-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = form.email.value.trim();
      const password = form.password.value;
      try {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (!res.ok) {
          const err = await res.json().catch(()=>({ error: 'Login failed' }));
          return alert(err.error || 'Login failed');
        }
        const json = await res.json();
        localStorage.setItem('hrms_token', json.token);
        localStorage.setItem('hrms_user', JSON.stringify(json.user));
        const modalEl = document.getElementById('hrms-login-modal');
        if (modalEl) modalEl.remove();
        // Update UI name
        const nameEl = document.querySelector('.user-name');
        if (nameEl) nameEl.textContent = json.user.full_name || json.user.email;
        location.reload();
      } catch (err) {
        console.error(err);
        alert('Login request failed');
      }
    });
  }

  function addLogoutButton() {
    const container = document.querySelector('.user-profile');
    if (!container) return;
    if (document.getElementById('hrms-logout-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'hrms-logout-btn';
    btn.textContent = 'Logout';
    btn.style = 'margin-left:12px;padding:6px 8px';
    btn.addEventListener('click', () => {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      location.reload();
    });
    container.appendChild(btn);
  }

  // On load, if no token, show modal; otherwise update UI
  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('hrms_token');
    if (!token) {
      createLoginModal();
    } else {
      const user = JSON.parse(localStorage.getItem('hrms_user') || 'null');
      const nameEl = document.querySelector('.user-name');
      if (nameEl && user) nameEl.textContent = user.full_name || user.email;
      addLogoutButton();
    }
  });

})();
