const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const User = require("../models/User");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const AUTH_COOKIE_NAME = "ca101_session";

// Log Supabase configuration for debugging
console.log("🔧 Supabase auth config:", {
  hasSupabaseUrl: !!SUPABASE_URL,
  supabaseUrlLength: SUPABASE_URL?.length,
  supabaseUrlPreview: SUPABASE_URL?.substring(0, 50),
  hasServiceKey: !!SUPABASE_SERVICE_KEY,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  envVars: {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
});

let supabaseAdmin = null;
let supabasePublic = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    // Validate URL format
    if (
      !SUPABASE_URL.startsWith("http://") &&
      !SUPABASE_URL.startsWith("https://")
    ) {
      console.error(
        `❌ Invalid SUPABASE_URL format: must start with http:// or https://`
      );
      console.error(
        `❌ Got: ${SUPABASE_URL ? SUPABASE_URL.substring(0, 50) : "undefined"}`
      );
      console.error(
        `❌ Please set SUPABASE_URL in Vercel environment variables to: https://eokqyijxubrmompozguh.supabase.co`
      );
    } else {
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log("✅ Supabase admin client initialized");
    }
  } catch (error) {
    console.error("❌ Failed to create Supabase admin client:", error.message);
    console.error(
      "❌ Check that SUPABASE_URL is set correctly in Vercel environment variables"
    );
  }
} else {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY)
    missing.push("SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  console.warn(
    `⚠️  Supabase admin credentials missing (${missing.join(
      ", "
    )}) - backend will fall back to legacy JWT auth`
  );
  console.warn(
    `⚠️  Please set these in Vercel Dashboard → Settings → Environment Variables`
  );
}

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    // Validate URL format
    if (
      !SUPABASE_URL.startsWith("http://") &&
      !SUPABASE_URL.startsWith("https://")
    ) {
      console.error(
        `❌ Invalid SUPABASE_URL format: must start with http:// or https://`
      );
      console.error(
        `❌ Got: ${SUPABASE_URL ? SUPABASE_URL.substring(0, 50) : "undefined"}`
      );
      console.error(
        `❌ Please set SUPABASE_URL in Vercel to: https://eokqyijxubrmompozguh.supabase.co`
      );
    } else {
      supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log("✅ Supabase public client initialized");
    }
  } catch (error) {
    console.error("❌ Failed to create Supabase public client:", error.message);
    console.error(
      "❌ Check that SUPABASE_URL and SUPABASE_ANON_KEY are set correctly in Vercel"
    );
  }
} else {
  if (!SUPABASE_URL) {
    console.warn("⚠️  SUPABASE_URL missing - public auth fallback disabled");
    console.warn(
      "⚠️  Set SUPABASE_URL in Vercel Dashboard → Settings → Environment Variables"
    );
  } else if (!SUPABASE_ANON_KEY) {
    console.warn(
      "⚠️  SUPABASE_ANON_KEY missing - public auth fallback disabled"
    );
    console.warn(
      "⚠️  Set SUPABASE_ANON_KEY in Vercel Dashboard → Settings → Environment Variables"
    );
  }
}

// Track failed login attempts
const failedAttempts = new Map();

// Clean up old failed attempts every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.timestamp > 60 * 60 * 1000) {
      // 1 hour
      failedAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    }, {});
}

async function findOrCreateUserFromSupabase(supabaseUser) {
  if (!supabaseUser || !supabaseUser.email) return null;

  const email = supabaseUser.email.toLowerCase();
  const derivedName =
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    email.split("@")[0] ||
    "Prep101 Actor";

  // Extract beta tester info from Supabase metadata
  const betaAccessLevel =
    supabaseUser.user_metadata?.betaAccessLevel ||
    supabaseUser.app_metadata?.betaAccessLevel ||
    "none";
  const isBetaTester = betaAccessLevel !== "none";

  if (!User) {
    console.warn("⚠️  User model unavailable; using Supabase-only user stub");
    return {
      id: supabaseUser.id,
      email,
      name: derivedName,
      subscription:
        supabaseUser.user_metadata?.subscription ||
        supabaseUser.app_metadata?.subscription ||
        "free",
      guidesLimit:
        supabaseUser.user_metadata?.guidesLimit ??
        supabaseUser.app_metadata?.guidesLimit ??
        null,
      guidesUsed:
        supabaseUser.user_metadata?.guidesUsed ??
        supabaseUser.app_metadata?.guidesUsed ??
        0,
      prep101TopUpCredits: 0,
      reader101Credits: 0,
      boldChoicesCredits: 0,
      isBetaTester,
      betaAccessLevel,
    };
  }

  try {
    let user = await User.findOne({ where: { email } });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");

      user = await User.create({
        email,
        password: randomPassword,
        name: derivedName,
        subscription: "free",
        guidesLimit: 1,
        isBetaTester,
        betaAccessLevel,
      });
    } else {
      // Sync beta tester fields from Supabase metadata to database
      // Only update if they differ to avoid unnecessary database writes
      const needsUpdate =
        user.isBetaTester !== isBetaTester ||
        user.betaAccessLevel !== betaAccessLevel;

      if (needsUpdate) {
        await user.update({
          isBetaTester,
          betaAccessLevel,
        });
        // Reload to get updated values
        await user.reload();
      }
    }

    return user;
  } catch (dbError) {
    // Database connection failed - fall back to Supabase-only user stub
    console.warn("⚠️  Database query failed; using Supabase-only user stub:", dbError.message);
    return {
      id: supabaseUser.id,
      email,
      name: derivedName,
      subscription:
        supabaseUser.user_metadata?.subscription ||
        supabaseUser.app_metadata?.subscription ||
        "free",
      guidesLimit:
        supabaseUser.user_metadata?.guidesLimit ??
        supabaseUser.app_metadata?.guidesLimit ??
        null,
      guidesUsed:
        supabaseUser.user_metadata?.guidesUsed ??
        supabaseUser.app_metadata?.guidesUsed ??
        0,
      prep101TopUpCredits: 0,
      reader101Credits: 0,
      boldChoicesCredits: 0,
      isBetaTester,
      betaAccessLevel,
    };
  }
}

