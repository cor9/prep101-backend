const { Sequelize } = require('sequelize');
const path = require('path');

// Explicitly load .env from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('=== Database Connection Debug ===');
console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('DATABASE_URL first 50 chars:', process.env.DATABASE_URL?.substring(0, 50));
console.log('VERCEL environment:', !!process.env.VERCEL);
console.log('NODE_ENV:', process.env.NODE_ENV);

const databaseUrl = process.env.DATABASE_URL?.trim(); // Trim whitespace/newlines

let sequelize = null;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('⚠️  Database-dependent features will be unavailable');
  console.error('For Supabase, it should look like: postgresql://postgres:[password]@[host]:5432/postgres');

  // In serverless, don't crash - just warn
  // Routes will handle missing database connection gracefully
  if (!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    // Only exit in local development
    process.exit(1);
  }
  } else {
  try {
    console.log('🔧 Attempting to create Sequelize connection...');
    
    // Check if pg package is available BEFORE creating Sequelize instance
    let pgAvailable = false;
    try {
      require.resolve('pg');
      pgAvailable = true;
      console.log('✅ pg package is available');
    } catch (pgError) {
      console.error('❌ pg package not found in node_modules');
      console.error('❌ This is likely a Vercel build issue. The pg package may not be installed during build.');
      console.error('❌ Check Vercel build logs to ensure npm install completes successfully.');
      console.error('❌ Database connection will be unavailable. Routes will use Supabase fallback if configured.');
      // Don't throw - just set sequelize to null so the app can continue
      sequelize = null;
      return;
    }
    
    // Parse the database URL to extract components
    const url = new URL(databaseUrl);
    const isSupabase = url.hostname.includes('supabase') || url.hostname.includes('supabase.co');
    console.log('🔧 Database hostname:', url.hostname);
    console.log('🔧 Is Supabase:', isSupabase);

    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: isSupabase ? {
          require: true,
          rejectUnauthorized: false
        } : {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      // Add retry logic for serverless
      retry: {
        max: 3,
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/
        ]
      }
    });
    console.log('✅ Sequelize instance created');
    
    // Test connection immediately in serverless environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('🔧 Testing database connection in serverless environment...');
      sequelize.authenticate()
        .then(() => {
          console.log('✅ Database connection verified on startup');
        })
        .catch((err) => {
          console.error('❌ Database connection failed on startup:', err.message);
          console.error('❌ Error code:', err.code);
          console.error('❌ Error name:', err.name);
          console.error('❌ This will cause models to be null. Check DATABASE_URL format and network access.');
          // Don't set sequelize to null - keep the instance for retry
        });
    }
  } catch (error) {
    console.error('❌ Failed to create Sequelize instance:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ DATABASE_URL format issue - check for whitespace/newlines');
    // Don't throw - let routes handle null sequelize
  }
}

const testConnection = async () => {
  if (!sequelize) {
    console.error('❌ Cannot test connection - sequelize instance not available');
    return false;
  }

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);

    // In serverless, don't exit - just return false
    if (!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
      // Only exit in local development
      process.exit(1);
    }
    return false;
  }
};

module.exports = { sequelize, testConnection };
