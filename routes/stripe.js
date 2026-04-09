const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
  runAdminQuery,
  tables,
  normalizeUserRow,
} = require('../lib/supabaseAdmin');
const {
  buildBoldChoicesUsage,
  buildPrep101Usage,
  buildReader101Usage,
  getBoldChoicesCredits,
  getBoldChoicesCreditsFromPriceId,
  getBoldChoicesGrantedSessionIds,
  getPrep101GrantedSessionIds,
  getPrep101TopUpCredits,
  getPrimaryPlanName,
  getReader101Credits,
  getReader101CreditsFromPriceId,
  getReader101GrantedSessionIds,
} = require('../services/prep101EntitlementsService');

const router = express.Router();

function formatPlanLabel(plan) {
  switch (String(plan || '').toLowerCase()) {
    case 'basic':
    case 'starter':
      return 'Starter';
    case 'bundle':
      return 'Bundle';
    case 'reader101_monthly':
      return 'Reader101 Monthly';
    case 'boldchoices_monthly':
      return 'Bold Choices Monthly';
    case 'premium':
      return 'Legacy Premium';
    case 'free':
    default:
      return 'Free';
  }
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

async function findUserRecord(req) {
  if (User && req.userId) {
    try {
      const row = await User.findByPk(req.userId);
      if (row) return { source: 'sequelize', row };
    } catch (error) {
      console.error('Sequelize user lookup failed during Stripe sync:', error.message);
    }
  }

  const userId = req.userId || req.user?.id;
  if (!userId) return null;

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  });

  return row ? { source: 'supabase', row: normalizeUserRow(row) } : null;
}

async function updateUserRecord(userRef, updates) {
  if (!userRef) return null;

  if (userRef.source === 'sequelize') {
    await userRef.row.update(updates);
    await userRef.row.reload();
    return { source: 'sequelize', row: userRef.row };
  }

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .update(updates)
      .eq('id', userRef.row.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  });

  return { source: 'supabase', row: normalizeUserRow(row) };
}

function selectBestSubscription(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;

  const rankedStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete'];
  return [...subscriptions].sort((a, b) => {
    const statusRankA = rankedStatuses.indexOf(a.status);
    const statusRankB = rankedStatuses.indexOf(b.status);
    if (statusRankA !== statusRankB) return statusRankA - statusRankB;
    return (b.created || 0) - (a.created || 0);
  })[0];
}

async function fetchSessionPriceIds(sessionId) {
  if (!sessionId) return [];

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 10,
    expand: ['data.price'],
  });

  return (lineItems.data || [])
    .map((item) =>
      typeof item.price === 'string' ? item.price : item.price?.id || null
    )
    .filter(Boolean);
}

