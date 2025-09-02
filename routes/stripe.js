const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const stripeService = require('../services/stripeService');
const User = require('../models/User');

const router = express.Router();

// GET /api/stripe/prices - Get available subscription prices
router.get('/prices', auth, async (req, res) => {
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
