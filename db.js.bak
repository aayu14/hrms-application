const STORAGE_KEY = 'hrms_db_v2';

const today = new Date().toISOString().split('T')[0];

// Empty initial data structure - all data will be loaded from NetSuite or user input
const initialData = {
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
        dataSource: 'local', // 'local' or 'netsuite'
        netsuiteEnabled: false
    }
};

const db = {
    init() {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) this._persist(initialData);
    },

    _persist(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    getAllData() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : structuredClone(initialData);
    },

    saveAll(data) {
        this._persist(data);
    },

    getCollection(collectionName) {
        return this.getAllData()[collectionName] || [];
    },

    getAll(collectionName) {
        return this.getCollection(collectionName);
    },

    get(collectionName) {
        return this.getCollection(collectionName);
    },

    set(collectionName, value) {
        const data = this.getAllData();
        data[collectionName] = value;
        this._persist(data);
    },

    save(collectionName, value) {
        this.set(collectionName, value);
    },

    getData(collectionName) {
        return this.getCollection(collectionName);
    },

    saveData(collectionName, value) {
        this.set(collectionName, value);
    },

    create(collectionName, item) {
        const data = this.getAllData();
        const collection = data[collectionName] || [];
        const nextId = collection.length ? Math.max(...collection.map(item => Number(item.id) || 0)) + 1 : 1;
        const newItem = { ...item, id: nextId };
        collection.push(newItem);
        data[collectionName] = collection;
        this._persist(data);
        this.log('Admin User', `Created ${collectionName} record`, collectionName);
        return newItem;
    },

    update(collectionName, id, fields) {
        const data = this.getAllData();
        const collection = data[collectionName] || [];
        const index = collection.findIndex(item => String(item.id) === String(id));
        if (index === -1) return null;
        collection[index] = { ...collection[index], ...fields };
        data[collectionName] = collection;
        this._persist(data);
        this.log('Admin User', `Updated ${collectionName} record #${id}`, collectionName);
        return collection[index];
    },

    delete(collectionName, id) {
        const data = this.getAllData();
        const collection = data[collectionName] || [];
        data[collectionName] = collection.filter(item => String(item.id) !== String(id));
        this._persist(data);
        this.log('Admin User', `Deleted ${collectionName} record #${id}`, collectionName);
    },

    findById(collectionName, id) {
        return this.getCollection(collectionName).find(item => String(item.id) === String(id));
    },

    getCount(collectionName) {
        return this.getCollection(collectionName).length;
    },

    getAttendanceCount(date) {
        return this.getCollection('attendance').filter(item => item.date === date && item.status === 'Present').length;
    },

    getPendingPayrollCount() {
        return this.getCollection('payroll').filter(item => item.status === 'Pending').length;
    },

    log(actor, action, module) {
        const data = this.getAllData();
        const logs = data.auditLogs || [];
        const nextId = logs.length ? Math.max(...logs.map(log => Number(log.id) || 0)) + 1 : 1;
        logs.unshift({ id: nextId, actor, action, module, time: new Date().toLocaleString() });
        data.auditLogs = logs.slice(0, 50);
        this._persist(data);
    },

    reset() {
        this._persist(initialData);
        window.location.reload();
    }
};

db.init();
window.db = db;
