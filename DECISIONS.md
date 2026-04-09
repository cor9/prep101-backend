## 2026-04-08
**Issue:** Sparse and image-heavy PDFs were still falling through to weak extraction results because OCR existed in code but was never called from the upload route.
**Decision:** Wired the upload pipeline to try `pdf-parse` first, then Adobe when enabled and sparse, then OCR when extraction is still sparse, empty, or repetitive. Added extraction attempt metadata to health diagnostics.
**Status:** Success

## 2026-04-08
**Issue:** Short but readable audition sides were being marked unusable and pushed into fallback mode too early.
**Decision:** Reclassified `too_short` extraction results as readable-but-limited instead of unusable corruption, so clean short sides can still drive line-based guidance.
**Status:** Success

## 2026-04-08
**Issue:** Repo context files were stale about current PDF extraction behavior and monitoring.
**Decision:** Updated project context and extraction summary docs to reflect the live pipeline, health diagnostics, and remaining OCR deployment caveat.
**Status:** Success

## 2026-04-08
**Issue:** Reader101 was treating intimate material like standard reader coaching, which risks sanitizing the scene or pushing readers into the wrong kind of participation.
**Decision:** Added intimacy detection, an intimacy-only section, stricter consequence-based prompt rules, exact role-lock language, parent/minor professionalism guidance, and an intimacy-specific fallback path for partial text.
**Status:** Success

## 2026-04-08
**Issue:** Reader101 still needed stronger system-level handling for high-risk scenes involving shame, moral contradiction, and power imbalance, not just obvious intimacy keywords.
**Decision:** Added a high-risk scene classifier, injected system-level discomfort/playability language, forced emotional arc mapping, and required Foster-style Scene 3 adjustments for shame-heavy material.
**Status:** Success

## 2026-04-08
**Issue:** Guide generation could fail with "Upload session expired" in serverless cold starts because the upload response returned `text` while the generate flow expected `sceneText`, so the client fallback payload was often empty.
**Decision:** Normalized upload payloads on the client, returned `sceneText` from `/api/upload`, restored missing uploads from `scenePayloads` before throwing an expiry error, and cached the latest upload payload in `sessionStorage` for refresh recovery.
**Status:** Success

## 2026-04-08
**Issue:** Watermark-heavy PDFs were still slipping into generic fallback coaching, which created unacceptable UX and hid extraction failures behind "we'll build it from tone" messaging.
**Decision:** Strengthened watermark stripping heuristics, removed the generic fallback upload toast, and changed unreadable watermark/repetition cases to fail explicitly with an extraction error instead of generating fallback guides.
**Status:** Success

## 2026-04-08
**Issue:** Some watermarked PDFs are visually readable but break standard text extraction because the underlying text layer is garbage or unordered.
**Decision:** Added watermark-interference heuristics, escalated those files to OCR earlier in the upload pipeline, and surfaced an explicit image-based-reading recovery message when OCR is used successfully.
**Status:** Success

## 2026-04-08
**Issue:** The PDF ingest path still depended on ad hoc extraction patches and could reject low-signal uploads instead of routing them through a deterministic multi-stage recovery flow.
**Decision:** Added a dedicated staged ingest module with text -> OCR -> vision routing, standardized the extraction contract to `text/source/confidence/warnings`, added routing tests for clean/watermarked/scanned/corrupted cases, and removed generation-side hard-fails so limited text still produces a guide-compatible result.
**Status:** Success

## 2026-04-08
**Issue:** Reader101 was still asking the model to write full HTML artifacts, which made section order, wording severity, and high-risk handling vulnerable to drift.
**Decision:** Split Reader101 into a fixed-template architecture under `reader101/templates` and `reader101/system`, moved generation to structured JSON-only content, added template selection plus deterministic rendering, and kept the existing `generateReaderGuide()` service contract as a wrapper over the new builder.
**Status:** Success

## 2026-04-08
**Issue:** Cross-product auth was still a fragile bridge between `prep101.site`, `reader101.site`, and `boldchoices.site`, with no shared identity/context layer for actor vs parent usage.
**Decision:** Started Phase 2 of the Child Actor 101 account system by adding backend `profiles` / `actor_profiles` foundations, shared auth endpoints (`/api/auth/verify`, `/dashboard`, `/context`, `/onboarding`, `/select-actor`), a Supabase migration, and a first Prep101 onboarding flow that captures role plus active actor context.
**Status:** In Progress

## 2026-04-08
**Issue:** Prep101 understood the new Child Actor 101 account context, but Bold Choices still treated auth as a bare login and Reader101 still trusted a token without verifying the shared account state.
**Decision:** Extended the shared account model across products by making Bold Choices onboarding-aware, surfacing the active actor in Bold Choices, adding return-aware onboarding redirects, and teaching Reader101's static site to verify the account and route incomplete accounts into the central Prep101 onboarding flow.
**Status:** Success

## 2026-04-08
**Issue:** Deploy tooling, guide exports, and Stripe account linkage were still split across old and new paths, which caused wrong-site Netlify deploys, broken saved-guide actions, and inconsistent account persistence for Bold Choices.
**Decision:** Stopped tracking generated `.netlify` metadata, hardened auth to accept token-based download links, replaced the stub guides routes with real list/get/html/pdf endpoints, started persisting full Bold Choices guides into the shared guide library, and enriched Stripe checkout webhook reconciliation with session line-item/user-id resolution plus post-sync user refresh on the success screen.
**Status:** Success
