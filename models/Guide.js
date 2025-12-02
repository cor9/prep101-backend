const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User');

// If sequelize is not available, export null
if (!sequelize) {
  console.warn('⚠️  Guide model not available - database connection missing');
  module.exports = null;
  return;
}

const Guide = sequelize.define('Guide', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  guideId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  characterName: { type: DataTypes.STRING, allowNull: false },
  productionTitle: { type: DataTypes.STRING, allowNull: false },
  productionType: { type: DataTypes.STRING, allowNull: false },
  productionTone: { type: DataTypes.STRING, allowNull: true },
  stakes: { type: DataTypes.STRING, allowNull: true },
  roleSize: { type: DataTypes.STRING, allowNull: false },
  genre: { type: DataTypes.STRING, allowNull: false },
  storyline: DataTypes.TEXT,
  characterBreakdown: DataTypes.TEXT,
  callbackNotes: DataTypes.TEXT,
  focusArea: DataTypes.STRING,
  sceneText: { type: DataTypes.TEXT, allowNull: false },
  generatedHtml: { type: DataTypes.TEXT, allowNull: false },
  childGuideRequested: { type: DataTypes.BOOLEAN, defaultValue: false },
  childGuideHtml: DataTypes.TEXT,
  childGuideCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  shareUrl: DataTypes.STRING,
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: false },
  viewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  isFavorite: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId', 'createdAt'] },
    { fields: ['guideId'] }
  ]
});

User.hasMany(Guide, { foreignKey: 'userId', as: 'guides' });
Guide.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = Guide;
