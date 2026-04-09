const { supabaseAdmin } = require("../lib/supabaseAdmin");

const PROFILES_TABLE = process.env.SUPABASE_PROFILES_TABLE || "profiles";
const ACTOR_PROFILES_TABLE =
  process.env.SUPABASE_ACTOR_PROFILES_TABLE || "actor_profiles";

const VALID_ROLES = new Set(["actor", "parent", "both"]);
const VALID_VIEWS = new Set(["actor", "parent"]);

function isMissingTableError(error) {
  return (
    error &&
    (error.code === "42P01" ||
      /relation .* does not exist/i.test(error.message || ""))
  );
}

function deriveDisplayName(user = {}) {
  return (
    user.name ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Child Actor 101 User"
  );
}

function normalizeProfile(profile, user = {}) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email || user.email || null,
    name: profile.name || deriveDisplayName(user),
    role: profile.role || null,
    defaultView: profile.default_view || null,
    activeActorId: profile.active_actor_id || null,
    onboardingCompleted: Boolean(profile.onboarding_completed),
    createdAt: profile.created_at || null,
    updatedAt: profile.updated_at || null,
  };
}

function normalizeActor(actor) {
  if (!actor) return null;
  return {
    id: actor.id,
    userId: actor.user_id,
    actorName: actor.actor_name,
    ageRange: actor.age_range || "",
    isChild: Boolean(actor.is_child),
    sortOrder: actor.sort_order || 0,
    createdAt: actor.created_at || null,
    updatedAt: actor.updated_at || null,
  };
}

function buildFallbackContext(user = {}) {
  return {
    profile: {
      id: user.id,
      email: user.email || null,
      name: deriveDisplayName(user),
      role: null,
      defaultView: null,
      activeActorId: null,
      onboardingCompleted: false,
      createdAt: null,
      updatedAt: null,
    },
    actors: [],
    activeActor: null,
    onboardingRequired: true,
    storage: "fallback",
  };
}

async function safeSelect(queryPromiseFactory) {
  if (!supabaseAdmin) return { data: null, error: null, storage: "fallback" };
  const { data, error } = await queryPromiseFactory();
  if (error && isMissingTableError(error)) {
    return { data: null, error, storage: "missing_schema" };
  }
  if (error) throw error;
  return { data, error: null, storage: "supabase" };
}

async function ensureProfile(user = {}) {
  if (!user?.id || !user?.email) return null;
  if (!supabaseAdmin) return normalizeProfile({ id: user.id, email: user.email }, user);

  const existing = await safeSelect(() =>
    supabaseAdmin.from(PROFILES_TABLE).select("*").eq("id", user.id).maybeSingle()
  );

  if (existing.data) {
    return normalizeProfile(existing.data, user);
  }

  if (existing.storage === "missing_schema") {
    return null;
  }

  const payload = {
    id: user.id,
    email: String(user.email).toLowerCase(),
    name: deriveDisplayName(user),
    role: null,
    default_view: null,
    active_actor_id: null,
    onboarding_completed: false,
  };

  const { data, error } = await supabaseAdmin
    .from(PROFILES_TABLE)
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error && isMissingTableError(error)) {
    return null;
  }
  if (error) throw error;
  return normalizeProfile(data, user);
}

