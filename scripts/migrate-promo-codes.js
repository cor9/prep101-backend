/**
 * Migration script for promo code system
 * Run with: node scripts/migrate-promo-codes.js
 */

require('dotenv').config();
const { sequelize } = require('../database/connection');
const User = require('../models/User');
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');

async function runMigration() {
  try {
    console.log('🔄 Starting promo code migration...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Create tables
    console.log('📝 Creating promo code tables...');
    await PromoCode.sync({ alter: true });
    console.log('✅ PromoCodes table created/updated');

    await PromoCodeRedemption.sync({ alter: true });
    console.log('✅ PromoCodeRedemptions table created/updated');

    // Update existing users to have 0 guides limit if they're on free plan
    console.log('📝 Updating existing free users...');
    const [updatedCount] = await User.update(
      { guidesLimit: 0 },
      {
        where: {
          subscription: 'free',
          guidesLimit: 1
        }
      }
    );
    console.log(`✅ Updated ${updatedCount} free users to 0 guides limit`);

    // Create a sample promo code for testing
    const sampleCode = await PromoCode.findOrCreate({
      where: { code: 'WELCOME2024' },
      defaults: {
        code: 'WELCOME2024',
        description: 'Welcome promo - 1 free guide',
        type: 'free_guides',
        guidesGranted: 1,
        maxRedemptions: 100,
        maxRedemptionsPerUser: 1,
        isActive: true,
        notes: 'Sample promo code created during migration'
      }
    });

    if (sampleCode[1]) {
      console.log('✅ Sample promo code created: WELCOME2024');
    } else {
      console.log('ℹ️  Sample promo code already exists: WELCOME2024');
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test promo code redemption with: WELCOME2024');
    console.log('2. Create more promo codes via the admin API');
    console.log('3. Update your frontend to include promo code redemption UI');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