async function syncOneTimeProductCredits(userRef, customerId) {
  if (!userRef || !customerId) {
    return {
      userRef,
      prep101BackfilledCredits: 0,
      reader101BackfilledCredits: 0,
      boldChoicesBackfilledCredits: 0,
      backfilledSessionIds: [],
    };
  }

  const prepGrantedSessionIds = getPrep101GrantedSessionIds(userRef.row);
  const readerGrantedSessionIds = getReader101GrantedSessionIds(userRef.row);
  const boldGrantedSessionIds = getBoldChoicesGrantedSessionIds(userRef.row);
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 50,
  });

  let prep101BackfilledCredits = 0;
  let reader101BackfilledCredits = 0;
  let boldChoicesBackfilledCredits = 0;
  const prepBackfilledSessionIds = [];
  const readerBackfilledSessionIds = [];
  const boldBackfilledSessionIds = [];

  for (const session of sessions.data || []) {
    if (
      session.mode !== 'payment' ||
      session.status !== 'complete' ||
      (prepGrantedSessionIds.includes(session.id) &&
        readerGrantedSessionIds.includes(session.id) &&
        boldGrantedSessionIds.includes(session.id))
    ) {
      continue;
    }

    const priceIds = await fetchSessionPriceIds(session.id);
    const prepCreditsForSession = priceIds.reduce(
      (total, priceId) =>
        total + stripeService.getPrep101TopUpCreditsFromPriceId(priceId),
      0
    );
    const readerCreditsForSession = priceIds.reduce(
      (total, priceId) => total + getReader101CreditsFromPriceId(priceId),
      0
    );
    const boldCreditsForSession = priceIds.reduce(
      (total, priceId) => total + getBoldChoicesCreditsFromPriceId(priceId),
      0
    );

    if (
      (prepCreditsForSession > 0 && !prepGrantedSessionIds.includes(session.id)) ||
      (readerCreditsForSession > 0 && !readerGrantedSessionIds.includes(session.id)) ||
      (boldCreditsForSession > 0 && !boldGrantedSessionIds.includes(session.id))
    ) {
      prep101BackfilledCredits += prepCreditsForSession;
      reader101BackfilledCredits += readerCreditsForSession;
      boldChoicesBackfilledCredits += boldCreditsForSession;
      if (prepCreditsForSession > 0 && !prepGrantedSessionIds.includes(session.id)) {
        prepBackfilledSessionIds.push(session.id);
      }
      if (readerCreditsForSession > 0 && !readerGrantedSessionIds.includes(session.id)) {
        readerBackfilledSessionIds.push(session.id);
      }
      if (boldCreditsForSession > 0 && !boldGrantedSessionIds.includes(session.id)) {
        boldBackfilledSessionIds.push(session.id);
      }
    }
  }

  if (
    !prep101BackfilledCredits &&
    !reader101BackfilledCredits &&
    !boldChoicesBackfilledCredits
  ) {
    return {
      userRef,
      prep101BackfilledCredits: 0,
      reader101BackfilledCredits: 0,
      boldChoicesBackfilledCredits: 0,
      backfilledSessionIds: [],
    };
  }

  const updatedUserRef = await updateUserRecord(userRef, {
    prep101TopUpCredits:
      getPrep101TopUpCredits(userRef.row) + prep101BackfilledCredits,
    prep101TopUpSessionIds: [...prepGrantedSessionIds, ...prepBackfilledSessionIds],
    reader101Credits:
      getReader101Credits(userRef.row) + reader101BackfilledCredits,
    reader101SessionIds: [...readerGrantedSessionIds, ...readerBackfilledSessionIds],
    boldChoicesCredits:
      getBoldChoicesCredits(userRef.row) + boldChoicesBackfilledCredits,
    boldChoicesSessionIds: [...boldGrantedSessionIds, ...boldBackfilledSessionIds],
  });

  return {
    userRef: updatedUserRef,
    prep101BackfilledCredits,
    reader101BackfilledCredits,
    boldChoicesBackfilledCredits,
    backfilledSessionIds: [
      ...new Set([
        ...prepBackfilledSessionIds,
        ...readerBackfilledSessionIds,
        ...boldBackfilledSessionIds,
      ]),
    ],
  };
}

// GET /api/stripe/prices - Get available subscription prices
router.get('/prices', async (req, res) => {
  try {
    const prices = [
      {
        id: 'price_starter',
        name: 'Starter',
        price: 19.99,
        guidesLimit: 5,
        features: ['5 guides per month', 'Full methodology access', 'Priority email support']
      }
    ];

    res.json({ prices });
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ message: 'Failed to fetch prices' });
  }
});

// POST /api/stripe/create-subscription - Create a new subscription
router.post('/create-subscription', auth, [
  body('priceId').notEmpty().withMessage('Price ID is required'),
  body('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { priceId, paymentMethodId } = req.body;
    const user = req.user;

    // Create subscription
    const subscription = await stripeService.createSubscription(user, priceId, paymentMethodId);

    // Update user's guides limit based on subscription
    const subscriptionTier = stripeService.getSubscriptionFromPriceId(priceId);
    const guidesLimit = stripeService.getPrep101MonthlyLimitFromPriceId(priceId);

    await user.update({
      subscription: subscriptionTier,
      guidesLimit: guidesLimit
    });

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        priceId: priceId
      },
      user: {
        subscription: subscriptionTier,
        planDisplay: formatPlanLabel(subscriptionTier),
        guidesLimit: guidesLimit
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      message: 'Failed to create subscription',
      error: error.message 
    });
  }
});

// POST /api/stripe/cancel-subscription - Cancel subscription
router.post('/cancel-subscription', auth, async (req, res) => {
  try {
    const user = req.user;
    const subscription = await stripeService.cancelSubscription(user);

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ 
      message: 'Failed to cancel subscription',
      error: error.message 
    });
  }
});

// POST /api/stripe/reactivate-subscription - Reactivate subscription
router.post('/reactivate-subscription', auth, async (req, res) => {
  try {
    const user = req.user;
    const subscription = await stripeService.reactivateSubscription(user);

    // Update user's guides limit
    const guidesLimit = stripeService.getPrep101MonthlyLimitFromPriceId(user.stripePriceId);
    await user.update({ guidesLimit });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      },
      user: {
        subscription: user.subscription,
        planDisplay: formatPlanLabel(getPrimaryPlanName(user)),
        guidesLimit: guidesLimit
      }
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ 
      message: 'Failed to reactivate subscription',
      error: error.message 
    });
  }
});

