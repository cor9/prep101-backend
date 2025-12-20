const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

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
                  guidesLimit: 1,
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

          return res.json({
            message: "Login successful",
            token: data.session.access_token,
            user: {
              id: user?.id || data.user.id,
              email: user?.email || data.user.email,
              name: user?.name || data.user.user_metadata?.name || email.split("@")[0],
            },
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
        return res.json({
          message: "Login successful",
          token,
          user: { id: user.id, name: user.name, email: user.email },
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

module.exports = router;

