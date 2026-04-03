const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { generateBoldChoices } = require("../services/boldChoicesService");
const { renderBoldChoicesTemplate } = require("../services/boldChoicesTemplate");
const { checkAndIncrement } = require("../services/boldChoicesUsage");
const auth = require("../middleware/auth");

// ── In-memory generation store (ephemeral cache; persisted copy in DB below) ──
const generationsCache = new Map();

// ── Analytics event logger ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function logEvent(event, userId, meta = {}) {
  console.log(`[Analytics] event=${event} user=${userId}`, meta);
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/boldchoices_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event,
        user_id: String(userId),
        meta: JSON.stringify(meta),
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Non-fatal — never block request flow for analytics
    console.warn("[Analytics] Failed to log event:", err.message);
  }
}

// ── Schema guard ──────────────────────────────────────────────────────────────
function isValidGuideData(data) {
  return (
    data &&
    data.pov &&
    typeof data.pov.summary === "string" &&
    Array.isArray(data.choices) &&
    data.choices.length >= 3 &&
    Array.isArray(data.moments) &&
    data.moments.length >= 1
  );
}

/**
 * POST /api/bold-choices/generate
 *
 * Body:
 *   characterName       string  required
 *   sceneText           string  required
 *   role                string  optional
 *   show                string  optional
 *   network             string  optional
 *   castingDirectors    string  optional
 *   castingOppositeOf   string  optional
 *   roleSize            string  optional
 *   characterDescription string optional
 *   storyline           string  optional
 *   format              string  "html" | "json"  (default "html")
 *   preview             boolean  if true, returns partial HTML with upsell gate
 *   previousGenerationId string  optional — pass to enable spin-aware context
 *
 * Auth: required (JWT bearer)
 */
