const express = require('express');
const router = express.Router();

// POST /api/upload/pdf
router.post('/pdf', (req, res) => {
  res.json({ ok: true, message: 'Stub upload endpoint works' });
});

module.exports = router;