// GET /api/stripe/subscription-status - Get current subscription status
router.get('/subscription-status', auth, async (req, res) => {
  try {
    const user = req.user;
    const subscription = await stripeService.getSubscriptionStatus(user);

    res.json({
      success: true,
      subscription: subscription,
      user: {
        subscription: getPrimaryPlanName(user),
        planDisplay: formatPlanLabel(getPrimaryPlanName(user)),
        subscriptionStatus: user.subscriptionStatus,
        guidesLimit: user.guidesLimit,
        guidesUsed: user.guidesUsed,
        prep101TopUpCredits: user.prep101TopUpCredits || 0,
        prep101Usage: buildPrep101Usage(user),
        reader101Credits: user.reader101Credits || 0,
        reader101Usage: buildReader101Usage(user),
        boldChoicesCredits: user.boldChoicesCredits || 0,
        boldChoicesUsage: buildBoldChoicesUsage(user),
        currentPeriodStart: user.currentPeriodStart,
        currentPeriodEnd: user.currentPeriodEnd
      }
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ 
      message: 'Failed to get subscription status',
      error: error.message 
    });
  }
});

// POST /api/stripe/sync-subscription - Reconcile logged-in user with Stripe
router.post('/sync-subscription', auth, async (req, res) => {
  try {
    let userRef = await findUserRecord(req);
    if (!userRef) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const email = normalizeEmail(userRef.row.email || req.user?.email);
    let customerId = userRef.row.stripeCustomerId || userRef.row.customerId || null;

    if (!customerId && email) {
      const customers = await stripe.customers.list({ email, limit: 10 });
      const customer = customers.data.find((entry) => !entry.deleted) || null;
      customerId = customer?.id || null;
    }

    if (!customerId) {
      return res.json({
        success: true,
        synced: false,
        reason: 'no_customer_found',
        user: {
          id: userRef.row.id,
          email: userRef.row.email,
          subscription: getPrimaryPlanName(userRef.row),
          planDisplay: formatPlanLabel(getPrimaryPlanName(userRef.row)),
          subscriptionStatus: userRef.row.subscriptionStatus,
          guidesLimit: userRef.row.guidesLimit,
          guidesUsed: userRef.row.guidesUsed,
          prep101TopUpCredits: userRef.row.prep101TopUpCredits || 0,
          prep101Usage: buildPrep101Usage(userRef.row),
          reader101Credits: userRef.row.reader101Credits || 0,
          reader101Usage: buildReader101Usage(userRef.row),
          boldChoicesCredits: userRef.row.boldChoicesCredits || 0,
          boldChoicesUsage: buildBoldChoicesUsage(userRef.row),
        },
      });
    }

    const topUpSync = await syncOneTimeProductCredits(userRef, customerId);
    userRef = topUpSync.userRef || userRef;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price'],
    });

    const subscription = selectBestSubscription(subscriptions.data);
    if (!subscription) {
      const updatedUser = await updateUserRecord(userRef, {
        customerId,
        stripeCustomerId: customerId,
      });

      return res.json({
        success: true,
        synced:
          topUpSync.prep101BackfilledCredits > 0 ||
          topUpSync.reader101BackfilledCredits > 0 ||
          topUpSync.boldChoicesBackfilledCredits > 0,
        reason:
          topUpSync.prep101BackfilledCredits > 0 ||
          topUpSync.reader101BackfilledCredits > 0 ||
          topUpSync.boldChoicesBackfilledCredits > 0
            ? 'one_time_credits_backfilled'
            : 'no_subscription_found',
        user: {
          id: updatedUser.row.id,
          email: updatedUser.row.email,
          subscription: getPrimaryPlanName(updatedUser.row),
          planDisplay: formatPlanLabel(getPrimaryPlanName(updatedUser.row)),
          subscriptionStatus: updatedUser.row.subscriptionStatus,
          guidesLimit: updatedUser.row.guidesLimit,
          guidesUsed: updatedUser.row.guidesUsed,
          prep101TopUpCredits: updatedUser.row.prep101TopUpCredits || 0,
          prep101Usage: buildPrep101Usage(updatedUser.row),
          reader101Credits: updatedUser.row.reader101Credits || 0,
          reader101Usage: buildReader101Usage(updatedUser.row),
          boldChoicesCredits: updatedUser.row.boldChoicesCredits || 0,
          boldChoicesUsage: buildBoldChoicesUsage(updatedUser.row),
          stripeCustomerId: updatedUser.row.stripeCustomerId,
        },
        prep101TopUps: {
          backfilledCredits: topUpSync.prep101BackfilledCredits,
          reader101BackfilledCredits: topUpSync.reader101BackfilledCredits,
          boldChoicesBackfilledCredits: topUpSync.boldChoicesBackfilledCredits,
          backfilledSessionIds: topUpSync.backfilledSessionIds,
        },
      });
    }

    const priceIds = (subscription.items?.data || [])
      .map((item) => item?.price?.id)
      .filter(Boolean);
    const primaryPriceId = priceIds[0] || null;
    const inferredSubscription = primaryPriceId
      ? stripeService.getSubscriptionFromPriceId(primaryPriceId)
      : 'free';
    const guidesLimit = stripeService.getPrep101MonthlyLimitFromPriceId(primaryPriceId);

    const updatedUser = await updateUserRecord(userRef, {
      customerId,
      stripeCustomerId: customerId,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: primaryPriceId,
      subscription: inferredSubscription,
      subscriptionStatus: subscription.status,
      guidesLimit,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    return res.json({
      success: true,
      synced: true,
      user: {
        id: updatedUser.row.id,
        email: updatedUser.row.email,
        subscription: getPrimaryPlanName(updatedUser.row),
        planDisplay: formatPlanLabel(getPrimaryPlanName(updatedUser.row)),
        subscriptionStatus: updatedUser.row.subscriptionStatus,
        guidesLimit: updatedUser.row.guidesLimit,
        guidesUsed: updatedUser.row.guidesUsed,
        prep101TopUpCredits: updatedUser.row.prep101TopUpCredits || 0,
        prep101Usage: buildPrep101Usage(updatedUser.row),
        reader101Credits: updatedUser.row.reader101Credits || 0,
        reader101Usage: buildReader101Usage(updatedUser.row),
        boldChoicesCredits: updatedUser.row.boldChoicesCredits || 0,
        boldChoicesUsage: buildBoldChoicesUsage(updatedUser.row),
        stripeCustomerId: updatedUser.row.stripeCustomerId,
        stripeSubscriptionId: updatedUser.row.stripeSubscriptionId,
        stripePriceId: updatedUser.row.stripePriceId,
      },
      prep101TopUps: {
        backfilledCredits: topUpSync.prep101BackfilledCredits,
        reader101BackfilledCredits: topUpSync.reader101BackfilledCredits,
        boldChoicesBackfilledCredits: topUpSync.boldChoicesBackfilledCredits,
        backfilledSessionIds: topUpSync.backfilledSessionIds,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        priceIds,
      },
    });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync subscription',
      error: error.message,
    });
  }
});

