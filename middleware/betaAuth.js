// Beta feature gating. Use after the JWT `auth` middleware so req.user is set.
//
//   router.post('/thing', auth, requireBetaFeature('linecue_rehearsal'), handler)
//
// Access requires an explicit entry in the user's betaFeatures array — being a
// beta tester (even at the admin level) is not enough on its own, because these
// features cost real API spend per request.

const LINECUE_REHEARSAL_FEATURE = 'linecue_rehearsal';

const REVOKED_BETA_STATUSES = new Set(['expired', 'completed']);

function getBetaFeatures(user) {
  const raw = user?.betaFeatures;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function userHasBetaFeature(user, featureName) {
  if (!user || !user.isBetaTester) return false;
  if (REVOKED_BETA_STATUSES.has(user.betaStatus)) return false;
  return getBetaFeatures(user).includes(featureName);
}

function requireBetaFeature(featureName) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!userHasBetaFeature(req.user, featureName)) {
        console.log(
          `🔒 Beta feature "${featureName}" denied for ${req.user.email || req.userId}, Path: ${req.path}`
        );
        return res.status(403).json({
          message: 'This feature is in private beta and is not enabled for your account.',
          code: 'BETA_FEATURE_REQUIRED',
          feature: featureName,
        });
      }
      next();
    } catch (error) {
      console.error('Beta feature check failed:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
}

module.exports = {
  LINECUE_REHEARSAL_FEATURE,
  getBetaFeatures,
  requireBetaFeature,
  userHasBetaFeature,
};
