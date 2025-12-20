const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const User = require("../models/User");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

let supabaseAdmin = null;
let supabasePublic = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "⚠️  Supabase admin credentials missing - backend will fall back to legacy JWT auth"
  );
}

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn("⚠️  Supabase anon key missing - public auth fallback disabled");
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
      isBetaTester,
      betaAccessLevel,
    };
  }

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
    const token = req.header("Authorization")?.replace("Bearer ", "");
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!token) {
      // Log unauthorized access attempt
      console.log(
        `🔒 Unauthorized access attempt from IP: ${clientIP}, Path: ${req.path}`
      );
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
