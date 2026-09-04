// Scheduled maintenance endpoints, invoked by Vercel Cron.
//
// These are unauthenticated in the user sense — there is no actor behind the
// request — so they are gated on a shared secret instead, and they fail closed:
// with no CRON_SECRET configured the endpoint refuses to run at all rather than
// leaving a route that writes to the database open to the internet.

const express = require("express");
const { recoverStrandedGuides } = require("../services/guideRecovery");

const router = express.Router();

function timingSafeEqual(a, b) {
  const crypto = require("crypto");
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authorizeCron(req, res, next) {
  // Env vars on this project have a history of arriving with trailing
  // newlines - SUPABASE_URL still does, which is why lib/supabaseAdmin.js
  // carries normalizeCredential. It matters more here than there: an HTTP
  // header cannot hold a raw newline, so a secret stored as "abc\n" would be
  // sent by Vercel Cron as "abc" and never match itself. The sweep would then
  // 401 on every run and silently stop protecting anything.
  const secret = String(process.env.CRON_SECRET || "").trim();

  if (!secret) {
    console.error(
      "[Cron] CRON_SECRET is not set; refusing to run scheduled guide recovery."
    );
    return res.status(503).json({
      error: "Cron is not configured on this deployment.",
    });
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var is
  // present on the project.
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || !timingSafeEqual(token, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

/**
 * Sweep for guides that generated but were never saved, and finalize them.
 *
 * The worker does this itself on completion and the polling endpoint does it
 * while someone is watching. This is the net under both: it catches guides
 * stranded by a worker running stale code, a worker that is down, or a browser
 * closed at the wrong moment. On a healthy system it finds nothing and says so.
 *
 * ?dryRun=1 reports what it would do without writing.
 */
router.get("/finalize-guides", authorizeCron, async (req, res) => {
  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";

  try {
    const summary = await recoverStrandedGuides({
      dryRun,
      source: "vercel-cron",
    });

    if (summary.found > 0) {
      console.log(
        `[Cron] Guide recovery: scanned ${summary.scanned}, found ${summary.found} stranded, ` +
          `recovered ${summary.recovered}, skipped ${summary.skipped}, deferred ${summary.deferred}`
      );
      for (const r of summary.results) {
        console.log(
          `[Cron]   job ${r.jobId} ${r.guideType} "${r.characterName} — ${r.productionTitle}" ` +
            `-> ${r.outcome.finalized ? (r.outcome.alreadyPersisted ? "already saved" : "recovered") : r.outcome.reason}`
        );
      }
    }

    return res.json({ ok: true, dryRun, ...summary });
  } catch (error) {
    console.error("[Cron] Guide recovery failed:", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
