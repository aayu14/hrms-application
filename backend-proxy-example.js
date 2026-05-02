/**
 * BACKEND PROXY - Example Node.js/Express Server for NetSuite API
 * This should be deployed on your backend server for security
 * 
 * Installation:
 * npm install express oauth-1.0a crypto cors
 * 
 * Usage: node backend-proxy-example.js
 */

const express = require('express');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

// OAuth 1.0 Configuration
const oauth = OAuth({
    consumer: {
        key: process.env.NETSUITE_CONSUMER_KEY,
        secret: process.env.NETSUITE_CONSUMER_SECRET
    },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
        return crypto
            .createHmac('sha256', key)
            .update(base_string)
            .digest('base64');
    }
});

/**
 * NetSuite API Proxy Endpoint
 * POST /api/netsuite
 */
app.post('/api/netsuite', async (req, res) => {
    try {
        const { method, endpoint, data, config } = req.body;

        // Validate configuration
        if (!config || !config.realm || !config.consumerId || !config.tokenId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid NetSuite configuration'
            });
        }

        // Construct request
        const request_data = {
            url: `https://${config.realm}.suiteapis.com/services/rest/record/v1${endpoint}`,
            method,
            data
        };

        // Generate OAuth signature
        const auth_header = oauth.toHeader(
            oauth.authorize(request_data, {
                key: config.tokenId,
                secret: process.env.NETSUITE_TOKEN_SECRET
            })
        );

        // Make request to NetSuite
        const response = await axios({
            method,
            url: request_data.url,
            headers: {
                ...auth_header,
                'Content-Type': 'application/json'
            },
            data
        });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('NetSuite API Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

/**
 * Sync Endpoint - Manually trigger data sync
 * POST /api/sync
 */
app.post('/api/sync', async (req, res) => {
    try {
        const { dataTypes, config } = req.body;

        if (!config || !config.realm) {
            return res.status(400).json({
                success: false,
                error: 'Invalid configuration'
            });
        }

        const syncResults = {};

        for (const dataType of dataTypes) {
            try {
                let endpoint = '';
                switch (dataType) {
                    case 'employees':
                        endpoint = '/employee?limit=100';
                        break;
                    case 'payroll':
                        endpoint = '/payroll?limit=100';
                        break;
                    case 'attendance':
                        endpoint = '/timetracking/timesheets?limit=100';
                        break;
                    case 'leave':
                        endpoint = '/leave?limit=100';
                        break;
                    case 'recruitment':
                        endpoint = '/candidate?limit=100';
                        break;
                    default:
                        continue;
                }

                const request_data = {
                    url: `https://${config.realm}.suiteapis.com/services/rest/record/v1${endpoint}`,
                    method: 'GET'
                };

                const auth_header = oauth.toHeader(
                    oauth.authorize(request_data, {
                        key: config.tokenId,
                        secret: process.env.NETSUITE_TOKEN_SECRET
                    })
                );

                const response = await axios({
                    method: 'GET',
                    url: request_data.url,
                    headers: {
                        ...auth_header,
                        'Content-Type': 'application/json'
                    }
                });

                syncResults[dataType] = {
                    synced: true,
                    count: response.data.items?.length || 0
                };

            } catch (error) {
                syncResults[dataType] = {
                    synced: false,
                    error: error.message
                };
            }
        }

        res.json({
            success: true,
            syncResults
        });

    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Health Check
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NetSuite API Proxy running on port ${PORT}`);
    console.log('Make sure to set environment variables:');
    console.log('- NETSUITE_CONSUMER_KEY');
    console.log('- NETSUITE_CONSUMER_SECRET');
    console.log('- NETSUITE_TOKEN_SECRET');
});
