const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;
    try {
      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(409).json({ message: 'Email already registered' });

      const user = await User.create({ email, password, name });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
      res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription },
        token
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
      res.json({
        user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription },
        token
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

module.exports = router;
