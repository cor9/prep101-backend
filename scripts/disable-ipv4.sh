#!/bin/bash

# Script to disable IPv4 add-on in Supabase
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

echo "🔄 Disabling IPv4 add-on for project: $PROJECT_REF"
echo ""
echo "⚠️  This will:"
echo "   - Remove the dedicated IPv4 address"
echo "   - Stop IPv4 hourly billing (\$4/month savings)"
echo "   - Leave your project fully intact"
echo "   - IPv6 + standard Supabase routing will still work"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "🚀 Disabling IPv4 add-on..."
echo "---"

# Disable IPv4 add-on
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons/ipv4" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
  echo "✅ IPv4 add-on disabled successfully!"
  echo ""
  echo "💰 You're now saving ~\$4/month"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Test your application to ensure everything works"
  echo "   2. If anything breaks, you can re-enable with: ./scripts/enable-ipv4.sh"
else
  echo "❌ Error disabling IPv4 add-on"
  echo "HTTP Code: $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
