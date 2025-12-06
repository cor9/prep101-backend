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
} = require("./lib/supabaseAdmin");

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

// Trust proxy - Required for Vercel and rate limiting to work correctly
app.set("trust proxy", true);

// Basic middleware setup first
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS - Allow specific origins including prep101.site
app.use(
  cors({
    origin: [
      "https://prep101.site",
      "https://prep101-api.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Continue with other imports
const pdfParse = require("pdf-parse");
// Try to load Adobe extractor, but don't fail if it's not available
let extractWithAdobe;
try {
  extractWithAdobe =
    require("./services/extractors/adobeExtract").extractWithAdobe;
} catch (error) {
  console.log("⚠️  Adobe extractor not available, using basic extraction only");
  extractWithAdobe = null;
}
const {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
} = require("./config/models");

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
  totals: { adobe: 0, basic: 0, ocr: 0 },
  last: null,
};

// Enhanced text cleaning function for basic extraction
function cleanBasicText(text) {
  if (!text) return "";

  return (
    text
      .replace(/\r/g, "")
      .replace(/Sides by Breakdown Services - Actors Access/gi, "")
      .replace(/Page \d+ of \d+/gi, "")
      // Enhanced cleaning patterns
      .replace(/\b\d{5,}\b/g, "") // Remove numeric watermarks
      .replace(/^\d{1,2}:\d{2}:\d{2}\s*$/gm, "") // Remove timestamp lines
      .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/gm, "") // Remove date-time lines
      .replace(/^[0-9\s\-_:]+$/gm, "") // Remove lines with only numbers/symbols
      .replace(/^[A-Za-z]{1,2}\s*$/gm, "") // Remove single/double letter lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Content quality assessment function
// NOTE: Very lenient on upload, stricter on generation
function assessContentQuality(text, wordCount, isUpload = false) {
  // UPLOAD CHECK: Only reject completely empty/corrupted files
  if (isUpload) {
    if (!text || wordCount < 10) {
      return { quality: "poor", reason: "insufficient_content" };
    }
    // For uploads, accept everything else and let generation handle quality
    return { quality: "good", reason: "sufficient_content" };
  }

  // GENERATION CHECK: Stricter validation before spending API tokens
  if (!text || wordCount < 25) {
    return { quality: "poor", reason: "insufficient_content" };
  }

  // Check for repetitive content patterns
  const repetitivePatterns = [
    /\b\d{5,}\b/g, // Numeric watermarks
    /^\d{1,2}:\d{2}:\d{2}\s*$/gm, // Timestamps
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/gm, // Date-time stamps
    /- Aug \d{1,2}, \d{4} \d{1,2}:\d{2} (AM|PM) -/g, // Specific timestamp pattern from logs
    /^\d{1,2}:\d{2} (AM|PM) -/gm, // Time AM/PM pattern
  ];

  // Check for repetitive content
  const repetitiveMatches = repetitivePatterns.reduce((count, pattern) => {
    return count + (text.match(pattern) || []).length;
  }, 0);

  const repetitiveRatio = repetitiveMatches / Math.max(wordCount, 1);

  // Check for high repetition of the same phrases
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  words.forEach((word) => {
    if (word.length > 3) {
      // Only count words longer than 3 chars
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const maxFreq = Math.max(...Object.values(wordFreq));
  const repetitionRatio = maxFreq / Math.max(wordCount, 1);

  // Lenient criteria - only reject truly corrupted content
  if (repetitiveRatio > 0.5) {
    // More than 50% repetitive patterns
    return { quality: "poor", reason: "repetitive_content", repetitiveRatio };
  }

  if (repetitionRatio > 0.5) {
    // More than 50% of content is the same word
    return { quality: "poor", reason: "high_repetition", repetitionRatio };
  }

  if (wordCount < 100) {
    return { quality: "low", reason: "minimal_content" };
  }

  return { quality: "good", reason: "sufficient_content" };
}

// Basic extraction helper used as fallback
async function extractWithBasic(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  let text = cleanBasicText(data.text || "");

  const wordCount = (text.match(/\b\w+\b/g) || []).length;
  const confidence =
    wordCount > 600 ? "high" : wordCount > 300 ? "medium" : "low";

  // Character names in ALL-CAPS ending with colon
  const characterPattern = /^[A-Z][A-Z\s]+:/gm;
  const characterNames = [
    ...new Set(
      (text.match(characterPattern) || []).map((n) => n.replace(":", "").trim())
    ),
  ];

  return { text, method: "basic", wordCount, confidence, characterNames };
}

// OCR extraction using Claude's vision model as fallback
async function extractWithOCR(pdfBuffer) {
  try {
    console.log("[OCR] Starting OCR extraction with Claude Vision...");

    // Convert PDF to images first
    const pdf2pic = require("pdf2pic");
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    // Create temporary directory for images
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
    const tempPdfPath = path.join(tempDir, "input.pdf");
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    // Convert PDF to images
    const options = {
      density: 300,
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 2048,
      height: 2048,
    };

    const convert = pdf2pic.fromPath(tempPdfPath, options);

    // Try to get page count by attempting to convert pages until it fails
    let pageCount = 0;
    let maxPages = 10; // Reasonable limit for sides

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const testPage = await convert(pageNum);
        if (testPage && testPage.path) {
          pageCount = pageNum;
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }

    console.log(`[OCR] PDF has ${pageCount} pages`);

    if (pageCount === 0) {
      throw new Error("Failed to detect any pages in PDF");
    }

    let allText = "";

    // Process each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      console.log(`[OCR] Processing page ${pageNum}/${pageCount}...`);

      const pageData = await convert(pageNum);

      if (!pageData || !pageData.path) {
        console.log(`[OCR] Failed to convert page ${pageNum}, skipping...`);
        continue;
      }

      // Read the image file
      const imageBuffer = fs.readFileSync(pageData.path);
      const base64Image = imageBuffer.toString("base64");

      // Prepare the message for Claude Vision
      const message = {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please extract all the text from this script/sides image (page ${pageNum} of ${pageCount.length}). Focus on:
1. Character names (in ALL CAPS followed by colon)
2. Dialogue and scene descriptions
3. Stage directions and parentheticals
4. Scene headings and transitions

Ignore watermarks, timestamps, page numbers, and other metadata. Return only the clean script content.`,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: base64Image,
            },
          },
        ],
      };

      // Call Claude Vision API for this page
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: DEFAULT_CLAUDE_MAX_TOKENS,
          messages: [message],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[OCR] Failed to process page ${pageNum}: ${errorText}`);
        continue;
      }

      const result = await response.json();
      const pageText = result.content[0].text || "";

      // Add page text to total (with separator)
      if (pageText.trim()) {
        allText += (allText ? "\n\n" : "") + pageText.trim();
      }
    }

    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Clean the extracted text from all pages
    let text = cleanBasicText(allText);

    const wordCount = (text.match(/\b\w+\b/g) || []).length;
    const confidence =
      wordCount > 600 ? "high" : wordCount > 300 ? "medium" : "low";

    // Character names in ALL-CAPS ending with colon
    const characterPattern = /^[A-Z][A-Z\s]+:/gm;
    const characterNames = [
      ...new Set(
        (text.match(characterPattern) || []).map((n) =>
          n.replace(":", "").trim()
        )
      ),
    ];

    console.log(
      `[OCR] Extraction completed: ${wordCount} words, ${characterNames.length} characters found`
    );

    return { text, method: "ocr", wordCount, confidence, characterNames };
  } catch (error) {
    console.error("[OCR] Extraction failed:", error.message);
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
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
} catch (_) {}

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
  console.log("✅ User model loaded");
} catch (error) {
  console.log("⚠️  User model not available:", error.message);
  User = null;
}

try {
  Guide = require("./models/Guide");
  console.log("✅ Guide model loaded");
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
        guidesUsed: 0,
        guidesLimit: 25, // Default for beta users
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
      `🧠 RAG Database Ready: ${
        Object.keys(methodologyDatabase).length
      } methodology files loaded`
    );
  } catch (error) {
    console.error("❌ Failed to load methodology files:", error);
  }
}

function determineFileType(filename) {
  const name = filename.toLowerCase();
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

  // Add filename-based keywords
  if (name.includes("character"))
    keywords.push("character", "development", "psychology");
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

// Intelligent RAG search through methodology files
function searchMethodology(characterName, productionType, sceneContext) {
  console.log(
    `🔍 RAG Search: ${characterName} | ${productionType} | Context: ${sceneContext.substring(
      0,
      100
    )}...`
  );

  const searchTerms = [
    characterName.toLowerCase(),
    productionType.toLowerCase(),
    "character development",
    "scene analysis",
    "uta hagen",
    "acting guide",
  ];

  // Add production-type specific terms
  if (productionType.toLowerCase().includes("comedy")) {
    searchTerms.push("comedy", "timing", "humor");
  }
  if (productionType.toLowerCase().includes("drama")) {
    searchTerms.push("drama", "emotion", "truth");
  }

  const relevantFiles = [];

  // Score each methodology file based on relevance
  Object.values(methodologyDatabase).forEach((file) => {
    let relevanceScore = 0;
    const fileContent = file.content.toLowerCase();
    const fileKeywords = file.keywords;

    // Score based on keywords
    searchTerms.forEach((term) => {
      if (fileKeywords.includes(term)) relevanceScore += 3;
      if (fileContent.includes(term)) relevanceScore += 1;
    });

    // Boost example guides
    if (file.type === "example-guide") relevanceScore += 5;

    // Boost Uta Hagen methodology
    if (file.type === "uta-hagen") relevanceScore += 4;

    // Boost character development for all requests
    if (file.type === "character-development") relevanceScore += 3;

    if (relevanceScore > 0) {
      relevantFiles.push({
        ...file,
        relevanceScore: relevanceScore,
      });
    }
  });

  // Sort by relevance and return top results
  const topResults = relevantFiles
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6); // Top 6 most relevant files

  console.log(
    `🎯 RAG Results: Found ${topResults.length} relevant methodology files`
  );
  topResults.forEach((file) => {
    console.log(
      `   📄 ${file.filename} (score: ${file.relevanceScore}, type: ${file.type})`
    );
  });

  return topResults;
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

    // Remove only known watermarks/footers
    cleanText = cleanText
      .replace(/Sides by Breakdown Services - Actors Access/gi, "")
      .replace(/Page \d+\s+of\s+\d+/gi, "")
      .replace(/B568CR-|74222 - .*? -/g, "")
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

  // Remove only known watermarks/footers; DO NOT blanket-replace digits or spaces
  text = text
    .replace(/Sides by Breakdown Services - Actors Access/gi, "")
    .replace(/Page \d+\s+of\s+\d+/gi, "")
    .replace(/B568CR-|74222 - .*? -/g, "")
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
  const fetch = require("node-fetch");

  try {
    console.log("🧠 Step 1: RAG - Searching your methodology files...");

    // Search your methodology files for relevant content
    const relevantMethodology = searchMethodology(
      data.characterName,
      data.productionType,
      data.sceneText
    );

    // Build context from your methodology files (limit to ~50k chars to prevent timeouts)
    let methodologyContext = "";
    const MAX_METHODOLOGY_CHARS = 50000;
    let currentChars = 0;

    if (relevantMethodology.length > 0) {
      const contextParts = [];
      for (const file of relevantMethodology) {
        const fileContext = `=== COREY RALSTON METHODOLOGY: ${file.filename} (Relevance: ${file.relevanceScore}) ===\n${file.content}\n\n`;
        if (currentChars + fileContext.length <= MAX_METHODOLOGY_CHARS) {
          contextParts.push(fileContext);
          currentChars += fileContext.length;
        } else {
          console.log(
            `⚠️ Skipping ${file.filename} to keep context under ${MAX_METHODOLOGY_CHARS} chars`
          );
        }
      }
      methodologyContext = contextParts.join("");
    }

    console.log(
      `🎭 Step 2: Generating guide using ${relevantMethodology.length} methodology files...`
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
- NO EVIDENCE TAGS or inline citations—trust the reader knows you're referencing the script. Just COACH.
- Tone: warm, direct, industry-savvy; balance encouragement with honest craft notes. Avoid generic motivational fluff.
`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          signal: controller.signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: DEFAULT_CLAUDE_MODEL,
            max_tokens: DEFAULT_CLAUDE_MAX_TOKENS,
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

SCRIPT:
${data.sceneText}${fileTypeContext}

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

9. **REHEARSAL STRATEGY** - "Your 10+ Takes" approach (Natural/Bold/Vulnerable/Comedic/Smaller/Bigger etc.). One "Alternative Callback Take" ready to go. Memorization tips. Working-with-reader advice.

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
- Pull archetype comparisons from character_archetype_comparables.md when they illuminate the role.
- Highlight "Bold Choice", "Gold Acting Moment", "Pitfall to Avoid" ONLY where they add genuine value—not as filler.
- Write to INSPIRE and STRATEGIZE, not just inform. This is coaching, not a book report.
- ${
                  data.hasFullScript
                    ? "Use full-script knowledge only to enrich side-specific analysis (avoid spoilers)."
                    : "Focus analysis strictly on the provided audition sides."
                }

**DELIVERABLE REMINDERS**
- Use HTML-friendly headings, paragraphs, and lists; keep the required order.
- Provide actionable coaching, not summaries; every section should end with playable insights.
- Always conclude with a FINAL PEP TALK in Corey's voice.

**OUTPUT FORMAT:** Output ONLY the raw HTML content without any markdown formatting, code blocks, or \`\`\`html wrappers. The response should be pure HTML that can be directly inserted into a web page. Make it worthy of the PREP101 brand and indistinguishable from Corey's personal coaching.`,
              },
            ],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ RAG Guide Generation Error (Attempt ${attempt}) [model=${DEFAULT_CLAUDE_MODEL}]:`,
            response.status,
            response.statusText,
            errorText
          );

          if (response.status === 504 && attempt < maxRetries) {
            console.log(
              `⏰ Gateway timeout, retrying in ${attempt * 2} seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
            lastError = new Error(`Gateway timeout (Attempt ${attempt})`);
            continue;
          }

          throw new Error(`Anthropic ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (result.content && result.content[0] && result.content[0].text) {
          console.log(`✅ RAG Guide generated using Corey's methodology!`);
          console.log(
            `📊 Guide length: ${result.content[0].text.length} characters`
          );
          console.log(
            `🎯 Methodology files used: ${relevantMethodology.length}`
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
            `🔄 Attempt ${attempt} failed, retrying in ${
              attempt * 2
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
  const fetch = require("node-fetch");

  try {
    console.log("🌟 Generating simplified Child's Guide...");

    // Search methodology for child-friendly examples
    const childMethodology = searchMethodology(
      data.characterName,
      data.productionType,
      data.sceneText
    );

    // Build context from child-friendly methodology
    let childMethodologyContext = "";
    if (childMethodology.length > 0) {
      childMethodologyContext = childMethodology
        .map(
          (file) =>
            `=== CHILD-FRIENDLY METHODOLOGY: ${file.filename} ===\n${file.content}\n\n`
        )
        .join("");
    }

    console.log(
      `🎭 Generating child guide using ${childMethodology.length} methodology files...`
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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: DEFAULT_CLAUDE_MODEL,
          max_tokens: DEFAULT_CLAUDE_MAX_TOKENS,
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

**IMPORTANT:**
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
        }),
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ Child Guide Generation Error:",
          response.status,
          errorText
        );
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

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
      `🌟 Child guide generation started for guide ${
        guideRecord.guideId || guideId
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
      `✅ Child guide stored for ${guideRecord.characterName} (${
        guideRecord.guideId || guideId
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

// PDF Upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Please upload a PDF file" });
    }

    console.log(`📄 Processing: ${req.file.originalname}`);

    const MIN_WC = parseInt(process.env.MIN_EXTRACT_WORDS || "200", 10);
    // 1) Adobe first (only if available)
    let result;
    if (extractWithAdobe) {
      result = await extractWithAdobe(req.file.buffer).catch((e) => ({
        success: false,
        method: "adobe",
        reason: e?.message || "adobe-extract-error",
      }));
    } else {
      console.log(
        "[UPLOAD] Adobe extractor not available, using basic extraction"
      );
      result = {
        success: false,
        method: "adobe",
        reason: "adobe-not-available",
      };
    }

    if (!result?.success || !result.text) {
      console.warn(
        "[UPLOAD] Adobe failed or empty:",
        result?.reason || "no-text"
      );
      result = await extractWithBasic(req.file.buffer);
    }

    // OCR Fallback: If basic extraction fails or produces poor quality content, try OCR
    if (!result?.text || result.text.length < 100) {
      console.log("[UPLOAD] Basic extraction failed, trying OCR fallback...");
      try {
        result = await extractWithOCR(req.file.buffer);
        console.log("[UPLOAD] OCR extraction completed:", {
          method: result.method,
          wordCount: result.wordCount,
          confidence: result.confidence,
        });
      } catch (ocrError) {
        console.error("[UPLOAD] OCR fallback failed:", ocrError.message);
      }
    }

    // Additional OCR fallback: If content quality is poor, try OCR
    const initialContentQuality = assessContentQuality(
      result.text,
      result.wordCount || 0,
      true
    );
    if (initialContentQuality.quality === "poor" && result.method === "basic") {
      console.log(
        "[UPLOAD] Basic extraction produced poor quality content, trying OCR fallback..."
      );
      try {
        const ocrResult = await extractWithOCR(req.file.buffer);
        const ocrContentQuality = assessContentQuality(
          ocrResult.text,
          ocrResult.wordCount || 0,
          true
        );

        // Use OCR result if it's better quality
        if (ocrContentQuality.quality !== "poor") {
          console.log(
            "[UPLOAD] OCR produced better quality content, using OCR result"
          );
          result = ocrResult;
        } else {
          console.log(
            "[UPLOAD] OCR also produced poor quality content, keeping basic result"
          );
        }
      } catch (ocrError) {
        console.error("[UPLOAD] OCR fallback failed:", ocrError.message);
      }
    }

    // 2) Assess content quality and handle low-quality content (lenient check on upload)
    const contentQuality = assessContentQuality(
      result.text,
      result.wordCount || 0,
      true
    );

    if (contentQuality.quality === "poor") {
      console.warn(
        `[UPLOAD] Poor content quality detected: ${contentQuality.reason}`,
        {
          filename: req.file.originalname,
          wordCount: result.wordCount,
          watermarkRatio: contentQuality.watermarkRatio,
        }
      );

      return res.status(422).json({
        success: false,
        error:
          contentQuality.reason === "watermark_heavy"
            ? "Limited content: please upload clean sides without watermarks or timestamps"
            : "Limited content: please upload a script with actual dialogue and scene content",
        contentQuality: contentQuality.reason,
        extractionMethod: result.method,
        extractionConfidence: result.confidence || "low",
        wordCount: result.wordCount,
        watermarkRatio: contentQuality.watermarkRatio,
      });
    }

    if (contentQuality.quality === "low") {
      console.log(
        `[UPLOAD] Low content quality - allowing fallback generation`,
        {
          filename: req.file.originalname,
          wordCount: result.wordCount,
          reason: contentQuality.reason,
        }
      );
    }

    const uploadId = Date.now().toString();
    const fileType = req.body.fileType || "sides"; // Default to sides if not specified

    // 3) Character names (if Adobe didn't supply them)
    const characterPattern = /^[A-Z][A-Z\s]+:/gm;
    const characterNames = result.characterNames || [
      ...new Set(
        (result.text.match(characterPattern) || []).map((n) =>
          n.replace(":", "").trim()
        )
      ),
    ];

    uploads[uploadId] = {
      filename: req.file.originalname,
      sceneText: result.text.trim(),
      characterNames,
      extractionMethod: result.method,
      extractionConfidence: result.confidence,
      uploadTime: new Date(),
      wordCount: result.wordCount,
      fileType: fileType, // Store the file type
    };

    // 5) Log triage with enhanced preview
    const preview = (result.text || "").slice(0, 300).replace(/\n/g, "⏎");
    console.log("[UPLOAD]", {
      file: req.file.originalname,
      method: result.method,
      confidence: result.confidence,
      words: result.wordCount,
      contentQuality: contentQuality.quality,
      preview: `"${preview}..."`,
    });

    // Update extraction diagnostics for /api/health
    try {
      const m = result.method || "unknown";
      if (extractionStats.totals[m] !== undefined)
        extractionStats.totals[m] += 1;
      extractionStats.last = {
        method: result.method,
        confidence: result.confidence,
        wordCount: result.wordCount,
        filename: req.file.originalname,
        at: new Date().toISOString(),
      };
    } catch (_) {}

    // 6) Respond
    return res.json({
      success: true,
      uploadId,
      filename: req.file.originalname,
      textLength: result.text.length,
      wordCount: result.wordCount,
      characterNames,
      extractionMethod: result.method,
      extractionConfidence: result.confidence,
      preview: (result.text || "").slice(0, 400) + "...",
      sceneText: result.text,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: "Failed to process PDF: " + error.message });
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
      productionTitle,
      productionType,
      roleSize,
      genre,
      storyline,
      characterBreakdown,
      callbackNotes,
      focusArea,
      childGuideRequested,
    } = req.body;

    // Handle both single and multiple upload IDs
    const uploadIdList = uploadIds || [uploadId];
    // Debug request basics for faster triage
    console.log("📝 Generate request:", {
      uploadIdsCount: Array.isArray(uploadIds)
        ? uploadIds.length
        : uploadId
        ? 1
        : 0,
      hasAuthHeader: !!req.headers.authorization,
      hasCharacterName: !!characterName,
      hasProductionTitle: !!productionTitle,
      hasProductionType: !!productionType,
    });

    if (!uploadIdList.length || uploadIdList.some((id) => !uploads[id])) {
      return res
        .status(400)
        .json({ error: "Invalid upload ID(s) or expired session" });
    }

    if (!characterName || !productionTitle || !productionType) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const currentUser =
      req.user || (User && req.userId ? await User.findByPk(req.userId) : null);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "Authentication required to save guide",
      });
    }

    const userGuidesUsed = currentUser.guidesUsed || 0;
    const userGuideLimit =
      typeof currentUser.guidesLimit === "number"
        ? currentUser.guidesLimit
        : null;
    const isAdminUser =
      currentUser.betaAccessLevel === "admin" ||
      currentUser.subscription === "admin";
    const hasUnlimitedPlan =
      isAdminUser ||
      userGuideLimit === null ||
      userGuideLimit <= 0 ||
      userGuideLimit >= 999 ||
      (currentUser.subscription &&
        currentUser.subscription.toLowerCase() !== "free");

    if (
      !hasUnlimitedPlan &&
      userGuideLimit !== null &&
      userGuideLimit > 0 &&
      userGuidesUsed >= userGuideLimit
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Monthly guide limit reached. Upgrade your subscription for more guides.",
        guidesUsed: userGuidesUsed,
        guidesLimit: userGuideLimit,
      });
    }

    // Combine all upload data
    const scenePayloads = req.body.scenePayloads || {};
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
        };
      }
      return null;
    });

    if (allUploadData.some((data) => !data)) {
      return res
        .status(400)
        .json({ error: "Upload data not found or expired. Please re-upload." });
    }
    const combinedSceneText = allUploadData
      .map((data) => data.sceneText)
      .join("\n\n--- NEW SCENE ---\n\n");
    const combinedWordCount = allUploadData.reduce(
      (total, data) => total + (data.wordCount || 0),
      0
    );

    console.log(`🎭 COREY RALSTON RAG Guide Generation...`);
    console.log(`🎬 ${characterName} | ${productionTitle} (${productionType})`);
    console.log(
      `🧠 Using ${Object.keys(methodologyDatabase).length} methodology files`
    );

    // Check if we have full script context
    const hasFullScript = allUploadData.some(
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

    // Only reject if TRULY terrible (< 10 words or > 80% corrupted)
    if (
      contentQuality.quality === "poor" &&
      (combinedWordCount < 10 ||
        (contentQuality.repetitiveRatio &&
          contentQuality.repetitiveRatio > 0.8) ||
        (contentQuality.repetitionRatio &&
          contentQuality.repetitionRatio > 0.8))
    ) {
      let errorMessage =
        "Unable to generate guide: content appears to be corrupted or empty";

      if (contentQuality.repetitiveRatio > 0.8) {
        errorMessage =
          "Unable to generate guide: content is mostly watermarks/timestamps (>80%)";
      } else if (contentQuality.repetitionRatio > 0.8) {
        errorMessage =
          "Unable to generate guide: content is mostly repetitive text (>80%)";
      } else if (combinedWordCount < 10) {
        errorMessage =
          "Unable to generate guide: insufficient content (less than 10 words)";
      }

      console.warn("[GENERATION] Rejecting due to poor quality:", {
        wordCount: combinedWordCount,
        repetitiveRatio: contentQuality.repetitiveRatio,
        repetitionRatio: contentQuality.repetitionRatio,
        reason: contentQuality.reason,
      });

      return res.status(422).json({
        success: false,
        error: errorMessage,
        contentQuality: contentQuality.reason,
        details: {
          combinedWordCount,
          repetitiveRatio: contentQuality.repetitiveRatio,
          repetitionRatio: contentQuality.repetitionRatio,
        },
      });
    }

    // If we made it here, content is acceptable - log for monitoring
    if (contentQuality.quality === "low") {
      console.log("[GENERATION] Low quality content but proceeding:", {
        wordCount: combinedWordCount,
        reason: contentQuality.reason,
      });
    }

    const guideContentRaw = await generateActingGuideWithRAG({
      sceneText: combinedSceneText,
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
      extractionMethod: allUploadData[0].extractionMethod,
      hasFullScript: hasFullScript,
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

      if (
        !hasUnlimitedPlan &&
        userGuideLimit !== null &&
        userGuideLimit > 0 &&
        typeof currentUser.increment === "function"
      ) {
        await currentUser.increment("guidesUsed").catch((err) => {
          console.error(
            "Failed to increment guide usage:",
            err?.message || err
          );
        });
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
          model: "claude-sonnet-4-20250514",
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
          model: "claude-sonnet-4-20250514",
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
      return res.status(400).json({ success: false, message: "Promo code is required" });
    }

    console.log(`🎟️  Promo code redemption attempt - Code: ${code}, User: ${userId}`);

    if (!isSupabaseAdminConfigured()) {
      return res.status(503).json({ success: false, message: "Promo code service unavailable" });
    }

    // Find the promo code in Supabase
    const { data: promoCode, error: promoError } = await runAdminQuery((client) =>
      client
        .from("PromoCodes")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("isActive", true)
        .maybeSingle()
    );

    if (promoError || !promoCode) {
      console.log(`❌ Promo code not found: ${code}`);
      return res.status(404).json({ success: false, message: "Invalid promo code" });
    }

    // Check if expired
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "Promo code has expired" });
    }

    // Check max redemptions
    if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
      return res.status(400).json({ success: false, message: "Promo code has reached maximum redemptions" });
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
      return res.status(400).json({ success: false, message: "You have already redeemed this code" });
    }

    // Create redemption record
    const { error: redemptionError } = await runAdminQuery((client) =>
      client.from("PromoCodeRedemptions").insert({
        id: require("crypto").randomUUID(),
        promoCodeId: promoCode.id,
        userId: userId,
        guidesGranted: promoCode.guidesGranted || 1,
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

    const newLimit = (currentUser?.guidesLimit || 0) + (promoCode.guidesGranted || 1);

    await runAdminQuery((client) =>
      client.from("Users").update({ guidesLimit: newLimit }).eq("id", userId)
    );

    console.log(`🎉 Promo code redeemed - Code: ${code}, User: ${userId}, Guides granted: ${promoCode.guidesGranted || 1}`);

    res.json({
      success: true,
      message: `Promo code redeemed! You received ${promoCode.guidesGranted || 1} free guide${(promoCode.guidesGranted || 1) > 1 ? "s" : ""}!`,
      redemption: {
        guidesGranted: promoCode.guidesGranted || 1,
        redeemedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Promo code redemption error:", error);
    res.status(500).json({ success: false, message: "Failed to redeem promo code" });
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
          ${
            guide.storyline
              ? `<p><strong>Storyline:</strong> ${guide.storyline}</p>`
              : ""
          }
          ${
            guide.characterBreakdown
              ? `<p><strong>Character Breakdown:</strong> ${guide.characterBreakdown}</p>`
              : ""
          }
          ${
            guide.focusArea
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
    minExtractWords: parseInt(process.env.MIN_EXTRACT_WORDS || "200", 10),
    extraction: {
      adobeEnabled: process.env.ADOBE_PDF_EXTRACT_ENABLED === "true",
      minExtractWords: parseInt(process.env.MIN_EXTRACT_WORDS || "200", 10),
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
