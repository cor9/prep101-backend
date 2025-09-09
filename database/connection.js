const { Sequelize } = require('sequelize');
const path = require('path');

// Explicitly load .env from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('=== Database Connection Debug ===');
console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Please set DATABASE_URL in your environment variables');
  console.error('For Supabase, it should look like: postgresql://postgres:[password]@[host]:5432/postgres');
  process.exit(1);
}

// Parse the database URL to extract components
const url = new URL(databaseUrl);
const isSupabase = url.hostname.includes('supabase') || url.hostname.includes('supabase.co');

const sequelize = new Sequelize(databaseUrl, {
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
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };
