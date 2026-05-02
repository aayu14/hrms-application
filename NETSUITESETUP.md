# HRMS Pro - NetSuite Integration Setup Guide

## 📋 Overview

Your HRMS system has been completely refactored to support **fully dynamic data loading** and **NetSuite integration**. No more hard-coded dummy data!

### Key Changes Made:
1. ✅ **Removed all hard-coded dummy data** - Database starts empty
2. ✅ **Added NetSuite API integration** - Connect directly to your NetSuite instance
3. ✅ **Created API Adapter** - Unified interface for local and API data sources
4. ✅ **Added dynamic data loading** - Automatic sync capabilities
5. ✅ **Created settings panel** - Easy NetSuite configuration UI

---

## 🚀 Getting Started

### Option 1: Local Development (No NetSuite)

If you want to start with local data while you set up NetSuite:

1. Open the HRMS application in your browser
2. Go to **Settings** → **NetSuite Integration**
3. Start adding employees, attendance, and payroll data through the UI
4. All data will be stored in browser's localStorage

### Option 2: NetSuite Integration (Production)

Follow the steps below to connect your NetSuite instance.

---

## 🔌 NetSuite Integration Setup

### Step 1: Prerequisites

Before connecting to NetSuite, you need:

1. **NetSuite Account** with API access enabled
2. **OAuth Credentials** generated in NetSuite:
   - Consumer Key
   - Consumer Secret
   - Token ID
   - Token Secret
   - Realm ID (Account number)

### Step 2: Retrieve NetSuite Credentials

#### In your NetSuite Account:

1. Navigate to **Setup → Integrations → Manage Integrations**
2. Click **New** to create a new integration
3. Fill in details:
   - **Name**: HRMS Integration
   - **Authentication**: OAuth 2.0
   - **API Scopes**: Select:
     - `rest_webservices`
     - `employees` (if available)
     - `payroll` (if available)
4. Generate and copy your credentials:
   - Consumer Key
   - Consumer Secret
5. Create a Token Grant:
   - Navigate to **Setup → Users/Roles → Access Tokens**
   - Click **New**
   - Select your integration
   - Copy Token ID and Token Secret

#### Find Your Realm:
- Go to **Setup → Company Information**
- Look for "Account ID" - this is your Realm

### Step 3: Backend Proxy Setup (IMPORTANT!)

**For security reasons, NEVER send API credentials from the frontend directly.**

You must deploy a backend proxy server. Use the provided `backend-proxy-example.js`:

#### Option A: Node.js Backend

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/

2. **Create a backend folder:**
   ```bash
   mkdir hrms-backend
   cd hrms-backend
   npm init -y
   ```

3. **Install dependencies:**
   ```bash
   npm install express oauth-1.0a crypto cors axios dotenv
   ```

4. **Copy backend proxy file:**
   - Copy `backend-proxy-example.js` to your backend folder
   - Rename to `server.js`

5. **Create `.env` file:**
   ```
   NETSUITE_CONSUMER_KEY=your_consumer_key
   NETSUITE_CONSUMER_SECRET=your_consumer_secret
   NETSUITE_TOKEN_SECRET=your_token_secret
   PORT=3000
   ```

6. **Start the server:**
   ```bash
   node server.js
   ```

   You should see: `NetSuite API Proxy running on port 3000`

#### Option B: Deployment Platforms

**Heroku:**
```bash
# Install Heroku CLI
# heroku create your-app-name
# git push heroku main
```

**Vercel/Netlify:**
- Use serverless functions in your deployment platform
- Deploy the proxy handler function
- Update API endpoint in `netsuite.js`

**AWS Lambda:**
- Wrap the proxy code in a Lambda handler
- Use API Gateway to expose the endpoint

### Step 4: Connect in HRMS UI

1. Open your HRMS application
2. Navigate to **Settings** tab (in left sidebar)
3. Find **NetSuite Integration** section
4. Enter your credentials:
   - **Realm**: Your account ID (e.g., `12345678`)
   - **Consumer Key**: From OAuth integration
   - **Consumer Secret**: Your consumer secret
   - **Token ID**: From access token
   - **Token Secret**: From access token

5. Click **Connect NetSuite** button
   - You'll see a success message if credentials are valid

6. Click **Sync Data** to start importing data
   - Employees
   - Attendance records
   - Payroll data
   - Leave requests
   - Recruitment candidates

### Step 5: Verify Sync

After syncing:
- Go to **Employees** → Should show your NetSuite employees
- Go to **Payroll** → Should show your NetSuite payroll records
- Go to **Attendance** → Should show time tracking data
- Go to **Leave Management** → Should show leave requests

---

## 📁 New Files Added

### Core Integration Files:

1. **`netsuite.js`**
   - NetSuite API client
   - Authentication handling
   - API endpoints mapping
   - Sync functionality

2. **`api-adapter.js`**
   - Unified data interface
   - Local vs API mode switching
   - Caching layer
   - Error handling

3. **`backend-proxy-example.js`**
   - Secure backend proxy
   - OAuth signing
   - CORS handling
   - API request forwarding

### Modified Files:

1. **`db.js`**
   - Removed hard-coded dummy data
   - Database now starts empty
   - Supports dynamic data loading

