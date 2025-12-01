const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

// If sequelize is not available, export null
if (!sequelize) {
  console.warn('⚠️  PromoCode model not available - database connection missing');
  module.exports = null;
  return;
}

const PromoCode = sequelize.define('PromoCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isUppercase: function(value) {
        if (value !== value.toUpperCase()) {
          throw new Error('Promo code must be uppercase');
        }
      }
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('free_guides', 'discount', 'upgrade'),
    defaultValue: 'free_guides',
    allowNull: false
  },
  // For free_guides type
  guidesGranted: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 0,
      max: 100
    }
  },
  // For discount type
  discountPercent: {
    type: DataTypes.INTEGER,
    validate: {
      min: 0,
      max: 100
    }
  },
  // Usage limits
  maxRedemptions: {
    type: DataTypes.INTEGER,
    allowNull: true, // null = unlimited
    validate: {
      min: 1
    }
  },
  currentRedemptions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  maxRedemptionsPerUser: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  // Status and dates
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  startsAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // Metadata
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true // Reference to admin user who created it
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['code']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Instance methods
PromoCode.prototype.isValid = function() {
  const now = new Date();

  // Check if active
  if (!this.isActive) {
    return { valid: false, reason: 'Promo code is inactive' };
  }

  // Check if expired
  if (this.expiresAt && now > this.expiresAt) {
    return { valid: false, reason: 'Promo code has expired' };
  }

  // Check if not yet active
  if (this.startsAt && now < this.startsAt) {
    return { valid: false, reason: 'Promo code is not yet active' };
  }

  // Check max redemptions
  if (this.maxRedemptions && this.currentRedemptions >= this.maxRedemptions) {
    return { valid: false, reason: 'Promo code has reached maximum redemptions' };
  }

  return { valid: true };
};

PromoCode.prototype.canBeRedeemedBy = async function(userId) {
  // Check if code is valid
  const validation = this.isValid();
  if (!validation.valid) {
    return validation;
  }

  // Check per-user redemption limit
  const PromoCodeRedemption = require('./PromoCodeRedemption');
  const userRedemptions = await PromoCodeRedemption.count({
    where: {
      promoCodeId: this.id,
      userId: userId
    }
  });

  if (userRedemptions >= this.maxRedemptionsPerUser) {
    return {
      valid: false,
      reason: `You have already redeemed this code (limit: ${this.maxRedemptionsPerUser} per user)`
    };
  }

  return { valid: true };
};

PromoCode.prototype.redeem = async function(userId) {
  const PromoCodeRedemption = require('./PromoCodeRedemption');

  // Check if can be redeemed
  const canRedeem = await this.canBeRedeemedBy(userId);
  if (!canRedeem.valid) {
    throw new Error(canRedeem.reason);
  }

  // Create redemption record
  const redemption = await PromoCodeRedemption.create({
    promoCodeId: this.id,
    userId: userId,
    guidesGranted: this.guidesGranted,
    discountPercent: this.discountPercent
  });

  // Increment redemption count
  await this.increment('currentRedemptions');

  return redemption;
};

// Class methods
PromoCode.findByCode = async function(code) {
  return await PromoCode.findOne({
    where: {
      code: code.toUpperCase()
    }
  });
};

// Set up associations
const User = require('./User');

PromoCode.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

module.exports = PromoCode;
