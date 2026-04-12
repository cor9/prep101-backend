const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const STRIPE_PRICE_IDS = {
  starter:
    process.env.STRIPE_STARTER_PRICE_ID || "price_1SYK8iDALb4OhZMWTMqOgCV8",
  alacarte:
    process.env.STRIPE_ALACARTE_PRICE_ID || "price_1SYKCHDALb4OhZMWBoTPIEww",
  prep101ThreePack:
    process.env.STRIPE_PREP101_THREE_PACK_PRICE_ID ||
    "price_1TKBjxDALb4OhZMWdBQ9pQIV",
  reader101Monthly:
    process.env.STRIPE_READER_MONTHLY_PRICE_ID || "price_1TIMhqDALb4OhZMWBHuctc0O",
  reader101Addon:
    process.env.STRIPE_READER_ADDON_PRICE_ID || "price_1TIMbzDALb4OhZMWHPeyulaF",
  reader101Single:
    process.env.STRIPE_READER_SINGLE_PRICE_ID || "price_1TIMgwDALb4OhZMWGUKxHADD",
  boldChoicesMonthly:
    process.env.STRIPE_BOLD_CHOICES_MONTHLY_PRICE_ID || "price_1TIMmkDALb4OhZMWIwvt40Oj",
  boldChoicesOneTime:
    process.env.STRIPE_BOLD_CHOICES_ONE_TIME_PRICE_ID || "price_1TIMmTDALb4OhZMWaxWUBUMA",
  bundle: process.env.STRIPE_BUNDLE_PRICE_ID || "price_1TINGJDALb4OhZMWIDYDMAvt",
};

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
        guidesLimit: 0
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
    if (!priceId) return "free";

    const priceMap = {
      price_basic: "basic",
      price_premium: "premium",
      [process.env.STRIPE_BASIC_PRICE_ID]: "basic",
      [STRIPE_PRICE_IDS.starter]: "basic",
      [process.env.STRIPE_PREMIUM_PRICE_ID]: "premium",
      [STRIPE_PRICE_IDS.reader101Monthly]: "reader101_monthly",
      [STRIPE_PRICE_IDS.reader101Addon]: "free",
      [STRIPE_PRICE_IDS.reader101Single]: "free",
      [STRIPE_PRICE_IDS.boldChoicesMonthly]: "boldchoices_monthly",
      [STRIPE_PRICE_IDS.boldChoicesOneTime]: "free",
      [STRIPE_PRICE_IDS.bundle]: "bundle",
    };

    const mapped = priceMap[priceId];
    if (mapped) return mapped;

    console.warn(
      `⚠️ Unmapped Stripe price ID ${priceId} - defaulting to free until mapped`
    );
    return "free";
  }

  getPrep101TopUpCreditsFromPriceId(priceId) {
    if (!priceId) return 0;

    const creditMap = {
      [STRIPE_PRICE_IDS.alacarte]: 1,
      [STRIPE_PRICE_IDS.prep101ThreePack]: 3,
    };

    return creditMap[priceId] || 0;
  }

  getPrep101MonthlyLimitFromPriceId(priceId) {
    if (!priceId) return this.getGuidesLimitFromSubscription("free");

    if (priceId === STRIPE_PRICE_IDS.starter) return 5;
    if (priceId === STRIPE_PRICE_IDS.bundle) return 5;
    if (
      priceId === STRIPE_PRICE_IDS.reader101Monthly ||
      priceId === STRIPE_PRICE_IDS.boldChoicesMonthly
    ) {
      return 0;
    }

    return this.getGuidesLimitFromSubscription(
      this.getSubscriptionFromPriceId(priceId)
    );
  }

  getLegacySubscriptionFromPriceIds(priceIds = []) {
    const ids = Array.isArray(priceIds)
      ? priceIds.filter(Boolean)
      : String(priceIds || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

    if (!ids.length) return "free";
    if (ids.includes(STRIPE_PRICE_IDS.starter) || ids.includes(STRIPE_PRICE_IDS.bundle)) {
      return "basic";
    }
    if (
      ids.includes(STRIPE_PRICE_IDS.reader101Monthly) ||
      ids.includes(STRIPE_PRICE_IDS.boldChoicesMonthly)
    ) {
      return "premium";
    }
    return "free";
  }

  getPrep101MonthlyLimitFromPriceIds(priceIds = []) {
    const ids = Array.isArray(priceIds)
      ? priceIds.filter(Boolean)
      : String(priceIds || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

    if (!ids.length) return this.getGuidesLimitFromSubscription("free");
    if (ids.includes(STRIPE_PRICE_IDS.starter) || ids.includes(STRIPE_PRICE_IDS.bundle)) {
      return 5;
    }
    return 0;
  }

  // Helper method to get guides limit from subscription
  getGuidesLimitFromSubscription(subscription) {
    const limitMap = {
      'free': 0,
      // "basic" is the legacy stored name for the current Starter plan.
      'basic': 5,
      'starter': 5,
      'bundle': 5,
      'reader101_monthly': 0,
      'boldchoices_monthly': 0,
      'premium': 999
    };
    return limitMap[subscription] ?? 0;
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
