# 🔍 Debug Guide Generation Error

## Error Location
The error occurs at **line 216** in `Dashboard.js` in the `catch` block of `handleGenerateGuide()`.

## Common Errors

### 1. **"Invalid upload ID(s) or expired session"**
**Cause**: The PDF upload data expired from backend memory  
**Solution**: Re-upload your PDF and try again immediately

### 2. **"Missing required fields"**
**Cause**: Form fields not filled in completely  
**Solution**: Make sure all required fields are filled:
- Character Name ✅
- Production Title ✅
- Production Type ✅

### 3. **401 Unauthorized / Invalid token**
**Cause**: Authentication token not working  
**Solution**: Log out and log back in

### 4. **"Limited content: please upload a script..."**
**Cause**: PDF extraction produced poor quality text  
**Solution**: We just fixed this! Try again with your PDF

### 5. **Network Error / Failed to fetch**
**Cause**: Can't reach backend API  
**Solution**: Check if https://prep101-api.vercel.app/health returns `{"status":"ok"}`

### 6. **Timeout after 5 minutes**
**Cause**: Guide generation took too long  
**Solution**: Try again - sometimes API is slow on first request

## How to Debug

### Step 1: Open Browser Console
1. Open Developer Tools (F12 or Right-click → Inspect)
2. Go to **Console** tab
3. Clear console (trash icon)
4. Try generating a guide again
5. Look for errors

### Step 2: Check Network Tab
1. Open Developer Tools → **Network** tab
2. Clear network log
3. Try generating a guide
4. Look for `/api/guides/generate` request
5. Click on it → **Response** tab
6. Copy the error message

### Step 3: Check Authentication
Open console and run:
```javascript
// Check if you're logged in
const user = JSON.parse(localStorage.getItem('sb-eokqyijxubrmompozguh-auth-token'));
console.log('User:', user?.user?.email);
console.log('Has token:', !!user?.access_token);
```

Should show your email and `Has token: true`

### Step 4: Test Backend
Open a new tab and go to:
```
https://prep101-api.vercel.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "production"
}
```

## Common Solutions

### Solution 1: Refresh and Retry
1. Refresh the page
2. Re-upload your PDF
3. Fill in the form
4. Try generating again

### Solution 2: Clear Auth and Re-login
1. Log out
2. Clear browser cache
3. Log back in
4. Try again

### Solution 3: Check PDF
1. Make sure PDF is readable text (not just scanned image)
2. Try a different PDF
3. Make sure PDF is under 10MB

### Solution 4: Wait and Retry
Sometimes the backend needs to "wake up":
1. Wait 30 seconds
2. Try again
3. Be patient - generation takes 2-5 minutes

## What to Share for Help

If none of these work, share these details:

1. **Error message** from browser console (full text)
2. **Network response** from `/api/guides/generate` request
3. **PDF type**: Is it sides, full script, scanned, etc.?
4. **When did it start**: Was it working before?
5. **Browser**: Chrome, Safari, Firefox?

## Recent Fixes (Oct 8, 2025)

✅ **Login authentication** - Fixed Supabase token validation  
✅ **PDF upload rejection** - Relaxed quality thresholds  
🔄 **Loading screen** - Built but not deployed yet  

---

**Need more help?** Share the error message and I'll fix it!

