function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const STRIPE_PRICE_IDS = {
  starter:
    process.env.STRIPE_STARTER_PRICE_ID || "price_1SYK8iDALb4OhZMWTMqOgCV8",
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

function hasActiveSubscription(user) {
  const status = String(
    user?.subscriptionStatus ?? user?.subscription_status ?? ""
  ).toLowerCase().trim();
  const plan = String(getPrimaryPlanName(user) || "").toLowerCase().trim();

  if (status === "canceled" || status === "unpaid") return false;
  if (status === "active" || status === "trialing" || status === "past_due") {
    return true;
  }

  return [
    "starter",
    "basic",
    "bundle",
    "reader101_monthly",
    "boldchoices_monthly",
  ].includes(plan);
}

function getActiveStripePriceIds(user) {
  const raw = user?.stripePriceId ?? user?.stripe_price_id ?? null;

  if (Array.isArray(raw)) {
    return raw
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveStripePriceId(user) {
  return getActiveStripePriceIds(user)[0] || null;
}

function getPrimaryPlanName(user) {
  const priceId = getActiveStripePriceId(user);

  if (priceId === STRIPE_PRICE_IDS.bundle) return "bundle";
  if (priceId === STRIPE_PRICE_IDS.starter) return "starter";
  if (priceId === STRIPE_PRICE_IDS.reader101Monthly) return "reader101_monthly";
  if (priceId === STRIPE_PRICE_IDS.boldChoicesMonthly) return "boldchoices_monthly";

  return user?.subscription || "free";
}

function getPrep101TopUpCredits(user) {
  return Math.max(
    0,
    toNumber(
      user?.prep101TopUpCredits ??
        user?.prep101_top_up_credits ??
        user?.prep101TopupCredits,
      0
    )
  );
}

function getPrep101GrantedSessionIds(user) {
  const raw =
    user?.prep101TopUpSessionIds ??
    user?.prep101_top_up_session_ids ??
    user?.prep101TopupSessionIds;

  return Array.isArray(raw)
    ? raw.filter((value) => typeof value === "string" && value.trim())
    : [];
}

function getReader101Credits(user) {
  return Math.max(
    0,
    toNumber(
      user?.reader101Credits ??
        user?.reader101_credits ??
        user?.reader101credits,
      0
    )
  );
}

function getReader101GrantedSessionIds(user) {
  const raw =
    user?.reader101SessionIds ??
    user?.reader101_session_ids ??
    user?.reader101GrantedSessionIds;

  return Array.isArray(raw)
    ? raw.filter((value) => typeof value === "string" && value.trim())
    : [];
}

function getBoldChoicesCredits(user) {
  return Math.max(
    0,
    toNumber(
      user?.boldChoicesCredits ??
        user?.bold_choices_credits ??
        user?.boldchoicescredits,
      0
    )
  );
}

function getBoldChoicesGrantedSessionIds(user) {
  const raw =
    user?.boldChoicesSessionIds ??
    user?.bold_choices_session_ids ??
    user?.boldChoicesGrantedSessionIds;

  return Array.isArray(raw)
    ? raw.filter((value) => typeof value === "string" && value.trim())
    : [];
}

function getMonthlyGuideLimit(user) {
  const raw = user?.guidesLimit;
  if (raw === null || typeof raw === "undefined") return 0;

  const limit = toNumber(raw, 0);
  if (limit >= 999) return null;
  return Math.max(0, limit);
}

function getMonthlyGuidesUsed(user) {
  return Math.max(0, toNumber(user?.guidesUsed, 0));
}

function buildPrep101Usage(user) {
  const monthlyLimit = getMonthlyGuideLimit(user);
  const monthlyUsed = getMonthlyGuidesUsed(user);
  const topUpCredits = getPrep101TopUpCredits(user);
  const hasUnlimitedMonthly = monthlyLimit === null;
  const monthlyRemaining = hasUnlimitedMonthly
    ? null
    : Math.max(0, monthlyLimit - monthlyUsed);
  const totalRemaining = hasUnlimitedMonthly
    ? null
    : monthlyRemaining + topUpCredits;
  const canGenerate = hasUnlimitedMonthly ? true : totalRemaining > 0;

  return {
    plan: getPrimaryPlanName(user),
    monthlyUsed,
    monthlyLimit,
    monthlyRemaining,
    topUpCredits,
    totalRemaining,
    canGenerate,
    renewsAt: user?.currentPeriodEnd || null,
  };
}

function hasReader101Unlimited(user) {
  if (!hasActiveSubscription(user)) return false;
  const plan = String(getPrimaryPlanName(user) || "").toLowerCase().trim();
  const priceIds = getActiveStripePriceIds(user);
  return Boolean(
    plan === "reader101_monthly" ||
      plan === "bundle" ||
      priceIds.includes(STRIPE_PRICE_IDS.reader101Monthly) ||
      priceIds.includes(STRIPE_PRICE_IDS.bundle)
  );
}

function buildReader101Usage(user) {
  const unlimited = hasReader101Unlimited(user);
  const credits = getReader101Credits(user);

  return {
    unlimited,
    credits,
    canGenerate: unlimited || credits > 0,
  };
}

function hasBoldChoicesUnlimited(user) {
  if (!hasActiveSubscription(user)) return false;
  const plan = String(getPrimaryPlanName(user) || "").toLowerCase().trim();
  const priceIds = getActiveStripePriceIds(user);
  return Boolean(
    plan === "boldchoices_monthly" ||
      plan === "bundle" ||
      priceIds.includes(STRIPE_PRICE_IDS.boldChoicesMonthly) ||
      priceIds.includes(STRIPE_PRICE_IDS.bundle)
  );
}

function buildBoldChoicesUsage(user) {
  const unlimited = hasBoldChoicesUnlimited(user);
  const credits = getBoldChoicesCredits(user);

  return {
    unlimited,
    credits,
    canGenerate: unlimited || credits > 0,
    modifierAccess: unlimited,
  };
}

function getPrep101ConsumptionUpdate(user) {
  const usage = buildPrep101Usage(user);

  if (usage.monthlyLimit === null) {
    return {
      allowed: true,
      source: "unlimited",
      updates: {},
      nextUsage: usage,
    };
  }

  if (usage.monthlyRemaining > 0) {
    const updates = {
      guidesUsed: usage.monthlyUsed + 1,
    };
    return {
      allowed: true,
      source: "monthly",
      updates,
      nextUsage: buildPrep101Usage({ ...user, ...updates }),
    };
  }

  if (usage.topUpCredits > 0) {
    const updates = {
      prep101TopUpCredits: usage.topUpCredits - 1,
    };
    return {
      allowed: true,
      source: "top_up",
      updates,
      nextUsage: buildPrep101Usage({ ...user, ...updates }),
    };
  }

  return {
    allowed: false,
    source: "none",
    updates: {},
    nextUsage: usage,
  };
}

function getReader101ConsumptionUpdate(user) {
  const usage = buildReader101Usage(user);

  if (usage.unlimited) {
    return {
      allowed: true,
      source: "unlimited",
      updates: {},
      nextUsage: usage,
    };
  }

  if (usage.credits > 0) {
    const updates = {
      reader101Credits: usage.credits - 1,
    };
    return {
      allowed: true,
      source: "credit",
      updates,
      nextUsage: buildReader101Usage({ ...user, ...updates }),
    };
  }

  return {
    allowed: false,
    source: "none",
    updates: {},
    nextUsage: usage,
  };
}

function getBoldChoicesConsumptionUpdate(user) {
  const usage = buildBoldChoicesUsage(user);

  if (usage.unlimited) {
    return {
      allowed: true,
      source: "unlimited",
      updates: {},
      nextUsage: usage,
    };
  }

  if (usage.credits > 0) {
    const updates = {
      boldChoicesCredits: usage.credits - 1,
    };
    return {
      allowed: true,
      source: "credit",
      updates,
      nextUsage: buildBoldChoicesUsage({ ...user, ...updates }),
    };
  }

  return {
    allowed: false,
    source: "none",
    updates: {},
    nextUsage: usage,
  };
}

function getReader101CreditsFromPriceId(priceId) {
  if (!priceId) return 0;
  return priceId === STRIPE_PRICE_IDS.reader101Single ||
    priceId === STRIPE_PRICE_IDS.reader101Addon
    ? 1
    : 0;
}

function getBoldChoicesCreditsFromPriceId(priceId) {
  if (!priceId) return 0;
  return priceId === STRIPE_PRICE_IDS.boldChoicesOneTime ? 1 : 0;
}

module.exports = {
  buildBoldChoicesUsage,
  buildPrep101Usage,
  buildReader101Usage,
  getActiveStripePriceIds,
  getPrimaryPlanName,
  getBoldChoicesConsumptionUpdate,
  getBoldChoicesCredits,
  getBoldChoicesCreditsFromPriceId,
  getBoldChoicesGrantedSessionIds,
  hasBoldChoicesUnlimited,
  getPrep101ConsumptionUpdate,
  getPrep101GrantedSessionIds,
  getPrep101TopUpCredits,
  getReader101ConsumptionUpdate,
  getReader101Credits,
  getReader101CreditsFromPriceId,
  getReader101GrantedSessionIds,
  hasReader101Unlimited,
};
