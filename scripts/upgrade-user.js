const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🔄 Prep101 User Upgrade Script');
console.log('==============================');

const { sequelize } = require('../database/connection');
const User = require('../models/User');

const upgradeUser = async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('❌ Usage: node scripts/upgrade-user.js <email> <new-access-level>');
      console.log('   access-level options: free, starter, premium, early-beta, premium-beta, admin-beta');
      console.log('   Example: node scripts/upgrade-user.js themrralston@gmail.com admin-beta');
      process.exit(1);
    }

    const [email, accessLevel] = args;

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Find the user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('❌ User not found with that email');
      process.exit(1);
    }

    console.log('👤 Found user:', user.name, `(${user.email})`);
    console.log('📊 Current access level:', user.subscription, user.isBetaTester ? 'BETA' : '');

    // Determine new subscription and limits based on access level
    let subscription, guidesLimit, isBetaTester, betaAccessLevel, betaStatus, betaFeatures;

    switch (accessLevel) {
      case 'free':
        subscription = 'free';
        guidesLimit = 1;
        isBetaTester = false;
        betaAccessLevel = null;
        betaStatus = null;
        betaFeatures = null;
        break;
      
      case 'starter':
        subscription = 'starter';
        guidesLimit = 3;
        isBetaTester = false;
        betaAccessLevel = null;
        betaStatus = null;
        betaFeatures = null;
        break;
      
      case 'premium':
        subscription = 'premium';
        guidesLimit = 10;
        isBetaTester = false;
        betaAccessLevel = null;
        betaStatus = null;
        betaFeatures = null;
        break;
      
      case 'early-beta':
        subscription = 'free';
        guidesLimit = 25;
        isBetaTester = true;
        betaAccessLevel = 'early';
        betaStatus = 'active';
        betaFeatures = ['early-access', 'priority-support'];
        break;
      
      case 'premium-beta':
        subscription = 'free';
        guidesLimit = 100;
        isBetaTester = true;
        betaAccessLevel = 'premium';
        betaStatus = 'active';
        betaFeatures = ['early-access', 'priority-support', 'advanced-rag', 'bulk-guide-generation'];
        break;
      
      case 'admin-beta':
        subscription = 'free';
        guidesLimit = 999;
        isBetaTester = true;
        betaAccessLevel = 'admin';
        betaStatus = 'active';
        betaFeatures = ['early-access', 'priority-support', 'advanced-rag', 'bulk-guide-generation', 'custom-methodology', 'advanced-analytics', 'api-access'];
        break;
      
      default:
        console.log('❌ Invalid access level. Use: free, starter, premium, early-beta, premium-beta, or admin-beta');
        process.exit(1);
    }

    // Update the user
    await user.update({
      subscription,
      guidesLimit,
      isBetaTester,
      betaAccessLevel,
      betaStatus,
      betaFeatures,
      betaStartedAt: isBetaTester ? new Date() : null
    });

    console.log('✅ User upgraded successfully!');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('💳 New Subscription:', user.subscription);
    console.log('📚 New Guides Limit:', user.guidesLimit);
    
    if (user.isBetaTester) {
      console.log('🔬 Beta Tester: Yes');
      console.log('🎯 Beta Level:', user.betaAccessLevel);
      console.log('✨ Beta Features:', user.betaFeatures.join(', '));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error upgrading user:', error.message);
    process.exit(1);
  }
};

upgradeUser();
