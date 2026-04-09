const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const stripeService = require("../services/stripeService");
const User = require("../models/User");
const {
  runAdminQuery,
  tables,
  normalizeUserRow,
} = require("../lib/supabaseAdmin");
const {
  getBoldChoicesCredits,
  getBoldChoicesCreditsFromPriceId,
  getBoldChoicesGrantedSessionIds,
  getPrep101GrantedSessionIds,
  getPrep101TopUpCredits,
  getReader101Credits,
  getReader101CreditsFromPriceId,
  getReader101GrantedSessionIds,
} = require("../services/prep101EntitlementsService");

const router = express.Router();

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

function inferPaidPlan(priceId) {
  const mapped = stripeService.getSubscriptionFromPriceId(priceId);
  if (mapped && mapped !== "free") return mapped;
  return "free";
}

function inferGuidesLimit(priceId, subscriptionTier) {
  if (priceId) {
    return stripeService.getPrep101MonthlyLimitFromPriceId(priceId);
  }
  if (subscriptionTier === "premium") return 999;
  if (subscriptionTier === "basic" || subscriptionTier === "starter") return 5;
  if (subscriptionTier === "bundle") return 5;
  if (
    subscriptionTier === "reader101_monthly" ||
    subscriptionTier === "boldchoices_monthly"
  ) {
    return 0;
  }
  return stripeService.getGuidesLimitFromSubscription(subscriptionTier);
}

async function fetchCustomerEmail(customerId) {
  if (!customerId) return null;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted) {
      return normalizeEmail(customer.email);
    }
  } catch (error) {
    console.error("Error fetching Stripe customer email:", error.message);
  }

  return null;
}

async function fetchSessionPriceIds(sessionId) {
  if (!sessionId) return [];

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 10,
      expand: ["data.price"],
    });

    return (lineItems.data || [])
      .map((item) =>
        typeof item.price === "string" ? item.price : item.price?.id || null
      )
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching checkout session line items:", error.message);
    return [];
  }
}

function wrapUser(row, source) {
  if (!row) return null;
  return { source, row };
}

async function findUserByField(field, value) {
  if (!value) return null;

  if (User) {
    try {
      const row = await User.findOne({ where: { [field]: value } });
      if (row) return wrapUser(row, "sequelize");
    } catch (error) {
      console.error(`Sequelize lookup failed for ${field}:`, error.message);
    }
  }

  try {
    const row = await runAdminQuery(async (client) => {
      const { data, error } = await client
        .from(tables.users)
        .select("*")
        .eq(field, value)
        .maybeSingle();

      if (error) throw error;
      return data;
    });

    if (row) return wrapUser(normalizeUserRow(row), "supabase");
  } catch (error) {
    console.error(`Supabase lookup failed for ${field}:`, error.message);
  }

  return null;
}

async function findUserById(id) {
  if (!id) return null;

  if (User) {
    try {
      const row = await User.findByPk(id);
      if (row) return wrapUser(row, "sequelize");
    } catch (error) {
      console.error("Sequelize lookup failed for id:", error.message);
    }
  }

  try {
    const row = await runAdminQuery(async (client) => {
      const { data, error } = await client
        .from(tables.users)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    });

    if (row) return wrapUser(normalizeUserRow(row), "supabase");
  } catch (error) {
    console.error("Supabase lookup failed for id:", error.message);
  }

  return null;
}

async function updateWrappedUser(userRef, updates) {
  if (!userRef) return null;

  if (userRef.source === "sequelize") {
    await userRef.row.update(updates);
    await userRef.row.reload();
    return wrapUser(userRef.row, "sequelize");
  }

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .update(updates)
      .eq("id", userRef.row.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  });

  return wrapUser(normalizeUserRow(row), "supabase");
}

