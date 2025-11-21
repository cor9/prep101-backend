# 🔍 PDF Extraction Issue - "Limited Content" Error

## What's Happening

Users are seeing this error when uploading scripts:
```
"Limited content: please upload a script with actual dialogue and scene content"
```

## Root Cause

The PDF text extraction is failing or producing poor quality output, causing the content quality check to reject the file.

### Extraction Flow
1. **Adobe PDF Extract** (primary) → Falls back if fails
2. **Basic PDF Parse** (fallback #1) → Falls back if < 100 chars
3. **OCR with Claude Vision** (fallback #2) → Last resort

### Quality Check Thresholds
The extracted text is rejected if:
- ❌ Word count < 50 words → `insufficient_content`
- ❌ Repetitive patterns > 5% → `repetitive_content` (watermarks/timestamps)
- ❌ Same word appears > 10% → `high_repetition`

## Why This Happens

### Possible Causes:
1. **Adobe PDF Service Not Working**
   - Adobe credentials missing/invalid
   - Adobe API quota exceeded
   - Service connectivity issues

2. **PDF Format Issues**
   - Scanned images (not searchable text)
   - Poor quality scans
   - Protected/encrypted PDFs
   - Unusual fonts/encoding

3. **Basic Parser Limitations**
   - `pdf-parse` library struggles with complex PDFs
   - Special formatting breaks extraction
   - Multi-column layouts confuse parser

4. **OCR Fallback Not Triggering**
   - OCR requires pdf2pic + GraphicsMagick/ImageMagick
   - May not be available in Vercel serverless environment

## Immediate Solutions

### Solution 1: Check Adobe PDF Service

```bash
# Check if Adobe is enabled
vercel env ls | grep ADOBE

# Test Adobe credentials locally
node test-adobe-extract.js
```

If Adobe is not working, the system should gracefully fall back to basic extraction.

### Solution 2: Improve Basic Extraction

The basic `pdf-parse` library should handle most scripts. If it's failing, we need to:
- Add better error handling
- Improve text cleaning
- Add more lenient quality thresholds

### Solution 3: Lower Quality Thresholds (Temporary)

Current thresholds are strict. We can temporarily lower them:
```javascript
// Current: wordCount < 50 → reject
// Proposed: wordCount < 25 → reject

// Current: repetitiveRatio > 0.05 (5%) → reject  
// Proposed: repetitiveRatio > 0.10 (10%) → reject
```

## Quick Fix Options

### Option A: Relax Quality Thresholds (Fastest)
**Impact**: Allow more PDFs through, some may have quality issues
**Risk**: Low - bad content will just produce generic guides

### Option B: Fix Adobe Extraction (Best)
**Impact**: Significantly better extraction quality
**Risk**: Medium - needs Adobe API credentials and testing

### Option C: Improve Basic Parser (Medium)
**Impact**: Better fallback when Adobe fails
**Risk**: Low - improves existing code

## Recommended Action Plan

### Immediate (Do Now):
1. ✅ Check Adobe PDF credentials in Vercel
2. ✅ Test with a real script PDF
3. ✅ Check extraction logs

### Short Term (Next 24 hours):
1. Temporarily relax quality thresholds to unblock users
2. Add detailed logging to see what extraction method succeeds
3. Test with various PDF formats

### Long Term (Next Week):
1. Fix Adobe PDF extraction if broken
2. Improve basic parser with better text cleaning
3. Add PDF format validation before processing

## Testing

### Test Script Upload:
1. Go to https://prep101.site/dashboard
2. Upload a script PDF
3. Check browser console for errors
4. Check if error is "Limited content..."

### Check Extraction Logs:
Go to Vercel Dashboard → Functions → Find `/api/upload` logs
Look for:
- `[UPLOAD] Adobe failed or empty`
- `[UPLOAD] Basic extraction failed`
- `[UPLOAD] Poor content quality detected`

## Quick Diagnostic

Run this to see the current settings:
```bash
curl https://prep101-api.vercel.app/health
```

Look for:
- `adobeExtract`: enabled/disabled
- `minExtractWords`: current threshold

## Next Steps

**Tell me:**
1. Can you try uploading a script PDF?
2. What exact error message do you see?
3. Can you share the PDF (or describe what type of PDF it is)?

Based on your answer, I'll implement the appropriate fix!

