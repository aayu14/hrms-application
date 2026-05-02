# Environment Configuration Example

# This file shows how to configure the HRMS system for both local and NetSuite modes

## Development Mode (Local Storage)

No configuration needed! The system will:
- Run in local mode by default
- Store all data in browser's localStorage
- No external API calls required

To reset local data:
```javascript
// In browser console:
db.reset();
```

## Production Mode (NetSuite Integration)

### Backend Proxy Configuration

Create a `.env` file in your backend project:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# NetSuite OAuth Credentials
NETSUITE_CONSUMER_KEY=your_oauth_consumer_key_here
NETSUITE_CONSUMER_SECRET=your_oauth_consumer_secret_here
NETSUITE_TOKEN_SECRET=your_token_secret_here

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_FILE_PATH=./logs/hrms.log

# Database (optional - for caching)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hrms_cache
DB_USER=hrms_user
DB_PASSWORD=secure_password
```

### Frontend Configuration

Update `netsuite.js` with your backend URL:

```javascript
// In netsuite.js, update the baseUrl:
const NetSuiteAPI = {
    baseUrl: 'https://your-backend-domain.com/api', // Update this
    // ... rest of the code
};

// Or in api-adapter.js:
const APIAdapter = {
    apiBaseUrl: 'https://your-backend-domain.com/api', // Update this
    // ... rest of the code
};
```

### HTML Configuration

No changes needed to index.html - configuration is handled in JS files.

---

## Data Source Configuration

### Switch to Local Mode
```javascript
// In console:
db.getAllData().settings.dataSource = 'local';
APIAdapter.setMode('local');
```

### Switch to NetSuite Mode
```javascript
// In console:
db.getAllData().settings.dataSource = 'netsuite';
APIAdapter.setMode('api');
```

---

## Database Configuration

### LocalStorage (Default)

- Automatic persistence
- Limit: ~10MB per domain
- Sync: When data is modified
- Reset: `db.reset()` or clear browser cache

### NetSuite API

- Real-time data
- Unlimited data
- Sync: Manual or scheduled
- Authentication: OAuth 1.0

---

## Deployment Checklist

- [ ] Backend proxy server deployed
- [ ] Environment variables configured
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] NetSuite credentials verified
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Database backup strategy in place
- [ ] Error monitoring set up
- [ ] Load testing completed

---

## Performance Tuning

### Caching Configuration

```javascript
// In api-adapter.js:
const APIAdapter = {
    cacheEnabled: true,
    cacheTimeout: 300000, // 5 minutes
    // ... rest of the code
};
```

### Sync Frequency

```javascript
// Set sync interval (in app.js or initialization script):
setInterval(async () => {
    const results = await NetSuiteAPI.syncData(['employees']);
    console.log('Data synced:', results);
}, 3600000); // 1 hour
```

### Pagination

```javascript
// Fetch employees in batches:
let offset = 0;
const limit = 100;

const allEmployees = [];
let hasMore = true;

while (hasMore) {
    const result = await NetSuiteAPI.getEmployees(limit, offset);
    allEmployees.push(...result.data);
    hasMore = result.data.length === limit;
    offset += limit;
}
```

---

## Error Handling

### Network Errors
The system automatically falls back to local storage if API is unavailable.

### Authentication Errors
Check credentials and refresh tokens in Settings panel.

### Rate Limiting
Implement exponential backoff on backend:
```javascript
// Example backoff strategy
const retryWithBackoff = async (fn, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429 && i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
            } else {
                throw error;
            }
        }
    }
};
```

---

## Security Considerations

1. **API Keys**: Store in backend `.env` only
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Whitelist specific domains
4. **Rate Limiting**: Prevent abuse
5. **Input Validation**: Validate all API inputs
6. **SQL Injection**: Use parameterized queries if caching with DB
7. **XSS Prevention**: Sanitize all user inputs
8. **CSRF Protection**: Implement CSRF tokens

---

## Monitoring & Logging

### Log Important Events

```javascript
// In backend proxy:
console.log(`[${new Date().toISOString()}] ${method} ${endpoint} - Status: ${status}`);

// In frontend:
db.log('User', 'Synced NetSuite data', 'Sync');
```

### Monitor Key Metrics

- API response times
- Sync success rate
- Cache hit rate
- Error frequency
- User activity

---

## Documentation

- **User Guide**: See README.md
- **API Reference**: See NETSUITESETUP.md
- **Troubleshooting**: See NETSUITESETUP.md
- **Code Examples**: See embedded comments in js files

---

## Version History

### v2.0 (Current)
- ✅ Full NetSuite integration
- ✅ Dynamic data loading
- ✅ API adapter layer
- ✅ Backend proxy example
- ✅ Settings UI

### v1.0
- Hard-coded dummy data
- Local storage only

---

**Setup Date**: 2026-05-01
**Last Modified**: 2026-05-01