async function resolveUser({
  userId = null,
  customerId = null,
  subscriptionId = null,
  email = null,
}) {
  const normalizedEmail = normalizeEmail(email);

  if (userId) {
    const byId = await findUserById(userId);
    if (byId) return byId;
  }

  if (customerId) {
    const byCustomer = await findUserByField("stripeCustomerId", customerId);
    if (byCustomer) return byCustomer;
  }

  if (subscriptionId) {
    const bySubscription = await findUserByField("stripeSubscriptionId", subscriptionId);
    if (bySubscription) return bySubscription;
  }

  if (normalizedEmail) {
    const byEmail = await findUserByField("email", normalizedEmail);
    if (byEmail) return byEmail;
  }

  return null;
}

async function backfillStripeLink(userRef, { customerId = null, subscriptionId = null, priceId = null }) {
  if (!userRef) return null;

  const updates = {};
  if (customerId && !userRef.row.stripeCustomerId) updates.stripeCustomerId = customerId;
  if (customerId && !userRef.row.customerId) updates.customerId = customerId;
  if (subscriptionId && !userRef.row.stripeSubscriptionId) updates.stripeSubscriptionId = subscriptionId;
  if (subscriptionId && !userRef.row.subscriptionId) updates.subscriptionId = subscriptionId;
  if (priceId && !userRef.row.stripePriceId) updates.stripePriceId = priceId;

  if (!Object.keys(updates).length) return userRef;
  return updateWrappedUser(userRef, updates);
}

async function handleCheckoutCompleted(session) {
  try {
    const priceIds = await fetchSessionPriceIds(session.id);
    const primaryPriceId = priceIds[0] || null;
    const email =
      normalizeEmail(session.customer_details?.email) ||
      normalizeEmail(session.customer_email) ||
      (await fetchCustomerEmail(session.customer));

    let userRef = await resolveUser({
      userId: session.metadata?.userId || session.client_reference_id || null,
      customerId: session.customer,
      subscriptionId: session.subscription,
      email,
    });

    if (!userRef) {
      console.error("User not found for checkout.session.completed:", {
        sessionId: session.id,
        customerId: session.customer,
        email,
      });
      return;
    }

    userRef = await backfillStripeLink(userRef, {
      customerId: session.customer,
      subscriptionId: session.subscription,
      priceId: primaryPriceId,
    });

    const updates = {
      subscriptionStatus: "active",
    };

    if (session.mode === "subscription") {
      const inferredPlan = inferPaidPlan(primaryPriceId);
      updates.subscription = inferredPlan;
      updates.guidesLimit = inferGuidesLimit(primaryPriceId, inferredPlan);
      updates.stripePriceId = primaryPriceId;
    } else {
      const prepGrantedSessionIds = getPrep101GrantedSessionIds(userRef.row);
      const readerGrantedSessionIds = getReader101GrantedSessionIds(userRef.row);
      const boldGrantedSessionIds = getBoldChoicesGrantedSessionIds(userRef.row);
      const prep101TopUpCredits = priceIds.reduce(
        (total, priceId) =>
          total + stripeService.getPrep101TopUpCreditsFromPriceId(priceId),
        0
      );
      const reader101Credits = priceIds.reduce(
        (total, priceId) => total + getReader101CreditsFromPriceId(priceId),
        0
      );
      const boldChoicesCredits = priceIds.reduce(
        (total, priceId) => total + getBoldChoicesCreditsFromPriceId(priceId),
        0
      );

      if (prep101TopUpCredits > 0 && !prepGrantedSessionIds.includes(session.id)) {
        updates.prep101TopUpCredits =
          getPrep101TopUpCredits(userRef.row) + prep101TopUpCredits;
        updates.prep101TopUpSessionIds = [...prepGrantedSessionIds, session.id];
        updates.stripePriceId = primaryPriceId;
      }

      if (reader101Credits > 0 && !readerGrantedSessionIds.includes(session.id)) {
        updates.reader101Credits =
          getReader101Credits(userRef.row) + reader101Credits;
        updates.reader101SessionIds = [...readerGrantedSessionIds, session.id];
        updates.stripePriceId = primaryPriceId;
      }

      if (boldChoicesCredits > 0 && !boldGrantedSessionIds.includes(session.id)) {
        updates.boldChoicesCredits =
          getBoldChoicesCredits(userRef.row) + boldChoicesCredits;
        updates.boldChoicesSessionIds = [...boldGrantedSessionIds, session.id];
        updates.stripePriceId = primaryPriceId;
      }
    }

    await updateWrappedUser(userRef, updates);
    console.log(`✅ Checkout completed linked for user ${userRef.row.email}`);
  } catch (error) {
    console.error("Error handling checkout completed:", error);
  }
}

