/**
 * routes/guides.js
 * Guide list + PDF download endpoints.
 * Lean: just enough to show "Your Guides" with PDF links.
 */

const express = require('express');
const router = express.Router();

let Guide, auth;
try {
  Guide = require('../models/Guide');
} catch (e) {
  console.warn('⚠️  Guide model not available in routes/guides.js');
}
try {
  auth = require('../middleware/auth');
} catch (e) {
  // Fallback: try alternate path
  try { auth = require('../authMiddleware'); } catch {}
}

// ── GET /api/guides ───────────────────────────────────────────────────────────
// Returns all guides for the authenticated user.
// Optional ?type=prep101|reader101|bold_choices filter.
router.get('/', auth, async (req, res) => {
  if (!Guide) return res.status(503).json({ error: 'Database not available' });

  try {
    const where = { userId: req.user.id };
    if (req.query.type) where.guideType = req.query.type;

    const guides = await Guide.findAll({
      where,
      attributes: [
        'id', 'guideId', 'guideType',
        'characterName', 'productionTitle', 'productionType',
        'createdAt', 'isFavorite'
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    const formatted = guides.map(g => ({
      id:              g.id,
      guideId:         g.guideId,
      guideType:       g.guideType || 'prep101',
      title:           `${g.characterName} — ${g.productionTitle}`,
      characterName:   g.characterName,
      productionTitle: g.productionTitle,
      productionType:  g.productionType,
      createdAt:       g.createdAt,
      isFavorite:      g.isFavorite,
      pdfUrl:          `/api/guides/${g.id}/pdf`,
    }));

    return res.json({ guides: formatted, total: formatted.length });
  } catch (err) {
    console.error('❌ [guides/list] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch guides' });
  }
});

// ── GET /api/guides/:id/pdf ───────────────────────────────────────────────────
// Already handled in simple-backend-rag.js — this stub prevents 404 if
// routes are mounted before the main handler. The main handler wins.
router.get('/:id/pdf', auth, async (req, res) => {
  if (!Guide) return res.status(503).json({ error: 'Database not available' });

  try {
    const guide = await Guide.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!guide) return res.status(404).json({ error: 'Guide not found' });

    const filename = `guide_${guide.characterName}_${guide.productionTitle}`
      .replace(/[^a-z0-9_\-]/gi, '_')
      .toLowerCase();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
    return res.send(guide.generatedHtml);
  } catch (err) {
    console.error('❌ [guides/:id/pdf] Error:', err.message);
    return res.status(500).json({ error: 'Failed to download guide' });
  }
});

module.exports = router;
