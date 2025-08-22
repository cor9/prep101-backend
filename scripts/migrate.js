const path = require('path');

// Load environment variables from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🔄 Running database migrations...');
console.log('Environment check:');
console.log('- DATABASE_URL loaded:', !!process.env.DATABASE_URL);
console.log('- Working directory:', process.cwd());

const { sequelize } = require('../database/connection');
const User = require('../models/User');
const Guide = require('../models/Guide');

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Database synced successfully');
    
    console.log('🎉 Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

migrate();
