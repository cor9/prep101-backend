/**
 * Script to create promo codes in the database
 * Run with: node scripts/create-promo-codes.js
 */

require('dotenv').config();
const { sequelize } = require('../database/connection');
const PromoCode = require('../models/PromoCode');

// Define the promo codes to create
const PROMO_CODES = [
  {
    code: 'WELCOME',
    description: 'Welcome promo - 1 free guide',
    type: 'free_guides',
    guidesGranted: 1,
    maxRedemptions: 1000,
    maxRedemptionsPerUser: 1,
    isActive: true,
    notes: 'Welcome code for new users'
  },
  {
    code: 'FREEGUIDE',
    description: 'Free guide promo',
    type: 'free_guides',
    guidesGranted: 1,
    maxRedemptions: 500,
    maxRedemptionsPerUser: 1,
    isActive: true,
    notes: 'General free guide code'
  },
  {
    code: 'TRYPREP',
    description: 'Try Prep101 - 2 free guides',
    type: 'free_guides',
    guidesGranted: 2,
    maxRedemptions: 500,
    maxRedemptionsPerUser: 1,
    isActive: true,
    notes: 'Trial code for new users'
  },
  {
    code: 'ACTORLIFE',
    description: 'Actor Life Special - 3 free guides',
    type: 'free_guides',
    guidesGranted: 3,
    maxRedemptions: 200,
    maxRedemptionsPerUser: 1,
    isActive: true,
    notes: 'Actor community promotion'
  },
  {
    code: 'VIP',
    description: 'VIP code - 5 free guides',
    type: 'free_guides',
    guidesGranted: 5,
    maxRedemptions: 100,
    maxRedemptionsPerUser: 1,
    isActive: true,
    notes: 'VIP/influencer code'
  }
];

async function createPromoCodes() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Ensure table exists
    await PromoCode.sync({ alter: true });
    console.log('✅ PromoCodes table ready\n');

    console.log('📝 Creating promo codes...\n');

    for (const codeData of PROMO_CODES) {
      const [code, created] = await PromoCode.findOrCreate({
        where: { code: codeData.code },
        defaults: codeData
      });

      if (created) {
        console.log(`✅ Created: ${codeData.code} (${codeData.guidesGranted} guide(s))`);
      } else {
        // Update existing code to make sure it's active
        await code.update({ isActive: true });
        console.log(`ℹ️  Already exists: ${codeData.code} (updated to active)`);
      }
    }

    console.log('\n🎉 Done! Here are your active promo codes:\n');

    const allCodes = await PromoCode.findAll({
      where: { isActive: true },
      order: [['guidesGranted', 'ASC']]
    });

    console.log('| Code          | Guides | Max Uses | Used  | Description                    |');
    console.log('|---------------|--------|----------|-------|--------------------------------|');

    for (const code of allCodes) {
      const codeStr = code.code.padEnd(13);
      const guidesStr = String(code.guidesGranted).padEnd(6);
      const maxStr = (code.maxRedemptions || '∞').toString().padEnd(8);
      const usedStr = String(code.currentRedemptions).padEnd(5);
      const descStr = (code.description || '').substring(0, 30);
      console.log(`| ${codeStr} | ${guidesStr} | ${maxStr} | ${usedStr} | ${descStr} |`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  createPromoCodes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createPromoCodes, PROMO_CODES };
