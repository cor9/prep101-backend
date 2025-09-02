const { sequelize } = require('../database/connection');
const User = require('../models/User');

async function migrateStripeFields() {
  try {
    console.log('🔄 Starting Stripe fields migration...');
    
    // Sync database to add new Stripe fields
    await sequelize.sync({ alter: true });
    
    console.log('✅ Database schema updated with Stripe fields');
    
    // Get all users
    const users = await User.findAll();
    console.log(`📊 Found ${users.length} users to migrate`);
    
    // Update users with default Stripe values
    let updatedCount = 0;
    for (const user of users) {
      const updates = {};
      
      // Set default values for new Stripe fields if they're null
      if (!user.stripeCustomerId) {
        updates.stripeCustomerId = null;
      }
      if (!user.stripeSubscriptionId) {
        updates.stripeSubscriptionId = null;
      }
      if (!user.stripePriceId) {
        updates.stripePriceId = null;
      }
      if (!user.subscriptionStatus) {
        updates.subscriptionStatus = 'active';
      }
      if (!user.currentPeriodStart) {
        updates.currentPeriodStart = new Date();
      }
      if (!user.currentPeriodEnd) {
        updates.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }
      if (!user.defaultPaymentMethodId) {
        updates.defaultPaymentMethodId = null;
      }
      
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
        updatedCount++;
        console.log(`✅ Updated user ${user.email}`);
      }
    }
    
    console.log(`🎉 Migration complete! Updated ${updatedCount} users`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateStripeFields();
}

module.exports = migrateStripeFields;
