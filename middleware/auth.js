const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Track failed login attempts
const failedAttempts = new Map();

// Clean up old failed attempts every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.timestamp > 60 * 60 * 1000) { // 1 hour
      failedAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!token) {
      // Log unauthorized access attempt
      console.log(`🔒 Unauthorized access attempt from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Get user from database to ensure they still exist
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      console.log(`🔒 Invalid token - user not found: ${decoded.userId} from IP: ${clientIP}`);
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user account is active (for future use)
    if (user.betaStatus === 'expired') {
      console.log(`🔒 Expired beta account access attempt: ${user.email} from IP: ${clientIP}`);
      return res.status(401).json({ message: 'Account access expired' });
    }

    // Log successful authentication
    console.log(`✅ Authenticated: ${user.email} (${user.id}) from IP: ${clientIP}, Path: ${req.path}`);

    // Add user info to request
    req.userId = decoded.userId;
    req.user = user;
    req.clientIP = clientIP;
    
    next();
  } catch (error) {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (error.name === 'JsonWebTokenError') {
      console.log(`🔒 Invalid token from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      console.log(`🔒 Expired token from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

// Export the failed attempts map for use in login routes
module.exports.failedAttempts = failedAttempts;
