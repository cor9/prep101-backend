const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const auth = require("./middleware/auth");
const {
  runAdminQuery,
  isSupabaseAdminConfigured,
  tables: supabaseTables,
  normalizeGuideRow,
  normalizeUserRow,
} = require("./lib/supabaseAdmin");
const { createClient } = require("@supabase/supabase-js");
const {
  buildReader101Usage,
  buildPrep101Usage,
  getReader101ConsumptionUpdate,
  getPrep101ConsumptionUpdate,
} = require("./services/prep101EntitlementsService");

// Create app immediately for fast health checks
const app = express();

// Super fast health check - responds immediately
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    vercel: !!process.env.VERCEL,
  });
});

// Even simpler test endpoint
app.get("/test", (req, res) => {
  res.status(200).json({ message: "Hello from Vercel!" });
});

// Diagnostic endpoint to check system status
app.get("/api/diagnostics", async (req, res) => {
  let dbStatus = "not_configured";
  let dbError = null;

  try {
    const { sequelize } = require("./database/connection");
    if (sequelize) {
      await sequelize.authenticate();
      dbStatus = "connected";
    } else {
      dbStatus = "sequelize_null";
    }
  } catch (error) {
    dbStatus = "error";
    dbError = error.message;
  }

  // Check Supabase configuration
  const supabaseConfigured = isSupabaseAdminConfigured();
  const supabaseStatus = supabaseConfigured ? "configured" : "not_configured";
  const supabaseMissing = [];
  if (!process.env.SUPABASE_URL) supabaseMissing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_KEY)
    supabaseMissing.push("SUPABASE_SERVICE_KEY");

  // Determine if guide saving will work
  const canSaveGuides = dbStatus === "connected" || supabaseConfigured;

  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM || "not set",
    },
    database: {
      status: dbStatus,
      error: dbError,
    },
    supabase: {
      status: supabaseStatus,
      missing: supabaseMissing.length > 0 ? supabaseMissing : null,
      guidesTable: supabaseTables.guides,
    },
    guideSaving: {
      enabled: canSaveGuides,
      method:
        dbStatus === "connected"
          ? "sequelize"
          : supabaseConfigured
            ? "supabase"
            : "none",
      warning: !canSaveGuides
        ? "Guide saving will FAIL! Configure DATABASE_URL or SUPABASE_SERVICE_KEY"
        : null,
    },
    endpoints: {
      health: "✅ Available",
      test: "✅ Available",
      guidesGenerate: "✅ Available (POST /api/guides/generate)",
      diagnostics: "✅ Available (GET /api/diagnostics)",
    },
  });
});

// Root route handler
app.get("/", (req, res) => {
  res.json({
    message: "PREP101 Backend API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      apiHealth: "/api/health",
      upload: "/api/upload",
      guides: "/api/guides",
      auth: "/api/auth",
    },
    documentation: "https://github.com/cor9/prep101-backend",
  });
});

// Favicon route - serve favicon if requested
app.get("/favicon.ico", (req, res) => {
  const faviconPath = path.join(__dirname, "client", "public", "favicon.ico");
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    // Fallback: return 204 No Content if favicon doesn't exist
    res.status(204).end();
  }
});

// Trust proxy - Required for Vercel and rate limiting to work correctly
app.set("trust proxy", true);

// Basic middleware setup first
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Manual CORS middleware for maximum compatibility
app.use((req, res, next) => {
  const envOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  const allowedOrigins = [
    "https://prep101.site",
    "https://www.prep101.site",
    "https://prep101-api.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://reader101.site",
    "https://www.reader101.site",
    "https://boldchoices.site",
    "https://www.boldchoices.site",
    ...envOrigins
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Allow credentials for cookies/auth
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Allow all common methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  // Allow common headers
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Continue with other imports
// methodology folder is now included in vercel.json
const { scrubWatermarks, assessQuality } = require(path.join(
  process.cwd(),
  "services",
  "textCleaner"
));
const {
  ingestPdf,
} = require(path.join(process.cwd(), "services", "pdfIngestPipeline"));
const {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
} = require("./config/models");
const { sendAnthropicMessage } = require("./services/anthropicClient");
const { retrieveMethodologyContext } = require("./services/methodologyRetrieval");

// Import new authentication and payment features (with error handling)
let config,
  validateConfig,
  authLimiter,
  apiLimiter,
  paymentLimiter,
  speedLimiter,
  corsOptions,
  securityHeaders;

try {
  const configModule = require("./config/config");
  config = configModule.config;
  validateConfig = configModule.validateConfig;
} catch (error) {
  console.log("⚠️  Config module not available:", error.message);
  config = { jwt: { secret: "fallback" } };
  validateConfig = () => console.log("⚠️  Config validation skipped");
}

try {
  const securityModule = require("./middleware/security");
  authLimiter = securityModule.authLimiter;
  apiLimiter = securityModule.apiLimiter;
  paymentLimiter = securityModule.paymentLimiter;
  speedLimiter = securityModule.speedLimiter;
  corsOptions = securityModule.corsOptions;
  securityHeaders = securityModule.securityHeaders;
} catch (error) {
  console.log("⚠️  Security middleware not available:", error.message);
  // Create fallback middleware
  authLimiter = (req, res, next) => next();
  apiLimiter = (req, res, next) => next();
  paymentLimiter = (req, res, next) => next();
  speedLimiter = (req, res, next) => next();
  securityHeaders = (req, res, next) => next();
}

// Validate configuration (skip in Vercel if env vars not set)
if (process.env.VERCEL) {
  console.log("🚀 Running in Vercel serverless environment");
  console.log(
    "⚠️  Skipping config validation - environment variables will be set in Vercel dashboard"
  );
} else {
  validateConfig();
}

// Security middleware
app.use(securityHeaders);

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api/payments", paymentLimiter);
app.use("/api", apiLimiter);
app.use(speedLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploads = {};
// Track extraction diagnostics for /api/health
const extractionStats = {
  totals: { text: 0, ocr: 0, vision: 0 },
  last: null,
};

// Content quality assessment function
// Stricter on generation, lenient on upload to allow correction
function assessContentQuality(text, wordCount, isUpload = false) {
  // Use centralized quality checker from services/textCleaner.js
  const assessment = assessQuality(text, wordCount);
  
  // UPLOAD CHECK: Only reject completely empty or severely corrupted files
  if (isUpload) {
    if (assessment.quality === "empty") {
      return { quality: "poor", reason: "insufficient_content" };
    }
    // Accept everything else during upload and let the cleaning process handle it
    return { quality: "good", reason: "sufficient_content" };
  }

  // GENERATION CHECK: Return full assessment to block bad outputs
  return {
    quality: assessment.quality,
    reason: assessment.reason,
    repetitiveRatio: assessment.ratio || 0,
    usable: assessment.usable,
  };
}

function getMeaningfulWordCount(text = "") {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

// Import and mount new API routes (with error handling)
try {
  const authRoutes = require("./routes/auth");
  app.use("/api/auth", authRoutes);
  console.log("✅ Auth routes loaded");
} catch (error) {
  console.log("⚠️  Auth routes not available:", error.message);
  // Add fallback routes for when auth routes fail to load
  app.get("/api/auth/dashboard", (req, res) => {
    res.status(503).json({
      error: "Authentication service temporarily unavailable",
      message: "Database connection required for authentication features",
    });
  });
  app.get("/api/auth/profile", (req, res) => {
    res.status(503).json({
      error: "Authentication service temporarily unavailable",
      message: "Database connection required for authentication features",
    });
  });
  // Add fallback login route - use Supabase directly
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email & password required" });
      }

      // Create Supabase client for login if not available
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
          const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            return res.status(401).json({ message: error.message || "Invalid credentials" });
          }

          if (data?.user && data?.session) {
            // Try to find or create user in database if User model is available
            let user = null;
            if (User) {
              const userEmail = data.user.email.toLowerCase();
              user = await User.findOne({ where: { email: userEmail } });

              if (!user) {
                const crypto = require("crypto");
                const randomPassword = crypto.randomBytes(32).toString("hex");
                const derivedName = data.user.user_metadata?.name || email.split("@")[0];
                const betaAccessLevel = data.user.user_metadata?.betaAccessLevel || data.user.app_metadata?.betaAccessLevel || "none";
                const isBetaTester = betaAccessLevel !== "none";

                user = await User.create({
                  email: userEmail,
                  password: randomPassword,
                  name: derivedName,
                  subscription: "free",
                  guidesLimit: 1,
                  isBetaTester,
                  betaAccessLevel,
                });
              }
            }

            return res.json({
              message: "Login successful",
              token: data.session.access_token,
              user: {
                id: user?.id || data.user.id,
                email: user?.email || data.user.email,
                name: user?.name || data.user.user_metadata?.name || email.split("@")[0],
              },
            });
          }
        } catch (supabaseError) {
          console.error("Supabase login error:", supabaseError);
        }
      }

      // Fallback: try database login if User model is available
      if (User) {
        const user = await User.findOne({ where: { email } });
        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const bcrypt = require("bcryptjs");
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const jwt = require("jsonwebtoken");
        const token = jwt.sign(
          { userId: user.id },
          process.env.JWT_SECRET || "fallback_secret",
          { expiresIn: "24h" }
        );
        return res.json({
          message: "Login successful",
          token,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }

      return res.status(503).json({
        message: "Authentication service unavailable",
        error: "No authentication method available. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login error", error: err.message });
    }
  });
}

try {
  const paymentRoutes = require("./routes/payments");
  app.use("/api/payments", paymentRoutes);
  console.log("✅ Payment routes loaded");
} catch (error) {
  console.log("⚠️  Payment routes not available:", error.message);
  // Add fallback routes for when payment routes fail to load
  app.get("/api/payments/*", (req, res) => {
    res.status(503).json({
      error: "Payment service temporarily unavailable",
      message: "Database connection required for payment features",
    });
  });
}

try {
  const guidesRoutes = require("./routes/guides");
  app.use("/api/guides", guidesRoutes);
  console.log("✅ Guide routes loaded");
} catch (error) {
  console.log("⚠️  Guide routes not available:", error.message);
}

try {
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", adminRoutes);
  console.log("✅ Admin routes loaded");
} catch (error) {
  console.log("⚠️  Admin routes not available:", error.message);
}

try {
  const betaRoutes = require("./routes/beta");
  app.use("/api/beta", betaRoutes);
  console.log("✅ Beta routes loaded");
} catch (error) {
  console.log("⚠️  Beta routes not available:", error.message);
}

try {
  const promoCodeRoutes = require("./routes/promoCodes");
  app.use("/api/promo-codes", promoCodeRoutes);
  console.log("✅ Promo code routes loaded");
} catch (error) {
  console.log("⚠️  Promo code routes not available:", error.message);
}

try {
  const stripeRoutes = require("./routes/stripe");
  app.use("/api/stripe", stripeRoutes);
  console.log("✅ Stripe routes loaded");
} catch (error) {
  console.log("⚠️  Stripe routes not available:", error.message);
  // Add fallback routes for when Stripe routes fail to load
  app.get("/api/stripe/*", (req, res) => {
    res.status(503).json({
      error: "Stripe service temporarily unavailable",
      message: "Database connection required for Stripe features",
    });
  });
}

try {
  const stripeWebhookRoutes = require("./routes/stripeWebhook");
  app.use("/api/webhooks", stripeWebhookRoutes);
  console.log("✅ Stripe webhook routes loaded");
} catch (error) {
  console.log("⚠️  Stripe webhook routes not available:", error.message);
}

try {
  const clawdbotRoutes = require("./routes/clawdbot");
  app.use("/api/clawdbot", clawdbotRoutes);
  console.log("✅ Clawdbot routes loaded");
} catch (error) {
  console.log("⚠️  Clawdbot routes not available:", error.message);
}

try {
  const boldChoicesRoutes = require("./routes/boldChoices");
  app.use("/api/bold-choices", boldChoicesRoutes);
  console.log("✅ Bold Choices routes loaded");
} catch (error) {
  console.log("⚠️  Bold Choices routes not available:", error.message);
}

// Secure API key handling (trim to avoid invisible whitespace issues)
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not found in environment variables");
  if (process.env.VERCEL) {
    console.log(
      "⚠️  Anthropic API key missing in Vercel - guide generation will fail"
    );
  } else {
    process.exit(1);
  }
}

// Debug environment variables
console.log("🔧 Environment variables loaded:");
console.log("  - JWT_SECRET present:", !!process.env.JWT_SECRET);
// Masked Anthropic key diagnostics (length only)
try {
  const masked = ANTHROPIC_API_KEY
    ? `len=${ANTHROPIC_API_KEY.length}`
    : "missing";
  console.log("  - ANTHROPIC_API_KEY:", masked);
} catch (_) { }

