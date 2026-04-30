const { sequelize } = require('../database/connection');
const PromoCode = require('../models/PromoCode');

async function createPromoCodes() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. One free guide
    try {
      const code1 = await PromoCode.create({
        code: 'FREE101',
        description: 'One free guide for new users',
        type: 'free_guides',
        guidesGranted: 1,
        maxRedemptions: null,
        maxRedemptionsPerUser: 1,
        isActive: true
      });
      console.log('✅ Created:', code1.code);
    } catch (e) {
      console.log('⚠️ Could not create FREE101:', e.message);
    }

    // 2. Unlimited beta test code
    try {
      const code2 = await PromoCode.create({
        code: 'BETATESTER',
        description: 'Unlimited guides for beta testers',
        type: 'free_guides',
        guidesGranted: 50, // They can redeem it multiple times to get 50 at a time
        maxRedemptions: null,
        maxRedemptionsPerUser: 100, // 5000 guides total per user
        isActive: true
      });
      console.log('✅ Created:', code2.code);
    } catch (e) {
      console.log('⚠️ Could not create BETATESTER:', e.message);
    }

    // 3. Redeem for bad or incomplete guides
    try {
      const code3 = await PromoCode.create({
        code: 'RESTOREGUIDE',
        description: 'Refund for bad/incomplete guide',
        type: 'free_guides',
        guidesGranted: 1,
        maxRedemptions: null,
        maxRedemptionsPerUser: 10,
        isActive: true
      });
      console.log('✅ Created:', code3.code);
    } catch (e) {
      console.log('⚠️ Could not create RESTOREGUIDE:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

createPromoCodes();
