const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/guides (protected)
router.get('/', auth, async (req, res) => {
  res.json({ guides: [] });
});

module.exports = router;