async function handleSubscriptionCreated(subscription) {
  try {
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const email = await fetchCustomerEmail(subscription.customer);
    let userRef = await resolveUser({
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      email,
    });

    if (!userRef) {
      console.error("User not found for subscription:", subscription.id);
      return;
    }

    userRef = await backfillStripeLink(userRef, {
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      priceId,
    });

    const subscriptionTier = inferPaidPlan(priceId);
    const guidesLimit = inferGuidesLimit(priceId, subscriptionTier);

    await updateWrappedUser(userRef, {
      customerId: subscription.customer,
      stripeCustomerId: subscription.customer,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscription: subscriptionTier,
      subscriptionStatus: subscription.status,
      guidesLimit,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    console.log(`✅ Subscription created for user ${userRef.row.email}: ${subscriptionTier}`);
  } catch (error) {
    console.error("Error handling subscription created:", error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const email = await fetchCustomerEmail(subscription.customer);
    let userRef = await resolveUser({
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      email,
    });

    if (!userRef) {
      console.error("User not found for subscription update:", subscription.id);
      return;
    }

    userRef = await backfillStripeLink(userRef, {
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      priceId,
    });

    const subscriptionTier = inferPaidPlan(priceId);
    const guidesLimit = inferGuidesLimit(priceId, subscriptionTier);

    await updateWrappedUser(userRef, {
      customerId: subscription.customer,
      stripeCustomerId: subscription.customer,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      subscription: subscriptionTier,
      guidesLimit,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    console.log(`✅ Subscription updated for user ${userRef.row.email}: ${subscription.status}`);
  } catch (error) {
    console.error("Error handling subscription updated:", error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const email = await fetchCustomerEmail(subscription.customer);
    const userRef = await resolveUser({
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      email,
    });

    if (!userRef) {
      console.error("User not found for subscription deletion:", subscription.id);
      return;
    }

    await updateWrappedUser(userRef, {
      subscription: "free",
      subscriptionStatus: "canceled",
      guidesLimit: 0,
    });

    console.log(`❌ Subscription canceled for user ${userRef.row.email}`);
  } catch (error) {
    console.error("Error handling subscription deleted:", error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const email = await fetchCustomerEmail(invoice.customer);
    const userRef = await resolveUser({
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      email,
    });

    if (!userRef) {
      console.error("User not found for payment succeeded:", invoice.id);
      return;
    }

    if (invoice.billing_reason === "subscription_cycle") {
      await updateWrappedUser(userRef, {
        guidesUsed: 0,
        subscriptionStatus: "active",
      });
      console.log(`💰 Payment succeeded for user ${userRef.row.email}, reset guides counter`);
    }
  } catch (error) {
    console.error("Error handling payment succeeded:", error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const email = await fetchCustomerEmail(invoice.customer);
    const userRef = await resolveUser({
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      email,
    });

    if (!userRef) {
      console.error("User not found for payment failed:", invoice.id);
      return;
    }

    await updateWrappedUser(userRef, {
      subscriptionStatus: "past_due",
    });

    console.log(`❌ Payment failed for user ${userRef.row.email}`);
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

// Stripe webhook endpoint - must use raw body for signature verification
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripeService.verifyWebhookSignature(req.body, sig);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("🔔 Stripe webhook received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
