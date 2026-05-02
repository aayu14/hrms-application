#!/bin/bash

# HRMS Pro - Quick Start Script
# This script helps set up the NetSuite backend proxy

echo "==================================="
echo "HRMS Pro - NetSuite Proxy Setup"
echo "==================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please download from https://nodejs.org/"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Node.js found: $(node -v)"
echo ""

# Create backend directory
mkdir -p hrms-backend
cd hrms-backend

echo "📁 Created backend directory"
echo ""

# Initialize npm project if not already done
if [ ! -f "package.json" ]; then
    echo "📦 Initializing npm project..."
    npm init -y
    echo "✅ npm project initialized"
else
    echo "✅ npm project already exists"
fi

echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install express oauth-1.0a crypto cors axios dotenv

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""

# Copy backend server file
if [ -f "../backend-proxy-example.js" ]; then
    cp ../backend-proxy-example.js server.js
    echo "✅ Backend server file copied"
else
    echo "⚠️  Could not find backend-proxy-example.js"
    echo "   Please copy it manually"
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Backend Server Configuration
PORT=3000
NODE_ENV=development

# NetSuite OAuth Credentials
# Get these from your NetSuite account setup
NETSUITE_CONSUMER_KEY=your_consumer_key_here
NETSUITE_CONSUMER_SECRET=your_consumer_secret_here
NETSUITE_TOKEN_SECRET=your_token_secret_here

# CORS Configuration
CORS_ORIGIN=http://localhost:8000

# Logging
LOG_LEVEL=info
EOF
    echo "✅ Created .env file"
    echo "⚠️  UPDATE the credentials in .env with your NetSuite credentials!"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Edit .env with your NetSuite credentials"
echo "2. Run: npm start"
echo "3. Server will start on http://localhost:3000"
echo ""
echo "Then in HRMS app:"
echo "1. Go to Settings → NetSuite Integration"
echo "2. Enter your credentials"
echo "3. Click 'Connect NetSuite'"
echo "4. Click 'Sync Data'"
echo ""
