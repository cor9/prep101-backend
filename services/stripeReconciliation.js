const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_missing");
const stripeService = require("./stripeService");
const {
  getPrep101GrantedSessionIds,
  getPrep101TopUpCredits,
  getReader101Credits,
  getReader101CreditsFromPriceId,
  getReader101GrantedSessionIds,
  getBoldChoicesCredits,
  getBoldChoicesCreditsFromPriceId,
  getBoldChoicesGrantedSessionIds,
} = require("./prep101EntitlementsService");
const {
  isSupabaseAdminConfigured,
  runAdminQuery,
  tables,
  normalizeUserRow,
} = require("../lib/supabaseAdmin");

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

async function updateUser(user, updates) {
  if (!updates || !Object.keys(updates).length) return user;

  if (user && typeof user.update === "function") {
    await user.update(updates);
    if (typeof user.reload === "function") await user.reload();
    return user;
  }

  if (!user?.id || !isSupabaseAdminConfigured()) {
    return { ...user, ...updates };
  }

  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .update(updates)
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });

  return normalizeUserRow(row);
}

async function getSessionPriceIds(sessionId) {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 20,
    expand: ["data.price"],
  });

  return (lineItems.data || [])
    .map((item) =>
      typeof item.price === "string" ? item.price : item.price?.id || null
    )
    .filter(Boolean);
}

async function reconcileStripePurchasesForUser(user) {
  const email = normalizeEmail(user?.email);
  if (!email || !process.env.STRIPE_SECRET_KEY) return user;

  const customers = await stripe.customers.list({ email, limit: 10 });
  if (!customers.data?.length) return user;

  let workingUser = user;
  const updates = {};
  const prepSessionIds = new Set(getPrep101GrantedSessionIds(workingUser));
  const readerSessionIds = new Set(getReader101GrantedSessionIds(workingUser));
  const boldSessionIds = new Set(getBoldChoicesGrantedSessionIds(workingUser));
  let prepCredits = getPrep101TopUpCredits(workingUser);
  let readerCredits = getReader101Credits(workingUser);
  let boldCredits = getBoldChoicesCredits(workingUser);
  let latestPriceId = workingUser?.stripePriceId || null;

  for (const customer of customers.data) {
    if (!updates.stripeCustomerId) updates.stripeCustomerId = customer.id;
    if (!updates.customerId) updates.customerId = customer.id;

    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 20,
    });

    for (const session of sessions.data || []) {
      if (session.mode !== "payment" || session.payment_status !== "paid") {
        continue;
      }

      const sessionEmail =
        normalizeEmail(session.customer_details?.email) ||
        normalizeEmail(session.customer_email) ||
        email;
      if (sessionEmail !== email) continue;

      const priceIds = await getSessionPriceIds(session.id);
      for (const priceId of priceIds) {
        const prepGrant = stripeService.getPrep101TopUpCreditsFromPriceId(priceId);
        const readerGrant = getReader101CreditsFromPriceId(priceId);
        const boldGrant = getBoldChoicesCreditsFromPriceId(priceId);

        if (prepGrant > 0 && !prepSessionIds.has(session.id)) {
          prepCredits += prepGrant;
          prepSessionIds.add(session.id);
          latestPriceId = priceId;
        }
        if (readerGrant > 0 && !readerSessionIds.has(session.id)) {
          readerCredits += readerGrant;
          readerSessionIds.add(session.id);
          latestPriceId = priceId;
        }
        if (boldGrant > 0 && !boldSessionIds.has(session.id)) {
          boldCredits += boldGrant;
          boldSessionIds.add(session.id);
          latestPriceId = priceId;
        }
      }
    }
  }

  if (prepCredits !== getPrep101TopUpCredits(workingUser)) {
    updates.prep101TopUpCredits = prepCredits;
    updates.prep101TopUpSessionIds = [...prepSessionIds];
  }
  if (readerCredits !== getReader101Credits(workingUser)) {
    updates.reader101Credits = readerCredits;
    updates.reader101SessionIds = [...readerSessionIds];
  }
  if (boldCredits !== getBoldChoicesCredits(workingUser)) {
    updates.boldChoicesCredits = boldCredits;
    updates.boldChoicesSessionIds = [...boldSessionIds];
  }
  if (latestPriceId && !workingUser?.stripePriceId) {
    updates.stripePriceId = latestPriceId;
  }

  if (!Object.keys(updates).length) return workingUser;
  const updatedUser = await updateUser(workingUser, updates);
  console.log(`✅ Reconciled Stripe purchases for ${email}`, updates);
  return updatedUser;
}

module.exports = {
  reconcileStripePurchasesForUser,
};
