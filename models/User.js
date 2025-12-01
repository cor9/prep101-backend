const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../database/connection');

// If sequelize is not available, export a dummy model
if (!sequelize) {
  console.warn('⚠️  User model not available - database connection missing');
  module.exports = null;
  return;
}

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [6, 100] }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subscription: {
    type: DataTypes.ENUM('free', 'basic', 'premium'),
    defaultValue: 'free'
  },
  subscriptionId: DataTypes.STRING,
  customerId: DataTypes.STRING,
  // Stripe-specific fields
  stripeCustomerId: DataTypes.STRING,
  stripeSubscriptionId: DataTypes.STRING,
  stripePriceId: DataTypes.STRING,
  subscriptionStatus: {
    type: DataTypes.ENUM('active', 'canceled', 'past_due', 'unpaid', 'trialing'),
    defaultValue: 'active'
  },
  currentPeriodStart: DataTypes.DATE,
  currentPeriodEnd: DataTypes.DATE,
  defaultPaymentMethodId: DataTypes.STRING,
  guidesUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  guidesLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Free users get 0 guides by default, must use promo codes
  },
  // Beta tester fields
  isBetaTester: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  betaAccessLevel: {
    type: DataTypes.ENUM('none', 'early', 'premium', 'admin'),
    defaultValue: 'none'
  },
  betaInvitedBy: DataTypes.UUID, // Who invited this beta tester
  betaInvitedAt: DataTypes.DATE,
  betaStartedAt: DataTypes.DATE,
  betaFeedback: DataTypes.TEXT, // Store feedback from beta testers
  betaFeatures: {
    type: DataTypes.JSONB,
    defaultValue: [] // Array of beta features this user has access to
  },
  betaStatus: {
    type: DataTypes.ENUM('invited', 'active', 'completed', 'expired'),
    defaultValue: 'invited'
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
      
      // Set beta tester defaults
      if (user.isBetaTester) {
        user.betaStartedAt = new Date();
        user.betaStatus = 'active';
        
        // Give beta testers extended access
        if (user.betaAccessLevel === 'early') {
          user.guidesLimit = 25; // 25 guides per month for early beta testers
        } else if (user.betaAccessLevel === 'premium') {
          user.guidesLimit = 100; // 100 guides per month for premium beta testers
        } else if (user.betaAccessLevel === 'admin') {
          user.guidesLimit = 999; // Unlimited for admin beta testers
        }
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
      
      // Handle beta tester status changes
      if (user.changed('isBetaTester') && user.isBetaTester) {
        user.betaStartedAt = new Date();
        user.betaStatus = 'active';
      }
      
      if (user.changed('betaAccessLevel')) {
        // Update guides limit based on new beta access level
        if (user.betaAccessLevel === 'early') {
          user.guidesLimit = 25;
        } else if (user.betaAccessLevel === 'premium') {
          user.guidesLimit = 100;
        } else if (user.betaAccessLevel === 'admin') {
          user.guidesLimit = 999;
        }
      }
    }
  }
});

// Instance method to compare passwords
User.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Beta tester methods
User.prototype.isActiveBetaTester = function() {
  return this.isBetaTester && this.betaStatus === 'active';
};

User.prototype.hasBetaFeature = function(featureName) {
  return this.betaFeatures && this.betaFeatures.includes(featureName);
};

User.prototype.getBetaAccessDescription = function() {
  if (!this.isBetaTester) return 'No beta access';
  
  const descriptions = {
    'early': 'Early Beta Tester - 25 guides/month + early feature access',
    'premium': 'Premium Beta Tester - 100 guides/month + all beta features',
    'admin': 'Admin Beta Tester - Unlimited guides + admin features'
  };
  
  return descriptions[this.betaAccessLevel] || 'Beta Tester';
};

module.exports = User;
