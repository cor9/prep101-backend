#!/bin/bash

# PREP101 Environment Setup Script
# This script helps set up environment variables safely

echo "🔧 PREP101 Environment Setup"
echo "=============================="

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to backup the existing .env file? (y/n): " backup_choice
    if [[ $backup_choice == "y" || $backup_choice == "Y" ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Existing .env backed up"
    fi
fi

# Create .env from template if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f "env.template" ]; then
        cp env.template .env
        echo "✅ Created .env from template"
        echo "📝 Please edit .env with your actual values"
    else
        echo "❌ env.template not found!"
        exit 1
    fi
fi

# Check for required environment variables
echo ""
echo "🔍 Checking required environment variables..."

required_vars=(
    "DATABASE_URL"
    "ANTHROPIC_API_KEY"
    "JWT_SECRET"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "✅ All required environment variables are present"
else
    echo "⚠️  Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📝 Please add these to your .env file"
fi

# Security check
echo ""
echo "🔒 Security Check:"
if grep -q "sk-ant-api03-" .env; then
    echo "✅ Anthropic API key format detected"
else
    echo "⚠️  Anthropic API key not found or incorrect format"
fi

if grep -q "your_jwt_secret" .env; then
    echo "⚠️  JWT_SECRET still has default value - please change it!"
else
    echo "✅ JWT_SECRET appears to be customized"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Edit .env with your actual values"
echo "2. Never commit .env to git (it's in .gitignore)"
echo "3. Use 'npm start' to run the application"
echo ""
echo "📚 For help, see the README.md file"