console.log("  - FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("  - API_BASE:", process.env.API_BASE);

// Database initialization (with error handling)
let sequelize, testConnection, User, Guide;

try {
  const dbModule = require("./database/connection");
  sequelize = dbModule.sequelize;
  testConnection = dbModule.testConnection;
  console.log("✅ Database connection module loaded");
} catch (error) {
  console.log("⚠️  Database connection module not available:", error.message);
  sequelize = null;
  testConnection = () => Promise.reject(new Error("Database not available"));
}

try {
  User = require("./models/User");
  if (User) {
    console.log("✅ User model loaded successfully");
  } else {
    console.log("⚠️  User model is null - sequelize connection likely failed");
    console.log("   Check DATABASE_URL and database connection logs above");
  }
} catch (error) {
  console.log("⚠️  User model not available:", error.message);
  User = null;
}

try {
  Guide = require("./models/Guide");
  if (Guide) {
    console.log("✅ Guide model loaded successfully");
  } else {
    console.log("⚠️  Guide model is null - sequelize connection likely failed");
    console.log("   Check DATABASE_URL and database connection logs above");
  }
} catch (error) {
  console.log("⚠️  Guide model not available:", error.message);
  Guide = null;
}

const SUPABASE_GUIDES_TABLE = supabaseTables.guides;

async function supabaseFetchGuide(filters = {}) {
  if (!isSupabaseAdminConfigured()) return null;

  const result = await runAdminQuery((client) => {
    let query = client.from(SUPABASE_GUIDES_TABLE).select("*");

    if (filters.id) query = query.eq("id", filters.id);
    if (filters.guideId) query = query.eq("guideId", filters.guideId);
    if (filters.userId) query = query.eq("userId", filters.userId);

    return query.maybeSingle();
  });

  if (!result) return null;
  if (result.error) {
    console.error("❌ Supabase fetch guide error:", result.error.message);
    return null;
  }

  return normalizeGuideRow(result.data);
}

async function supabaseInsertGuide(payload, options = {}) {
  if (!isSupabaseAdminConfigured()) {
    console.error(
      "❌ Supabase admin client not configured - SUPABASE_URL or SUPABASE_SERVICE_KEY missing"
    );
    return null;
  }

  const { user, retryAttempt = 0 } = options;

  console.log("📝 Attempting Supabase guide insert...", {
    guideId: payload.guideId,
    userId: payload.userId,
    characterName: payload.characterName,
    retryAttempt,
  });

  const now = new Date().toISOString();
  const guidePayload = {
    ...payload,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };

  const result = await runAdminQuery((client) =>
    client.from(SUPABASE_GUIDES_TABLE).insert(guidePayload).select("*").single()
  );

  if (!result) {
    console.error(
      "❌ Supabase runAdminQuery returned null - client unavailable"
    );
    return null;
  }
  if (result.error) {
    const errorMessage = result.error.message || "";

    if (
      user &&
      retryAttempt < 1 &&
      errorMessage.includes("Guides_userId_fkey")
    ) {
      console.warn(
        "⚠️  Supabase guide insert failed due to missing user reference. Retrying after ensuring user exists.",
        { userId: user.id }
      );

      const ensured = await ensureSupabaseUser(user);
      if (ensured) {
        return await supabaseInsertGuide(payload, {
          ...options,
          retryAttempt: retryAttempt + 1,
        });
      }
    }

    console.error("❌ Supabase insert error:", result.error);
    throw new Error(
      result.error.message || "Failed to save guide via Supabase"
    );
  }

  console.log("✅ Supabase guide insert successful:", result.data?.id);
  return normalizeGuideRow(result.data);
}

async function supabaseUpdateGuide(id, userId, updates) {
  if (!isSupabaseAdminConfigured()) return null;

  const result = await runAdminQuery((client) =>
    client
      .from(SUPABASE_GUIDES_TABLE)
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("userId", userId)
      .select("*")
      .single()
  );

  if (!result) return null;
  if (result.error) {
    throw new Error(
      result.error.message || "Failed to update guide via Supabase"
    );
  }

  return normalizeGuideRow(result.data);
}

// Ensure user exists in Supabase Users table before saving guides
async function ensureSupabaseUser(user) {
  if (!isSupabaseAdminConfigured()) return false;

  const SUPABASE_USERS_TABLE = supabaseTables.users;

  // Check if user exists
  const checkResult = await runAdminQuery((client) =>
    client
      .from(SUPABASE_USERS_TABLE)
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
  );

  if (checkResult?.data) {
    console.log(`✅ User ${user.id} exists in Supabase Users table`);
    return true;
  }

  // User doesn't exist, create them
  console.log(`📝 Creating user ${user.id} in Supabase Users table...`);
  const insertResult = await runAdminQuery((client) =>
    client
      .from(SUPABASE_USERS_TABLE)
      .insert({
        id: user.id,
        email: user.email,
        name: user.name || user.email.split("@")[0],
        password: "supabase_auth", // Placeholder - actual auth is via Supabase Auth
        subscription: user.subscription || "free",
        guidesUsed: typeof user.guidesUsed === "number" ? user.guidesUsed : 0,
        guidesLimit: typeof user.guidesLimit === "number" ? user.guidesLimit : 1,
        prep101TopUpCredits:
          typeof user.prep101TopUpCredits === "number" ? user.prep101TopUpCredits : 0,
        prep101TopUpSessionIds: Array.isArray(user.prep101TopUpSessionIds)
          ? user.prep101TopUpSessionIds
          : [],
        reader101Credits:
          typeof user.reader101Credits === "number" ? user.reader101Credits : 0,
        reader101SessionIds: Array.isArray(user.reader101SessionIds)
          ? user.reader101SessionIds
          : [],
        boldChoicesCredits:
          typeof user.boldChoicesCredits === "number" ? user.boldChoicesCredits : 0,
        boldChoicesSessionIds: Array.isArray(user.boldChoicesSessionIds)
          ? user.boldChoicesSessionIds
          : [],
      })
      .select("id")
      .single()
  );

  if (insertResult?.error) {
    console.error("❌ Failed to create user in Supabase:", insertResult.error);
    return false;
  }

  console.log(`✅ User ${user.id} created in Supabase Users table`);
  return true;
}

async function loadBillingUser(user) {
  const userId = user?.id;
  if (!userId) return user;

  if (User) {
    try {
      const row = await User.findByPk(userId);
      if (row) return row;
    } catch (error) {
      console.error("Failed to load billing user via Sequelize:", error.message);
    }
  }

  if (!isSupabaseAdminConfigured()) return user;

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(supabaseTables.users)
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  });

  return row ? normalizeUserRow(row) : user;
}

async function persistBillingUserUpdates(user, updates) {
  if (!user || !updates || !Object.keys(updates).length) return user;

  if (typeof user.update === "function") {
    await user.update(updates);
    if (typeof user.reload === "function") {
      await user.reload();
    }
    return user;
  }

  if (!isSupabaseAdminConfigured() || !user.id) {
    return { ...user, ...updates };
  }

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(supabaseTables.users)
      .update(updates)
      .eq("id", user.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  });

  return row ? normalizeUserRow(row) : { ...user, ...updates };
}

// Load methodology files into memory for RAG
let methodologyDatabase = {};

function wrapGuideHtml(rawContent, meta = {}) {
  if (!rawContent) return "";
  const hasFullDocument =
    rawContent.includes("<html") && rawContent.includes("</html>");
  if (hasFullDocument) {
    return rawContent;
  }

  const {
    characterName = "PREP101 Actor",
    productionTitle = "",
    productionType = "",
  } = meta;

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${characterName} • ${productionTitle} Guide</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;600;700&family=Playfair+Display:wght@600&display=swap" rel="stylesheet">
    <style>
      :root {
        --gold: #fbbf24;
        --midnight: #0f172a;
        --slate: #1f2937;
        --cloud: #e2e8f0;
        --sunset: linear-gradient(135deg, #facc15, #f97316);
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background: #0b1120;
        font-family: "Libre Franklin", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #f8fafc;
        line-height: 1.6;
      }
      .hero {
        background: var(--sunset);
        color: #0f172a;
        padding: 3rem 1rem;
        text-align: center;
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      }
      .hero h1 {
        margin: 0;
        font-size: clamp(2.25rem, 4vw, 3rem);
        font-family: "Playfair Display", serif;
        letter-spacing: 0.03em;
      }
      .hero p {
        margin-top: 0.75rem;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .guide-shell {
        max-width: 960px;
        margin: -80px auto 80px;
        padding: 0 1.5rem;
      }
      .guide-body {
        background: rgba(15, 23, 42, 0.9);
        border-radius: 24px;
        padding: 3rem;
        box-shadow: 0 25px 60px rgba(0,0,0,0.45);
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
      h2 {
        font-size: 1.35rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        margin-top: 2.75rem;
        margin-bottom: 1.25rem;
        color: var(--gold);
      }
      h3 {
        font-size: 1.1rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-top: 2rem;
        margin-bottom: 0.75rem;
        color: #cbd5f5;
      }
      p {
        margin-bottom: 1rem;
        color: #e2e8f0;
      }
      ul, ol {
        color: #f1f5f9;
        padding-left: 1.5rem;
      }
      strong {
        color: #facc15;
        font-weight: 600;
      }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .info-card {
        border: 1px solid rgba(248, 250, 252, 0.08);
        border-radius: 18px;
        padding: 1.25rem;
        background: rgba(15, 23, 42, 0.65);
      }
      .info-card span {
        display: block;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #94a3b8;
        margin-bottom: 0.45rem;
      }
      .info-card strong {
        color: #f8fafc;
        font-size: 1rem;
      }
      .guide-body > *:first-child {
        margin-top: 0;
      }
      @media (max-width: 768px) {
        .guide-body {
          padding: 2rem;
        }
        h2 {
          font-size: 1.1rem;
        }
      }
    </style>
  </head>
  <body>
    <section class="hero">
      <p>Prep101 • ${productionType || "Audition Prep"}</p>
      <h1>${characterName}</h1>
      <p>${productionTitle || ""}</p>
    </section>
    <main class="guide-shell">
      <article class="guide-body">
        ${rawContent}
      </article>
    </main>
  </body>
  </html>`;
}

async function initializeDatabase() {
  if (!sequelize || !testConnection) {
    console.log("⚠️  Database not available - skipping initialization");
    return;
  }

  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    console.log("✅ Database models synchronized");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    if (process.env.VERCEL) {
      console.log(
        "⚠️  Database connection failed in Vercel - continuing without database"
      );
    } else {
      process.exit(1);
    }
  }
}

function loadMethodologyFiles() {
  const methodologyPath = path.join(__dirname, "methodology");

  if (!fs.existsSync(methodologyPath)) {
    console.error(
      "❌ Methodology folder not found! Please create ./methodology/ with your files"
    );
    return;
  }

  console.log("📚 Loading methodology files for RAG...");

  try {
    const files = fs.readdirSync(methodologyPath);
    console.log(`📁 Found ${files.length} methodology files:`, files);

    files.forEach((filename) => {
      const filePath = path.join(methodologyPath, filename);
      const content = fs.readFileSync(filePath, "utf8");

      // Store with metadata for intelligent searching
      methodologyDatabase[filename] = {
        content: content,
        filename: filename,
        size: content.length,
        type: determineFileType(filename),
        keywords: extractKeywords(filename, content),
      };

      console.log(`✅ Loaded: ${filename} (${content.length} characters)`);
    });

    console.log(
      `🧠 RAG Database Ready: ${Object.keys(methodologyDatabase).length
      } methodology files loaded`
    );
  } catch (error) {
    console.error("❌ Failed to load methodology files:", error);
  }
}

function determineFileType(filename) {
  const name = filename.toLowerCase();
  if (name === "methodology.md" || name.includes("core_methodology"))
    return "core-methodology";
  if (name.includes("character")) return "character-development";
  if (name.includes("scene")) return "scene-work";
  if (name.includes("comedy")) return "comedy";
  if (name.includes("uta")) return "uta-hagen";
  if (name.includes("cece") || name.includes("eloise")) return "example-guide";
  if (name.includes("guide") || name.includes("example"))
    return "example-guide";
  return "general-methodology";
}

function extractKeywords(filename, content) {
  const keywords = [];
  const name = filename.toLowerCase();

  if (name === "methodology.md" || name.includes("core_methodology")) {
    keywords.push(
      "core methodology",
      "acting methodology",
      "prep101",
      "reader101",
      "bold choices",
      "coaching voice"
    );
  }

  // Add filename-based keywords
  if (name.includes("character"))
    keywords.push("character", "development", "psychology");
  if (name.includes("archetype") || name.includes("comparable"))
    keywords.push("archetype", "comparable", "reference", "similar characters");
  if (name.includes("scene")) keywords.push("scene", "breakdown", "analysis");
  if (name.includes("comedy")) keywords.push("comedy", "timing", "humor");
  if (name.includes("uta"))
    keywords.push("uta hagen", "9 questions", "methodology");

  // Extract content-based keywords (simple approach)
  const contentLower = content.toLowerCase();
  if (contentLower.includes("subtext")) keywords.push("subtext");
  if (contentLower.includes("objective")) keywords.push("objectives");
  if (contentLower.includes("physicality")) keywords.push("physicality");
  if (contentLower.includes("voice")) keywords.push("voice");
  if (contentLower.includes("audition")) keywords.push("audition");
  if (contentLower.includes("self-tape")) keywords.push("self-tape");

  return keywords;
}

// Intelligent RAG search through methodology files (weighted chunk retrieval)
function searchMethodology(input = {}, productionType = "", sceneContext = "") {
  const context =
    typeof input === "string"
      ? {
          characterName: input,
          productionType: productionType || "",
          sceneText: sceneContext || "",
        }
      : { ...input };

  const product = context.product || "prep101";

  const retrieval = retrieveMethodologyContext(
    {
      product,
      characterName: context.characterName || "",
      productionType: context.productionType || "",
      productionTitle: context.productionTitle || "",
      genre: context.genre || "",
      genreMode: context.genreMode || "",
      storyline: context.storyline || "",
      script: context.sceneText || context.sceneContext || "",
      methodologyHints:
        context.methodologyHints ||
        [
          "behavior over emotion",
          "tactics over feelings",
          "specificity over volume",
          "sincerity over performance",
          "objective",
          "obstacle",
          "how do i get it",
        ],
    },
    {
      topK: context.topK || 8,
    }
  );

  const relevantChunks = retrieval.selectedChunks.map((chunk) => ({
    ...chunk,
    relevanceScore: chunk.score,
    content: chunk.text,
  }));

  console.log(
    `🎯 RAG Results (${product}): ${relevantChunks.length} chunks selected (of ${retrieval.availableChunks})`
  );
  console.log(
    `   🧠 Archetype: ${retrieval.primaryArchetype || "general"}${retrieval.secondaryArchetype ? ` / ${retrieval.secondaryArchetype}` : ""
    }`
  );
  console.log(
    `   🎬 Hagen focus: want=${(retrieval.hagen?.want || []).length}, obstacle=${(retrieval.hagen?.obstacle || []).length}, tactics=${(retrieval.hagen?.tactics || []).length}`
  );
  relevantChunks.slice(0, 5).forEach((chunk) => {
    console.log(
      `   📄 ${chunk.filename}#${String(chunk.id).split("#")[1] || "1"} (score: ${chunk.relevanceScore.toFixed(3)}, type: ${chunk.fileType})`
    );
  });

  return {
    ...retrieval,
    relevantChunks,
  };
}

