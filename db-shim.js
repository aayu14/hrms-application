(function (global) {
  const STORAGE_KEY = 'hrms_db_v2';
  const API_BASE = window.__API_BASE__ || '/api';

  let localCache = null;

  function defaultData() {
    return {
      employees: [],
      attendance: [],
      payroll: [],
      leaveRequests: [],
      documents: [],
      auditLogs: [],
      recruitment: [],
      performance: [],
      settings: {
        roles: ['Admin', 'HR', 'Manager', 'Employee', 'Finance'],
        departments: [],
        leaveTypes: ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Work From Home'],
        approvalLevels: 2,
        dataSource: 'local',
        netsuiteEnabled: false
      }
    };
  }

  function loadCache() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { localCache = JSON.parse(raw); } catch (e) { localCache = defaultData(); }
    } else {
      localCache = defaultData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localCache));
    }
  }

  function persistCache() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localCache)); } catch (e) { console.warn('persist failed', e); }
  }

  async function postJson(path, body) {
    try {
      const token = localStorage.getItem('hrms_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      // ignore — we'll continue using local cache
      console.warn('API sync error:', err.message);
      return null;
    }
  }

  // Fire-and-forget PUT
  async function putJson(path, body) {
    try {
      const token = localStorage.getItem('hrms_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(API_BASE + path, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        credentials: 'include'
      });
    } catch (err) {
      console.warn('API sync error:', err.message);
    }
  }

  // Fire-and-forget DELETE
  async function deleteJson(path) {
    try {
      const token = localStorage.getItem('hrms_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(API_BASE + path, { method: 'DELETE', credentials: 'include', headers });
    } catch (err) {
      console.warn('API sync error:', err.message);
    }
  }

  const shim = {
    init() { loadCache(); },
    _persist() { persistCache(); },
    getAllData() { return localCache; },
    saveAll(data) { localCache = data; persistCache(); },
    getCollection(name) { return localCache[name] || []; },
    getAll(name) { return this.getCollection(name); },
    get(name) { return this.getCollection(name); },
    set(name, value) { localCache[name] = value; persistCache(); },
    save(name, value) { this.set(name, value); },
    getData(name) { return this.getCollection(name); },
    saveData(name, value) { this.set(name, value); },
    create(name, item) {
      const collection = localCache[name] || [];
      const nextId = Date.now();
      const newItem = Object.assign({ id: nextId }, item);
      collection.push(newItem);
      localCache[name] = collection;
      persistCache();
      // Try to sync to server in background
      postJson(`/${name}`, newItem).catch(()=>{});
      return newItem;
    },
    update(name, id, fields) {
      const collection = localCache[name] || [];
      const index = collection.findIndex(i => String(i.id) === String(id));
      if (index === -1) return null;
      collection[index] = Object.assign({}, collection[index], fields);
      localCache[name] = collection;
      persistCache();
      putJson(`/${name}/${id}`, fields).catch(()=>{});
      return collection[index];
    },
    delete(name, id) {
      localCache[name] = (localCache[name] || []).filter(i => String(i.id) !== String(id));
      persistCache();
      deleteJson(`/${name}/${id}`).catch(()=>{});
      return true;
    },
    findById(name, id) { return (localCache[name] || []).find(i => String(i.id) === String(id)); },
    getCount(name) { return (localCache[name] || []).length; },
    getAttendanceCount(date) { return (localCache.attendance || []).filter(item => item.date === date && item.status === 'Present').length; },
    getPendingPayrollCount() { return (localCache.payroll || []).filter(item => item.status === 'Pending').length; },
    log(actor, action, module) {
      const logs = localCache.auditLogs || [];
      const nextId = logs.length ? Math.max(...logs.map(l => Number(l.id) || 0)) + 1 : 1;
      logs.unshift({ id: nextId, actor, action, module, time: new Date().toLocaleString() });
      localCache.auditLogs = logs.slice(0, 50);
      persistCache();
      postJson(`/audit-logs`, { actor, action, module }).catch(()=>{});
    },
    reset() {
      localCache = defaultData();
      persistCache();
      window.location.reload();
    }
  };

  shim.init();
  global.db = shim;
})(window);