// GET /api/stripe/payment-methods - Get user's payment methods
router.get('/payment-methods', auth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripeCustomerId) {
      return res.json({ paymentMethods: [] });
    }

    const paymentMethods = await stripeService.getPaymentMethods(user.stripeCustomerId);

    res.json({
      success: true,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ 
      message: 'Failed to get payment methods',
      error: error.message 
    });
  }
});

// POST /api/stripe/update-payment-method - Update default payment method
router.post('/update-payment-method', auth, [
  body('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { paymentMethodId } = req.body;
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ message: 'No Stripe customer found' });
    }

    await stripeService.updateDefaultPaymentMethod(user.stripeCustomerId, paymentMethodId);
    await user.update({ defaultPaymentMethodId: paymentMethodId });

    res.json({
      success: true,
      message: 'Default payment method updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ 
      message: 'Failed to update payment method',
      error: error.message 
    });
  }
});

// POST /api/stripe/create-payment-intent - Create payment intent for one-time payments
router.post('/create-payment-intent', auth, [
  body('amount').isInt({ min: 50 }).withMessage('Amount must be at least 50 cents'),
  body('metadata').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, metadata = {} } = req.body;
    const user = req.user;

    if (!user.stripeCustomerId) {
      await stripeService.createCustomer(user);
    }

    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      user.stripeCustomerId,
      { ...metadata, userId: user.id }
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status
      }
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      message: 'Failed to create payment intent',
      error: error.message 
    });
  }
});

// POST /api/stripe/create-customer-portal-session - Create customer portal session
router.post('/create-customer-portal-session', auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.status(400).json({ message: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/account`,
    });

    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ 
      message: 'Failed to create customer portal session',
      error: error.message 
    });
  }
});

module.exports = router;
