const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

class StripeService {
  // Create a new Stripe customer
  async createCustomer(user) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id
        }
      });

      // Update user with Stripe customer ID
      await user.update({ stripeCustomerId: customer.id });
      
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create a subscription
  async createSubscription(user, priceId, paymentMethodId) {
    try {
      // Ensure user has a Stripe customer
      if (!user.stripeCustomerId) {
        await this.createCustomer(user);
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with subscription details
      await user.update({
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        defaultPaymentMethodId: paymentMethodId
      });

      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(user) {
    try {
      if (!user.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Update user
      await user.update({
        subscriptionStatus: 'canceled',
        subscription: 'free',
        guidesLimit: 1
      });

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Reactivate subscription
  async reactivateSubscription(user) {
    try {
      if (!user.stripeSubscriptionId) {
        throw new Error('No subscription found');
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      // Update user
      await user.update({
        subscriptionStatus: 'active',
        subscription: this.getSubscriptionFromPriceId(user.stripePriceId)
      });

      return subscription;
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  // Get subscription status
  async getSubscriptionStatus(user) {
    try {
      if (!user.stripeSubscriptionId) {
        return { status: 'no_subscription' };
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      // Update user with latest status
      await user.update({
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });

      return subscription;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  // Create payment intent for one-time payments
  async createPaymentIntent(amount, customerId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        metadata
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Get customer payment methods
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw error;
    }
  }

  // Update default payment method
  async updateDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      console.error('Error updating default payment method:', error);
      throw error;
    }
  }

  // Helper method to get subscription tier from price ID
  getSubscriptionFromPriceId(priceId) {
    const priceMap = {
      'price_basic': 'basic',
      'price_premium': 'premium'
    };
    return priceMap[priceId] || 'free';
  }

  // Helper method to get guides limit from subscription
  getGuidesLimitFromSubscription(subscription) {
    const limitMap = {
      'free': 1,
      'basic': 10,
      'premium': 100
    };
    return limitMap[subscription] || 1;
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();
