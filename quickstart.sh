#!/bin/bash

echo "🚀 PREP101 Backend Quick Start"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.template .env
    echo "⚠️  Please edit .env file with your database credentials and JWT secret"
    echo "   Then run this script again"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if database is accessible
echo "🔍 Checking database connection..."
if node -e "
const { testConnection } = require('./database/connection');
testConnection().then(() => {
    console.log('Database connection successful');
    process.exit(0);
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});
" 2>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "   Please check your DATABASE_URL in .env file"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Starting server..."
echo "   Server will be available at: http://localhost:3001"
echo "   Health check: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
