// Exercises routes/cron.js auth + the recovery sweep against stubbed internals.
const path = require("path");
const http = require("http");
const ROOT = "/home/user/prep101-backend";

const state = { jobs: [], persisted: new Set(), finalized: [], recoverThrows: null };

// Stub guideQueue (Redis) and guideFinalizer (Supabase/email).
function stub(rel, exports) {
  const p = require.resolve(path.join(ROOT, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}
stub("services/guideQueue.js", {
  getGuideQueue: () => ({
    getJobs: async (states, start, end) => state.jobs.slice(start, end + 1),
  }),
});
stub("services/guideFinalizer.js", {
  findGuideByGuideId: async (id) => (state.persisted.has(id) ? { guideId: id } : null),
  finalizeGuideJob: async ({ guidePayload, source }) => {
    state.finalized.push({ guideId: guidePayload.guideId, source });
    state.persisted.add(guidePayload.guideId);
    return { finalized: true, alreadyPersisted: false, emailed: true };
  },
});
stub("lib/supabaseAdmin.js", { isSupabaseAdminConfigured: () => true });

const express = require(path.join(ROOT, "node_modules/express"));
const cronRouter = require(path.join(ROOT, "routes/cron.js"));
const app = express();
app.use("/api/cron", cronRouter);

function job(id, overrides = {}) {
  return {
    id,
    finishedOn: Date.now(),
    returnvalue: {
      guidePayload: {
        guideId: "g-" + id, userId: "u1", characterName: "Evie",
        productionTitle: "Carmody Road", guideType: "prep101",
      },
      isReaderMode: false,
      ...overrides,
    },
  };
}

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail !== undefined ? "  -> " + JSON.stringify(detail) : ""}`); }
};

function req(server, { token, query = "" } = {}) {
  return new Promise((resolve) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    http.get(
      { host: "127.0.0.1", port: server.address().port, path: `/api/cron/finalize-guides${query}`, headers },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "{}") }));
      }
    );
  });
}

(async () => {
  console.log("cron /finalize-guides\n");
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));

  // 1. Fails closed with no secret configured.
  delete process.env.CRON_SECRET;
  let r = await req(server, { token: "anything" });
  check("503 when CRON_SECRET is unset", r.status === 503, r);

  process.env.CRON_SECRET = "s3cret-value";

  // 2. Rejects missing and wrong tokens.
  r = await req(server);
  check("401 with no token", r.status === 401, r);
  r = await req(server, { token: "wrong" });
  check("401 with a wrong token", r.status === 401, r);
  r = await req(server, { token: "s3cret-valuX" });
  check("401 with a same-length wrong token", r.status === 401, r);

  // 2b. A secret stored with a trailing newline still authenticates. Vercel
  //     sends the header without it, so an untrimmed compare would 401 forever.
  process.env.CRON_SECRET = "s3cret-value\n";
  state.jobs = []; state.persisted = new Set(); state.finalized = [];
  r = await req(server, { token: "s3cret-value" });
  check("tolerates a newline-padded stored secret", r.status === 200, r);
  process.env.CRON_SECRET = " s3cret-value ";
  r = await req(server, { token: "s3cret-value" });
  check("tolerates a space-padded stored secret", r.status === 200, r);
  r = await req(server, { token: "s3cret-valu" });
  check("still rejects a wrong token when padded", r.status === 401, r);
  process.env.CRON_SECRET = "s3cret-value";

  // 3. Healthy system: nothing stranded.
  state.jobs = [job("1")];
  state.persisted = new Set(["g-1"]);
  state.finalized = [];
  r = await req(server, { token: "s3cret-value" });
  check("200 with the right token", r.status === 200, r.status);
  check("finds nothing when all are saved", r.body.found === 0 && r.body.recovered === 0, r.body);

  // 4. A stranded guide is recovered.
  state.jobs = [job("2"), job("3")];
  state.persisted = new Set(["g-2"]);
  state.finalized = [];
  r = await req(server, { token: "s3cret-value" });
  check("recovers the unsaved guide", r.body.found === 1 && r.body.recovered === 1, r.body);
  check("recovers the right one", state.finalized.length === 1 && state.finalized[0].guideId === "g-3", state.finalized);
  check("tags the source as vercel-cron", state.finalized[0]?.source === "vercel-cron", state.finalized);

  // 5. Bold Choices results are ignored (no guidePayload).
  state.jobs = [{ id: "4", returnvalue: { guideData: {}, jobType: "bold_choices" } }];
  state.persisted = new Set();
  state.finalized = [];
  r = await req(server, { token: "s3cret-value" });
  check("ignores bold_choices jobs", r.body.found === 0 && state.finalized.length === 0, r.body);

  // 6. A job the worker already finalized costs no database lookup.
  state.jobs = [job("5", { finalization: { finalized: true } })];
  state.persisted = new Set(); // would look stranded if we checked the DB
  state.finalized = [];
  r = await req(server, { token: "s3cret-value" });
  check("trusts the worker's own finalization record", r.body.found === 0, r.body);

  // 7. dryRun reports without writing.
  state.jobs = [job("6")];
  state.persisted = new Set();
  state.finalized = [];
  r = await req(server, { token: "s3cret-value", query: "?dryRun=1" });
  check("dryRun finds it", r.body.found === 1, r.body);
  check("dryRun writes nothing", state.finalized.length === 0, state.finalized);

  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
