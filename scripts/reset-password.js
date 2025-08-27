const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🔑 Prep101 Password Reset Script');
console.log('================================');

const { sequelize } = require('../database/connection');
const User = require('../models/User');

const resetPassword = async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('❌ Usage: node scripts/reset-password.js <email> <new-password>');
      console.log('   Example: node scripts/reset-password.js corey@childactor101.com newpassword123');
      process.exit(1);
    }

    const [email, newPassword] = args;

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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the password directly in the database to avoid double-hashing
    await sequelize.query(
      'UPDATE "Users" SET password = ?, "updatedAt" = NOW() WHERE id = ?',
      {
        replacements: [hashedPassword, user.id],
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log('✅ Password reset successfully!');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('🔑 New password set (you can now log in)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  }
};

resetPassword();
