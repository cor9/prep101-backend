const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  runAdminQuery,
  tables,
  normalizeGuideRow,
  normalizeUserRow,
} = require("../lib/supabaseAdmin");
const {
  buildPrep101Usage,
  buildReader101Usage,
} = require("../services/prep101EntitlementsService");

const router = express.Router();

let Guide = null;
let User = null;
let auth = null;

try {
  Guide = require("../models/Guide");
} catch (error) {
  console.warn("⚠️ Guide model not available in routes/guides.js");
}

try {
  User = require("../models/User");
} catch (error) {
  console.warn("⚠️ User model not available in routes/guides.js");
}

try {
  auth = require("../middleware/auth");
} catch (error) {
  console.warn("⚠️ Auth middleware not available in routes/guides.js");
}

function unwrapGuide(record) {
  return record?.dataValues ? record.dataValues : record;
}

function sanitizeFilePart(value = "") {
  return String(value)
    .trim()
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function buildFilenameBase(guide) {
  return [
    guide.guideType || "guide",
    sanitizeFilePart(guide.characterName || "actor"),
    sanitizeFilePart(guide.productionTitle || "untitled"),
  ]
    .filter(Boolean)
    .join("_");
}

function wrapGuideHtml(rawHtml, guide = {}) {
  const content = String(rawHtml || "");
  if (content.includes("<html") && content.includes("</html>")) {
    return content;
  }

  const titleBits = [guide.characterName, guide.productionTitle].filter(Boolean);
  const title = titleBits.length ? titleBits.join(" • ") : "Child Actor 101 Guide";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
${content}
</body>
</html>`;
}

async function listGuidesForUser(userId, guideType = null) {
  if (Guide) {
    const where = { userId };
    if (guideType) where.guideType = guideType;

    const guides = await Guide.findAll({
      where,
      attributes: [
        "id",
        "guideId",
        "guideType",
        "characterName",
        "productionTitle",
        "productionType",
        "createdAt",
        "updatedAt",
        "isFavorite",
      ],
      order: [["createdAt", "DESC"]],
      limit: 100,
    });

    return guides.map(unwrapGuide);
  }

  const result = await runAdminQuery(async (client) => {
    let query = client
      .from(tables.guides)
      .select(
        "id, guideId, guideType, characterName, productionTitle, productionType, createdAt, updatedAt, isFavorite"
      )
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(100);

    if (guideType) query = query.eq("guideType", guideType);

    const response = await query;
    if (response.error) throw response.error;
    return response.data || [];
  }, []);

  return (result || []).map(normalizeGuideRow);
}

async function fetchGuideForUser(id, userId) {
  if (Guide) {
    const guide = await Guide.findOne({
      where: { id, userId },
    });
    return unwrapGuide(guide);
  }

  const result = await runAdminQuery(async (client) => {
    const response = await client
      .from(tables.guides)
      .select("*")
      .eq("id", id)
      .eq("userId", userId)
      .maybeSingle();

    if (response.error) throw response.error;
    return response.data;
  }, null);

  return normalizeGuideRow(result);
}

function assessGeneratedGuideQuality(html = "") {
  const content = String(html || "");
  const lower = content.toLowerCase();
  const missing = [];
  if (content.length < 2500) missing.push("guide is too short");
  if (!/Final Coach Note|Closing Coach'?s?\s*Note|FINAL PEP TALK/i.test(content)) {
    missing.push("final coach note");
  }
  if (!/Pre-Submission Checklist/i.test(content)) missing.push("pre-submission checklist");
  if (!/Two[- ]Take|Take\s*A\b|Take\s*B\b|Take\s*1\b|Take\s*2\b/i.test(content)) {
    missing.push("two-take strategy");
  }
  if (
    lower.includes("no usable dramatic content detected") ||
    lower.includes("script pages are not available") ||
    lower.includes("actual script pages are not available") ||
    lower.includes("resubmit with the correct pdf") ||
    ((lower.match(/not stated in sides/g) || []).length >= 8)
  ) {
    missing.push("source-specific coaching");
  }
  return { valid: missing.length === 0, missing };
}

async function persistUserRefund(req, guideType) {
  const userId = req.user.id;

  if (User) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");
    if (guideType === "reader101") {
      await user.update({ reader101Credits: Number(user.reader101Credits || 0) + 1 });
    } else {
      await user.update({ prep101TopUpCredits: Number(user.prep101TopUpCredits || 0) + 1 });
    }
    await user.reload();
    return user;
  }

  const row = await runAdminQuery(async (client) => {
    const field = guideType === "reader101" ? "reader101Credits" : "prep101TopUpCredits";
    const { data: current, error: fetchError } = await client
      .from(tables.users)
      .select("*")
      .eq("id", userId)
      .single();
    if (fetchError) throw fetchError;
    const { data, error } = await client
      .from(tables.users)
      .update({ [field]: Number(current?.[field] || 0) + 1 })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });

  return normalizeUserRow(row);
}

async function deleteGuideForUser(id, userId) {
  if (Guide) {
    const guide = await Guide.findOne({ where: { id, userId } });
    if (guide) await guide.destroy();
    return;
  }

  await runAdminQuery(async (client) => {
    const { error } = await client
      .from(tables.guides)
      .delete()
      .eq("id", id)
      .eq("userId", userId);
    if (error) throw error;
  });
}

async function renderPdfBuffer(guide) {
  let adobeSdk = null;
  try {
    adobeSdk = require("@adobe/pdfservices-node-sdk");
  } catch (error) {
    throw new Error(
      "PDF export is temporarily unavailable: Adobe PDF SDK is not installed in this runtime"
    );
  }

  const {
    ServicePrincipalCredentials,
    PDFServices,
    MimeType,
    HTMLToPDFJob,
    HTMLToPDFResult,
    PageLayout,
    HTMLToPDFParams,
  } = adobeSdk;

  const credentialsPath = path.join(process.cwd(), "pdfservices-api-credentials.json");
  if (!fs.existsSync(credentialsPath)) {
    throw new Error("Adobe PDF credentials file is missing");
  }

  const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const credentials = new ServicePrincipalCredentials({
    clientId: credentialsData.client_credentials.client_id,
    clientSecret: credentialsData.client_credentials.client_secret,
  });

  const pdfServices = new PDFServices({ credentials });
  const wrappedHtml = wrapGuideHtml(guide.generatedHtml, guide);
  const tempHtmlPath = path.join(os.tmpdir(), `guide_${guide.id}_${Date.now()}.html`);

  fs.writeFileSync(tempHtmlPath, wrappedHtml, "utf8");

  try {
    const inputAsset = await pdfServices.upload({
      readStream: fs.createReadStream(tempHtmlPath),
      mimeType: MimeType.HTML,
    });

    const pageLayout = new PageLayout({
      pageHeight: 11,
      pageWidth: 8.5,
    });

    const params = new HTMLToPDFParams({
      pageLayout,
      includeHeaderFooter: false,
    });

    const job = new HTMLToPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: HTMLToPDFResult,
    });

    const resultAsset = pdfServicesResponse.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    const chunks = [];
    await new Promise((resolve, reject) => {
      streamAsset.readStream.on("data", (chunk) => chunks.push(chunk));
      streamAsset.readStream.on("end", resolve);
      streamAsset.readStream.on("error", reject);
    });

    return Buffer.concat(chunks);
  } finally {
    fs.unlink(tempHtmlPath, () => {});
  }
}

function formatGuideListItem(guide) {
  return {
    id: guide.id,
    guideId: guide.guideId,
    guideType: guide.guideType || "prep101",
    title: `${guide.characterName} — ${guide.productionTitle}`,
    characterName: guide.characterName,
    productionTitle: guide.productionTitle,
    productionType: guide.productionType,
    createdAt: guide.createdAt,
    updatedAt: guide.updatedAt || guide.createdAt,
    isFavorite: Boolean(guide.isFavorite),
    viewUrl: `/guide/${guide.id}`,
    htmlUrl: `/api/guides/${guide.id}/html`,
    pdfUrl: `/api/guides/${guide.id}/pdf`,
  };
}

router.get("/", auth, async (req, res) => {
  try {
    const guides = await listGuidesForUser(req.user.id, req.query.type || null);
    const formatted = guides.map(formatGuideListItem);
    return res.json({ guides: formatted, total: formatted.length });
  } catch (error) {
    console.error("❌ [guides/list] Error:", error.message);
    return res.status(500).json({ error: "Failed to fetch guides" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const guide = await fetchGuideForUser(req.params.id, req.user.id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    return res.json({
      guide: {
        ...guide,
        generatedHtml: wrapGuideHtml(guide.generatedHtml, guide),
        htmlUrl: `/api/guides/${guide.id}/html`,
        pdfUrl: `/api/guides/${guide.id}/pdf`,
      },
    });
  } catch (error) {
    console.error("❌ [guides/get] Error:", error.message);
    return res.status(500).json({ error: "Failed to load guide" });
  }
});

router.get("/:id/html", auth, async (req, res) => {
  try {
    const guide = await fetchGuideForUser(req.params.id, req.user.id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    const filename = `${buildFilenameBase(guide)}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(wrapGuideHtml(guide.generatedHtml, guide));
  } catch (error) {
    console.error("❌ [guides/html] Error:", error.message);
    return res.status(500).json({ error: "Failed to download HTML" });
  }
});