// PDF extraction using Adobe PDF Services
async function extractTextWithAdobe(pdfBuffer) {
  const {
    ServicePrincipalCredentials,
    PDFServices,
    MimeType,
    ExtractPDFParams,
    ExtractElementType,
    ExtractPDFJob,
    ExtractPDFResult,
    SDKError,
    ServiceUsageError,
    ServiceApiError,
  } = require("@adobe/pdfservices-node-sdk");

  try {
    // Create credentials from the credentials file
    const credentials = ServicePrincipalCredentials.fromFile(
      "pdfservices-api-credentials.json"
    );

    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Create a readable stream from the buffer
    const { Readable } = require("stream");
    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);

    // Upload the PDF
    const inputAsset = await pdfServices.upload({
      readStream: stream,
      mimeType: MimeType.PDF,
    });

    // Create parameters for text extraction
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT],
    });

    // Create and submit the job
    const job = new ExtractPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });

    // Wait for completion and get result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult,
    });

    // Get the extracted text content
    const resultAsset = pdfServicesResponse.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Convert stream to text
    const chunks = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(chunk);
    }
    const extractedText = Buffer.concat(chunks).toString("utf8");

    console.log(
      "🔍 Adobe raw response (first 200 chars):",
      extractedText.substring(0, 200)
    );

    let fullText = "";

    // Try to parse as JSON first (structured format)
    try {
      const textData = JSON.parse(extractedText);
      if (textData.elements) {
        textData.elements.forEach((element) => {
          if (element.Text) {
            fullText += element.Text + "\n";
          }
        });
      }
    } catch (jsonError) {
      // If JSON parsing fails, treat as plain text
      console.log("🔍 JSON parsing failed, treating as plain text");
      fullText = extractedText;
    }

    // Clean up the text while preserving structure
    let cleanText = fullText
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Remove known watermarks/footers
    cleanText = cleanText
      .replace(/Sides by Breakdown Services - Actors Access/gi, "")
      .replace(/Page \d+\s+of\s+\d+/gi, "")
      .replace(/\-\s*[a-zA-Z]{3,4}\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*[AP]M\s*\-/gi, "\n")
      .replace(/\bB\d{3,}[A-Z0-9]*\b/gi, "") // matches B540LT, B568CR, etc
      .replace(/B540LT|B568CR|74222/gi, "")
      .replace(/\b\d{1,2}:\d{2}:\d{2}\s*[AP]M\b/gi, "")
      .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, "")
      .replace(/\b[A-Z]\d{3,}[A-Z]{2}\b/gi, "")
      .replace(/\b\d{5,}\b/g, "")
      .replace(/\-{2,}/g, " ") // clean up leftover hyphens from B540LT-B540LT
      .replace(/74222 - .*? -/g, "")
      .trim();

    // Character tags: keep multiline, after we preserved \n
    const characterPattern = /^(?:[A-Z][A-Z][A-Z\s]{1,40}):/gm; // e.g., "BRAD:" or "MRS. CARRUTHERS:"
    const characterNames = [
      ...new Set(
        (cleanText.match(characterPattern) || []).map((n) =>
          n.replace(":", "").trim()
        )
      ),
    ];

    // Basic quality signal
    const wordCount = (cleanText.match(/\b\w+\b/g) || []).length;

    console.log("🔍 Adobe PDF Services Extraction:");
    console.log("🔍 Text length:", cleanText.length);
    console.log("🔍 Word count:", wordCount);
    console.log("🔍 Character names found:", characterNames);
    console.log("🔍 First 300 chars:", cleanText.substring(0, 300));

    return {
      text: cleanText,
      method: "adobe-pdf-services",
      confidence: wordCount > 120 ? "high" : wordCount > 40 ? "medium" : "low",
      characterNames,
      wordCount,
    };
  } catch (error) {
    console.error("❌ Adobe PDF Services extraction failed:", error);

    // Fallback to basic extraction if Adobe fails
    console.log("🔄 Falling back to basic pdf-parse extraction...");
    return await extractTextBasic(pdfBuffer);
  }
}

// Fallback PDF extraction (keep the old function as backup)
async function extractTextBasic(pdfBuffer) {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(pdfBuffer);

  // Preserve line breaks. Normalize only CRLF->LF and trim trailing spaces.
  let text = data.text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n") // strip end-of-line spaces
    .replace(/\n{3,}/g, "\n\n") // collapse >2 blank lines to 1 blank line
    .trim();

  // Remove known watermarks/footers; DO NOT blanket-replace digits or spaces
  text = text
    .replace(/Sides by Breakdown Services - Actors Access/gi, "")
    .replace(/Page \d+\s+of\s+\d+/gi, "")
    .replace(/\-\s*[a-zA-Z]{3,4}\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*[AP]M\s*\-/gi, "\n")
    .replace(/\bB\d{3,}[A-Z0-9]*\b/gi, "") // matches B540LT, B568CR, etc
    .replace(/B540LT|B568CR|74222/gi, "")
      .replace(/\b\d{1,2}:\d{2}:\d{2}\s*[AP]M\b/gi, "")
      .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, "")
      .replace(/\b[A-Z]\d{3,}[A-Z]{2}\b/gi, "")
      .replace(/\b\d{5,}\b/g, "")
    .replace(/\-{2,}/g, " ") // clean up leftover hyphens from B540LT-B540LT
    .replace(/74222 - .*? -/g, "")
    .trim();

  // Character tags: keep multiline, after we preserved \n
  const characterPattern = /^(?:[A-Z][A-Z][A-Z\s]{1,40}):/gm; // e.g., "BRAD:" or "MRS. CARRUTHERS:"
  const characterNames = [
    ...new Set(
      (text.match(characterPattern) || []).map((n) => n.replace(":", "").trim())
    ),
  ];

  // Basic quality signal
  const wordCount = (text.match(/\b\w+\b/g) || []).length;

  return {
    text,
    method: "basic",
    confidence: wordCount > 120 ? "high" : wordCount > 40 ? "medium" : "low",
    characterNames,
    wordCount,
  };
}

// RAG-Enhanced Guide Generation using your methodology files
async function generateActingGuideWithRAG(data) {
  try {
    console.log("🧠 Step 1: RAG - Searching your methodology files...");

    // Search your methodology files for relevant content
    const retrieval = searchMethodology({
      product: "prep101",
      characterName: data.characterName,
      productionType: data.productionType,
      productionTitle: data.productionTitle,
      genre: data.genre,
      storyline: data.storyline,
      sceneText: data.sceneText,
      topK: 8,
    });
    const relevantMethodology = retrieval.relevantChunks || [];

    // Build context from your methodology files (limit to ~120k chars to allow archetype file + examples)
    let methodologyContext = "";
    const MAX_METHODOLOGY_CHARS = 120000;
    let currentChars = 0;

    if (relevantMethodology.length > 0) {
      const contextParts = [];
      for (const chunk of relevantMethodology) {
        const chunkContext = `=== COREY RALSTON METHODOLOGY CHUNK: ${chunk.filename} (score: ${chunk.relevanceScore.toFixed(
          3
        )}, type: ${chunk.fileType}) ===\n${chunk.content}\n\n`;
        if (currentChars + chunkContext.length <= MAX_METHODOLOGY_CHARS) {
          contextParts.push(chunkContext);
          currentChars += chunkContext.length;
        } else {
          console.log(
            `⚠️ Skipping chunk from ${chunk.filename} to keep context under ${MAX_METHODOLOGY_CHARS} chars`
          );
        }
      }
      methodologyContext = contextParts.join("");
    }

    if (retrieval.hagen) {
      const hagenBlock = `=== HAGEN CONTEXT (AUTO-EXTRACTED) ===
WHO: ${retrieval.hagen.who || "Not clear from sides"}
WHERE: ${retrieval.hagen.where || "Not clear from sides"}
WHEN: ${retrieval.hagen.when || "Not clear from sides"}
RELATIONSHIPS: ${(retrieval.hagen.relationships || []).join(", ") || "Not clear from sides"}
WANT: ${(retrieval.hagen.want || []).join(" | ") || "Not clear from sides"}
OBSTACLE: ${(retrieval.hagen.obstacle || []).join(" | ") || "Not clear from sides"}
TACTICS: ${(retrieval.hagen.tactics || []).join(" | ") || "Not clear from sides"}

`;
      methodologyContext = `${hagenBlock}${methodologyContext}`;
    }

    console.log(
      `🎭 Step 2: Generating guide using ${relevantMethodology.length} methodology chunks...`
    );
    console.log(
      `📊 Total methodology context: ${methodologyContext.length} characters`
    );

    // Build file type context for the AI
    let fileTypeContext = "";
    if (data.hasFullScript) {
      fileTypeContext = `

**FILE TYPE CONTEXT:**
You have access to BOTH audition sides AND the full script. Use this to your advantage:

- **Full Script Context**: Reference the full script ONLY for character relationships, story arc, tone, and broader context
- **Audition Sides Focus**: Analyze and provide specific guidance ONLY on the uploaded audition sides
- **Smart Integration**: Pull relevant background information from the full script to enrich your analysis of the sides
- **Stay Focused**: Never give line-by-line notes on sections outside the audition sides

**IMPORTANT**: The full script provides context, but your analysis should focus entirely on the audition sides. Use the broader context to make the sides analysis richer and more informed.`;
    } else {
      fileTypeContext = `

**FILE TYPE CONTEXT:**
You are working with audition sides only. Focus your analysis on what's provided in the uploaded scenes.`;
    }

    // Generate guide using your methodology as context with timeout and retry logic
    // Allow 4 minutes for Claude to generate (Vercel has 5-minute max)
    const maxRetries = 2; // Allow one retry on timeout
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to generate guide...`);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minutes max for parent guide

        // Debug scene content
        console.log(
          "📄 Scene text preview (first 500 chars):",
          data.sceneText.substring(0, 500)
        );
        console.log("📄 Scene text length:", data.sceneText.length);

        // Log what the model actually sees
        console.log(
          "🧾 SCRIPT PREVIEW:",
          (data.sceneText || "").slice(0, 800).replace(/\n/g, "⏎"),
          "... (len:",
          (data.sceneText || "").length,
          ")"
        );

        const POLICY = `
SCRIPT INTEGRITY:
- Use ONLY facts present in SCRIPT below. If key facts (title, studio, location, time period) are not in the script, write "Not stated in sides" rather than inventing.
- Do NOT hallucinate project names, franchises, or studio info not explicitly in the script.
- For sparse scripts: acknowledge limited information, focus on what IS present, and give MORE imaginative/empathetic coaching to compensate.
- Never abort. If the script text is limited or partially corrupted, still generate the guide from the available signal plus title/genre/character context.
- NO EVIDENCE TAGS or inline citations—trust the reader knows you're referencing the script. Just COACH.
- Tone: warm, direct, industry-savvy; balance encouragement with honest craft notes. Avoid generic motivational fluff.
`;

        const {
          data: result,
          model: resolvedModel,
          provider: resolvedProvider,
        } = await sendAnthropicMessage({
          apiKey: ANTHROPIC_API_KEY,
          preferredModel: DEFAULT_CLAUDE_MODEL,
          maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
          openAIFallbackModel: "gpt-5.2",
          signal: controller.signal,
          messages: [
            {
              role: "user",
              content: `${POLICY}

You are PREP101, Corey Ralston's elite acting coach persona. You have access to Corey's complete methodology and reference files (Gold Standard Examples, Character Archetype Comparables, Voice Examples). Use them to deliver a personalized coaching guide that feels like Corey wrote it.

**COREY RALSTON'S METHODOLOGY & EXAMPLES:**
${methodologyContext}

**CURRENT AUDITION:**
CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})

${data.fallbackMode ? `
⚠️ FALLBACK MODE ACTIVATED: The uploaded audition sides were unreadable or corrupted. 
You must STILL generate a full Prep101 Coaching Guide using character archetypes, production genre, and tone. 
Instead of line-by-line analysis, focus on:
- Archetypal character behavior for this project type.
- The "vibe" and rhythm of ${data.productionTitle}.
- Universal beats and choices for this genre.
Do NOT reference specific script text that is not actually present. Build the guide from your deep acting knowledge and the provided methodology.` : `
SCRIPT:
${data.sceneText}${fileTypeContext}
`}

**VOICE & PERSONALITY**
- Talk directly to the actor ("You're about to...", "Your job is...").
- Open with a vivid hook that reframes the character's essence.
- Use emphatic caps sparingly and bold callouts (e.g., **Bold Choice:**, **Gold Acting Moment:**).
- Mix warmth, humor, and industry-truth honesty; always end with a FINAL PEP TALK.

**REQUIRED SECTIONS (IN THIS ORDER):**
1. **PROJECT OVERVIEW** - Project type, genre, tone/style. Name 3-5 comparable projects with 1-sentence explanations of WHY they're relevant (e.g., "Parks & Rec for the ensemble comedy rhythm"). Scene context + "Casting Director Mindset" (what they're REALLY looking for).

