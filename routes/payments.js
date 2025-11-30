const express = require('express');
const { body, validationResult } = require('express-validator');
const PaymentService = require('../services/paymentService');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();
const paymentService = new PaymentService();

// GET /api/payments/plans - Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = paymentService.getSubscriptionPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ message: 'Failed to fetch subscription plans' });
  }
});

// POST /api/payments/create-checkout-session - Create Stripe Checkout session
router.post(
  '/create-checkout-session',
  [
    auth,
    body('plan').isIn(['starter', 'alacarte', 'premium'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { plan } = req.body;
      const userId = req.userId;

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get plan details
      const plans = paymentService.getSubscriptionPlans();
      const selectedPlan = plans[plan];
      
      if (!selectedPlan || !selectedPlan.priceId) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await paymentService.createCustomer(user.email, user.name);
        customerId = customer.id;
        await user.update({ stripeCustomerId: customerId });
      }

      // Create checkout session
      const session = await paymentService.createCheckoutSession(
        customerId,
        selectedPlan.priceId
      );

      res.json({
        message: 'Checkout session created successfully',
        sessionId: session.id,
        url: session.url
      });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ message: 'Failed to create checkout session' });
    }
  }
);

// POST /api/payments/create-subscription - Create a new subscription (legacy method)
router.post(
  '/create-subscription',
  [
    auth,
    body('plan').isIn(['starter', 'alacarte', 'premium']),
    body('paymentMethodId').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { plan, paymentMethodId } = req.body;
      const userId = req.userId;

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get plan details
      const plans = paymentService.getSubscriptionPlans();
      const selectedPlan = plans[plan];
      
      if (!selectedPlan || !selectedPlan.priceId) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await paymentService.createCustomer(user.email, user.name);
        customerId = customer.id;
        await user.update({ stripeCustomerId: customerId });
      }

      // Create subscription
      const subscription = await paymentService.createSubscription(
        customerId,
        selectedPlan.priceId
      );

      // Update user subscription info
      await user.update({
        subscription: plan,
        subscriptionId: subscription.id,
        guidesLimit: selectedPlan.guidesLimit
      });

      res.json({
        message: 'Subscription created successfully',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: plan,
          guidesLimit: selectedPlan.guidesLimit
        },
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      });

    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ message: 'Failed to create subscription' });
    }
  }
);

// POST /api/payments/cancel-subscription - Cancel subscription
router.post('/cancel-subscription', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription to cancel' });
    }

    // Cancel in Stripe
    await paymentService.cancelSubscription(user.subscriptionId);

    // Update user
    await user.update({
      subscription: 'free',
      subscriptionId: null,
      guidesLimit: 0 // Free tier has no guides without promo codes
    });

    res.json({ message: 'Subscription cancelled successfully' });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// POST /api/payments/update-subscription - Update subscription plan
router.post(
  '/update-subscription',
  [
    auth,
    body('plan').isIn(['basic', 'premium'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { plan } = req.body;
      const userId = req.userId;
      const user = await User.findByPk(userId);

      if (!user || !user.subscriptionId) {
        return res.status(400).json({ message: 'No active subscription to update' });
      }

      const plans = paymentService.getSubscriptionPlans();
      const selectedPlan = plans[plan];

      if (!selectedPlan || !selectedPlan.priceId) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      // Update subscription in Stripe
      await paymentService.updateSubscription(user.subscriptionId, selectedPlan.priceId);

      // Update user
      await user.update({
        subscription: plan,
        guidesLimit: selectedPlan.guidesLimit
      });

      res.json({
        message: 'Subscription updated successfully',
        plan: plan,
        guidesLimit: selectedPlan.guidesLimit
      });

    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ message: 'Failed to update subscription' });
    }
  }
);

// GET /api/payments/subscription-status - Get current subscription status
router.get('/subscription-status', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let subscriptionDetails = null;
    if (user.subscriptionId) {
      try {
        subscriptionDetails = await paymentService.getSubscription(user.subscriptionId);
      } catch (error) {
        console.error('Error fetching subscription details:', error);
      }
    }

    const plans = paymentService.getSubscriptionPlans();
    const currentPlan = plans[user.subscription];

    res.json({
      subscription: user.subscription,
      guidesUsed: user.guidesUsed,
      guidesLimit: user.guidesLimit,
      currentPlan: currentPlan,
      subscriptionDetails: subscriptionDetails
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ message: 'Failed to fetch subscription status' });
  }
});

// GET /api/payments/billing-history - Get user's billing history
router.get('/billing-history', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.customerId) {
      return res.json({ invoices: [], customerId: null });
    }

    // Get invoices from Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const invoices = await stripe.invoices.list({
      customer: user.customerId,
      limit: 20
    });

    const billingHistory = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      date: new Date(invoice.created * 1000),
      description: invoice.description,
      invoiceUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf
    }));

    res.json({
      customerId: user.customerId,
      invoices: billingHistory,
      totalInvoices: billingHistory.length
    });

  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ message: 'Failed to fetch billing history' });
  }
});