router.post("/generate", auth, async (req, res) => {
  try {
    const {
      characterName,
      sceneText,
      role,
      show,
      network,
      castingDirectors,
      castingOppositeOf,
      roleSize,
      characterDescription,
      storyline,
      format = "html",
      preview = false,
      modifier = null,   // null | 'wilder' | 'take2' | 'spin'
      spinAgain = false,
      previousGenerationId = null, // enables spin-aware generation
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!characterName || typeof characterName !== "string" || !characterName.trim()) {
      return res.status(400).json({ error: "characterName is required" });
    }
    if (!sceneText || typeof sceneText !== "string" || sceneText.trim().length < 20) {
      return res.status(400).json({
        error: "sceneText is required (minimum 20 characters)",
      });
    }

    const validModifiers = [null, "wilder", "take2", "spin"];
    if (!validModifiers.includes(modifier)) {
      return res.status(400).json({ error: "Invalid modifier. Use: wilder | take2 | spin | null" });
    }

    const OWNER_EMAIL = process.env.OWNER_EMAIL || 'corey@childactor101.com';
    const isAdmin = req.user && req.user.email === OWNER_EMAIL;
    const isPro = isAdmin || (req.user && (req.user.subscription === 'pro' || req.user.isPro ||
      req.user.betaAccessLevel === 'admin' || req.user.subscription === 'premium'));
    const userId = req.userId || (req.user && req.user.id);

    // ── Modifier paywall ────────────────────────────────────────────────────
    if (!isPro && modifier && modifier !== null) {
      logEvent("upgrade_clicked", userId, { modifier, characterName, show });
      return res.status(403).json({ error: "Upgrade required for this feature" });
    }

    // ── Durable daily limit (free users) ────────────────────────────────────
    if (!isPro) {
      const { allowed, count } = await checkAndIncrement(userId, 1);
      if (!allowed) {
        logEvent('limit_reached', userId, { count, characterName });
        return res.status(403).json({
          error: 'Monthly limit reached. Upgrade to generate unlimited bold choices.',
          usageCount: count,
        });
      }
    }

    let actualSpinAgain = spinAgain;
    let actualModifier = modifier;
    if (modifier === "spin") {
      actualSpinAgain = true;
      actualModifier = null;
    }

    // ── Retrieve previous output for spin-aware context ─────────────────────
    let previousOutputSummary = null;
    if (actualSpinAgain && previousGenerationId) {
      const prev = generationsCache.get(previousGenerationId);
      if (prev && prev.data) {
        // Build a concise summary so Claude avoids repeating
        const d = prev.data;
        const choiceTitles = (d.choices || []).map((c) => c.title).join(", ");
        const coachNote = d.coachNote ? d.coachNote.substring(0, 200) : "";
        previousOutputSummary = `Previous choices: ${choiceTitles}. Coach note excerpt: ${coachNote}`;
      }
    }

    console.log(
      `[BoldChoices] Generating for: ${characterName} | modifier: ${actualModifier || "standard"} | spinAgain: ${actualSpinAgain} | preview: ${preview} | previousId: ${previousGenerationId || "none"}`,
    );

    // Log analytics event
    const analyticsEvent = modifier === "wilder"
      ? "wilder_clicked"
      : modifier === "take2"
      ? "take2_clicked"
      : actualSpinAgain
      ? "spin_clicked"
      : "generated";
    logEvent(analyticsEvent, userId, { characterName, show, preview });

    // ── Call Claude ──────────────────────────────────────────────────────────
    const inputData = {
      characterName: characterName.trim(),
      sceneText: sceneText.trim(),
      role,
      show,
      network,
      castingDirectors,
      castingOppositeOf,
      roleSize,
      characterDescription,
      storyline,
      modifier: actualModifier,
      spinAgain: actualSpinAgain,
      previousOutputSummary, // injected into prompt for spin-aware variation
    };

    const guideData = await generateBoldChoices(inputData);

    // ── Schema guard: retry once with stricter instruction if invalid ─────────
    if (!isValidGuideData(guideData)) {
      console.warn("[BoldChoices] Schema guard failed — retrying with stricter instruction");
      inputData._schemaRetry = true;
      const retryData = await generateBoldChoices(inputData);
      if (!isValidGuideData(retryData)) {
        console.error("[BoldChoices] Schema guard failed on retry too.");
        return res.status(500).json({ error: "Generated guide was malformed. Please try again." });
      }
      Object.assign(guideData, retryData);
    }

    // ── Store generation with ID ──────────────────────────────────────────────
    const generationId = uuidv4();
    generationsCache.set(generationId, {
      id: generationId,
      data: guideData,
      prompt: inputData,
      userId,
      createdAt: new Date().toISOString(),
    });
    // Evict stale entries (keep last 200)
    if (generationsCache.size > 200) {
      const firstKey = generationsCache.keys().next().value;
      generationsCache.delete(firstKey);
    }

    // ── Persist generation to Supabase (non-blocking) ─────────────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/boldchoices_generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: generationId,
          user_id: String(userId),
          character_name: characterName.trim(),
          show: show || null,
          modifier: modifier || null,
          is_preview: !!preview,
          output_json: JSON.stringify(guideData),
          prompt_summary: JSON.stringify({
            role, show, network, castingDirectors, roleSize, modifier,
          }),
          created_at: new Date().toISOString(),
        }),
      }).catch((err) => console.warn("[BoldChoices] Failed to persist generation:", err.message));
    }

    // ── Format and return ─────────────────────────────────────────────────────
    if (format === "json") {
      return res.json({
        success: true,
        data: guideData,
        meta: inputData,
        isPreview: preview,
        modifier,
        spinAgain,
        generationId,
      });
    }

    // Default: return rendered HTML
    const meta = {
      characterName: characterName.trim(),
      show: show || "",
      network: network || "",
      castingDirectors: castingDirectors || "",
      castingOppositeOf: castingOppositeOf || "",
      roleSize: roleSize || "",
    };

    const html = renderBoldChoicesTemplate(guideData, meta, !!preview);

    console.log(`[BoldChoices] Done (${html.length} chars). modifier: ${modifier || "none"}`);

    return res.json({
      success: true,
      html,
      isPreview: preview,
      meta,
      modifier,
      generationId,
    });
  } catch (err) {
    console.error("[BoldChoices] Generation error:", err.message);
    return res.status(500).json({
      error: "Failed to generate Bold Choices guide",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * GET /api/bold-choices/health
 */
router.get("/health", (req, res) => {
  res.json({
    service: "bold-choices",
    status: "ok",
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
  });
});

/**
 * POST /api/bold-choices/save
 * Persists a saved choice to Supabase.
 */
router.post("/save", auth, async (req, res) => {
  try {
    const { choice, character, show, generationId } = req.body;
    const userId = req.userId || (req.user && req.user.id);

    if (!choice) {
      return res.status(400).json({ error: "choice is required" });
    }

    const recordId = uuidv4();
    const record = {
      id: recordId,
      userId,
      choice,
      metadata: { character, show, generationId },
      createdAt: new Date().toISOString(),
    };

    // Persist to Supabase (non-blocking)
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/boldchoices_saved`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: recordId,
          user_id: String(userId),
          choice_text: choice,
          character_name: character || null,
          show: show || null,
          generation_id: generationId || null,
          created_at: record.createdAt,
        }),
      }).catch((err) => console.warn("[BoldChoices] Save to Supabase failed:", err.message));
    }

    logEvent("choice_saved", userId, { character, show, generationId });
    return res.json({ success: true, data: record });
  } catch (err) {
    console.error("[BoldChoices] Save error:", err.message);
    return res.status(500).json({ error: "Failed to save choice" });
  }
});

/**
 * POST /api/bold-choices/analytics
 * Client-side event tracking (upgrade_clicked, etc.)
 */
router.post("/analytics", auth, (req, res) => {
  const { event, meta = {} } = req.body;
  const userId = req.userId || (req.user && req.user.id);
  if (event) logEvent(event, userId, meta);
  res.json({ success: true });
});

/**
 * GET /api/bold-choices/admin/dashboard
 * Admin dashboard data
 */
router.get("/admin/dashboard", auth, async (req, res) => {
  try {
    const OWNER_EMAIL = process.env.OWNER_EMAIL || 'corey@childactor101.com';
    const isAdmin = req.user && req.user.email === OWNER_EMAIL;
    
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { SUPABASE_URL } = process.env;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(503).json({ error: "Supabase credentials missing" });
    }

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    };

    // Parallel fetch all stats from Supabase REST API
    const [usageRes, eventsRes, generationsRes, savedRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/boldchoices_usage?select=count`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/boldchoices_events?select=count`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/boldchoices_generations?select=*&order=created_at.desc&limit=50`, { headers }), // get recent generations
      fetch(`${SUPABASE_URL}/rest/v1/boldchoices_saved?select=count`, { headers })
    ]);

    const stats = {
      totalUsage: 0,
      totalEvents: 0,
      totalSaved: 0,
      recentGenerations: []
    };

    if (usageRes.ok) {
        // Since we did ?select=count, the response header Content-Range has the total or we can just sum the counts if we fetched records.
        // Actually, without exact header parsing, let's just fetch all and count in memory for now since it's an MVP admin dash, or parse properly.
        // Let's re-fetch without select=count header logic to be safe and simple, or just use the count from the payload if it's there.
    }
    
    // Better way to get count from Supabase REST: use Prefer: count=exact header, but it's simpler to just fetch recent rows and maybe group them. 
    // Let's do a simple aggregation for the MVP:
    const eventsDataRes = await fetch(`${SUPABASE_URL}/rest/v1/boldchoices_events?select=event,count&limit=1000`, { headers });
    const eventsData = eventsDataRes.ok ? await eventsDataRes.json() : [];
    
    // We'll just fetch raw data and aggregate it for the dashboard
    const allEventsRes = await fetch(`${SUPABASE_URL}/rest/v1/boldchoices_events?select=event,user_id,created_at&limit=1000&order=created_at.desc`, { headers });
    const allEvents = allEventsRes.ok ? await allEventsRes.json() : [];

    const generationsData = generationsRes.ok ? await generationsRes.json() : [];
    
    const uniqueUsers = new Set(allEvents.map(e => e.user_id)).size;
    const spins = allEvents.filter(e => e.event === 'spin').length;
    const wilders = allEvents.filter(e => e.event === 'wilder').length;
    const upgrades = allEvents.filter(e => e.event === 'upgrade_clicked').length;
    
    res.json({
        success: true,
        stats: {
            totalEvents: allEvents.length,
            uniqueUsers,
            spins,
            wilders,
            upgrades,
            recentGenerations: generationsData.map(g => ({
                id: g.id,
                userId: g.user_id,
                createdAt: g.created_at,
                // parse prompt to get character info safely
                character: typeof g.prompt === 'string' ? JSON.parse(g.prompt).characterName : (g.prompt?.characterName || 'Unknown')
            })).slice(0, 20)
        }
    });

  } catch (error) {
    console.error("[BoldChoices Admin] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch admin dashboard" });
  }
});

module.exports = router;
