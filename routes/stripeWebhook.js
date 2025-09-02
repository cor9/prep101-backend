const express = require('express');
const stripeService = require('../services/stripeService');
const User = require('../models/User');

const router = express.Router();

// Stripe webhook endpoint - must use raw body for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripeService.verifyWebhookSignature(req.body, sig);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🔔 Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;
      
      case 'customer.subscription.trial_ended':
        await handleTrialEnded(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  try {
    const user = await User.findOne({
      where: { stripeCustomerId: subscription.customer }
    });

    if (!user) {
      console.error('User not found for subscription:', subscription.id);
      return;
    }

    const subscriptionTier = stripeService.getSubscriptionFromPriceId(subscription.items.data[0].price.id);
    const guidesLimit = stripeService.getGuidesLimitFromSubscription(subscriptionTier);

    await user.update({
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      subscription: subscriptionTier,
      subscriptionStatus: subscription.status,
      guidesLimit: guidesLimit,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    console.log(`✅ Subscription created for user ${user.email}: ${subscriptionTier}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  try {
    const user = await User.findOne({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!user) {
      console.error('User not found for subscription update:', subscription.id);
      return;
    }

    const subscriptionTier = stripeService.getSubscriptionFromPriceId(subscription.items.data[0].price.id);
    const guidesLimit = stripeService.getGuidesLimitFromSubscription(subscriptionTier);

    await user.update({
      subscriptionStatus: subscription.status,
      subscription: subscriptionTier,
      guidesLimit: guidesLimit,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    console.log(`✅ Subscription updated for user ${user.email}: ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  try {
    const user = await User.findOne({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!user) {
      console.error('User not found for subscription deletion:', subscription.id);
      return;
    }

    await user.update({
      subscription: 'free',
      subscriptionStatus: 'canceled',
      guidesLimit: 1
    });

    console.log(`❌ Subscription canceled for user ${user.email}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  try {
    const user = await User.findOne({
      where: { stripeCustomerId: invoice.customer }
    });

    if (!user) {
      console.error('User not found for payment succeeded:', invoice.id);
      return;
    }

    // Reset guides used counter for new billing period
    if (invoice.billing_reason === 'subscription_cycle') {
      await user.update({ guidesUsed: 0 });
      console.log(`💰 Payment succeeded for user ${user.email}, reset guides counter`);
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  try {
    const user = await User.findOne({
      where: { stripeCustomerId: invoice.customer }
    });

    if (!user) {
      console.error('User not found for payment failed:', invoice.id);
      return;
    }

    await user.update({
      subscriptionStatus: 'past_due'
    });

    console.log(`❌ Payment failed for user ${user.email}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// Handle trial ending soon
async function handleTrialWillEnd(subscription) {
  try {
    const user = await User.findOne({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!user) {
      console.error('User not found for trial will end:', subscription.id);
      return;
    }

    console.log(`⚠️ Trial ending soon for user ${user.email}`);
    // You could send an email notification here
  } catch (error) {
    console.error('Error handling trial will end:', error);
  }
}

// Handle trial ended
async function handleTrialEnded(subscription) {
  try {
    const user = await User.findOne({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!user) {
      console.error('User not found for trial ended:', subscription.id);
      return;
    }

    await user.update({
      subscriptionStatus: subscription.status
    });

    console.log(`⏰ Trial ended for user ${user.email}`);
  } catch (error) {
    console.error('Error handling trial ended:', error);
  }
}

module.exports = router;
