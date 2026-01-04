# Check and Disable IPv4 - Simple Commands

## Step 1: Get Your Token
1. Open https://supabase.com/dashboard/account/tokens in YOUR browser
2. Click "Generate new token"
3. Copy the token

## Step 2: Set the Token
```bash
export SUPABASE_ACCESS_TOKEN="paste-your-token-here"
```

## Step 3: Check If IPv4 is Enabled
```bash
curl -X GET "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq '.'
```

**Look for:** `"addon_type": "ipv4"` with `"enabled": true` = IPv4 is enabled ($4/month)

## Step 4: Disable IPv4 (Save $4/month)
```bash
curl -X DELETE "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons/ipv4" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

## Step 5: Re-enable If Needed (If Something Breaks)
```bash
curl -X POST "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addon_type": "ipv4"}'
```

That's it. No scripts needed. Just copy/paste.
