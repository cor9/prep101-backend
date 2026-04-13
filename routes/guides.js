const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  runAdminQuery,
  tables,
  normalizeGuideRow,
} = require("../lib/supabaseAdmin");

const router = express.Router();

let Guide = null;
let auth = null;

try {
  Guide = require("../models/Guide");
} catch (error) {
  console.warn("⚠️ Guide model not available in routes/guides.js");
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

module.exports = router;
