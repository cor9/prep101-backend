let stripe = null;

class PaymentService {
  constructor() {
    const { config } = require('../config/config');
    if (config.stripe.secretKey) {
      stripe = require('stripe')(config.stripe.secretKey);
    } else {
      console.warn('⚠️  Stripe not configured - payment features will be disabled');
    }
  }

  // Check if Stripe is available
  isStripeAvailable() {
    return stripe !== null;
  }

  // Create a customer in Stripe
  async createCustomer(email, name) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
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

  // Create a Stripe Checkout session
  async createCheckoutSession(customerId, priceId, successUrl = null, cancelUrl = null) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || 'https://childactor101.sbs/app/stripe/success',
        cancel_url: cancelUrl || 'https://childactor101.sbs/pricing',
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        metadata: {
          source: 'prep101'
        }
      });
      
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Get available subscription plans
  getSubscriptionPlans() {
    return {
      free: {
        name: 'Free',
        price: 0,
        guidesLimit: 1,
        features: ['1 guide per month', 'Core scene breakdown & tips', 'Parent + kid versions included', 'Email support']
      },
      starter: {
        name: 'Starter',
        price: 29.99,
        priceId: process.env.STRIPE_STARTER_PRICE_ID,
        guidesLimit: 3,
        features: ['3 guides per month', 'Detailed beats, subtext & buttons', 'Genre-aware notes', 'Parent deep-dive + kid-ready guide', 'Priority email support', 'Printable PDF delivery']
      },
      alacarte: {
        name: 'A la carte',
        price: 14.99,
        priceId: process.env.STRIPE_ALACARTE_PRICE_ID,
        guidesLimit: 1,
        features: ['1 guide (one-time purchase)', 'Same depth as Starter guides', 'Parent + kid versions', 'PDF delivery']
      },
      premium: {
        name: 'Premium',
        price: 99.99,
        priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
        guidesLimit: 10,
        features: ['10 guides per month', 'Advanced scene & character analysis', '2 Self-Tape Feedbacks included', 'Parent deep-dive + kid-ready guide', 'Rush-friendly priority support', 'PDF delivery + rehearsal variations']
      }
    };
  }

  // Get add-on services
  getAddOnServices() {
    return {
      coaching: {
        name: '30-min Private Coaching',
        price: 50.00,
        priceId: process.env.STRIPE_COACHING_PRICE_ID,
        description: 'Targeted notes on your sides + on-camera adjustments.'
      },
      feedback: {
        name: 'Self-Tape Feedback',
        price: 22.00,
        priceId: process.env.STRIPE_FEEDBACK_PRICE_ID,
        description: 'Actionable punch-ups within hours whenever possible.'
      }
    };
  }
}

module.exports = PaymentService;
