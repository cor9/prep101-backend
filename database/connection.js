const { Sequelize } = require('sequelize');
const path = require('path');

// Explicitly load .env from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('=== Database Connection Debug ===');
console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
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
