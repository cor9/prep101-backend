const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const auth = require("../middleware/auth");
const User = require("../models/User");
const {
  addActorProfile,
  buildAccountContext,
  completeOnboarding,
  ensureProfile,
  selectActiveActor,
} = require("../services/accountContextService");
const {
  buildBoldChoicesUsage,
  buildPrep101Usage,
  buildReader101Usage,
} = require("../services/prep101EntitlementsService");
const {
  reconcileStripePurchasesForUser,
} = require("../services/stripeReconciliation");

const router = express.Router();
const AUTH_COOKIE_NAME = "ca101_session";

function getAuthCookieOptions() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
}

function setSessionCookie(res, token) {
  if (!token) return;
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });
}

function serializeUser(user, account = null) {
  const prep101Usage = buildPrep101Usage(user);
  const reader101Usage = buildReader101Usage(user);
  const boldChoicesUsage = buildBoldChoicesUsage(user);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
    subscription: user.subscription || "free",
    guidesUsed: typeof user.guidesUsed === "number" ? user.guidesUsed : 0,
    guidesLimit:
      typeof user.guidesLimit === "number" ? user.guidesLimit : user.guidesLimit ?? 0,
    prep101TopUpCredits:
      typeof user.prep101TopUpCredits === "number" ? user.prep101TopUpCredits : 0,
    reader101Credits:
      typeof user.reader101Credits === "number" ? user.reader101Credits : 0,
    boldChoicesCredits:
      typeof user.boldChoicesCredits === "number" ? user.boldChoicesCredits : 0,
    subscriptionStatus: user.subscriptionStatus || "active",
    currentPeriodStart: user.currentPeriodStart || null,
    currentPeriodEnd: user.currentPeriodEnd || null,
    betaAccessLevel: user.betaAccessLevel || "none",
    isBetaTester: Boolean(user.isBetaTester),
    prep101Usage,
    reader101Usage,
    boldChoicesUsage,
    account,
  };
}

async function buildSerializedUser(user, options = {}) {
  if (options.reconcileStripe) {
    user = await reconcileStripePurchasesForUser(user).catch((error) => {
      console.warn("⚠️ Stripe purchase reconciliation skipped:", error.message);
      return user;
    });
  }
  const account = await buildAccountContext(user, options);
  return serializeUser(user, account);
}

// POST /api/auth/register - User registration
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Name, email & password required" });
    }

    // Get Supabase credentials
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    console.log("🔍 Register attempt:", { email });

    // 1. Try Supabase Registration first
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        });

        if (error) {
          console.error("❌ Supabase signUp error:", error.message);
          return res.status(400).json({ message: error.message });
        }

        if (data?.user) {
          console.log("✅ Supabase registration successful:", data.user.id);

          // Sync with local DB if available
          if (User) {
            try {
              const userEmail = data.user.email.toLowerCase();
              let user = await User.findOne({ where: { email: userEmail } });

              if (!user) {
                // Determine beta status
                const isBetaTester = false; // Default to false for public signups

                user = await User.create({
                  id: data.user.id, // Try to sync UUIDs if possible
                  email: userEmail,
                  password: password, // Will be hashed by hook
                  name: name,
                  subscription: "free",
                  guidesLimit: 0,
                  isBetaTester
                });
                console.log("✅ Synced new user to local DB:", user.id);
              }
            } catch (dbError) {
              console.error("⚠️ Local DB sync failed (non-fatal):", dbError.message);
              // Continue - valid Supabase user created
            }
          }

          const hydratedUser = {
            id: data.user.id,
            email: data.user.email,
            name,
            subscription: "free",
            guidesUsed: 0,
            guidesLimit: 0,
            subscriptionStatus: "active",
          };

          await ensureProfile(hydratedUser).catch((error) => {
            console.warn("⚠️ Profile bootstrap skipped during register:", error.message);
          });

          const serializedUser = await buildSerializedUser(hydratedUser, {
            ensureProfile: true,
            reconcileStripe: true,
          });

          setSessionCookie(res, data.session?.access_token);

          return res.status(201).json({
            message: "User registered successfully",
            token: data.session?.access_token,
            user: serializedUser,
          });
        }
      } catch (sbError) {
        console.error("Supabase registration exception:", sbError);
        // Fall through to local DB
      }
    }

    // 2. Local DB Fallback (if Supabase failed or not configured)
    if (User) {
      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(400).json({ message: 'User already exists' });

      const newUser = await User.create({ name, email, password }); // Password hashed by model hook
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
      setSessionCookie(res, token);

      return res.status(201).json({
        message: 'User registered',
        token,
        user: await buildSerializedUser(newUser, {
          ensureProfile: true,
          reconcileStripe: true,
        }),
      });
    }

    return res.status(500).json({ message: "Registration failed - no auth provider available" });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration error", error: error.message });
  }
});

