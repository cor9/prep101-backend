# How to Check and Disable IPv4 - Super Simple Steps

## What You're Doing
Checking if you're paying $4/month for IPv4 in Supabase, and turning it off if you are.

---

## Step 1: Get Your Token from Supabase Website

1. Open your web browser
2. Go to: https://supabase.com/dashboard/account/tokens
3. Log in if needed
4. Click "Generate new token" button
5. Give it a name (like "IPv4 check")
6. Copy the token (long string of letters/numbers)

---

## Step 2: Open Terminal

1. On Mac: Press `Cmd + Space` (opens Spotlight)
2. Type: `Terminal`
3. Press Enter
4. Terminal window opens

---

## Step 3: Navigate to Your Project Folder

In Terminal, type this and press Enter:

```bash
cd /Users/coreyralston/prep101/prep101-app/prep101-backend
```

---

## Step 4: Set Your Token

Paste this into Terminal (replace `your-token-here` with the token you copied):

```bash
export SUPABASE_ACCESS_TOKEN="your-token-here"
```

Press Enter.

---

## Step 5: Check If IPv4 is Enabled

Copy and paste this entire thing into Terminal, then press Enter:

```bash
curl -X GET "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq '.'
```

**What to look for:**
- If you see `"addon_type": "ipv4"` and `"enabled": true` → You're paying $4/month
- If you don't see IPv4 at all, or it says `"enabled": false` → You're not paying for it

---

## Step 6: Disable IPv4 (If It's Enabled)

If IPv4 is enabled, copy and paste this to turn it off:

```bash
curl -X DELETE "https://api.supabase.com/v1/projects/eokqyijxubrmompozguh/billing/addons/ipv4" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Press Enter.

You should see a success message. You just saved $4/month!

---

## That's It!

- If something breaks (very unlikely), you can re-enable it
- Your app uses modern connection methods, so it should work fine without IPv4
- No rebuilds or migrations needed
