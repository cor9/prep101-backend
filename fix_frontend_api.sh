#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:5002"
CLIENT_DIR="client"

echo "[1/5] Ensure client exists"
test -d "$CLIENT_DIR" || { echo "No ./client dir found"; exit 1; }

echo "[2/5] Set frontend env pointing to $API"
# Vite or CRA, either will read one of these
echo "VITE_API_BASE=$API"   > "$CLIENT_DIR/.env.local"
echo "REACT_APP_API_BASE=$API" >> "$CLIENT_DIR/.env.local"

echo "[3/5] Patch fetch('/api/...') -> fetch('http://localhost:5002/api/...')"
# JS/TS source files
FILES=$(find "$CLIENT_DIR/src" -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) 2>/dev/null || true)

if [ -n "$FILES" ]; then
  # fetch('/api/...')
  perl -0777 -pe "s/fetch\((\s*)'\/api\//fetch($1'$API\/api\//g" -i $FILES
  perl -0777 -pe "s/fetch\((\s*)\"\/api\//fetch($1\"$API\/api\//g" -i $FILES

  echo "[4/5] Patch axios calls axios.get('/api/...') etc."
  perl -0777 -pe "s/axios\.(get|post|put|patch|delete)\(\s*'\/api\//axios.\$1('$API\/api\//g" -i $FILES
  perl -0777 -pe "s/axios\.(get|post|put|patch|delete)\(\s*\"\/api\//axios.\$1(\"$API\/api\//g" -i $FILES

  echo "[4b/5] Try to set axios baseURL if present"
  perl -0777 -pe "s/baseURL:\s*(['\"])https?:\/\/[^'\"\)]+(['\"])/baseURL: \$1$API\$2/g" -i $FILES 2>/dev/null || true
fi

echo "[5/5] Print the two lines you must use in code going forward:"
cat <<TXT

Use this wherever you build URLs in the frontend:

const API_BASE = import.meta?.env?.VITE_API_BASE || process.env.REACT_APP_API_BASE || '$API';
// Example:
fetch(\`\${API_BASE}/api/auth/register\`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...}) })

TXT

echo "Done. Restart your frontend and try your registration page."
