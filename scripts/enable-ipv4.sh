#!/bin/bash

# Script to enable IPv4 add-on in Supabase (if needed)
# Project: Prep101 (eokqyijxubrmompozguh)

PROJECT_REF="eokqyijxubrmompozguh"

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN environment variable is not set"
  echo ""
  echo "📋 To get your access token:"
  echo "   1. Go to: https://supabase.com/dashboard/account/tokens"
  echo "   2. Click 'Generate new token'"
  echo "   3. Give it a name (e.g., 'IPv4 Management')"
  echo "   4. Copy the token"
  echo "   5. Run: export SUPABASE_ACCESS_TOKEN='your-token-here'"
  echo "   6. Then run this script again"
  exit 1
fi

echo "🔄 Enabling IPv4 add-on for project: $PROJECT_REF"
echo ""
echo "⚠️  This will:"
echo "   - Add a dedicated IPv4 address"
echo "   - Start IPv4 hourly billing (~\$4/month)"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "🚀 Enabling IPv4 add-on..."
echo "---"

# Enable IPv4 add-on
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addon_type": "ipv4"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ IPv4 add-on enabled successfully!"
  echo ""
  echo "⏳ Services should recover automatically within 1-2 minutes"
  echo ""
  echo "💰 This will cost ~\$4/month"
else
  echo "❌ Error enabling IPv4 add-on"
  echo "HTTP Code: $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
