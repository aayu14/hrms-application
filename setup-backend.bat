@echo off
REM HRMS Pro - Quick Start Script for Windows
REM This script helps set up the NetSuite backend proxy

echo ===================================
echo HRMS Pro - NetSuite Proxy Setup
echo ===================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed!
    echo Please download from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo.
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK Node.js found: %NODE_VERSION%
echo.

REM Create backend directory
if not exist "hrms-backend" (
    mkdir hrms-backend
    echo OK Created backend directory
) else (
    echo OK Backend directory already exists
)

cd hrms-backend

echo.

REM Initialize npm project if not already done
if not exist "package.json" (
    echo Installing npm project...
    call npm init -y
    if %errorlevel% equ 0 (
        echo OK npm project initialized
    ) else (
        echo Error: Failed to initialize npm
        pause
        exit /b 1
    )
) else (
    echo OK npm project already exists
)

echo.

REM Install dependencies
echo Installing dependencies...
call npm install express oauth-1.0a crypto cors axios dotenv

if %errorlevel% equ 0 (
    echo OK Dependencies installed
) else (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.

REM Copy backend server file
if exist "..\backend-proxy-example.js" (
    copy ..\backend-proxy-example.js server.js
    echo OK Backend server file copied
) else (
    echo Warning: Could not find backend-proxy-example.js
    echo Please copy it manually
)

echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    (
        echo # Backend Server Configuration
        echo PORT=3000
        echo NODE_ENV=development
        echo.
        echo # NetSuite OAuth Credentials
        echo # Get these from your NetSuite account setup
        echo NETSUITE_CONSUMER_KEY=your_consumer_key_here
        echo NETSUITE_CONSUMER_SECRET=your_consumer_secret_here
        echo NETSUITE_TOKEN_SECRET=your_token_secret_here
        echo.
        echo # CORS Configuration
        echo CORS_ORIGIN=http://localhost:8000
        echo.
        echo # Logging
        echo LOG_LEVEL=info
    ) > .env
    echo OK Created .env file
    echo Warning: UPDATE the credentials in .env with your NetSuite credentials!
) else (
    echo OK .env file already exists
)

echo.
echo ===================================
echo Setup Complete!
echo ===================================
echo.
echo Next steps:
echo 1. Edit .env with your NetSuite credentials
echo 2. Run: npm start
echo 3. Server will start on http://localhost:3000
echo.
echo Then in HRMS app:
echo 1. Go to Settings - NetSuite Integration
echo 2. Enter your credentials
echo 3. Click 'Connect NetSuite'
echo 4. Click 'Sync Data'
echo.
pause