2. **`app.js`**
   - Added NetSuite settings module
   - Updated recruitment module (loads from DB)
   - Updated performance module (loads from DB)
   - Added sync functions

3. **`index.html`**
   - Added new script imports
   - Added Settings and Audit Logs menu items

4. **`style.css`**
   - Added NetSuite configuration UI styles
   - Added settings grid styles
   - Added status message styling

---

## 🔄 Data Sync Process

### Automatic Sync
The system can periodically sync data from NetSuite:

```javascript
// Example - sync every hour
setInterval(async () => {
    const results = await NetSuiteAPI.syncData(['employees', 'payroll']);
    console.log('Sync complete:', results);
}, 3600000); // 1 hour
```

### Manual Sync
Users can manually trigger sync from Settings:
1. Click **Settings** → **NetSuite Integration**
2. Click **Sync Data** button
3. Monitor sync status

### Data Mapping

| HRMS Field | NetSuite Record |
|-----------|-----------------|
| Employees | `/employee` |
| Payroll | `/payroll` |
| Attendance | `/timetracking/timesheets` |
| Leave Requests | `/leave` |
| Recruitment | `/candidate` |
| Performance | `/performancereview` |

---

## 🔐 Security Best Practices

1. **Never commit credentials** - Use `.env` files
2. **Use HTTPS only** - All API calls must be encrypted
3. **Rotate tokens** - Change tokens periodically
4. **Limit scopes** - Only request needed permissions
5. **Backend proxy** - Keep secrets server-side only
6. **Rate limiting** - Implement on backend
7. **Audit logging** - Track all API calls

---

## 🧪 Testing

### Test Local Mode First:
```javascript
// In browser console:
APIAdapter.setMode('local');
APIAdapter.init({mode: 'local'});

// Add test employee
db.create('employees', {
    name: 'Test Employee',
    email: 'test@example.com',
    department: 'Engineering'
});

// Verify
console.log(db.getCollection('employees'));
```

### Test NetSuite Connection:
```javascript
// In browser console:
console.log(NetSuiteConfig.getConfig());
// Should show your credentials

// Test API call
NetSuiteAPI.getEmployees(10, 0).then(result => {
    console.log('NetSuite response:', result);
});
```

---

## 📊 Features

### ✅ Complete Modules
- **Dashboard** - Overview stats
- **Employees** - Full employee management (no hard-coded data)
- **Attendance** - Dynamic attendance tracking
- **Payroll** - Dynamic payroll processing
- **Leave Management** - Leave requests
- **Recruitment** - Candidate pipeline
- **Performance** - Performance reviews
- **Reports** - Analytics and reports
- **Settings** - NetSuite integration configuration
- **Audit Logs** - Activity tracking

### ✅ Dynamic Features
- Automatic data refresh
- Bi-directional sync
- API error handling with fallback
- Data caching
- Role-based access control ready

---

## 🐛 Troubleshooting

### "NetSuite not configured"
**Solution**: Go to Settings → NetSuite Integration and enter credentials

### "API Error: CORS"
**Solution**: Ensure backend proxy is running and accessible. Check:
```javascript
APIAdapter.apiBaseUrl // Should point to your backend
```

### "No data showing"
**Solution**: 
1. Check if NetSuite is connected
2. Click "Sync Data" button
3. Check browser console for errors
4. Verify backend proxy is running

### "Sync takes too long"
**Solution**:
- Reduce sync data types
- Implement pagination in NetSuite API calls
- Use backend caching

### "Password fields empty after page refresh"
**Design**: This is intentional for security - you'll need to re-enter them or use `.env` in backend

---

## 📝 API Reference

### NetSuiteAPI Methods

```javascript
// Initialize connection
NetSuiteAPI.init(realm, consumerId, consumerSecret, tokenId, tokenSecret);

// Get employees
await NetSuiteAPI.getEmployees(limit, offset);

// Get specific employee
await NetSuiteAPI.getEmployee(employeeId);

// Create employee
await NetSuiteAPI.createEmployee(employeeData);

// Get payroll records
await NetSuiteAPI.getPayroll(limit, offset);

// Get leave requests
await NetSuiteAPI.getLeaveRequests(limit, offset);

// Submit leave request
await NetSuiteAPI.submitLeaveRequest(leaveData);

// Sync all data
await NetSuiteAPI.syncData(['employees', 'payroll', 'attendance']);
```

### APIAdapter Methods

```javascript
// Initialize adapter
APIAdapter.init({mode: 'local', cacheEnabled: true});

// Switch mode
APIAdapter.setMode('api'); // or 'local'

// Get data
await APIAdapter.getData('employees');

// Create record
await APIAdapter.create('employees', recordData);

// Update record
await APIAdapter.update('employees', id, fields);

// Delete record
await APIAdapter.delete('employees', id);
```

---

## 🎯 Next Steps

1. ✅ Set up backend proxy server
2. ✅ Get NetSuite credentials
3. ✅ Configure in Settings
4. ✅ Sync data
5. ✅ Start using the system

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check backend server logs
4. Verify NetSuite API access is enabled
5. Test with backend proxy directly

---

## 📄 License

This HRMS Pro system is ready for production deployment with NetSuite integration.

**Last Updated**: 2026-05-01
**Version**: 2.0 (Dynamic with NetSuite)
