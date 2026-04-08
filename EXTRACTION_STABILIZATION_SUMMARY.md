# Extraction Stabilization & Intelligent Fallback Summary
**Date:** April 8, 2026
**Status:** Deployed & Stable

## 🚨 The Problem: "Input Reliability Bottleneck"
The system was experiencing a "hard fail" loop:
1. **Adobe SDK Failure**: In Vercel serverless environments, the Adobe PDF Services SDK was failing with `Cannot find module './SessionToken'`. This was identified as a dynamic bundling issue where Vercel's Node File Trace (NFT) missed internal SDK dependencies.
2. **Brittle Fallback**: The "basic" extractor was too weak, often returning 0 words for messy or watermarked PDFs.
3. **Guardrail rejection**: The system would throw a `422: Limited content` error, blocking the user entirely.

## 🛠️ The Solution: Bulletproof Pipeline
We transitioned from an "error-on-failure" model to a **"pivot-on-failure"** model.

### 1. Robust Extraction Stack
- **Primary Engine**: Switched to a hardened `pdf-parse` base.
- **Repetition Filter (Watermark Killer)**: Implemented `removeRepeatedLines` in `services/textCleaner.js`. This automatically identifies and deletes lines appearing 3+ times (timestamps, project codes like `B540LT`, and page headers).
- **Quality Grader**: Added a unique-to-total word ratio check. If the ratio is < 0.25 (highly repetitive) or word count < 100, the system triggers **Fallback Mode**.
- **OCR Rescue Path**: The upload route now escalates to OCR when cleaned extraction is still sparse, empty, or repetitive after the primary pass.
- **Short Sides Handling**: Readable uploads under 100 words are now treated as limited-but-usable instead of automatically corrupted.

### 2. Intelligent Fallback Engine (Archetype Mode)
Instead of failing, the system now returns `fallbackMode: true` and proceeds with generation:
- **Acting Guides (BoldChoices/Prep101)**: Pivots to generating choices from **Character Archetypes**, genres, and production metadata.
- **Reader Guides (Reader101)**: Pivots to generating tone-based reader dynamics (e.g., "This is a Drama—use the 50% Rule and stay emotionally disconnected").
- **Corey (AI Coach) Reframing**: The prompts are updated to say: *"Sides were messy, so I've built this guide using behavioral patterns and archetypes."*

### 3. UX Framing & Conversion
- **Frontend Notification**: Dashboard and BoldChoices now show a 🧠 toast telling the user we're using "Character and Tone" metadata.
- **Upsell Opportunity**: The limitation of the PDF is used to reinforce the value of high-quality inputs in the premium Prep101 tier.

## 📌 Technical Notes for Future Reference
- **Adobe SDK**: Do not attempt to re-enable Adobe as primary without confirming `node_modules/@adobe/pdfservices-node-sdk/**` is accurately tracked or moving to a serverful environment (Railway/DigitalOcean).
- **File Inclusion**: `vercel.json` now explicitly includes `services/**`, `config/**`, and `methodology/**` to prevent runtime "module not found" errors.
- **Pathing**: Always use `path.join(process.cwd(), ...)` for required folders in the Vercel environment.
- **Monitoring**: `/api/health` now exposes the last extraction method, fallback status, and method attempts; use that before guessing which stage failed.
- **OCR Caveat**: OCR still depends on PDF-to-image conversion working in the runtime environment, so watch production logs if scanned PDFs remain weak.