2. **CHARACTER BREAKDOWN** - Lead with a vivid character essence hook (see Voice Examples). Include:
   - **Who They REALLY Are** (not the logline version—the lived-in truth)
   - **How They See Themselves vs How Others See Them** (internal/external gap)
   - **Your Bridge to [Character]** — 5+ reflective prompts to help the actor find personal connection ("Have you ever...?")
   - **The Empathy Stretch** — What's DIFFERENT about this character's life from yours? How do you imaginatively access that?
   - **Character Shortcut** — A vivid metaphor (e.g., "She's a golden retriever puppy in human form")
   - **The Type (And How to Transcend It)** — Name the stereotype, then show how to make it three-dimensional
   - **Character Archetypes to Study** — List 3-5 SPECIFIC characters from TV/Film that match this vibe (e.g., "Ruth Langmore in Ozark for the toughness," "Ginny Miller for the mother-daughter tension"). Use the uploaded \`character_archetype_comparables.md\` for inspiration but providing SPECIFIC examples is mandatory.

3. **UTA HAGEN'S 9 QUESTIONS** - Answer ALL NINE in first-person character voice. Be specific, grounded, imaginative. NO citations needed—just inhabit the character fully.

4. **SCENE-BY-SCENE BREAKDOWN** - For each scene:
   - One-sentence emotional arc summary
   - Beat-by-beat breakdown: What I'm DOING / What I'm REALLY thinking (subtext) / Physical life
   - Identify the scene's emotional climax and how to earn it

5. **PHYSICALITY & MOVEMENT** - Translate psychology into body: posture, gestures, eye patterns, nervous habits, stillness vs movement. Include vocal life (pace, pitch, where they swallow emotion). Name 2-3 "signature moves" specific to THIS character. Self-tape framing notes.

6. **SUBTEXT & EMOTIONAL LAYERS** - For EVERY key line: "Line text" = Surface meaning → Subtext (the real need underneath). Map the emotional journey through the scenes. Name one "Trap to Avoid" and one "Secret Weapon" for this character.

7. **BOLD ACTING CHOICES** - The gold that books roles:
   - **Trap vs Truth** table (Line | The Cliché Delivery | The Bold Choice)
   - 3-4 "Surprising Shifts to Try" (e.g., "What if they LAUGH here instead of cry?")
   - Genre-specific strategy
   - "The Audition Trap" (what most actors will do wrong)

8. **MOMENT BEFORE & BUTTON** - Specific prep beats (60s/30s/10s/1s before) and multiple "button" options to end scenes with impact. Include physical punctuation ideas.

9. **REHEARSAL STRATEGY** - **CRITICAL SECTION:**
   - **Your 10+ Takes Strategy:** Explicitly list 10 unique ways to run the scene (e.g., 1-2: Get words in body, 3-4: Full Anger, 5-6: Vulnerable/Barely holding back tears, 7-8: Strategic/Chess Player, 9-10: Mix and Match).
   - **Alternative Callback Take:** Suggest one radically different approach to have in your back pocket.
   - **Memorization Strategy:** How to learn the *argument*, not just lines.
   - **Working with Reader:** Specific tips on how to react to the reader's tone.

10. **ACTION PLAN** - Quick checklist: [ ] Week Before / [ ] Day Before / [ ] Day Of / [ ] After. Include emotional safety/decompression notes if material is heavy.

**END WITH:** A **FINAL PEP TALK** in Corey's voice—direct, warm, belief-filled. Make them feel ready to walk into that room and OWN it.

**PRODUCTION TYPE ADJUSTMENTS (APPLY WHEN RELEVANT):**
- **Multi-Cam Sitcom:** Mention live audience timing, "hold for laugh" guidance, bigger/cleaner physical choices, readable jokes.
- **Sketch Comedy:** Emphasize recurring character logic, signature behaviors, "Recurring Character Mindset", physical signature move.
- **Single-Cam Comedy:** Balance grounded truth with comedy, camera intimacy, reference shows like "The Office"/"Parks & Rec".
- **Streaming Drama/Prestige:** Highlight range, series arc, voice-over considerations, prestige comparables (Succession, Euphoria, etc.).
- **Feature Film:** Stress cinematic stillness, lens awareness, "The Camera Will Find You", film performance references.
- **Child/Family Project:** Keep language age-appropriate, add parent-friendly guidance, fun/emojis allowed, shorter digestible paragraphs.

**QUALITY IMPERATIVES**
- NEVER invent production facts; write "Not stated in sides" when missing. NO inline citations or [evidence] tags—just write naturally.
- Include at least 3 comparable projects with clear "why" explanations.
- AVOID REPETITION: Each section should add NEW insights, not repeat what was said earlier. If you've covered a point, move on.
- Make EVERY line of subtext analysis SPECIFIC to the actual dialogue—don't generalize.
- Bridge to Character prompts should feel deeply personal and imaginative, not generic.
- Pull archetype comparisons from \`character_archetype_comparables.md\` when they illuminate the role.
- Highlight "Bold Choice", "Gold Acting Moment", "Pitfall to Avoid" ONLY where they add genuine value—not as filler.
- Write to INSPIRE and STRATEGIZE, not just inform. This is coaching, not a book report.
- ${data.hasFullScript
                    ? "Use full-script knowledge only to enrich side-specific analysis (avoid spoilers)."
                    : "Focus analysis strictly on the provided audition sides."
                  }

**DELIVERABLE REMINDERS**
- Use HTML-friendly headings, paragraphs, and lists; keep the required order.
- Provide actionable coaching, not summaries; every section should end with playable insights.
- Always conclude with a FINAL PEP TALK in Corey's voice.

**CRITICAL HTML STYLING RULES:**
- NEVER use light text colors (white, #fff, #ffffff, light gray, etc.) on light backgrounds
- NEVER use inline styles with light background colors (#fff, #ffffff, #fdf, #eff, #f5f, #f0f, #fef, #fffb, #f8fa, rgba(255, rgba(253, rgba(239, rgba(245, rgba(240, rgba(254, rgba(248, etc.)
- If you must use background colors, use DARK backgrounds with LIGHT text, or NO background colors at all
- The guide will be displayed on a dark background (#1f2937), so all text should be light/readable colors
- DO NOT add inline style attributes with color or background-color properties
- Let the CSS handle all styling - just use semantic HTML

**OUTPUT FORMAT:** Output ONLY the raw HTML content without any markdown formatting, code blocks, or \`\`\`html wrappers. The response should be pure HTML that can be directly inserted into a web page. Make it worthy of the PREP101 brand and indistinguishable from Corey's personal coaching.`,
            },
          ],
        });

        clearTimeout(timeoutId);
        if (resolvedProvider === "openai") {
          console.warn(
            `[PREP101] Anthropic unavailable; used OpenAI fallback model ${resolvedModel}.`
          );
        }
        if (resolvedModel !== DEFAULT_CLAUDE_MODEL) {
          console.warn(
            `[PREP101] Used fallback model ${resolvedModel} (primary ${DEFAULT_CLAUDE_MODEL} unavailable)`
          );
        }

        if (result.content && result.content[0] && result.content[0].text) {
          console.log(`✅ RAG Guide generated using Corey's methodology!`);
          console.log(
            `📊 Guide length: ${result.content[0].text.length} characters`
          );
          console.log(
            `🎯 Methodology chunks used: ${relevantMethodology.length}`
          );
          return result.content[0].text;
        } else {
          throw new Error("Invalid response format from API");
        }
      } catch (error) {
        lastError = error;

        if (error.name === "AbortError") {
          console.error(`⏰ Request timeout on attempt ${attempt}`);
          if (attempt < maxRetries) {
            console.log(`🔄 Retrying after timeout...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
            continue;
          }
        }

        if (attempt < maxRetries) {
          console.log(
            `🔄 Attempt ${attempt} failed, retrying in ${attempt * 2
            } seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }

        console.error(`❌ All ${maxRetries} attempts failed`);
        throw error;
      }
    }

    throw (
      lastError ||
      new Error("Failed to generate guide after all retry attempts")
    );
  } catch (error) {
    console.error("❌ RAG guide generation failed:", error.message);
    throw error;
  }
}

// Analyze script content to determine color theme
function determineColorTheme(
  characterName,
  productionTitle,
  productionType,
  sceneText
) {
  const text =
    `${characterName} ${productionTitle} ${productionType} ${sceneText}`.toLowerCase();

  // Gender-specific themes (check character names first)
  const characterNameLower = characterName.toLowerCase();

  // Princess/Female character themes
  if (
    characterNameLower.includes("princess") ||
    characterNameLower.includes("queen") ||
    characterNameLower.includes("fairy") ||
    characterNameLower.includes("rose") ||
    characterNameLower.includes("lily") ||
    characterNameLower.includes("belle") ||
    characterNameLower.includes("ariel") ||
    characterNameLower.includes("snow")
  ) {
    return {
      primary: "#EC4899", // Pink
      secondary: "#F59E0B", // Gold
      accent: "#8B5CF6", // Purple
      background: "#FDF2F8", // Light pink
      name: "Princess",
    };
  }

  // Prince/Male character themes
  if (
    characterNameLower.includes("prince") ||
    characterNameLower.includes("king") ||
    characterNameLower.includes("knight") ||
    characterNameLower.includes("hero") ||
    characterNameLower.includes("warrior") ||
    characterNameLower.includes("dragon") ||
    characterNameLower.includes("max") ||
    characterNameLower.includes("leo")
  ) {
    return {
      primary: "#3B82F6", // Blue
      secondary: "#F59E0B", // Gold
      accent: "#10B981", // Green
      background: "#EFF6FF", // Light blue
      name: "Prince",
    };
  }

  // Adventure/Action themes
  if (
    text.includes("adventure") ||
    text.includes("action") ||
    text.includes("quest") ||
    text.includes("hero") ||
    text.includes("battle") ||
    text.includes("journey") ||
    text.includes("explorer") ||
    text.includes("warrior") ||
    text.includes("knight")
  ) {
    return {
      primary: "#4F46E5", // Vibrant blue
      secondary: "#F59E0B", // Orange
      accent: "#10B981", // Green
      background: "#EFF6FF", // Light blue
      name: "Adventure",
    };
  }

  // Comedy/Fun themes
  if (
    text.includes("comedy") ||
    text.includes("funny") ||
    text.includes("humor") ||
    text.includes("silly") ||
    text.includes("joke") ||
    text.includes("laugh") ||
    text.includes("playful") ||
    text.includes("wacky") ||
    text.includes("goofy")
  ) {
    return {
      primary: "#EC4899", // Pink
      secondary: "#F59E0B", // Yellow
      accent: "#8B5CF6", // Purple
      background: "#FDF2F8", // Light pink
      name: "Comedy",
    };
  }

  // Fantasy/Magical themes
  if (
    text.includes("fantasy") ||
    text.includes("magic") ||
    text.includes("wizard") ||
    text.includes("fairy") ||
    text.includes("dragon") ||
    text.includes("spell") ||
    text.includes("enchanted") ||
    text.includes("mythical") ||
    text.includes("wonder")
  ) {
    return {
      primary: "#8B5CF6", // Purple
      secondary: "#EC4899", // Pink
      accent: "#F59E0B", // Gold
      background: "#F5F3FF", // Light purple
      name: "Fantasy",
    };
  }

  // Drama/Serious themes
  if (
    text.includes("drama") ||
    text.includes("serious") ||
    text.includes("emotional") ||
    text.includes("intense") ||
    text.includes("deep") ||
    text.includes("powerful") ||
    text.includes("meaningful") ||
    text.includes("touching") ||
    text.includes("heartfelt")
  ) {
    return {
      primary: "#7C3AED", // Purple
      secondary: "#14B8A6", // Teal
      accent: "#6B7280", // Gray
      background: "#F0FDFA", // Light teal
      name: "Drama",
    };
  }

  // Modern/Urban themes
  if (
    text.includes("modern") ||
    text.includes("urban") ||
    text.includes("city") ||
    text.includes("contemporary") ||
    text.includes("trendy") ||
    text.includes("cool") ||
    text.includes("street") ||
    text.includes("hip") ||
    text.includes("current")
  ) {
    return {
      primary: "#3B82F6", // Blue
      secondary: "#6B7280", // Gray
      accent: "#EF4444", // Red
      background: "#F8FAFC", // Light gray
      name: "Modern",
    };
  }

  // Princess/Royal themes
  if (
    text.includes("princess") ||
    text.includes("royal") ||
    text.includes("queen") ||
    text.includes("king") ||
    text.includes("crown") ||
    text.includes("castle") ||
    text.includes("noble") ||
    text.includes("elegant") ||
    text.includes("regal")
  ) {
    return {
      primary: "#EC4899", // Pink
      secondary: "#F59E0B", // Gold
      accent: "#8B5CF6", // Purple
      background: "#FDF2F8", // Light pink
      name: "Royal",
    };
  }

  // Superhero themes
  if (
    text.includes("superhero") ||
    text.includes("hero") ||
    text.includes("power") ||
    text.includes("save") ||
    text.includes("rescue") ||
    text.includes("strong") ||
    text.includes("mighty") ||
    text.includes("brave") ||
    text.includes("courage")
  ) {
    return {
      primary: "#EF4444", // Red
      secondary: "#F59E0B", // Gold
      accent: "#3B82F6", // Blue
      background: "#FEF2F2", // Light red
      name: "Superhero",
    };
  }

  // Nature/Outdoor themes
  if (
    text.includes("nature") ||
    text.includes("outdoor") ||
    text.includes("forest") ||
    text.includes("garden") ||
    text.includes("animal") ||
    text.includes("tree") ||
    text.includes("flower") ||
    text.includes("mountain") ||
    text.includes("river")
  ) {
    return {
      primary: "#10B981", // Green
      secondary: "#F59E0B", // Orange
      accent: "#8B5CF6", // Purple
      background: "#F0FDF4", // Light green
      name: "Nature",
    };
  }

  // Production type specific themes
  if (productionType.toLowerCase().includes("musical")) {
    return {
      primary: "#EC4899", // Pink
      secondary: "#F59E0B", // Gold
      accent: "#8B5CF6", // Purple
      background: "#FDF2F8", // Light pink
      name: "Musical",
    };
  }

  if (productionType.toLowerCase().includes("comedy")) {
    return {
      primary: "#F59E0B", // Yellow
      secondary: "#EC4899", // Pink
      accent: "#10B981", // Green
      background: "#FFFBEB", // Light yellow
      name: "Comedy",
    };
  }

  if (productionType.toLowerCase().includes("drama")) {
    return {
      primary: "#7C3AED", // Purple
      secondary: "#14B8A6", // Teal
      accent: "#6B7280", // Gray
      background: "#F0FDFA", // Light teal
      name: "Drama",
    };
  }

  if (
    productionType.toLowerCase().includes("action") ||
    productionType.toLowerCase().includes("adventure")
  ) {
    return {
      primary: "#EF4444", // Red
      secondary: "#F59E0B", // Gold
      accent: "#3B82F6", // Blue
      background: "#FEF2F2", // Light red
      name: "Action",
    };
  }

  // Seasonal and holiday themes
  if (
    text.includes("christmas") ||
    text.includes("holiday") ||
    text.includes("winter")
  ) {
    return {
      primary: "#EF4444", // Red
      secondary: "#10B981", // Green
      accent: "#F59E0B", // Gold
      background: "#FEF2F2", // Light red
      name: "Christmas",
    };
  }

  if (
    text.includes("halloween") ||
    text.includes("spooky") ||
    text.includes("ghost")
  ) {
    return {
      primary: "#8B5CF6", // Purple
      secondary: "#F59E0B", // Orange
      accent: "#EF4444", // Red
      background: "#F5F3FF", // Light purple
      name: "Halloween",
    };
  }

  if (
    text.includes("easter") ||
    text.includes("spring") ||
    text.includes("bunny")
  ) {
    return {
      primary: "#EC4899", // Pink
      secondary: "#10B981", // Green
      accent: "#FCD34D", // Yellow
      background: "#FDF2F8", // Light pink
      name: "Easter",
    };
  }

  if (
    text.includes("summer") ||
    text.includes("beach") ||
    text.includes("ocean")
  ) {
    return {
      primary: "#3B82F6", // Blue
      secondary: "#FCD34D", // Yellow
      accent: "#10B981", // Green
      background: "#EFF6FF", // Light blue
      name: "Summer",
    };
  }

  // Default: Friendly and approachable
  let theme = {
    primary: "#10B981", // Green
    secondary: "#F59E0B", // Orange
    accent: "#3B82F6", // Blue
    background: "#F0FDF4", // Light green
    name: "Friendly",
  };

  // Age-specific color adjustments
  if (
    text.includes("baby") ||
    text.includes("toddler") ||
    text.includes("little")
  ) {
    // Softer, pastel colors for very young characters
    theme.primary = "#F472B6"; // Soft pink
    theme.secondary = "#FCD34D"; // Soft yellow
    theme.accent = "#A78BFA"; // Soft purple
    theme.background = "#FDF2F8"; // Very light pink
    theme.name = "Baby-Friendly";
  } else if (
    text.includes("teen") ||
    text.includes("older") ||
    text.includes("mature")
  ) {
    // More sophisticated colors for older characters
    theme.primary = "#7C3AED"; // Deeper purple
    theme.secondary = "#14B8A6"; // Teal
    theme.accent = "#6B7280"; // Gray
    theme.background = "#F8FAFC"; // Light gray
    theme.name = "Teen-Friendly";
  }

  return theme;
}