// POST /api/auth/login - User login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    // Get Supabase credentials
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    console.log("🔍 Login attempt:", {
      email,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      supabaseUrl: SUPABASE_URL?.substring(0, 50)
    });

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        // Validate URL format
        if (!SUPABASE_URL.startsWith("http://") && !SUPABASE_URL.startsWith("https://")) {
          console.error("❌ Invalid SUPABASE_URL format:", SUPABASE_URL?.substring(0, 50));
          throw new Error("Invalid SUPABASE_URL format");
        }

        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        console.log("✅ Supabase client created, attempting signInWithPassword...");

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("❌ Supabase signIn error:", error.message, error.status);
          return res.status(401).json({ message: error.message || "Invalid credentials" });
        }

        if (data?.user && data?.session) {
          console.log("✅ Supabase login successful, user ID:", data.user.id);

          // Try to find or create user in database if User model is available
          let user = null;
          if (User) {
            try {
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
                  guidesLimit: 0,
                  isBetaTester,
                  betaAccessLevel,
                });
                console.log("✅ Created new user in database:", user.id);
              } else {
                console.log("✅ Found existing user in database:", user.id);
              }
            } catch (dbError) {
              console.error("❌ Database error during user lookup/create:", dbError.message);
              // Continue with Supabase user data if DB fails
            }
          }

          const hydratedUser = {
            id: user?.id || data.user.id,
            email: user?.email || data.user.email,
            name: user?.name || data.user.user_metadata?.name || email.split("@")[0],
            subscription: user?.subscription || "free",
            guidesUsed: user?.guidesUsed || 0,
            guidesLimit: user?.guidesLimit ?? 0,
            subscriptionStatus: user?.subscriptionStatus || "active",
            currentPeriodStart: user?.currentPeriodStart || null,
            currentPeriodEnd: user?.currentPeriodEnd || null,
            betaAccessLevel: user?.betaAccessLevel || "none",
            isBetaTester: Boolean(user?.isBetaTester),
          };

          await ensureProfile(hydratedUser).catch((error) => {
            console.warn("⚠️ Profile bootstrap skipped during login:", error.message);
          });

          setSessionCookie(res, data.session.access_token);

          return res.json({
            message: "Login successful",
            token: data.session.access_token,
            user: await buildSerializedUser(hydratedUser, {
              ensureProfile: true,
              reconcileStripe: true,
            }),
          });
        } else {
          console.error("❌ Supabase login returned no user or session");
          throw new Error("No user or session returned from Supabase");
        }
      } catch (supabaseError) {
        console.error("❌ Supabase login error:", supabaseError.message, supabaseError.stack);
        // Don't return here - fall through to database login fallback
      }
    } else {
      console.warn("⚠️  Supabase credentials missing, trying database fallback...");
    }

    // Fallback: try database login if User model is available
    if (User) {
      console.log("🔄 Attempting database login fallback...");
      try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
          console.error("❌ User not found in database");
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const bcrypt = require("bcryptjs");
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.error("❌ Password mismatch");
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const jwt = require("jsonwebtoken");
        const token = jwt.sign(
          { userId: user.id },
          process.env.JWT_SECRET || "fallback_secret",
          { expiresIn: "24h" }
        );
        console.log("✅ Database login successful");
        setSessionCookie(res, token);
        return res.json({
          message: "Login successful",
          token,
          user: await buildSerializedUser(user, {
            ensureProfile: true,
            reconcileStripe: true,
          }),
        });
      } catch (dbError) {
        console.error("❌ Database login error:", dbError.message);
        return res.status(500).json({ message: "Database login failed", error: dbError.message });
      }
    }

    console.error("❌ No authentication method available");
    return res.status(503).json({
      message: "Authentication service unavailable",
      error: "No authentication method available. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.",
    });
  } catch (err) {
    console.error("❌ Login error:", err.message, err.stack);
    return res.status(500).json({ message: "Login error", error: err.message });
  }
});

router.post("/session", auth, async (req, res) => {
  try {
    setSessionCookie(res, req.authToken);
    return res.json({
      success: true,
      user: await buildSerializedUser(req.user, { ensureProfile: true }),
    });
  } catch (error) {
    console.error("Session exchange error:", error);
    return res.status(500).json({ success: false, message: "Failed to create session" });
  }
});

router.post("/logout", async (_req, res) => {
  try {
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Failed to log out" });
  }
});

router.get("/verify", auth, async (req, res) => {
  try {
    return res.json({
      valid: true,
      user: await buildSerializedUser(req.user, {
        ensureProfile: true,
        reconcileStripe: true,
      }),
    });
  } catch (error) {
    console.error("Verify error:", error);
    return res.status(500).json({ valid: false, message: "Verification failed" });
  }
});

router.get("/dashboard", auth, async (req, res) => {
  try {
    const user = await buildSerializedUser(req.user, {
      ensureProfile: true,
      reconcileStripe: true,
    });
    return res.json({
      success: true,
      user,
      account: user.account,
      subscription: {
        currentPlan: {
          name: user.subscription,
        },
        status: user.subscriptionStatus,
        renewsAt: user.currentPeriodEnd || null,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard" });
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await buildSerializedUser(req.user, {
      ensureProfile: true,
      reconcileStripe: true,
    });
    return res.json({
      success: true,
      user,
      account: user.account,
    });
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

router.get("/context", auth, async (req, res) => {
  try {
    const account = await buildAccountContext(req.user, { ensureProfile: true });
    return res.json({ success: true, account });
  } catch (error) {
    console.error("Context error:", error);
    return res.status(500).json({ message: "Failed to load account context" });
  }
});

router.post("/onboarding", auth, async (req, res) => {
  try {
    const account = await completeOnboarding(req.user, req.body || {});
    return res.json({
      success: true,
      account,
      user: serializeUser(req.user, account),
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return res.status(400).json({ message: error.message || "Onboarding failed" });
  }
});

router.post("/select-actor", auth, async (req, res) => {
  try {
    const account = await selectActiveActor(req.user, req.body?.actorId);
    return res.json({
      success: true,
      account,
      user: serializeUser(req.user, account),
    });
  } catch (error) {
    console.error("Select actor error:", error);
    return res.status(400).json({ message: error.message || "Failed to select actor" });
  }
});

router.post("/add-actor", auth, async (req, res) => {
  try {
    const account = await addActorProfile(req.user, req.body || {});
    return res.json({
      success: true,
      account,
      user: serializeUser(req.user, account),
    });
  } catch (error) {
    console.error("Add actor error:", error);
    return res.status(400).json({ message: error.message || "Failed to add actor" });
  }
});

module.exports = router;
