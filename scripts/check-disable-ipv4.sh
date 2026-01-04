#!/bin/bash

# Script to check and disable IPv4 add-on in Supabase
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

echo "🔍 Checking IPv4 add-on status for project: $PROJECT_REF"
echo ""

# Step 1: Check current IPv4 status
echo "📊 Current add-ons:"
echo "---"
curl -s -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Check if IPv4 is enabled
IPV4_ENABLED=$(curl -s -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" | jq -r '.[] | select(.addon_type == "ipv4") | .enabled // false')

if [ "$IPV4_ENABLED" = "true" ]; then
  echo "⚠️  IPv4 add-on is ENABLED (costing ~\$4/month)"
  echo ""
  echo "💡 To disable IPv4 and save \$4/month:"
  echo "   Run: ./scripts/disable-ipv4.sh"
  echo ""
  echo "   Or run this command:"
  echo "   curl -X DELETE \"https://api.supabase.com/v1/projects/$PROJECT_REF/billing/addons/ipv4\" \\"
  echo "     -H \"Authorization: Bearer \$SUPABASE_ACCESS_TOKEN\""
else
  echo "✅ IPv4 add-on is NOT enabled - you're already saving \$4/month!"
fi
