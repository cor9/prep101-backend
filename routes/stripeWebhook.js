const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const router = express.Router();

// Stripe webhook endpoint - raw body required
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
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
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
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

// Handle successful checkout completion
async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout session completion:', session.id);
  
  try {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateUserSubscription(customerId, subscription);
    }
  } catch (error) {
    console.error('Error handling checkout session completion:', error);
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription creation:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    await updateUserSubscription(customerId, subscription);
  } catch (error) {
    console.error('Error handling subscription creation:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription update:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    await updateUserSubscription(customerId, subscription);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deletion:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    await updateUserSubscription(customerId, subscription);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Processing successful invoice payment:', invoice.id);
  
  try {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateUserSubscription(customerId, subscription);
    }
  } catch (error) {
    console.error('Error handling invoice payment success:', error);
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
  console.log('Processing failed invoice payment:', invoice.id);
  
  try {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateUserSubscription(customerId, subscription);
    }
  } catch (error) {
    console.error('Error handling invoice payment failure:', error);
  }
}

// Update user subscription based on Stripe subscription
async function updateUserSubscription(customerId, subscription) {
  try {
    // Find user by Stripe customer ID
    const user = await User.findOne({ where: { stripeCustomerId: customerId } });
    
    if (!user) {
      console.log('User not found for customer ID:', customerId);
      return;
    }

    const status = subscription.status;
    const priceId = subscription.items.data[0]?.price.id;
    
    // Map Stripe price IDs to subscription plans
    let subscriptionPlan = 'free';
    let guidesLimit = 1;
    
    if (status === 'active' && priceId) {
      switch (priceId) {
        case process.env.STRIPE_STARTER_PRICE_ID:
          subscriptionPlan = 'starter';
          guidesLimit = 3;
          break;
        case process.env.STRIPE_ALACARTE_PRICE_ID:
          subscriptionPlan = 'alacarte';
          guidesLimit = 1;
          break;
        case process.env.STRIPE_PREMIUM_PRICE_ID:
          subscriptionPlan = 'premium';
          guidesLimit = 10;
          break;
        default:
          console.log('Unknown price ID:', priceId);
      }
    } else if (status === 'canceled' || status === 'unpaid') {
      subscriptionPlan = 'free';
      guidesLimit = 1;
    }

    // Update user subscription
    await user.update({
      subscription: subscriptionPlan,
      guidesLimit: guidesLimit,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionUpdatedAt: new Date()
    });

    console.log(`Updated user ${user.id} subscription to ${subscriptionPlan} (${status})`);
  } catch (error) {
    console.error('Error updating user subscription:', error);
  }
}

module.exports = router;
