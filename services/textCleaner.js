/**
 * Centralized Text Cleaning & Quality Assessment Service
 * Optimized for script/sides extraction across Prep101, BoldChoices, and Reader101.
 */

/**
 * Aggressive cleaning for script extractions.
 * Targets project codes (B540LT), timestamps, and repetitive watermarks.
 */
function cleanExtractedText(text) {
  if (!text) return '';

  return text
    // 1) Kill timestamps: Feb 12, 2025 10:30 AM or similar
    .replace(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}.*?(AM|PM)/gi, '')
    
    // 2) Kill watermark codes like B540LT-B540LT or B568CR
    .replace(/(B\d{3,}[A-Z]*)[-\s]*/gi, '')
    
    // 3) Kill common Breakdown Services / Actors Access footers
    .replace(/Sides by Breakdown Services - Actors Access|Page \d+\s+of\s+\d+/gi, '')
    
    // 4) Remove repeated garbage chunks (e.g., "XXXXXXXXX")
    .replace(/(.{3,10})\1{3,}/g, '')
    
    // 5) Normalize spacing: collapse tabs and multiple spaces
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The Secret Weapon: Repetition Filter.
 * Removes lines that appear 3+ times (usually watermarks, headers, or footers).
 */
function removeRepeatedLines(text) {
  if (!text) return '';
  const lines = text.split('\n');

  const counts = {};
  lines.forEach(line => {
    const t = line.trim();
    if (!t || t.length < 3) return; // Don't count short dialogue like "No" or "I"
    counts[t] = (counts[t] || 0) + 1;
  });

  return lines
    .filter(line => {
      const t = line.trim();
      // Keep it if it's short dialogue OR if it appears less than 3 times
      return t && (t.length < 5 || counts[t] < 3);
    })
    .join('\n');
}

/**
 * Assesses the quality of the text based on common corruption markers.
 * Implements the "Pivot to Fallback" logic if content is sparse.
 */
function assessQuality(text) {
  if (!text) return { quality: 'empty', usable: false, reason: 'No text extracted' };

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const unique = new Set(words);

  const ratio = wordCount > 0 ? unique.size / wordCount : 0;

  // 1) Too short for deep coaching
  if (wordCount < 100) {
    return { 
      quality: 'too_short', 
      usable: false, 
      reason: 'Insufficient dialogue for line-specific guidance',
      wordCount 
    };
  }

  // 2) Too repetitive (likely scrambled PDF or OCR failure)
  if (ratio < 0.25) {
    return { 
      quality: 'repetitive', 
      usable: false, 
      reason: 'Extracted text appears corrupted or overly repetitive',
      ratio 
    };
  }

  return { quality: 'good', usable: true, wordCount, ratio };
}

/**
 * Primary processing pipeline for PDF text.
 */
function scrubWatermarks(text) {
  let cleaned = cleanExtractedText(text);
  cleaned = removeRepeatedLines(cleaned);
  return cleaned;
}

module.exports = {
  scrubWatermarks,
  cleanExtractedText,
  removeRepeatedLines,
  assessQuality
};
