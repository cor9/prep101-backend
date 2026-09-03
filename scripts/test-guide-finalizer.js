// Exercises guideFinalizer against a stubbed Supabase + email layer.
const path = require("path");
const ROOT = "/home/user/prep101-backend";

const state = { guides: [], users: [], updates: [], emails: [], onInsert: null };

// Stub lib/supabaseAdmin before the finalizer requires it.
const adminPath = require.resolve(path.join(ROOT, "lib/supabaseAdmin.js"));
require.cache[adminPath] = {
  id: adminPath, filename: adminPath, loaded: true, exports: {
    isSupabaseAdminConfigured: () => true,
    tables: { guides: "Guides", users: "Users" },
    normalizeGuideRow: (r) => r,
    normalizeUserRow: (r) => r,
    runAdminQuery: async (cb) => cb(makeClient()),
  },
};

const emailPath = require.resolve(path.join(ROOT, "services/emailService.js"));
require.cache[emailPath] = {
  id: emailPath, filename: emailPath, loaded: true, exports: {
    isConfigured: () => true,
    sendGuideReadyEmail: async ({ to, guide }) => { state.emails.push({ to, guideId: guide.guideId }); },
  },
};

function makeClient() {
  return {
    from(table) {
      const q = { table, filters: {} };
      q.select = () => q;
      q.eq = (col, val) => { q.filters[col] = val; return q; };
      q.maybeSingle = async () => {
        const rows = table === "Guides" ? state.guides : state.users;
        const hit = rows.find((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v));
        return { data: hit || null, error: null };
      };
      q.single = async () => {
        if (q._insert) {
          if (state.onInsert) { const hook = state.onInsert; state.onInsert = null; hook(q._insert); }
          state.guides.push(q._insert);
          return { data: q._insert, error: null };
        }
        if (q._update) {
          state.updates.push({ table, filters: q.filters, updates: q._update });
          return { data: { ...state.users[0], ...q._update }, error: null };
        }
        return { data: null, error: null };
      };
      q.insert = (row) => { q._insert = row; return q; };
      q.update = (u) => { q._update = u; return q; };
      return q;
    },
  };
}

const { finalizeGuideJob } = require(path.join(ROOT, "services/guideFinalizer.js"));

// A guide long enough and complete enough to pass the prep101 gate.
const goodHtml = "<h1>Guide</h1>" + "Two-Take strategy. Pre-Submission Checklist. Final Coach Note. " + "x".repeat(2600);

function guide(overrides = {}) {
  return { guideId: "g-" + Math.random().toString(36).slice(2), userId: "u1", characterName: "Evie",
           productionTitle: "Carmody Road", guideType: "prep101", generatedHtml: goodHtml, ...overrides };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  -> " + JSON.stringify(detail) : ""}`); }
}

(async () => {
  console.log("guideFinalizer\n");

  // 1. Happy path: saves, deducts a monthly credit, emails.
  state.users = [{ id: "u1", email: "actor@example.com", guidesUsed: 2, guidesLimit: 10 }];
  let g = guide();
  let r = await finalizeGuideJob({ guidePayload: g, isReaderMode: false });
  check("saves the guide", r.finalized && !r.alreadyPersisted, r);
  check("emails the actor", state.emails.length === 1 && state.emails[0].to === "actor@example.com", state.emails);
  check("deducts a credit", state.updates.some((u) => u.updates.guidesUsed === 3), state.updates);

  // 2. Idempotent: a second finalize of the same guide is a no-op.
  const before = state.guides.length;
  r = await finalizeGuideJob({ guidePayload: g, isReaderMode: false });
  check("second finalize is a no-op", r.finalized && r.alreadyPersisted && state.guides.length === before, r);

  // 3. Quality gate: short guide is neither saved nor charged.
  state.updates = []; state.emails = [];
  r = await finalizeGuideJob({ guidePayload: guide({ generatedHtml: "<p>too short</p>" }) });
  check("rejects a bad guide", !r.finalized && r.reason === "quality_gate", r);
  check("no credit spent on a bad guide", state.updates.length === 0, state.updates);
  check("no email for a bad guide", state.emails.length === 0, state.emails);

  // 4. Missing Users row defers rather than exploding on the FK.
  state.users = [];
  r = await finalizeGuideJob({ guidePayload: guide() });
  check("defers when the Users row is missing", !r.finalized && r.reason === "user_row_missing", r);

  // 5. Race: the polling endpoint inserts between our SELECT and our INSERT.
  state.users = [{ id: "u1", email: "actor@example.com", guidesUsed: 0, guidesLimit: 10 }];
  const raced = guide();
  state.onInsert = (row) => {
    state.guides.push({ ...row, id: "winner-from-poll" }); // the other writer lands
    const dup = new Error('duplicate key value violates unique constraint "Guides_guideId_key"');
    dup.code = "23505";
    throw dup;
  };
  r = await finalizeGuideJob({ guidePayload: raced });
  check("loses an insert race gracefully", r.finalized && r.alreadyPersisted, r);
  check("race returns the winner's row", r.guide && r.guide.id === "winner-from-poll", r.guide);

  // 6. A genuine insert failure surfaces as an error, not a false success.
  state.onInsert = () => { throw new Error("connection terminated unexpectedly"); };
  r = await finalizeGuideJob({ guidePayload: guide() });
  check("reports a real insert failure", !r.finalized && r.reason === "error", r);

  // 7. Unlimited plans are not charged.
  state.updates = []; state.emails = [];
  state.users = [{ id: "u1", email: "admin@example.com", guidesUsed: 0, guidesLimit: 999 }];
  r = await finalizeGuideJob({ guidePayload: guide() });
  check("unlimited plan saves the guide", r.finalized && !r.alreadyPersisted, r);
  check("unlimited plan spends no credit", state.updates.length === 0, state.updates);

  // 8. Reader101 guides are gated and charged on their own terms.
  state.updates = [];
  state.users = [{ id: "u1", email: "actor@example.com", reader101Credits: 2 }];
  const readerHtml = "<h1>Reader Support</h1> key beats " + "y".repeat(1600);
  r = await finalizeGuideJob({
    guidePayload: guide({ guideType: "reader101", generatedHtml: readerHtml }),
    isReaderMode: true,
  });
  check("saves a reader101 guide", r.finalized && !r.alreadyPersisted, r);
  check("spends a reader101 credit", state.updates.some((u) => u.updates.reader101Credits === 1), state.updates);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
