const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  constructor() {
    const { config } = require('../config/config');
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
  }

  // Create a customer in Stripe
  async createCustomer(email, name) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          source: 'prep101'
        }
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create a subscription
  async createSubscription(customerId, priceId) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId, priceId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
      });
      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw new Error('Failed to retrieve subscription');
    }
  }

  // Create a payment intent for one-time payments
  async createPaymentIntent(amount, customerId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        metadata: {
          ...metadata,
          source: 'prep101'
        }
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Handle webhook events
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionChange(event.data.object);
        case 'invoice.payment_succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
        case 'invoice.payment_failed':
          return await this.handlePaymentFailed(event.data.object);
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Handle subscription changes
  async handleSubscriptionChange(subscription) {
    // This will be implemented in the webhook handler
    return {
      type: 'subscription_change',
      subscriptionId: subscription.id,
      status: subscription.status,
      customerId: subscription.customer
    };
  }

  // Handle successful payments
  async handlePaymentSucceeded(invoice) {
    return {
      type: 'payment_succeeded',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer
    };
  }

  // Handle failed payments
  async handlePaymentFailed(invoice) {
    return {
      type: 'payment_failed',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer
    };
  }

  // Get available subscription plans
  getSubscriptionPlans() {
    return {
      free: {
        name: 'Free',
        price: 0,
        guidesLimit: 1,
        features: ['1 guide per month', 'Basic methodology access']
      },
      basic: {
        name: 'Basic',
        price: 9.99,
        priceId: process.env.STRIPE_BASIC_PRICE_ID,
        guidesLimit: 10,
        features: ['10 guides per month', 'Full methodology access', 'Priority support']
      },
      premium: {
        name: 'Premium',
        price: 19.99,
        priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
        guidesLimit: 50,
        features: ['50 guides per month', 'Full methodology access', 'Priority support', 'Custom requests']
      }
    };
  }
}

module.exports = PaymentService;
