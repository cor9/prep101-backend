# How a guide gets saved

Generating a guide and *keeping* it are two different things, and the second one
has three chances to happen. This is what they are and what each needs, because
when a guide goes missing the cause is always one of them.

## The path

```
POST /api/guides/generate                    ENABLE_GUIDE_QUEUE=true
  └─ enqueue BullMQ job, return 202 + jobId       │
                                                  ▼
                              worker.js  (npm run worker:guide)
                                 ├─ generate the guide
                                 └─ finalize: save + spend credit + email   ← 1
                                                  │
   browser polls GET /api/guides/jobs/:id ────────┤
     └─ finalizes if the worker did not           ← 2
                                                  │
   GET /api/cron/finalize-guides (every 15 min) ──┘
     └─ sweeps completed jobs with no Guides row  ← 3
```

All three call the same idempotent `finalizeGuideJob`, keyed on `guideId`.
Whoever arrives first wins; the others no-op. A guide is never saved twice and a
credit is never spent twice.

If `ENABLE_GUIDE_QUEUE` is not `"true"`, the API skips all of this and generates
inline, saving before it responds. That path is simpler but has no protection
against a serverless timeout on a slow generation.

### 1. The worker — the one that should do the work

`worker.js` runs as a standalone process, wherever you host it. It finalizes the
moment generation completes, so nothing depends on the actor still having the
page open.

This is why the worker's environment matters more than it used to:

```
REDIS_URL=rediss://...                  # required; the worker exits without it
ANTHROPIC_API_KEY=sk-ant-...            # required; the worker exits without it
SUPABASE_URL=https://xxxx.supabase.co   # required to SAVE guides
SUPABASE_SERVICE_ROLE_KEY=...           # required to SAVE guides
SES_SMTP_HOST=email-smtp.<region>.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=...
SES_SMTP_PASS=...
EMAIL_FROM=noreply@prep101.site
FRONTEND_URL=https://prep101.childactor101.com   # the link in the email
```

The worker prints a banner on boot. A healthy one reads:

```
   Redis: configured
   Anthropic: configured
   Supabase: configured
   Email (SES): configured
```

`Supabase: MISSING` logs an error and means guides generate but are only saved
if a browser happens to still be polling. `Email (SES): MISSING` means guides
save but nobody is told.

### 2. The polling endpoint — the one that used to do all of it

`GET /api/guides/jobs/:id` finalizes a completed job if it finds no row for it.
Before the worker took over, this was the *only* place a guide was ever saved,
which meant closing the tab during a generation lost it outright. It stays as a
fallback and needs nothing new — it runs in the API, which has always had the
Supabase credentials.

### 3. The cron sweep — the one that catches what the other two miss

`GET /api/cron/finalize-guides` runs every 15 minutes via Vercel Cron
(`vercel.json` → `crons`). It scans recent completed jobs, finds any with no
`Guides` row, and finalizes them.

This exists because the worker is the weakest link in the chain: it is a
long-lived process on separate infrastructure, and it can be down, unreachable,
or running an older build without anything in the API noticing. The sweep does
not care where the worker lives or how current it is — if a guide was generated
and never saved, it gets saved.

Required on the Vercel project:

```
CRON_SECRET=<a long random string>
```

Vercel sends it as `Authorization: Bearer $CRON_SECRET`. The endpoint **fails
closed**: with no `CRON_SECRET` set it returns 503 and does nothing, rather than
leaving a route that writes to the database open.

Tuning, if the Redis bill matters (see `a3ece7c` for prior work here):

```
GUIDE_RECOVERY_SCAN=20   # completed jobs inspected per sweep
GUIDE_RECOVERY_MAX=10    # guides finalized per sweep; the rest wait for the next
```

At the defaults a sweep costs roughly 20 Redis reads, and jobs the worker
already finalized are skipped without a database lookup — so a healthy system
spends about 2,000 Redis commands a day on this, and a sick one spends slightly
more and rescues guides.

## When a guide is missing

```bash
npm run recover:guides           # report what is stranded
npm run recover:guides -- --apply  # save, credit and email it
```

Same sweep as the cron, run by hand. Needs `REDIS_URL` plus the Supabase
credentials. BullMQ keeps the last 100 completed jobs, so anything recent is
recoverable; older than that and the return value is gone.

If it reports nothing stranded and the guide still is not there, the job never
completed — look at whether the worker is running at all.

## Tests

```bash
npm run test:finalizer   # save / credit / email / idempotency / race handling
npm run test:cron        # cron auth and sweep behaviour
```
