
## Cursor Working Agreement (Prep101)

At the start of every session, paste this:

```
Read .cursor/rules.md, .cursor/context.md, and DECISIONS.md. Summarize last 3–5 DECISIONS entries. Use today’s date (YYYY-MM-DD) and propose new DECISIONS entries after each resolved issue.
```

### Emergency Brakes
- STOP spiral: `STOP. Summarize plan in one sentence. Wait for my approval.`
- Doc reminder: `Check .cursor/rules.md, .cursor/context.md, and DECISIONS.md. Don’t repeat solved issues.`
- Lazy delegation: `Run it yourself. Do not hand back trivial steps.`

### Enforcement Script
We include `scripts/ensure-decisions-updated.ts` which blocks commits if `DECISIONS.md` has not been touched in the last 24h when code changes occur. Integrate with Husky or your CI pipeline.

Run locally:
```bash
ts-node scripts/ensure-decisions-updated.ts
```