// Generate sample HTML template with the determined color theme
function generateHTMLTemplate(colorTheme, characterName, productionTitle) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${characterName} - ${productionTitle} - Child's Guide</title>
    <link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Fredoka+One&family=Bubblegum+Sans&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Comic Neue', cursive;
            background: linear-gradient(135deg, ${colorTheme.background} 0%, #ffffff 100%);
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, ${colorTheme.primary} 0%, ${colorTheme.secondary} 100%);
            color: #1f2937;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-family: 'Fredoka One', cursive;
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.5);
            color: #1f2937;
        }

        .header p {
            font-size: 1.2rem;
            color: #374151;
        }

        .content {
            padding: 30px;
        }

        .section {
            margin-bottom: 30px;
            padding: 25px;
            background: ${colorTheme.background};
            border-radius: 15px;
            border-left: 5px solid ${colorTheme.accent};
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }

        .section h2 {
            font-family: 'Bubblegum Sans', cursive;
            color: ${colorTheme.primary};
            font-size: 1.8rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section h3 {
            color: ${colorTheme.secondary};
            font-size: 1.4rem;
            margin: 20px 0 10px 0;
            font-weight: 700;
        }

        .highlight-box {
            background: #fef3c7;
            color: #1f2937;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            font-weight: 700;
            border: 2px solid ${colorTheme.accent};
        }

        .tip-box {
            background: #ecfdf5;
            color: #1f2937;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            font-weight: 700;
            border: 2px solid ${colorTheme.secondary};
        }

        .number-list {
            list-style: none;
            counter-reset: item;
        }

        .number-list li {
            counter-increment: item;
            margin-bottom: 15px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            border: 2px solid ${colorTheme.primary};
            position: relative;
        }

        .number-list li::before {
            content: counter(item);
            background: ${colorTheme.primary};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: -15px;
            top: 50%;
            transform: translateY(-50%);
            font-weight: 700;
        }

        .number-list li strong {
            color: ${colorTheme.primary};
            font-weight: 700;
        }

        .emoji {
            font-size: 1.5rem;
        }

        .footer {
            background: linear-gradient(135deg, ${colorTheme.secondary} 0%, ${colorTheme.primary} 100%);
            color: #1f2937;
            text-align: center;
            padding: 20px;
            font-weight: 700;
            text-shadow: 0 1px 2px rgba(255,255,255,0.5);
        }

        @media (max-width: 600px) {
            .header h1 { font-size: 2rem; }
            .content { padding: 20px; }
            .section { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 ${characterName} 🌟</h1>
            <p>Your Awesome Acting Guide for ${productionTitle}</p>
        </div>

        <div class="content">
            <!-- Your guide content will go here -->
        </div>

        <div class="footer">
            <p>🎭 You've got this! Break a leg! 🎭</p>
        </div>
    </div>
</body>
</html>`;
}

// Child's Guide Generation Function
async function generateChildGuide(data) {
  try {
    console.log("🌟 Generating simplified Child's Guide...");

    // Search methodology for child-friendly examples
    const childRetrieval = searchMethodology({
      product: "prep101",
      characterName: data.characterName,
      productionType: data.productionType,
      productionTitle: data.productionTitle,
      genre: data.genre,
      storyline: data.storyline,
      sceneText: data.sceneText,
      topK: 6,
    });
    const childMethodology = childRetrieval.relevantChunks || [];

    // Build context from child-friendly methodology
    let childMethodologyContext = "";
    if (childMethodology.length > 0) {
      childMethodologyContext = childMethodology
        .map(
          (chunk) =>
            `=== CHILD-FRIENDLY METHODOLOGY: ${chunk.filename} (score: ${chunk.relevanceScore.toFixed(
              3
            )}) ===\n${chunk.content}\n\n`
        )
        .join("");
    }

    console.log(
      `🎭 Generating child guide using ${childMethodology.length} methodology chunks...`
    );

    // Determine color theme based on content
    const colorTheme = determineColorTheme(
      data.characterName,
      data.productionTitle,
      data.productionType,
      data.sceneText
    );
    console.log(`🎨 Using ${colorTheme.name} color theme for child guide`);

    // Add timeout to child guide generation to prevent Vercel timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100000); // 100 second timeout for child guide

    try {
      // Generate child guide using the parent guide as reference
      const { data: result, model: resolvedModel } = await sendAnthropicMessage({
        apiKey: ANTHROPIC_API_KEY,
        preferredModel: DEFAULT_CLAUDE_MODEL,
        maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
        signal: controller.signal,
        messages: [
          {
            role: "user",
            content: `You are Corey Ralston, a witty, experienced youth acting coach.
Your task is to create a simplified, fun, and empowering "Child's Guide" for young actors (ages 8-12), based on the parent-facing audition prep guide.

## Voice & Style
- Friendly, encouraging, and conversational — talk **to the child directly**.
- Keep language simple but not babyish.
- Fun tone with positive energy, like a coach who believes in them.
- Use emojis sparingly for emphasis (🌟, 🎭, 🎬) — no overuse.
- Add clear, bold section headers for easy reading.
- Keep paragraphs short and scannable.

## Structure
Your guide must follow this flow:
1. **Big Welcome**
   - Greet the actor, mention the role name and project title, and remind them they've got this.
2. **About Your Character**
   - Describe who they are, what makes them unique, and their personality.
   - Keep it relatable and fun, like explaining to a friend.
3. **What's Happening in the Scene**
   - Explain the scene setup in simple language.
4. **Acting Jobs (Action Plan)**
   - Numbered list of 3-5 specific things they need to focus on in the scene.
   - Use bold keywords for clarity.
5. **Fun Acting Tips**
   - Ideas for how they can explore choices (different voices, physicality, emotions).
6. **Moment Before & Button**
   - A simple explanation of what happens right before the scene and how to finish strong.
7. **Practice Ideas**
   - Easy practice tasks or "games" to rehearse their choices.
8. **Final Encouragement**
   - Short, upbeat closing that reminds them they are ready and capable.

## HTML Styling & Colors
Create a complete HTML document with embedded CSS using this EXACT color theme:

**${colorTheme.name.toUpperCase()} THEME COLORS:**
- Primary: ${colorTheme.primary}
- Secondary: ${colorTheme.secondary}
- Accent: ${colorTheme.accent}
- Background: ${colorTheme.background}

**HTML TEMPLATE REFERENCE:**
Use this structure and styling approach (replace the placeholder content with your guide):

${generateHTMLTemplate(colorTheme, data.characterName, data.productionTitle)}

**CRITICAL COLOR & STYLING RULES:**
- NEVER use light text colors (white, #fff, light gray, etc.) on light backgrounds
- NEVER use inline style attributes with light background colors - the CSS will handle all styling
- If you use the provided color theme, ensure DARK text (#1f2937, #333, etc.) on light backgrounds
- DO NOT add inline color or background-color styles - let the CSS classes handle styling
- Use the exact colors provided above
- Follow the CSS class names from the template (.section, .highlight-box, .tip-box, .number-list)
- Keep the fun, youthful design with rounded corners, shadows, and gradients
- Make sure all content is properly wrapped in the HTML structure

2. **Youthful Design Elements**:
   - Rounded corners (border-radius: 12px)
   - Soft shadows (box-shadow: 0 4px 20px rgba(0,0,0,0.1))
   - Fun fonts (Google Fonts: 'Comic Neue', 'Fredoka One', 'Bubblegum Sans')
   - Gradient backgrounds
   - Emoji icons for section headers
   - Colorful accent borders

3. **Responsive Layout**:
   - Mobile-friendly design
   - Easy-to-read typography
   - Clear visual hierarchy
   - Comfortable spacing

## Rules
- NO overly adult jargon — explain complex ideas in kid-friendly terms.
- NO summarizing or shortening beyond what's needed for age clarity — keep the guide complete and helpful.
- Reference the parent guide's insights for accuracy but rewrite it in a playful, empowering style.
- When the role skews younger (under 8), simplify even further and lean into fun phrasing and examples.
- ALWAYS include complete HTML with embedded CSS styling and appropriate colors.

## References
Match the tone, depth, and structure of these examples:
- Tucker's Guide (age 9)
- Eloise's Guide (age 10)
- Alanna's Guide (age 4-6)
- Alma's Guide (age 8)

## Current Project
CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})

SCRIPT:
${data.sceneText}

## Parent Guide Reference
${data.parentGuideContent.substring(0, 2000)}...

## Child-Friendly Methodology
${childMethodologyContext}

**OUTPUT FORMAT:** Output ONLY the raw HTML content without any markdown formatting, code blocks, or \`\`\`html wrappers. The response should be a complete HTML document with embedded CSS styling, fun colors, and perfect for young actors!`,
          },
        ],
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      if (resolvedModel !== DEFAULT_CLAUDE_MODEL) {
        console.warn(
          `[ChildGuide] Used fallback model ${resolvedModel} (primary ${DEFAULT_CLAUDE_MODEL} unavailable)`
        );
      }

      if (result.content && result.content[0] && result.content[0].text) {
        console.log(`✅ Child's Guide generated successfully!`);
        console.log(
          `📊 Child guide length: ${result.content[0].text.length} characters`
        );
        return result.content[0].text;
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        console.error("⏰ Child guide generation timeout after 90 seconds");
        throw new Error("Child guide generation timed out");
      }

      console.error("❌ Child guide generation failed:", error.message);
      throw error;
    }
  } catch (error) {
    console.error("❌ Child guide generation outer error:", error.message);
    throw error;
  }
}

