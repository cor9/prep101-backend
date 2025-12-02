const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const User = require('../models/User');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.warn('⚠️  Supabase admin credentials missing - backend will fall back to legacy JWT auth');
}

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

async function findOrCreateUserFromSupabase(supabaseUser) {
  if (!supabaseUser || !supabaseUser.email) return null;

  const email = supabaseUser.email.toLowerCase();
  let user = await User.findOne({ where: { email } });

  if (!user) {
    const derivedName =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email.split('@')[0] ||
      'Prep101 Actor';

    const randomPassword = crypto.randomBytes(32).toString('hex');

    user = await User.create({
      email,
      password: randomPassword,
      name: derivedName,
      subscription: 'free',
      guidesLimit: 1
    });
  }

  return user;
}

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!token) {
      // Log unauthorized access attempt
      console.log(`🔒 Unauthorized access attempt from IP: ${clientIP}, Path: ${req.path}`);
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Prefer Supabase token validation when configured
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data?.user) {
          const user = await findOrCreateUserFromSupabase(data.user);
          if (user) {
            console.log(`✅ Supabase auth: ${user.email} (${user.id}) from IP: ${clientIP}, Path: ${req.path}`);
            req.userId = user.id;
            req.user = user;
            req.clientIP = clientIP;
            return next();
          }
        }
      } catch (supabaseError) {
        console.error('❌ Supabase token validation failed:', supabaseError.message || supabaseError);
      }
    }

    // Fallback to legacy JWT validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

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
