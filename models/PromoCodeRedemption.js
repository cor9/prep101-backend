const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const PromoCodeRedemption = sequelize.define('PromoCodeRedemption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  promoCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PromoCodes',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  // What was granted
  guidesGranted: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  discountPercent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Status
  redeemedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['promoCodeId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['promoCodeId', 'userId']
    }
  ]
});

// Set up associations
const User = require('./User');
const PromoCode = require('./PromoCode');

PromoCodeRedemption.belongsTo(PromoCode, { foreignKey: 'promoCodeId', as: 'promoCode' });
PromoCodeRedemption.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(PromoCodeRedemption, { foreignKey: 'userId', as: 'promoRedemptions' });

module.exports = PromoCodeRedemption;