async function listActorProfiles(userId) {
  if (!userId || !supabaseAdmin) return [];
  const result = await safeSelect(() =>
    supabaseAdmin
      .from(ACTOR_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
  );
  return (result.data || []).map(normalizeActor);
}

async function buildAccountContext(user = {}, options = {}) {
  if (!user?.id) return buildFallbackContext(user);

  let profile = options.ensureProfile ? await ensureProfile(user) : null;
  if (!profile && supabaseAdmin) {
    const profileResult = await safeSelect(() =>
      supabaseAdmin
        .from(PROFILES_TABLE)
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
    );
    profile = profileResult.data ? normalizeProfile(profileResult.data, user) : null;
  }

  if (!profile) {
    return buildFallbackContext(user);
  }

  const actors = await listActorProfiles(user.id);
  const activeActor =
    actors.find((actor) => actor.id === profile.activeActorId) || actors[0] || null;

  return {
    profile: {
      ...profile,
      activeActorId: activeActor?.id || profile.activeActorId || null,
    },
    actors,
    activeActor,
    onboardingRequired:
      !profile.onboardingCompleted ||
      !profile.role ||
      actors.length === 0 ||
      !activeActor,
    storage: "supabase",
  };
}

function normalizeActorsInput(actors = [], user = {}, role = null) {
  const cleaned = (Array.isArray(actors) ? actors : [])
    .map((actor, index) => ({
      actorName: String(actor?.actorName || actor?.name || "").trim(),
      ageRange: String(actor?.ageRange || "").trim(),
      isChild:
        typeof actor?.isChild === "boolean"
          ? actor.isChild
          : role === "parent",
      sortOrder:
        typeof actor?.sortOrder === "number" ? actor.sortOrder : index,
    }))
    .filter((actor) => actor.actorName);

  if (cleaned.length > 0) return cleaned;

  if (role === "actor" || role === "both") {
    return [
      {
        actorName: deriveDisplayName(user),
        ageRange: "",
        isChild: false,
        sortOrder: 0,
      },
    ];
  }

  return [];
}

async function completeOnboarding(user = {}, payload = {}) {
  if (!supabaseAdmin) {
    return buildFallbackContext({
      ...user,
      account: {
        profile: {
          role: payload.role || null,
          defaultView: payload.defaultView || null,
          onboardingCompleted: true,
        },
      },
    });
  }

  const role = VALID_ROLES.has(payload.role) ? payload.role : null;
  const defaultView = VALID_VIEWS.has(payload.defaultView)
    ? payload.defaultView
    : role === "parent"
      ? "parent"
      : "actor";

  if (!role) {
    throw new Error("role must be one of actor, parent, or both");
  }

  const profile = await ensureProfile(user);
  if (!profile) {
    throw new Error("profiles table is not available yet");
  }

  const actorInputs = normalizeActorsInput(payload.actors, user, role);
  if (!actorInputs.length) {
    throw new Error("At least one actor profile is required");
  }

  const { error: deleteError } = await supabaseAdmin
    .from(ACTOR_PROFILES_TABLE)
    .delete()
    .eq("user_id", user.id);

  if (deleteError && !isMissingTableError(deleteError)) throw deleteError;

  const actorRows = actorInputs.map((actor, index) => ({
    user_id: user.id,
    actor_name: actor.actorName,
    age_range: actor.ageRange || null,
    is_child: Boolean(actor.isChild),
    sort_order: typeof actor.sortOrder === "number" ? actor.sortOrder : index,
  }));

  const { data: insertedActors, error: insertError } = await supabaseAdmin
    .from(ACTOR_PROFILES_TABLE)
    .insert(actorRows)
    .select("*");

  if (insertError && !isMissingTableError(insertError)) throw insertError;

  const normalizedActors = (insertedActors || []).map(normalizeActor);
  const requestedActiveId = payload.activeActorId || null;
  const activeActor =
    normalizedActors.find((actor) => actor.id === requestedActiveId) ||
    normalizedActors[0] ||
    null;

  const { error: profileError } = await supabaseAdmin
    .from(PROFILES_TABLE)
    .update({
      email: String(user.email || profile.email || "").toLowerCase(),
      name: payload.name || deriveDisplayName(user),
      role,
      default_view: defaultView,
      active_actor_id: activeActor?.id || null,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (profileError && !isMissingTableError(profileError)) throw profileError;

  return buildAccountContext(user, { ensureProfile: true });
}

async function selectActiveActor(user = {}, actorId) {
  if (!supabaseAdmin) {
    throw new Error("shared actor context requires Supabase admin configuration");
  }
  if (!actorId) {
    throw new Error("actorId is required");
  }

  const actors = await listActorProfiles(user.id);
  const actor = actors.find((entry) => entry.id === actorId);
  if (!actor) {
    throw new Error("actor profile not found");
  }

  const { error } = await supabaseAdmin
    .from(PROFILES_TABLE)
    .update({ active_actor_id: actorId })
    .eq("id", user.id);

  if (error) throw error;
  return buildAccountContext(user, { ensureProfile: true });
}

module.exports = {
  buildAccountContext,
  completeOnboarding,
  ensureProfile,
  normalizeProfile,
  normalizeActor,
  selectActiveActor,
  tables: {
    profiles: PROFILES_TABLE,
    actorProfiles: ACTOR_PROFILES_TABLE,
  },
};
