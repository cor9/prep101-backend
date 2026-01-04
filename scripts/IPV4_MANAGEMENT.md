# IPv4 Add-on Management for Prep101

This guide explains how to check and disable the IPv4 add-on in Supabase to save ~$4/month.

## Prerequisites

1. **Get your Supabase Personal Access Token:**
   - Go to: https://supabase.com/dashboard/account/tokens
   - Click "Generate new token"
   - Give it a name (e.g., "IPv4 Management")
   - Copy the token (you'll only see it once!)

2. **Set the token as an environment variable:**
   ```bash
   export SUPABASE_ACCESS_TOKEN="your-token-here"
   ```

## Your Project Details

- **Project Ref:** `eokqyijxubrmompozguh`
- **Project Name:** Prep101

## Step 1: Check Current Status (Safe, Read-Only)

```bash
./scripts/check-disable-ipv4.sh
```

This will:
- Show all current add-ons
- Tell you if IPv4 is enabled
- Show you the cost if it's enabled

**What to look for:**
- If you see `"addon_type": "ipv4"` with `"enabled": true` → IPv4 is enabled ($4/month)
- If IPv4 is absent or `"enabled": false` → You're already saving money!

## Step 2: Disable IPv4 (Save $4/month)

**⚠️ Safety Check First:**

Your Prep101 app is safe to disable IPv4 because:
- ✅ Uses Supabase client library (`@supabase/supabase-js`)
- ✅ Uses standard PostgreSQL connection strings (hostname-based, not IP)
- ✅ Uses Sequelize ORM with `pg` driver (supports IPv6)
- ✅ Uses connection pooling via pgbouncer
- ✅ All access goes through modern methods (REST, RPC, Edge Functions)

**You're NOT safe if you're doing any of these (which you're not):**
- ❌ Connecting via raw IP (psql, pgAdmin, DBeaver using IP)
- ❌ Old SMTP services requiring IPv4
- ❌ Legacy tools hitting DB directly via IP
- ❌ Static IP allow-listing

**To disable:**

```bash
./scripts/disable-ipv4.sh
```

This will:
- Remove the dedicated IPv4 address
- Stop IPv4 billing (~$4/month savings)
- Leave your project fully intact
- IPv6 + standard Supabase routing still works

**Expected outcome:**
- No downtime for your app (uses hostnames, not IPs)
- All services continue working normally
- You save ~$4/month

## Step 3: Test After Disabling

1. **Test your app:**
   - Hit Prep101: https://prep101.site
   - Run one test workflow
   - Create a guide
   - Check admin routes

2. **If anything breaks** (very unlikely):
   - Re-enable IPv4 (see Step 4)
   - Wait 1-2 minutes
   - Services recover automatically
   - No rebuilds or migrations needed

## Step 4: Re-enable IPv4 (If Needed)

If something breaks (which it shouldn't), you can re-enable:

```bash
./scripts/enable-ipv4.sh
```

**What happens:**
- IPv4 address is added back
- Billing resumes (~$4/month)
- Services recover automatically within 1-2 minutes
- No rebuilds or migrations needed

## Manual API Commands

If you prefer to run the API commands directly:

### Check Status
```bash
curl -X GET "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq '.'
```

### Disable IPv4
```bash
curl -X DELETE "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons/ipv4" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Enable IPv4 (if needed)
```bash
curl -X POST "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addon_type": "ipv4"}'
```

## Summary

**Current Setup:**
- ✅ Modern connection methods (no raw IP)
- ✅ Safe to disable IPv4
- ✅ Will save ~$4/month

**Next Steps:**
1. Get your access token from Supabase dashboard
2. Run `./scripts/check-disable-ipv4.sh` to check status
3. If IPv4 is enabled, run `./scripts/disable-ipv4.sh` to disable
4. Test your app
5. Enjoy the savings! 💰
