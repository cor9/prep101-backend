# Prep101 PDF Extraction Survival Protocol

This service must assume audition sides are watermarked by default.

## Goal

Generate from verified script text, not from raw PDF text volume. A PDF can contain thousands of words of watermark garbage and still contain very little usable script text.

## Runtime Protocol

1. Fast text-layer pass
   - Run `pdf-parse` / Adobe text extraction.
   - Keep page count and raw diagnostics.
   - Accept only if text is script-like, non-repetitive, and plausible for page count.

2. Quality gates
   - Reject or escalate text-layer output when any of these are true:
     - repeated token ratio is high
     - watermark interference is detected
     - metadata-heavy lines dominate
     - entropy is too low
     - multi-page PDF has suspiciously low script density
     - quality is `repetitive`, even if word count is high

3. Managed OCR recovery
   - For failed gates, call purifier/OCR pipeline:
     - `PDF_PURIFIER_URL` raster/purify worker
     - Mistral OCR first
     - LlamaParse fallback
     - OpenAI vision fallback
   - Map OCR blocks back into screenplay structure.

4. Acceptance rule
   - For low-density text, OCR must beat the text layer by a strong margin.
   - For watermark-corrupted text, OCR does not need to beat fake watermark word count; it must be non-repetitive and clear a page-count-based minimum.

5. Generation handoff
   - If upload produced verified usable text, generate from cached text via JSON endpoint.
   - Do not send the same PDF back through direct PDF extraction.
   - Only use `generate-from-pdf` when upload is partial/unreadable and one more PDF-native recovery pass is needed.

6. UX contract
   - Never show “PDF processed — N words extracted” if `scriptReadable === false`.
   - On hard Vercel timeout (`FUNCTION_INVOCATION_TIMEOUT` / `HTTP 504`), stop spinner immediately and show a truthful failure.
   - Do not silently retry long server timeout requests while the customer sees “still building.”

## Verified Fixtures

- `AWTR_-_Jamie_Sides.pdf`
  - Old: 112 words, casting notes only.
  - New: 653 script words via `purifier_ocr:mistral-ocr-latest`.

- `ANNABETH_Sides_8.27.pdf`
  - Old: 5250 fake watermark words, `scriptReadable: false`.
  - New: 1163 script words via `purifier_ocr:mistral-ocr-latest`.