// GET /api/payments/usage-analytics - Get detailed usage analytics
router.get('/usage-analytics', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    // Get guide usage over time
    const Guide = require('../models/Guide');
    const guides = await Guide.findAll({
      where: { userId },
      attributes: ['createdAt', 'status'],
      order: [['createdAt', 'ASC']]
    });

    // Calculate monthly usage
    const monthlyUsage = {};
    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 6, 1);

    guides.forEach(guide => {
      const month = guide.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (new Date(guide.createdAt) >= sixMonthsAgo) {
        monthlyUsage[month] = (monthlyUsage[month] || 0) + 1;
      }
    });

    // Calculate subscription efficiency
    const subscriptionEfficiency = user.guidesLimit > 0 ? 
      Math.round((user.guidesUsed / user.guidesLimit) * 100) : 0;

    // Get plan recommendations
    const plans = paymentService.getSubscriptionPlans();
    const currentPlan = plans[user.subscription];
    const recommendations = [];

    if (user.guidesUsed >= user.guidesLimit * 0.8) {
      recommendations.push({
        type: 'upgrade',
        message: 'You\'re approaching your monthly limit. Consider upgrading for more guides.',
        suggestedPlan: user.subscription === 'free' ? 'basic' : 'premium'
      });
    }

    if (user.guidesUsed < user.guidesLimit * 0.3 && user.subscription !== 'free') {
      recommendations.push({
        type: 'downgrade',
        message: 'You\'re using less than 30% of your monthly limit. Consider downgrading to save money.',
        suggestedPlan: 'free'
      });
    }

    res.json({
      currentUsage: {
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit,
        efficiency: subscriptionEfficiency,
        remaining: Math.max(0, user.guidesLimit - user.guidesUsed)
      },
      monthlyUsage,
      subscriptionEfficiency,
      recommendations,
      currentPlan: currentPlan
    });

  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    res.status(500).json({ message: 'Failed to fetch usage analytics' });
  }
});

// POST /api/payments/upgrade-plan - Upgrade subscription plan
router.post('/upgrade-plan', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const plans = paymentService.getSubscriptionPlans();
    const selectedPlan = plans[plan];

    if (!selectedPlan || !selectedPlan.priceId) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    // Check if user is upgrading
    const planHierarchy = { free: 0, basic: 1, premium: 2 };
    const currentPlanLevel = planHierarchy[user.subscription] || 0;
    const selectedPlanLevel = planHierarchy[plan] || 0;

    if (selectedPlanLevel <= currentPlanLevel) {
      return res.status(400).json({ message: 'Can only upgrade to a higher tier plan' });
    }

    // Create or get Stripe customer
    let customerId = user.customerId;
    if (!customerId) {
      const customer = await paymentService.createCustomer(user.email, user.name);
      customerId = customer.id;
      await user.update({ customerId: customerId });
    }

    // Create subscription
    const subscription = await paymentService.createSubscription(
      customerId,
      selectedPlan.priceId
    );

    // Update user
    await user.update({
      subscription: plan,
      subscriptionId: subscription.id,
      guidesLimit: selectedPlan.guidesLimit
    });

    res.json({
      message: 'Plan upgraded successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: plan,
        guidesLimit: selectedPlan.guidesLimit
      },
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    });

  } catch (error) {
    console.error('Error upgrading plan:', error);
    res.status(500).json({ message: 'Failed to upgrade plan' });
  }
});

// POST /api/payments/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = require('stripe')(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const result = await paymentService.handleWebhook(event);
    
    // Handle the webhook result
    if (result.type === 'subscription_change') {
      await handleSubscriptionChange(result);
    } else if (result.type === 'payment_succeeded') {
      await handlePaymentSucceeded(result);
    } else if (result.type === 'payment_failed') {
      await handlePaymentFailed(result);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

// Helper functions for webhook handling
async function handleSubscriptionChange(result) {
  try {
    const user = await User.findOne({ where: { subscriptionId: result.subscriptionId } });
    if (user) {
      if (result.status === 'canceled' || result.status === 'unpaid') {
        await user.update({
          subscription: 'free',
          guidesLimit: 0 // Free tier has no guides without promo codes
        });
      }
    }
  } catch (error) {
    console.error('Error handling subscription change:', error);
  }
}

async function handlePaymentSucceeded(result) {
  try {
    const user = await User.findOne({ where: { subscriptionId: result.subscriptionId } });
    if (user) {
      // Reset guides used count for new billing period
      await user.update({ guidesUsed: 0 });
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(result) {
  try {
    const user = await User.findOne({ where: { subscriptionId: result.subscriptionId } });
    if (user) {
      // Could implement dunning management here
      console.log(`Payment failed for user ${user.id}`);
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// POST /api/payments/create-addon-session - Create Stripe Checkout session for add-ons
router.post(
  '/create-addon-session',
  [
    auth,
    body('addon').isIn(['coaching', 'feedback'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { addon } = req.body;
      const userId = req.userId;

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get add-on details
      const addons = paymentService.getAddOnServices();
      const selectedAddon = addons[addon];
      
      if (!selectedAddon || !selectedAddon.priceId) {
        return res.status(400).json({ message: 'Invalid add-on selected' });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await paymentService.createCustomer(user.email, user.name);
        customerId = customer.id;
        await user.update({ stripeCustomerId: customerId });
      }

      // Create checkout session for one-time payment
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: selectedAddon.priceId,
            quantity: 1,
          },
        ],
        mode: 'payment', // One-time payment, not subscription
        success_url: 'https://prep101.site/app/stripe/success',
        cancel_url: 'https://prep101.site/pricing',
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        metadata: {
          source: 'prep101',
          addon: addon,
          userId: userId
        }
      });

      res.json({
        message: 'Add-on checkout session created successfully',
        sessionId: session.id,
        url: session.url
      });

    } catch (error) {
      console.error('Error creating add-on checkout session:', error);
      res.status(500).json({ message: 'Failed to create add-on checkout session' });
    }
  }
);

module.exports = router;
