require('dotenv').config();

const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    refreshExpiresIn: '7d'
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID
    }
  },

  // Server
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },

  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    paymentMax: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX) || 10
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.stripe.com"],
          frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      }
    }
  },

  // Subscription Plans
  plans: {
    free: {
      name: 'Free',
      price: 0,
      guidesLimit: 0,
      features: ['Use promo codes for free guides', 'Basic methodology access']
    },
    basic: {
      name: 'Basic',
      price: 9.99,
      guidesLimit: 10,
      features: ['10 guides per month', 'Full methodology access', 'Priority support']
    },
    premium: {
      name: 'Premium',
      price: 19.99,
      guidesLimit: 50,
      features: ['50 guides per month', 'Full methodology access', 'Priority support', 'Custom requests']
    }
  },

  // Validation
  validation: {
    password: {
      minLength: 6,
      maxLength: 100
    },
    name: {
      minLength: 2,
      maxLength: 100
    },
    email: {
      maxLength: 255
    }
  }
};

// Validation function to check required environment variables
const validateConfig = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('Please check your .env file or environment configuration');
    process.exit(1);
  }

  // Check Stripe configuration (optional for now)
  if (!config.stripe.secretKey) {
    console.warn('⚠️  Stripe secret key is missing - payment features will be disabled');
  }

  console.log('✅ Configuration validated successfully');
  console.log(`🔐 JWT Secret: ${config.jwt.secret ? 'Configured' : 'Missing'}`);
  console.log(`💳 Stripe: ${config.stripe.secretKey ? 'Configured' : 'Disabled (optional)'}`);
};

module.exports = { config, validateConfig };
