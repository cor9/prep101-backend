const User = require('../models/User');
const { Op } = require('sequelize');

class BetaTesterService {
  constructor() {
    this.betaFeatures = {
      'advanced-rag': 'Advanced RAG with custom methodology',
      'bulk-guide-generation': 'Generate multiple guides at once',
      'custom-methodology': 'Upload custom methodology files',
      'advanced-analytics': 'Detailed guide performance analytics',
      'api-access': 'Direct API access for integrations',
      'priority-support': 'Priority customer support',
      'early-access': 'Access to features before public release'
    };
  }

  // Helper method to check if User model is available
  _checkUserModel() {
    if (!User) {
      throw new Error('Database service unavailable. User model not loaded.');
    }
  }

  // Invite a new beta tester
  async inviteBetaTester(email, name, accessLevel = 'early', invitedBy = null, features = []) {
    try {
      this._checkUserModel();
      // Check if user already exists
      let user = await User.findOne({ where: { email } });
      
      if (user) {
        // Update existing user to beta tester
        await user.update({
          isBetaTester: true,
          betaAccessLevel: accessLevel,
          betaInvitedBy: invitedBy,
          betaInvitedAt: new Date(),
          betaStatus: 'invited',
          betaFeatures: features.length > 0 ? features : this.getDefaultFeatures(accessLevel)
        });
      } else {
        // Create new beta tester user
        user = await User.create({
          email,
          name,
          password: this.generateTemporaryPassword(),
          isBetaTester: true,
          betaAccessLevel: accessLevel,
          betaInvitedBy: invitedBy,
          betaInvitedAt: new Date(),
          betaStatus: 'invited',
          betaFeatures: features.length > 0 ? features : this.getDefaultFeatures(accessLevel)
        });
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          betaAccessLevel: user.betaAccessLevel,
          betaStatus: user.betaStatus,
          betaFeatures: user.betaFeatures
        },
        temporaryPassword: user.password // Only for new users
      };
    } catch (error) {
      console.error('Error inviting beta tester:', error);
      throw new Error('Failed to invite beta tester');
    }
  }

  // Get default features for each access level
  getDefaultFeatures(accessLevel) {
    const featureMap = {
      'early': ['early-access', 'priority-support'],
      'premium': ['early-access', 'priority-support', 'advanced-rag', 'bulk-guide-generation'],
      'admin': ['early-access', 'priority-support', 'advanced-rag', 'bulk-guide-generation', 'custom-methodology', 'advanced-analytics', 'api-access']
    };
    
    return featureMap[accessLevel] || ['early-access'];
  }

  // Generate temporary password for new beta testers
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Activate beta tester (when they first log in)
  async activateBetaTester(userId) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user || !user.isBetaTester) {
        throw new Error('User is not a beta tester');
      }

      await user.update({
        betaStatus: 'active',
        betaStartedAt: new Date()
      });

      return {
        success: true,
        message: 'Beta tester activated successfully',
        betaAccessLevel: user.betaAccessLevel,
        guidesLimit: user.guidesLimit
      };
    } catch (error) {
      console.error('Error activating beta tester:', error);
      throw error;
    }
  }

  // Get all beta testers
  async getAllBetaTesters(status = null) {
    try {
      this._checkUserModel();
      const whereClause = { isBetaTester: true };
      if (status) {
        whereClause.betaStatus = status;
      }

      const betaTesters = await User.findAll({
        where: whereClause,
        attributes: [
          'id', 'email', 'name', 'betaAccessLevel', 'betaStatus',
          'betaInvitedAt', 'betaStartedAt', 'guidesUsed', 'guidesLimit',
          'betaFeatures', 'createdAt'
        ],
        order: [['betaInvitedAt', 'DESC']]
      });

      return betaTesters;
    } catch (error) {
      console.error('Error fetching beta testers:', error);
      throw new Error('Failed to fetch beta testers');
    }
  }

  // Get beta tester statistics
  async getBetaTesterStats() {
    try {
      this._checkUserModel();
      const stats = await User.findAll({
        where: { isBetaTester: true },
        attributes: [
          'betaAccessLevel',
          'betaStatus',
          'guidesUsed',
          'createdAt'
        ]
      });

      const totalBetaTesters = stats.length;
      const activeBetaTesters = stats.filter(u => u.betaStatus === 'active').length;
      const totalGuidesGenerated = stats.reduce((sum, u) => sum + (u.guidesUsed || 0), 0);
      
      const accessLevelStats = stats.reduce((acc, user) => {
        const level = user.betaAccessLevel;
        if (!acc[level]) acc[level] = { count: 0, guidesUsed: 0 };
        acc[level].count++;
        acc[level].guidesUsed += (user.guidesUsed || 0);
        return acc;
      }, {});

      const statusStats = stats.reduce((acc, user) => {
        const status = user.betaStatus;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        totalBetaTesters,
        activeBetaTesters,
        totalGuidesGenerated,
        accessLevelStats,
        statusStats,
        averageGuidesPerTester: totalBetaTesters > 0 ? Math.round(totalGuidesGenerated / totalBetaTesters * 100) / 100 : 0
      };
    } catch (error) {
      console.error('Error fetching beta tester stats:', error);
      throw new Error('Failed to fetch beta tester statistics');
    }
  }

  // Update beta tester access level
  async updateBetaTesterAccess(userId, newAccessLevel, newFeatures = null) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user || !user.isBetaTester) {
        throw new Error('User is not a beta tester');
      }

      const updates = { betaAccessLevel: newAccessLevel };
      if (newFeatures) {
        updates.betaFeatures = newFeatures;
      }

      await user.update(updates);

      return {
        success: true,
        message: 'Beta tester access updated successfully',
        user: {
          id: user.id,
          email: user.email,
          betaAccessLevel: user.betaAccessLevel,
          betaFeatures: user.betaFeatures,
          guidesLimit: user.guidesLimit
        }
      };
    } catch (error) {
      console.error('Error updating beta tester access:', error);
      throw error;
    }
  }

  // Collect feedback from beta testers
  async submitFeedback(userId, feedback) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user || !user.isBetaTester) {
        throw new Error('User is not a beta tester');
      }

      await user.update({
        betaFeedback: feedback
      });

      return {
        success: true,
        message: 'Feedback submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // End beta testing for a user
  async endBetaTesting(userId) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user || !user.isBetaTester) {
        throw new Error('User is not a beta tester');
      }

      // Reset to free user with standard limits
      await user.update({
        isBetaTester: false,
        betaStatus: 'completed',
        guidesLimit: 1,
        guidesUsed: Math.min(user.guidesUsed, 1) // Cap at 1 if they were over
      });

      return {
        success: true,
        message: 'Beta testing ended successfully',
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          guidesLimit: user.guidesLimit
        }
      };
    } catch (error) {
      console.error('Error ending beta testing:', error);
      throw error;
    }
  }

  // Get available beta features
  getAvailableFeatures() {
    return this.betaFeatures;
  }

  // Check if user has access to a specific beta feature
  async hasFeatureAccess(userId, featureName) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user) return false;
      
      return user.isActiveBetaTester() && user.hasBetaFeature(featureName);
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Get beta tester dashboard data
  async getBetaTesterDashboard(userId) {
    try {
      this._checkUserModel();
      const user = await User.findByPk(userId);
      if (!user || !user.isBetaTester) {
        throw new Error('User is not a beta tester');
      }

      return {
        isBetaTester: true,
        betaAccessLevel: user.betaAccessLevel,
        betaStatus: user.betaStatus,
        betaFeatures: user.betaFeatures,
        betaStartedAt: user.betaStartedAt,
        guidesLimit: user.guidesLimit,
        guidesRemaining: Math.max(0, user.guidesLimit - user.guidesUsed),
        accessDescription: user.getBetaAccessDescription(),
        availableFeatures: this.betaFeatures
      };
    } catch (error) {
      console.error('Error getting beta tester dashboard:', error);
      throw error;
    }
  }
}

module.exports = BetaTesterService;