router.get("/:id/pdf", auth, async (req, res) => {
  try {
    const guide = await fetchGuideForUser(req.params.id, req.user.id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    const pdfBuffer = await renderPdfBuffer(guide);
    const filename = `${buildFilenameBase(guide)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ [guides/pdf] Error:", error.message);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.post("/:id/reclaim-credit", auth, async (req, res) => {
  try {
    const guide = await fetchGuideForUser(req.params.id, req.user.id);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    const guideType = guide.guideType || "prep101";
    if (!["prep101", "reader101"].includes(guideType)) {
      return res.status(400).json({
        error: "Credit reclaim is only available for Prep101 and Reader101 guides.",
      });
    }

    const quality = assessGeneratedGuideQuality(guide.generatedHtml);
    const isAdmin = req.user?.betaAccessLevel === "admin";
    const force = isAdmin && req.body?.force === true;
    if (quality.valid && !force) {
      return res.status(400).json({
        error:
          "This guide does not look incomplete. Contact support if you still need a credit restored.",
        quality,
      });
    }

    const updatedUser = await persistUserRefund(req, guideType);
    await deleteGuideForUser(req.params.id, req.user.id);

    return res.json({
      success: true,
      message: "Credit restored and incomplete guide removed.",
      reclaimed: guideType === "reader101" ? "reader101Credit" : "prep101TopUpCredit",
      usage:
        guideType === "reader101"
          ? buildReader101Usage(updatedUser)
          : buildPrep101Usage(updatedUser),
      quality,
    });
  } catch (error) {
    console.error("❌ [guides/reclaim-credit] Error:", error.message);
    return res.status(500).json({ error: "Failed to reclaim guide credit" });
  }
});

module.exports = router;