// Async child guide generation - runs in background on serverful, or via separate endpoint on serverless
async function generateChildGuideAsync({ guideId, childData, userId }) {
  let persistence = "sequelize";
  let guideRecord = null;
  let GuideModel = null;

  try {
    GuideModel = Guide || require("./models/Guide");
  } catch (_) {
    GuideModel = null;
  }

  try {
    if (GuideModel) {
      guideRecord = await GuideModel.findByPk(guideId);
    } else if (isSupabaseAdminConfigured()) {
      persistence = "supabase";
      guideRecord = await supabaseFetchGuide({ id: guideId });
    } else {
      console.warn(
        "⚠️  No database models or Supabase admin client available - child guide generation skipped."
      );
      return { success: false, error: "No database available" };
    }

    if (!guideRecord) {
      console.warn(
        `⚠️  Child guide generation skipped - guide ${guideId} not found`
      );
      return { success: false, error: "Guide not found" };
    }

    console.log(
      `🌟 Child guide generation started for guide ${guideRecord.guideId || guideId
      }`
    );
    const childHtml = await generateChildGuide(childData);
    const supabaseUserId =
      userId || guideRecord?.userId || guideRecord?.user_id;

    if (
      persistence === "sequelize" &&
      GuideModel &&
      typeof guideRecord.update === "function"
    ) {
      await guideRecord.update({
        childGuideHtml: childHtml,
        childGuideCompleted: true,
      });
    } else if (supabaseUserId) {
      await supabaseUpdateGuide(guideId, supabaseUserId, {
        childGuideHtml: childHtml,
        childGuideCompleted: true,
      });
    } else {
      console.warn(
        `⚠️  Unable to persist child guide for ${guideId}: missing userId`
      );
      return { success: false, error: "Missing userId" };
    }

    console.log(
      `✅ Child guide stored for ${guideRecord.characterName} (${guideRecord.guideId || guideId
      })`
    );
    return { success: true, childHtml };
  } catch (error) {
    console.error("❌ Child guide generation failed:", error);
    try {
      if (persistence === "sequelize" && GuideModel) {
        await GuideModel.update(
          { childGuideCompleted: false },
          { where: { id: guideId } }
        );
      } else if (guideRecord) {
        const supabaseUserId =
          userId || guideRecord?.userId || guideRecord?.user_id;
        if (supabaseUserId) {
          await supabaseUpdateGuide(guideId, supabaseUserId, {
            childGuideCompleted: false,
          });
        }
      }
    } catch (updateError) {
      console.error(
        "❌ Failed to persist child guide failure status:",
        updateError
      );
    }
    return { success: false, error: error.message };
  }
}

function queueChildGuideGeneration({ guideId, childData, userId }) {
  // In Vercel serverless, run synchronously but don't await (fire and forget with internal error handling)
  // This works because Vercel keeps the function alive for a bit after response is sent
  if (process.env.VERCEL) {
    console.log(
      `🌟 Starting child guide generation for ${guideId} (Vercel serverless mode)`
    );
    // Fire and forget - the function has internal error handling
    generateChildGuideAsync({ guideId, childData, userId })
      .then((result) => {
        if (result.success) {
          console.log(`✅ Child guide generated for ${guideId} in Vercel mode`);
        } else {
          console.error(`❌ Child guide failed for ${guideId}:`, result.error);
        }
      })
      .catch((err) => {
        console.error(`❌ Child guide error for ${guideId}:`, err);
      });
    return;
  }

  // In serverful mode (local dev, Railway), use setImmediate for background processing
  setImmediate(async () => {
    await generateChildGuideAsync({ guideId, childData, userId });
  });
}

// Handle OPTIONS preflight for upload endpoint
app.options("/api/upload", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "86400"); // 24 hours
  res.status(200).end();
});

