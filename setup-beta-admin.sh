#!/bin/bash

echo "🎭 PREP101 Beta Tester System Setup"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one first."
    echo "   Copy env.template to .env and fill in your database details."
    exit 1
fi

echo "✅ .env file found"
echo ""

# Load environment variables
source .env

# Check if database connection string is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env file"
    exit 1
fi

echo "✅ Database connection configured"
echo ""

echo "🚀 Setting up your first admin beta tester..."
echo ""

# Prompt for admin email
read -p "Enter your email address: " ADMIN_EMAIL

if [ -z "$ADMIN_EMAIL" ]; then
    echo "❌ Email address is required"
    exit 1
fi

echo ""
echo "📝 Creating admin beta tester for: $ADMIN_EMAIL"
echo ""

# Create SQL script
cat > setup-admin-beta.sql << EOF
-- PREP101 Admin Beta Tester Setup
-- Run this in your PostgreSQL database

-- First, check if user exists
SELECT 
    id, 
    email, 
    "isBetaTester", 
    "betaAccessLevel", 
    "betaStatus"
FROM "Users" 
WHERE email = '$ADMIN_EMAIL';

-- If user exists, update them to admin beta tester
UPDATE "Users" 
SET 
    "isBetaTester" = true,
    "betaAccessLevel" = 'admin',
    "betaStatus" = 'active',
    "betaStartedAt" = NOW(),
    "betaFeatures" = '["early-access", "priority-support", "advanced-rag", "bulk-guide-generation", "custom-methodology", "advanced-analytics", "api-access"]',
    "guidesLimit" = 999
WHERE email = '$ADMIN_EMAIL';

-- If no rows were updated, user doesn't exist
-- You'll need to register normally first, then run this update
EOF

echo "📄 SQL script created: setup-admin-beta.sql"
echo ""
echo "🔧 Next steps:"
echo "1. Run the SQL script in your PostgreSQL database:"
echo "   psql $DATABASE_URL -f setup-admin-beta.sql"
echo ""
echo "2. Or copy and paste the SQL commands directly into your database"
echo ""
echo "3. After running the SQL, you can:"
echo "   - Log in to your account"
echo "   - Access admin beta features at /api/beta/*"
echo "   - Invite other beta testers"
echo ""
echo "4. Test the system:"
echo "   curl -s http://localhost:5001/api/beta/features"
echo ""

echo "🎯 Beta Tester Access Levels:"
echo "   • Early: 25 guides/month + basic features"
echo "   • Premium: 100 guides/month + advanced features"
echo "   • Admin: Unlimited + all features + management"
echo ""

echo "✨ Your PREP101 Beta Tester System is ready!"
echo "   Check BETA_TESTER_SYSTEM.md for full documentation"
