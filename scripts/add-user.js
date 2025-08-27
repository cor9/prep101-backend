const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('👤 Prep101 User Management Script');
console.log('================================');

const { sequelize } = require('../database/connection');
const User = require('../models/User');

const addUser = async () => {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log('❌ Usage: node scripts/add-user.js <email> <name> <password> [access-level]');
      console.log('   access-level options: free, starter, premium, early-beta, premium-beta, admin-beta');
      console.log('   Example: node scripts/add-user.js john@example.com "John Doe" password123 early-beta');
      process.exit(1);
    }

    const [email, name, password, accessLevel = 'free'] = args;

    // Debug: Log the arguments received
    console.log('🔍 Debug - Arguments received:');
    console.log('  Email:', email);
    console.log('  Name:', name);
    console.log('  Password:', password ? '[HIDDEN]' : 'undefined');
    console.log('  Access Level:', accessLevel);
    console.log('  Total args:', args.length);

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log('❌ User already exists with that email');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Determine subscription and limits based on access level
    let subscription, guidesLimit, isBetaTester, betaAccessLevel, betaStatus, betaFeatures;

    switch (accessLevel) {
      case 'free':
        subscription = 'free';
        guidesLimit = 1;
        isBetaTester = false;
        break;
      
      case 'starter':
        subscription = 'starter';
        guidesLimit = 3;
        isBetaTester = false;
        break;
      
      case 'premium':
        subscription = 'premium';
        guidesLimit = 10;
        isBetaTester = false;
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

    // Create user
    const user = await User.create({
      email,
      name,
      password: hashedPassword,
      subscription,
      guidesLimit,
      guidesUsed: 0,
      isBetaTester,
      betaAccessLevel,
      betaStatus,
      betaFeatures,
      betaStartedAt: isBetaTester ? new Date() : null
    });

    console.log('✅ User created successfully!');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('💳 Subscription:', user.subscription);
    console.log('📚 Guides Limit:', user.guidesLimit);
    
    if (user.isBetaTester) {
      console.log('🔬 Beta Tester: Yes');
      console.log('🎯 Beta Level:', user.betaAccessLevel);
      console.log('✨ Beta Features:', user.betaFeatures.join(', '));
    }

    console.log('\n🎉 User can now log in at https://childactor101.sbs/login');
    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to create user:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

addUser();