// PDF Upload endpoint
// PDF Upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Please upload a PDF file" });
    }

    console.log(`[UPLOAD] Extracting text from ${req.file.originalname}`);
    const pipelineResult = await ingestPdf(req.file.buffer, { maxPages: 10 });
    const cleanedText = pipelineResult.text || "";
    const quality = assessQuality(cleanedText);
    const wordCount = pipelineResult.wordCount || quality.wordCount || getMeaningfulWordCount(cleanedText);
    const extractionMethod = pipelineResult.source || "text";
    const fallbackMode = Boolean(pipelineResult.limited);

    extractionStats.totals[extractionMethod] =
      (extractionStats.totals[extractionMethod] || 0) + 1;
    extractionStats.last = {
      filename: req.file.originalname,
      method: extractionMethod,
      wordCount,
      quality: quality.quality,
      fallbackMode,
      warnings: pipelineResult.warnings || [],
      diagnostics: pipelineResult.diagnostics || null,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[UPLOAD] Extraction Complete: ${extractionMethod} / ${quality.quality} (${wordCount} words)`
    );

    // 4) Metadata & Storage
    const uploadId = Date.now().toString();
    const fileType = req.body.fileType || "sides";
    
    const characterNames = pipelineResult.characterNames || [];

    uploads[uploadId] = {
      filename: req.file.originalname,
      sceneText: cleanedText,
      characterNames,
      extractionMethod,
      extractionConfidence:
        pipelineResult.confidence || (quality.usable ? "high" : "low"),
      uploadTime: new Date(),
      wordCount: wordCount,
      fileType: fileType,
      userId: req.userId || req.user?.id || null,
      fallbackMode,
      quality,
      warnings: pipelineResult.warnings || [],
      source: extractionMethod,
    };

    // 5) SMART RESPONSE: Success flag even on low quality, with fallback flag
    return res.status(200).json({
      success: true,
      originalName: req.file.originalname,
      filename: req.file.originalname,
      uploadId,
      text: cleanedText,
      sceneText: cleanedText,
      characterNames,
      wordCount: wordCount,
      extractionMethod,
      extractionConfidence:
        pipelineResult.confidence || (quality.usable ? "high" : "low"),
      fileType,
      quality: quality.quality,
      fallbackMode,
      source: extractionMethod,
      confidence:
        pipelineResult.confidence || (quality.usable ? "high" : "low"),
      warnings: pipelineResult.warnings || [],
      uploadMessage: pipelineResult.uploadMessage || null,
      debug: {
        method: extractionMethod,
        usable: quality.usable,
        reason: quality.reason,
        ratio: quality.ratio,
        shortButReadable: Boolean(quality.shortButReadable),
        diagnostics: pipelineResult.diagnostics || null,
      }
    });

  } catch (error) {
    console.error("❌ Upload Route Fatal Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Extraction process failed: " + error.message,
      debug: error.message 
    });
  }
});

// RAG-Enhanced Guide Generation Endpoint
app.post("/api/guides/generate", auth, async (req, res) => {
  const requestStartTime = Date.now(); // Track start time for Vercel timeout management

  try {
    const {
      uploadId,
      uploadIds,
      characterName,
      actorAge,
      productionTitle,
      productionType,
      roleSize,
      genre,
      storyline,
      characterBreakdown,
      callbackNotes,
      focusArea,
      childGuideRequested,
      // Reader101 mode flag — "reader_support" activates the Reader Guide path
      mode,
    } = req.body;

    const isReaderMode = mode === "reader_support";

    // Handle both single and multiple upload IDs
    const uploadIdList = uploadIds
      ? Array.isArray(uploadIds)
        ? uploadIds
        : [uploadIds]
      : uploadId
        ? [uploadId]
        : [];
    const scenePayloads = req.body.scenePayloads || {};

    // Fallback: Restore upload from request body if available (handles Vercel statelessness)
    if ((req.body.sceneText || req.body.text) && uploadIdList.length > 0) {
      const primaryId = uploadIdList[0];
      if (!uploads[primaryId]) {
        console.log(`[GENERATE] 🔄 Restoring upload ${primaryId} from client payload`);
        uploads[primaryId] = {
          filename: req.body.filename || "restored-upload.pdf",
          sceneText: req.body.sceneText || req.body.text,
          characterNames: req.body.characterNames || [],
          wordCount: req.body.wordCount || 0,
          uploadTime: new Date(),
          fileType: "sides", // Default
          userId: req.userId,
          fallbackMode: Boolean(req.body.fallbackMode),
          warnings: req.body.warnings || [],
          source: req.body.source || "text",
        };
      }
    }

    for (const id of uploadIdList) {
      if (uploads[id]) continue;

      const fallback = scenePayloads[id];
      if (!fallback?.sceneText) continue;

      console.log(`[GENERATE] 🔄 Restoring upload ${id} from scenePayloads`);
      uploads[id] = {
        filename: fallback.filename || `upload_${id}.txt`,
        sceneText: fallback.sceneText,
        characterNames: fallback.characterNames || [],
        extractionMethod: fallback.extractionMethod || "client-cache",
        extractionConfidence: fallback.extractionConfidence || "unknown",
        uploadTime: new Date(),
        wordCount:
          fallback.wordCount ||
          (fallback.sceneText.match(/\b\w+\b/g) || []).length,
        fileType: fallback.fileType || "sides",
        userId: req.userId || req.user?.id || null,
        fallbackMode: Boolean(fallback.fallbackMode),
        warnings: fallback.warnings || [],
        source: fallback.source || fallback.extractionMethod || "text",
      };
    }

    // Debug request basics for faster triage

    console.log("📝 Generate request:", {
      uploadIdsCount: uploadIdList.length,
      uploadIds: uploadIdList,
      hasAuthHeader: !!req.headers.authorization,
      hasCharacterName: !!characterName,
      hasProductionTitle: !!productionTitle,
      hasProductionType: !!productionType,
      hasClientPayload: !!req.body.sceneText,
      availableUploads: Object.keys(uploads).length,
      availableUploadIds: Object.keys(uploads).slice(0, 5), // First 5 for debugging
    });

    // Check if upload IDs exist and provide detailed error info
    const missingIds = uploadIdList.filter((id) => !uploads[id]);
    const availableIds = Object.keys(uploads);

    if (!uploadIdList.length) {
      console.error("[GENERATE] No upload IDs provided in request");
      return res.status(400).json({
        error: "No upload ID(s) provided. Please upload your PDF first.",
        debug: { received: { uploadId, uploadIds } }
      });
    }

    if (missingIds.length > 0) {
      console.error("[GENERATE] Missing upload IDs:", {
        requested: uploadIdList,
        missing: missingIds,
        available: availableIds.slice(0, 5), // Show first 5 for debugging
        totalAvailable: availableIds.length,
        timestamp: new Date().toISOString()
      });

      // In serverless, uploads can expire between requests
      // Provide helpful error message
      return res.status(400).json({
        error: "Upload session expired. This can happen in serverless environments. Please re-upload your PDF and try generating immediately.",
        debug: {
          missingIds,
          availableCount: availableIds.length,
          tip: "Upload your PDF and generate the guide in the same session without delay"
        }
      });
    }

    if (!characterName || !productionTitle || !productionType) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const currentUser = await loadBillingUser(
      req.user || (User && req.userId ? await User.findByPk(req.userId) : null)
    );

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "Authentication required to save guide",
      });
    }

    const prep101Usage = buildPrep101Usage(currentUser);
    const reader101Usage = buildReader101Usage(currentUser);
    const isAdminUser =
      currentUser.betaAccessLevel === "admin" ||
      currentUser.subscription === "admin";
    const hasReaderAccess = isAdminUser || reader101Usage.canGenerate;
    const hasPrep101Access = isAdminUser || prep101Usage.canGenerate;

    if (isReaderMode && !hasReaderAccess) {
      return res.status(403).json({
        success: false,
        error: "Reader101 access is required before generating a reader guide.",
        reader101Usage,
      });
    }

    if (!isReaderMode && !hasPrep101Access) {
      return res.status(403).json({
        success: false,
        error:
          "You've used your monthly Prep101 guides and have no top-up credits remaining.",
        guidesUsed: prep101Usage.monthlyUsed,
        guidesLimit: prep101Usage.monthlyLimit,
        prep101Usage,
      });
    }

    // Combine all upload data
    const allUploadData = uploadIdList.map((id) => {
      if (uploads[id]) return uploads[id];
      const fallback = scenePayloads[id];
      if (fallback && fallback.sceneText) {
        return {
          filename: fallback.filename || `upload_${id}.txt`,
          sceneText: fallback.sceneText,
          characterNames: fallback.characterNames || [],
          extractionMethod: fallback.extractionMethod || "client-cache",
          extractionConfidence: fallback.extractionConfidence || "unknown",
          uploadTime: new Date(),
          wordCount:
            fallback.wordCount ||
            (fallback.sceneText.match(/\b\w+\b/g) || []).length,
          fileType: fallback.fileType || "sides",
          fallbackMode: Boolean(fallback.fallbackMode),
          warnings: fallback.warnings || [],
          source: fallback.source || fallback.extractionMethod || "text",
        };
      }
      return null;
    });

    if (allUploadData.some((data) => !data)) {
      return res
        .status(400)
        .json({ error: "Upload data not found or expired. Please re-upload." });
    }
    // Check if any upload is in fallback mode
    const isFallbackGeneration = allUploadData.some(d => d.fallbackMode === true);

    const combinedSceneText = allUploadData
      .map((data) => data.sceneText)
      .join("\n\n--- NEW SCENE ---\n\n");
    const combinedCharacterNames = [
      ...new Set(
        allUploadData
          .flatMap((data) =>
            Array.isArray(data.characterNames) ? data.characterNames : []
          )
          .map((name) => String(name || "").trim())
          .filter(Boolean)
      ),
    ];
    const combinedWordCount = allUploadData.reduce(
      (total, data) => total + (data.wordCount || 0),
      0
    );
    const cleanedMeaningfulText = scrubWatermarks(combinedSceneText || "");
    const meaningfulWordCount = getMeaningfulWordCount(cleanedMeaningfulText);

    console.log(`🎭 COREY RALSTON RAG Generation... [Fallback: ${isFallbackGeneration}]`);
    console.log(`🎬 ${characterName} | ${productionTitle} (Words: ${combinedWordCount})`);

    // Check if we have full script context (not if we're in fallback mode)
    const hasFullScript = !isFallbackGeneration && allUploadData.some(
      (data) => data.fileType === "full_script"
    );
    const hasSides = allUploadData.some((data) => data.fileType === "sides");

    console.log(
      `📚 File types detected: ${allUploadData
        .map((d) => d.fileType)
        .join(", ")}`
    );
    console.log(`🎭 Has sides: ${hasSides}, Has full script: ${hasFullScript}`);

    // Quality assessment - very lenient since we already validated at upload
    const contentQuality = assessContentQuality(
      combinedSceneText,
      combinedWordCount,
      false
    );

    const readerUnreadableCorruption =
      contentQuality.quality === "empty" ||
      contentQuality.quality === "repetitive" ||
      (contentQuality.repetitiveRatio &&
        contentQuality.repetitiveRatio > 0.8) ||
      (contentQuality.repetitionRatio &&
        contentQuality.repetitionRatio > 0.8);

    const readerFallbackTriggeredByCorruption =
      contentQuality.quality === "too_short";

    const shouldForceReaderFallback =
      isReaderMode &&
      (isFallbackGeneration ||
        readerFallbackTriggeredByCorruption ||
        readerUnreadableCorruption);

    const shouldForcePrepFallback =
      !isReaderMode &&
      (isFallbackGeneration ||
        contentQuality.quality === "empty" ||
        contentQuality.quality === "repetitive" ||
        contentQuality.quality === "too_short" ||
        combinedWordCount < 100);

    const hasReaderMetadata = Boolean(
      characterName?.trim() ||
      productionTitle?.trim() ||
      productionType?.trim() ||
      genre?.trim() ||
      storyline?.trim()
    );

    if (shouldForcePrepFallback) {
      console.warn("[GENERATION] Limited-text fallback engaged for Prep101:", {
        wordCount: combinedWordCount,
        repetitiveRatio: contentQuality.repetitiveRatio,
        repetitionRatio: contentQuality.repetitionRatio,
        reason: contentQuality.reason,
      });
    }

    if (isReaderMode && shouldForceReaderFallback) {
      console.log("[Reader101] Corruption fallback engaged:", {
        meaningfulWordCount,
        quality: contentQuality.quality,
        reason: contentQuality.reason,
        repetitiveRatio: contentQuality.repetitiveRatio,
        uploadFallback: isFallbackGeneration,
      });
    }

    // If we made it here, content is acceptable - log for monitoring
    if (contentQuality.quality === "low") {
      console.log("[GENERATION] Low quality content but proceeding:", {
        wordCount: combinedWordCount,
        reason: contentQuality.reason,
      });
    }

    // ─── Reader101: Reader Support Guide mode ────────────────────────────────
    if (isReaderMode) {
      console.log("📖 [Reader101] Reader Support mode activated — generating reader guide");
      const { generateReaderGuide } = require("./services/readerGuideService");

      const readerGuideHtml = await generateReaderGuide({
        sceneText: combinedSceneText,
        characterName: characterName.trim(),
        characterNames: combinedCharacterNames,
        actorAge: actorAge || "",
        productionTitle: productionTitle.trim(),
        productionType: productionType.trim(),
        genre: genre || "",
        storyline: storyline || "",
        fallbackMode: shouldForceReaderFallback,
      });

      console.log("✅ [Reader101] Reader guide complete!");

      // Save reader guide to database (same table, tagged with mode)
      try {
        const GuideModel = Guide || require("./models/Guide");
        const readerGuideId = `reader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const readerPayload = {
          guideId: readerGuideId,
          userId: currentUser.id,
          characterName: characterName.trim(),
          productionTitle: productionTitle.trim(),
          productionType: productionType.trim(),
          roleSize: roleSize || "Supporting",
          genre: genre || "",
          storyline: storyline || "",
          characterBreakdown: "",
          callbackNotes: "",
          focusArea: "reader_support",
          sceneText: combinedSceneText,
          generatedHtml: readerGuideHtml,
          childGuideRequested: false,
          childGuideCompleted: false,
        };

        let savedReaderGuide = null;
        if (GuideModel) {
          savedReaderGuide = await GuideModel.create(readerPayload);
        } else {
          const { randomUUID } = require("crypto");
          readerPayload.id = randomUUID();
          await ensureSupabaseUser(currentUser);
          savedReaderGuide = await supabaseInsertGuide(readerPayload, { user: currentUser });
        }

        let updatedBillingUser = currentUser;
        const consumption = getReader101ConsumptionUpdate(currentUser);
        if (!consumption.allowed) {
          throw new Error("Reader101 credits were exhausted before the guide could be saved.");
        }
        if (Object.keys(consumption.updates).length > 0) {
          updatedBillingUser = await persistBillingUserUpdates(
            currentUser,
            consumption.updates
          );
        }

        return res.json({
          success: true,
          guideId: savedReaderGuide?.guideId || readerGuideId,
          guideContent: readerGuideHtml,
          mode: "reader_support",
          childGuideRequested: false,
          childGuideQueued: false,
          childGuideCompleted: false,
          reader101Usage: buildReader101Usage(updatedBillingUser),
          reader101CreditSource: consumption.source,
          metadata: {
            characterName: characterName.trim(),
            productionTitle: productionTitle.trim(),
            productionType: productionType.trim(),
            guideLength: readerGuideHtml.length,
            generationTime: Date.now() - requestStartTime,
          },
        });
      } catch (saveErr) {
        console.error("[Reader101] Failed to save reader guide:", saveErr);
        // Still return the guide even if save fails
        return res.json({
          success: true,
          guideId: `reader_${Date.now()}`,
          guideContent: readerGuideHtml,
          mode: "reader_support",
          childGuideRequested: false,
          childGuideQueued: false,
          childGuideCompleted: false,
          saveError: "Guide generated but could not be saved",
        });
      }
    }
    // ── End Reader101 mode ────────────────────────────────────────────────────

    const guideContentRaw = await generateActingGuideWithRAG({
      sceneText: combinedSceneText,
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
      genre: (genre || "").trim(),
      storyline: (storyline || "").trim(),
      extractionMethod: allUploadData[0].extractionMethod,
      hasFullScript: hasFullScript,
      fallbackMode: shouldForcePrepFallback,
      uploadData: allUploadData,
    });

    const guideContent = wrapGuideHtml(guideContentRaw, {
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
    });

    console.log(`✅ Corey Ralston RAG Guide Complete!`);

    // Save guide to database
    try {
      const GuideModel = Guide || require("./models/Guide");
      const generatedGuideId = `corey_rag_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const baseGuidePayload = {
        guideId: generatedGuideId,
        userId: currentUser.id,
        characterName: characterName.trim(),
        productionTitle: productionTitle.trim(),
        productionType: productionType.trim(),
        roleSize: roleSize || "Supporting",
        genre: genre || "Drama",
        storyline: storyline || "",
        characterBreakdown: characterBreakdown || "",
        callbackNotes: callbackNotes || "",
        focusArea: focusArea || "",
        sceneText: combinedSceneText,
        generatedHtml: guideContent,
        childGuideRequested: childGuideRequested || false,
        childGuideCompleted: false,
        guideType: isReaderMode ? 'reader101' : 'prep101',
      };

      let persistedGuide = null;
      let persistenceMethod = "sequelize";

      if (GuideModel) {
        persistedGuide = await GuideModel.create(baseGuidePayload);
      } else {
        persistenceMethod = "supabase";

        // Generate UUID for Supabase (it doesn't auto-generate like Sequelize)
        const { randomUUID } = require("crypto");
        baseGuidePayload.id = randomUUID();

        // Ensure user exists in Supabase Users table (for foreign key constraint)
        const userEnsured = await ensureSupabaseUser(currentUser);
        if (!userEnsured) {
          console.error(
            "❌ Failed to ensure user exists in Supabase Users table"
          );
          throw new Error(
            "Supabase Users table is not configured for guide saving"
          );
        }

        persistedGuide = await supabaseInsertGuide(baseGuidePayload, {
          user: currentUser,
        });
        if (!persistedGuide) {
          throw new Error(
            "Guide model unavailable and Supabase fallback failed"
          );
        }
      }

      console.log(
        `💾 Guide saved via ${persistenceMethod} with ID: ${persistedGuide.id}`
      );

      let updatedBillingUser = currentUser;
      const consumption = getPrep101ConsumptionUpdate(currentUser);
      if (!consumption.allowed) {
        throw new Error("Prep101 credits were exhausted before the guide could be saved.");
      }
      if (Object.keys(consumption.updates).length > 0) {
        updatedBillingUser = await persistBillingUserUpdates(
          currentUser,
          consumption.updates
        );
      }

      let childGuideQueued = false;
      let childGuideCompleted = false;
      if (childGuideRequested) {
        childGuideQueued = true;
        // In Vercel serverless, generate child guide SYNCHRONOUSLY before sending response
        // Fire-and-forget doesn't work because the function terminates after res.json()
        if (process.env.VERCEL) {
          console.log(
            `🌟 Generating child guide synchronously for ${persistedGuide.id} (Vercel mode)`
          );
          try {
            const childResult = await generateChildGuideAsync({
              guideId: persistedGuide.id,
              childData: {
                sceneText: combinedSceneText,
                characterName: characterName.trim(),
                productionTitle: productionTitle.trim(),
                productionType: productionType.trim(),
                parentGuideContent: guideContentRaw,
                extractionMethod: allUploadData[0].extractionMethod,
              },
              userId: currentUser?.id,
            });
            if (childResult.success) {
              childGuideCompleted = true;
              console.log(`✅ Child guide completed for ${persistedGuide.id}`);
            } else {
              console.error(`❌ Child guide failed: ${childResult.error}`);
            }
          } catch (childErr) {
            console.error(`❌ Child guide error:`, childErr);
          }
        } else {
          // Non-Vercel: queue for background processing
          queueChildGuideGeneration({
            guideId: persistedGuide.id,
            childData: {
              sceneText: combinedSceneText,
              characterName: characterName.trim(),
              productionTitle: productionTitle.trim(),
              productionType: productionType.trim(),
              parentGuideContent: guideContentRaw,
              extractionMethod: allUploadData[0].extractionMethod,
            },
            userId: currentUser?.id,
          });
        }
      }

      // Log the response being sent
      const responseData = {
        success: true,
        guideId: persistedGuide.guideId,
        guideContent,
        childGuideRequested: !!childGuideRequested,
        childGuideQueued,
        childGuideCompleted: childGuideCompleted,
        childGuideMessage: childGuideCompleted
          ? "Child guide generated successfully!"
          : childGuideQueued
            ? "Child guide is being generated in the background."
            : childGuideRequested
              ? "Child guide requested but queue unavailable."
              : null,
        generatedAt: new Date(),
        savedToDatabase: true,
        prep101Usage: buildPrep101Usage(updatedBillingUser),
        prep101CreditSource: consumption.source,
        metadata: {
          characterName,
          productionTitle,
          productionType,
          scriptWordCount: combinedWordCount,
          guideLength: guideContent.length,
          childGuideStatus: childGuideCompleted
            ? "completed"
            : childGuideQueued
              ? "queued"
              : childGuideRequested
                ? "pending"
                : "not_requested",
          model: DEFAULT_CLAUDE_MODEL,
          ragEnabled: true,
          methodologyFiles: Object.keys(methodologyDatabase).length,
          contentQuality: "corey-ralston-methodology-enhanced",
          fileCount: uploadIdList.length,
          uploadedFiles: uploadIdList.map((id) => uploads[id].filename),
        },
      };

      console.log(`🌟 Sending response to frontend:`, {
        childGuideRequested: responseData.childGuideRequested,
        childGuideQueued: responseData.childGuideQueued,
        childGuideCompleted: responseData.childGuideCompleted,
      });

      res.json(responseData);
    } catch (dbError) {
      console.error("❌ Database save error:", dbError);

      // Check if it's an authentication error
      if (
        dbError.message.includes("Authentication required") ||
        dbError.message.includes("User not found")
      ) {
        return res.status(401).json({
          success: false,
          error: "Authentication required to save guide",
          message: "Please log in to save your guide to your account",
          guideContent: guideContent, // Still provide the guide content
          generatedAt: new Date(),
          savedToDatabase: false,
        });
      }

      // Still return the guide content even if save fails for other reasons
      res.json({
        success: true,
        guideId: `corey_rag_${uploadIdList[0] || uploadId}`,
        guideContent: guideContent,
        generatedAt: new Date(),
        savedToDatabase: false,
        saveError: dbError.message,
        metadata: {
          characterName,
          productionTitle,
          productionType,
          scriptWordCount: combinedWordCount,
          guideLength: guideContent.length,
          model: DEFAULT_CLAUDE_MODEL,
          ragEnabled: true,
          methodologyFiles: Object.keys(methodologyDatabase).length,
          contentQuality: "corey-ralston-methodology-enhanced",
          fileCount: uploadIdList.length,
          uploadedFiles: uploadIdList.map((id) => uploads[id].filename),
        },
      });
    }
  } catch (error) {
    console.error("❌ Corey Ralston RAG error:", error);
    // Always surface the server-side reason for easier client debug (no secrets)
    res.status(500).json({
      error:
        "Failed to generate Corey Ralston methodology guide. Please try again.",
      reason: error && error.message ? String(error.message) : undefined,
    });
  }
});

// Methodology API endpoint to view loaded files
app.get("/api/methodology", (req, res) => {
  const summary = Object.values(methodologyDatabase).map((file) => ({
    filename: file.filename,
    type: file.type,
    size: file.size,
    keywords: file.keywords,
  }));

  res.json({
    totalFiles: Object.keys(methodologyDatabase).length,
    files: summary,
    ragEnabled: true,
    message: "Corey Ralston methodology files loaded and ready for RAG",
  });
});

// Note: Guide endpoints are now handled by the mounted routes in ./routes/guides.js

// Generate child guide on-demand (for serverless environments where background tasks don't complete)
app.post("/api/guides/:id/generate-child", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser =
      req.user || (User && req.userId ? await User.findByPk(req.userId) : null);

    if (!currentUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let guideRecord = null;
    let GuideModel = null;

    try {
      GuideModel = Guide || require("./models/Guide");
    } catch (_) {
      GuideModel = null;
    }

    if (GuideModel) {
      guideRecord = await GuideModel.findOne({
        where: { id, userId: currentUser.id },
      });
    } else if (isSupabaseAdminConfigured()) {
      guideRecord = await supabaseFetchGuide({ id, userId: currentUser.id });
    } else {
      return res.status(503).json({ error: "Guide storage unavailable" });
    }

    if (!guideRecord) {
      return res.status(404).json({ error: "Guide not found" });
    }

    // Check if child guide was requested but not completed
    if (!guideRecord.childGuideRequested) {
      return res
        .status(400)
        .json({ error: "Child guide was not requested for this guide" });
    }

    if (guideRecord.childGuideCompleted && guideRecord.childGuideHtml) {
      return res.json({
        success: true,
        message: "Child guide already exists",
        alreadyCompleted: true,
      });
    }

    console.log(`🌟 On-demand child guide generation for guide ${id}`);

    const result = await generateChildGuideAsync({
      guideId: id,
      childData: {
        sceneText: guideRecord.sceneText,
        characterName: guideRecord.characterName,
        productionTitle: guideRecord.productionTitle,
        productionType: guideRecord.productionType,
        parentGuideContent: guideRecord.generatedHtml,
        extractionMethod: "stored",
      },
      userId: currentUser.id,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Child guide generated successfully",
        childGuideCompleted: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to generate child guide",
      });
    }
  } catch (error) {
    console.error("❌ Child guide generation error:", error);
    res.status(500).json({ error: "Failed to generate child guide" });
  }
});

// Promo Code Redemption (Supabase-based)
app.post("/api/promo-codes/redeem", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Promo code is required" });
    }

    console.log(
      `🎟️  Promo code redemption attempt - Code: ${code}, User: ${userId}`
    );

    if (!isSupabaseAdminConfigured()) {
      return res
        .status(503)
        .json({ success: false, message: "Promo code service unavailable" });
    }

    // Find the promo code in Supabase
    const { data: promoCode, error: promoError } = await runAdminQuery(
      (client) =>
        client
          .from("PromoCodes")
          .select("*")
          .eq("code", code.toUpperCase())
          .eq("isActive", true)
          .maybeSingle()
    );

    if (promoError || !promoCode) {
      console.log(`❌ Promo code not found: ${code}`);
      return res
        .status(404)
        .json({ success: false, message: "Invalid promo code" });
    }

    // Check if expired
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Promo code has expired" });
    }

    // Check max redemptions
    if (
      promoCode.maxRedemptions &&
      promoCode.currentRedemptions >= promoCode.maxRedemptions
    ) {
      return res.status(400).json({
        success: false,
        message: "Promo code has reached maximum redemptions",
      });
    }

    // Check if user already redeemed this code
    const { data: existingRedemption } = await runAdminQuery((client) =>
      client
        .from("PromoCodeRedemptions")
        .select("id")
        .eq("promoCodeId", promoCode.id)
        .eq("userId", userId)
        .maybeSingle()
    );

    if (existingRedemption) {
      return res.status(400).json({
        success: false,
        message: "You have already redeemed this code",
      });
    }

    // Create redemption record
    const { error: redemptionError } = await runAdminQuery((client) =>
      client.from("PromoCodeRedemptions").insert({
        id: require("crypto").randomUUID(),
        promoCodeId: promoCode.id,
        userId: userId,
        guidesGranted: promoCode.guidesGranted || 1,
        discountPercent: promoCode.discountPercent || 0,
        redeemedAt: new Date().toISOString(),
      })
    );

    if (redemptionError) {
      console.error("❌ Failed to create redemption record:", redemptionError);
      // Continue anyway - the important part is granting the guides
    }

    // Increment promo code redemption count
    await runAdminQuery((client) =>
      client
        .from("PromoCodes")
        .update({ currentRedemptions: (promoCode.currentRedemptions || 0) + 1 })
        .eq("id", promoCode.id)
    );

    // Grant guides to user - update their guidesLimit
    const { data: currentUser } = await runAdminQuery((client) =>
      client.from("Users").select("guidesLimit").eq("id", userId).maybeSingle()
    );

    const newLimit =
      (currentUser?.guidesLimit || 0) + (promoCode.guidesGranted || 1);

    await runAdminQuery((client) =>
      client.from("Users").update({ guidesLimit: newLimit }).eq("id", userId)
    );

    console.log(
      `🎉 Promo code redeemed - Code: ${code}, User: ${userId}, Guides granted: ${promoCode.guidesGranted || 1
      }`
    );

    res.json({
      success: true,
      message: `Promo code redeemed! You received ${promoCode.guidesGranted || 1
        } free guide${(promoCode.guidesGranted || 1) > 1 ? "s" : ""}!`,
      redemption: {
        guidesGranted: promoCode.guidesGranted || 1,
        redeemedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Promo code redemption error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to redeem promo code" });
  }
});

// Download guide as PDF
app.get("/api/guides/:id/pdf", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser =
      req.user || (User && req.userId ? await User.findByPk(req.userId) : null);

    if (!currentUser) {
      console.log("❌ PDF endpoint - Authenticated user not found");
      return res.status(401).json({ error: "Authentication required" });
    }

    let guideRecord = null;
    let GuideModel = null;

    try {
      GuideModel = Guide || require("./models/Guide");
    } catch (_) {
      GuideModel = null;
    }

    if (GuideModel) {
      guideRecord = await GuideModel.findOne({
        where: { id, userId: currentUser.id },
        attributes: [
          "id",
          "guideId",
          "characterName",
          "productionTitle",
          "productionType",
          "roleSize",
          "genre",
          "storyline",
          "characterBreakdown",
          "callbackNotes",
          "focusArea",
          "sceneText",
          "generatedHtml",
          "createdAt",
          "viewCount",
        ],
      });
    } else if (isSupabaseAdminConfigured()) {
      guideRecord = await supabaseFetchGuide({ id, userId: currentUser.id });
    } else {
      return res
        .status(503)
        .json({ error: "Guide storage unavailable - please try again later" });
    }

    if (!guideRecord) {
      return res.status(404).json({ error: "Guide not found" });
    }

    const guide = guideRecord.dataValues ? guideRecord.dataValues : guideRecord;

    console.log(
      `📄 Generating PDF for guide: ${guide.characterName} - ${guide.productionTitle}`
    );

    // Use Adobe PDF Services to convert HTML to PDF
    const {
      ServicePrincipalCredentials,
      PDFServices,
      MimeType,
      HTMLToPDFJob,
      HTMLToPDFResult,
      PageLayout,
      HTMLToPDFParams,
    } = require("@adobe/pdfservices-node-sdk");

    // Load Adobe credentials from JSON file
    const credentialsPath = "./pdfservices-api-credentials.json";
    const credentialsData = JSON.parse(
      fs.readFileSync(credentialsPath, "utf8")
    );

    // Create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: credentialsData.client_credentials.client_id,
      clientSecret: credentialsData.client_credentials.client_secret,
    });

    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Create HTML content with proper styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          h2 { color: #34495e; margin-top: 30px; }
          h3 { color: #7f8c8d; }
          .guide-section { margin-bottom: 25px; }
          .character-info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .script-content { background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
          .footer { margin-top: 40px; text-align: center; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>🎭 Audition Guide: ${guide.characterName}</h1>

        <div class="character-info">
          <h2>Production Details</h2>
          <p><strong>Production:</strong> ${guide.productionTitle}</p>
          <p><strong>Type:</strong> ${guide.productionType}</p>
          <p><strong>Role Size:</strong> ${guide.roleSize}</p>
          <p><strong>Genre:</strong> ${guide.genre}</p>
          <p><strong>Created:</strong> ${new Date(
      guide.createdAt
    ).toLocaleDateString()}</p>
        </div>

        <div class="guide-section">
          <h2>Character Analysis</h2>
          ${guide.storyline
        ? `<p><strong>Storyline:</strong> ${guide.storyline}</p>`
        : ""
      }
          ${guide.characterBreakdown
        ? `<p><strong>Character Breakdown:</strong> ${guide.characterBreakdown}</p>`
        : ""
      }
          ${guide.focusArea
        ? `<p><strong>Focus Area:</strong> ${guide.focusArea}</p>`
        : ""
      }
        </div>

        <div class="guide-section">
          <h2>Generated Guide</h2>
          ${guide.generatedHtml}
        </div>

        <div class="footer">
          <p>Generated by Prep101 - Professional Acting Guide Generator</p>
          <p>Corey Ralston Methodology</p>
        </div>
      </body>
      </html>
    `;

    // Create a temporary HTML file
    const tempHtmlPath = `./temp_guide_${id}.html`;
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // Create input asset from HTML file
    const readStream = fs.createReadStream(tempHtmlPath);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.HTML,
    });

    // Create parameters for the job
    const pageLayout = new PageLayout({
      pageHeight: 11,
      pageWidth: 8.5,
    });

    const params = new HTMLToPDFParams({
      pageLayout,
      includeHeaderFooter: false,
    });

    // Create and submit the job
    const job = new HTMLToPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });

    // Wait for job completion and get result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: HTMLToPDFResult,
    });

    // Get content from the resulting asset
    const resultAsset = pdfServicesResponse.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="guide_${guide.characterName}_${guide.productionTitle}.pdf"`
    );

    // Get content length safely
    const contentLength = streamAsset.asset?.size || "unknown";
    if (contentLength !== "unknown") {
      res.setHeader("Content-Length", contentLength);
    }

    // Stream the PDF to the response
    streamAsset.readStream.pipe(res);

    // Clean up temporary files
    setTimeout(() => {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (err) {
        console.log("Could not delete temp HTML file:", err.message);
      }
    }, 5000);
  } catch (error) {
    console.error("❌ PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Note: Email endpoint is now handled by the mounted routes in ./routes/guides.js

// Test email configuration

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "running",
    model: DEFAULT_CLAUDE_MODEL,
    maxTokens: DEFAULT_CLAUDE_MAX_TOKENS,
    ragEnabled: true,
    methodologyFiles: Object.keys(methodologyDatabase).length,
    coreyRalstonMethodology: true,
    apiKey: ANTHROPIC_API_KEY ? "configured" : "missing",
    anthropicKeyLen: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.length : 0,
    uploadsCount: Object.keys(uploads).length,
    adobeExtract:
      process.env.ADOBE_PDF_EXTRACT_ENABLED === "true" ? "enabled" : "disabled",
    adobeImportError,
    minExtractWords: 50,
    extraction: {
      adobeEnabled: process.env.ADOBE_PDF_EXTRACT_ENABLED === "true",
      adobeForceEnabled: process.env.ADOBE_FORCE_ENABLE === "true",
      minExtractWords: 50,
      lineSpecificWordThreshold: 100,
    },
    extractionTotals: extractionStats.totals,
    extractionLast: extractionStats.last,
    features: [
      "True RAG with Corey Ralston methodology",
      "Intelligent methodology search",
      "Example guide pattern matching",
      "Professional coaching voice replication",
      "Claude Sonnet 4 + 16K tokens",
      "PREP101 authentic methodology",
      "Actor Motivator writing style",
      "User authentication & authorization",
      "Stripe payment integration",
      "Subscription management",
      "Guide usage tracking",
    ],
    message:
      "PREP101 Corey Ralston RAG-Enhanced Guide Generator with Actor Motivator Style + Full Auth & Payment System",
  });
});

// Fast health check for Railway (no database queries)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    server: "PREP101 Enhanced Backend",
  });
});

// ── Reader101 no-auth test endpoint ───────────────────────────────────────────
app.post("/api/reader-test", async (req, res) => {
  const { sceneText, characterName, actorAge, productionTitle, productionType, genre, storyline } = req.body;
  if (!sceneText) {
    return res.status(400).json({ error: "sceneText is required" });
  }
  try {
    const { generateReaderGuide } = require("./services/readerGuideService");
    const html = await generateReaderGuide({
      sceneText,
      characterName: characterName || "Actor",
      actorAge: actorAge || "",
      productionTitle: productionTitle || "",
      productionType: productionType || "",
      genre: genre || "",
      storyline: storyline || "",
    });
    res.json({ success: true, guideContent: html });
  } catch (err) {
    console.error("[reader-test]", err);
    res.status(500).json({ error: err.message });
  }
});

// Even faster health check for Railway deployment
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Enhanced health check with new features (for detailed monitoring)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    features: {
      rag: true,
      authentication: true,
      payments: true,
      guides: true,
      uploads: true,
    },
    server: "PREP101 Enhanced Backend",
  });
});

// Initialize server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    // Load methodology files
    loadMethodologyFiles();

    // Start server
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, "0.0.0.0", () => {
      console.log("🎭 PREP101 COREY RALSTON RAG-ENHANCED GENERATOR");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🤖 Model: Claude Sonnet 4 ✅`);
      console.log(`⚡ Max Tokens: 16,000 ✅`);
      console.log(`🧠 RAG: Corey Ralston Methodology ✅`);
      console.log(
        `📚 Files Loaded: ${Object.keys(methodologyDatabase).length} ✅`
      );
      console.log(`🎯 Actor Motivator Style: ENABLED ✅`);
      console.log("");
      console.log("🎯 Corey Ralston RAG Features:");
      console.log("   • True file-based RAG system");
      console.log("   • Intelligent methodology search");
      console.log("   • Example guide pattern matching");
      console.log("   • Professional coaching voice replication");
      console.log("   • PREP101 authentic methodology");
      console.log("   • Actor Motivator writing style");
      console.log("");
      console.log("🔐 NEW: Authentication & Payment System");
      console.log("   • User registration & login");
      console.log("   • Stripe subscription management");
      console.log("   • Guide usage tracking");
      console.log("   • Subscription-based access control");
      console.log("");
      console.log(
        "✅ Ready to generate authentic Corey Ralston guides with full auth & payments!"
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Initialize for serverless (Vercel)
const initializeForServerless = async () => {
  try {
    // Load methodology files immediately for serverless
    loadMethodologyFiles();
    console.log("🧠 Methodology files loaded for serverless");
  } catch (error) {
    console.error("❌ Failed to initialize for serverless:", error);
  }
};

// Initialize immediately for serverless functions
initializeForServerless();

// For Vercel serverless functions, export the app instead of starting a server
module.exports = app;

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  // Start the server
  startServer();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("🛑 SIGTERM received, shutting down gracefully");
    await sequelize.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("🛑 SIGINT received, shutting down gracefully");
    await sequelize.close();
    process.exit(0);
  });
}