async function getSupabaseUserFromToken(token) {
  if (!token) return null;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    } catch (supabaseError) {
      console.error(
        "❌ Supabase admin validation failed:",
        supabaseError.message || supabaseError
      );
    }
  }

  if (supabasePublic) {
    try {
      const { data, error } = await supabasePublic.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    } catch (supabaseError) {
      console.error(
        "❌ Supabase public validation failed:",
        supabaseError.message || supabaseError
      );
    }
  }

  if (SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ["HS256"],
      });
      return {
        id: decoded.sub,
        email: decoded.email,
        user_metadata:
          decoded.user_metadata ||
          decoded.app_metadata ||
          decoded.user_metadata ||
          {},
      };
    } catch (jwtError) {
      console.error(
        "❌ Supabase JWT verify failed:",
        jwtError.message || jwtError
      );
    }
  }

  try {
    const decoded = jwt.decode(token);
    const decodedEmail =
      decoded?.email ||
      decoded?.user_metadata?.email ||
      decoded?.app_metadata?.email;
    // Support both Supabase-style (sub) and our backend-style (userId) tokens
    const decodedId = decoded?.sub || decoded?.userId;
    if (decoded && decodedEmail && decodedId) {
      console.warn("⚠️  Using unsigned JWT decode fallback");
      return {
        id: decodedId,
        email: decodedEmail,
        user_metadata: decoded.user_metadata || decoded.app_metadata || {},
      };
    }
  } catch (decodeError) {
    console.error(
      "❌ JWT decode fallback failed:",
      decodeError.message || decodeError
    );
  }

  return null;
}

module.exports = async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers?.cookie);
    let token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      cookies[AUTH_COOKIE_NAME] ||
      req.query?.token ||
      req.query?.access_token ||
      req.body?.token ||
      req.body?.access_token;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Sanitize token: treat "null" or "undefined" strings as missing
    if (token === "null" || token === "undefined") {
      token = null;
    }

    if (!token) {
      // Log unauthorized access attempt (less verbose for health checks/root)
      if (req.path !== "/" && req.path !== "/health") {
        console.log(
          `🔒 No token from IP: ${clientIP}, Path: ${req.path}`
        );
      }
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    // Prefer Supabase token validation (admin client or local JWT secret)
    const supabaseUser = await getSupabaseUserFromToken(token);
    if (supabaseUser) {
      const user = await findOrCreateUserFromSupabase(supabaseUser);
      if (user) {
        console.log(
          `✅ Supabase auth: ${user.email} (${user.id}) from IP: ${clientIP}, Path: ${req.path}`
        );
        req.userId = user.id;
        req.user = user;
        req.authToken = token;
        req.clientIP = clientIP;
        return next();
      }
    }

    // Fallback to legacy JWT validation
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret"
    );

    // Get userId from token - check both userId and sub (Supabase-style)
    const tokenUserId = decoded.userId || decoded.sub;

    if (!tokenUserId) {
      console.log(`🔒 Token missing userId from IP: ${clientIP}`);
      return res
        .status(401)
        .json({ message: "Invalid token - missing user ID" });
    }

    let user = null;

    // Try to load user from database if User model is available
    if (User && typeof User.findByPk === "function") {
      user = await User.findByPk(tokenUserId);
      if (!user) {
        console.log(
          `🔒 Invalid token - user not found: ${tokenUserId} from IP: ${clientIP}`
        );
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user account is active (for future use)
      if (user.betaStatus === "expired") {
        console.log(
          `🔒 Expired beta account access attempt: ${user.email} from IP: ${clientIP}`
        );
        return res.status(401).json({ message: "Account access expired" });
      }
    } else {
      // User model not available - create stub from token data
      console.warn(`⚠️  User model unavailable, using token data for auth`);
      user = {
        id: tokenUserId,
        email: decoded.email || "unknown",
        name: decoded.name || decoded.email?.split("@")[0] || "User",
        subscription: decoded.subscription || "free",
        guidesUsed: decoded.guidesUsed || 0,
        guidesLimit: decoded.guidesLimit || 1,
      };
    }

    // Log successful authentication
    console.log(
      `✅ Authenticated: ${user.email} (${user.id}) from IP: ${clientIP}, Path: ${req.path}`
    );

    // Add user info to request
    req.userId = tokenUserId;
    req.user = user;
    req.authToken = token;
    req.clientIP = clientIP;

    next();
  } catch (error) {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (error.name === "JsonWebTokenError") {
      console.log(`🔒 Invalid token from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      console.log(`🔒 Expired token from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

// Export the failed attempts map for use in login routes
module.exports.failedAttempts = failedAttempts;
