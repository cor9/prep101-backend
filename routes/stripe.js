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

const router = express.Router();

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

// GET /api/stripe/prices - Get available subscription prices
router.get('/prices', async (req, res) => {
  try {
    const prices = [
      {
        id: 'price_basic',
        name: 'Basic',
        price: 9.99,
        guidesLimit: 10,
        features: ['10 guides per month', 'Full methodology access', 'Email support']
      },
      {
        id: 'price_premium',
        name: 'Premium',
        price: 29.99,
        guidesLimit: 100,
        features: ['100 guides per month', 'Priority support', 'Advanced features', 'Early access']
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
    const guidesLimit = stripeService.getGuidesLimitFromSubscription(subscriptionTier);

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
    const guidesLimit = stripeService.getGuidesLimitFromSubscription(user.subscription);
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
        subscription: user.subscription,
        subscriptionStatus: user.subscriptionStatus,
        guidesLimit: user.guidesLimit,
        guidesUsed: user.guidesUsed,
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
    const userRef = await findUserRecord(req);
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
          subscription: userRef.row.subscription,
          subscriptionStatus: userRef.row.subscriptionStatus,
          guidesLimit: userRef.row.guidesLimit,
          guidesUsed: userRef.row.guidesUsed,
        },
      });
    }

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
        synced: false,
        reason: 'no_subscription_found',
        user: {
          id: updatedUser.row.id,
          email: updatedUser.row.email,
          subscription: updatedUser.row.subscription,
          subscriptionStatus: updatedUser.row.subscriptionStatus,
          guidesLimit: updatedUser.row.guidesLimit,
          guidesUsed: updatedUser.row.guidesUsed,
          stripeCustomerId: updatedUser.row.stripeCustomerId,
        },
      });
    }

    const priceIds = (subscription.items?.data || [])
      .map((item) => item?.price?.id)
      .filter(Boolean);
    const primaryPriceId = priceIds[0] || null;
    const inferredSubscription = primaryPriceId
      ? stripeService.getSubscriptionFromPriceId(primaryPriceId)
      : 'premium';
    const guidesLimit = stripeService.getGuidesLimitFromSubscription(inferredSubscription);

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
        subscription: updatedUser.row.subscription,
        subscriptionStatus: updatedUser.row.subscriptionStatus,
        guidesLimit: updatedUser.row.guidesLimit,
        guidesUsed: updatedUser.row.guidesUsed,
        stripeCustomerId: updatedUser.row.stripeCustomerId,
        stripeSubscriptionId: updatedUser.row.stripeSubscriptionId,
        stripePriceId: updatedUser.row.stripePriceId,
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
