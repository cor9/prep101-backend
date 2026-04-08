/**
 * Centralized Text Cleaning & Quality Assessment Service
 * Optimized for script/sides extraction across Prep101, BoldChoices, and Reader101.
 */

/**
 * Aggressive cleaning for script extractions.
 * Targets project codes (B540LT), timestamps, and repetitive watermarks.
 */
function isLikelyWatermarkLine(line) {
  const text = String(line || '').trim();
  if (!text) return false;

  if (
    /Sides by Breakdown Services - Actors Access/i.test(text) ||
    /Actors Access/i.test(text) ||
    /Breakdown Services/i.test(text) ||
    /Page \d+\s+of\s+\d+/i.test(text) ||
    /This document.*confidential/i.test(text) ||
    /Confidential/i.test(text)
  ) {
    return true;
  }

  if (
    /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(text) ||
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/i.test(text) ||
    /^[0-9\s\-_:/.]+$/i.test(text)
  ) {
    return true;
  }

  if (/^[A-Z0-9\-_]{5,20}$/.test(text) && /\d/.test(text)) {
    return true;
  }

  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const uppercaseLetters = (text.match(/[A-Z]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[^A-Za-z0-9\s]/g) || []).length;
  const compactLength = text.replace(/\s+/g, '').length || 1;

  if (digits >= 4 && letters <= 6 && /^[A-Z0-9\s\-_:/.]+$/.test(text)) {
    return true;
  }

  if (
    compactLength >= 8 &&
    digits / compactLength > 0.35 &&
    punctuation / compactLength > 0.08
  ) {
    return true;
  }

  if (letters > 0 && uppercaseLetters / letters > 0.95 && digits > 0 && letters < 10) {
    return true;
  }

  return false;
}

function cleanExtractedText(text) {
  if (!text) return '';

  return text
    // 1) Kill timestamps: Feb 12, 2025 10:30 AM or similar
    .replace(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}.*?(AM|PM)/gi, '')
    
    // 2) Kill watermark codes like B540LT-B540LT or B568CR
    .replace(/(B\d{3,}[A-Z]*)[-\s]*/gi, '')
    
    // 3) Kill common Breakdown Services / Actors Access footers
    .replace(/Sides by Breakdown Services - Actors Access|Page \d+\s+of\s+\d+/gi, '')

    // 3b) Kill common confidentiality and watermark overlays
    .replace(/This document.*confidential.*$/gim, '')
    .replace(/Confidential\s*-\s*Do Not Duplicate.*$/gim, '')
    .replace(/For internal use only.*$/gim, '')
    
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
      if (isLikelyWatermarkLine(t)) return false;

      // Keep it if it's short dialogue OR if it appears less than 3 times
      if (t.length < 5) return true;
      if (counts[t] >= 3) return false;
      if (counts[t] >= 2 && isLikelyWatermarkLine(t)) return false;
      return Boolean(t);
    })
    .join('\n');
}

/**
 * Assesses the quality of the text based on common corruption markers.
 * Implements the "Pivot to Fallback" logic if content is sparse.
 */
function assessQuality(text) {
  if (!text) {
    return {
      quality: 'empty',
      usable: false,
      reason: 'No text extracted',
      wordCount: 0,
      ratio: 0,
      shortButReadable: false,
      fallbackRecommended: true,
    };
  }

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const unique = new Set(words);

  const ratio = wordCount > 0 ? unique.size / wordCount : 0;

  // 1) Too short for deep coaching
  if (wordCount < 100) {
    return { 
      quality: 'too_short', 
      usable: true,
      reason: 'Readable text is short, so deep line-specific coaching may be limited',
      wordCount,
      ratio,
      shortButReadable: true,
      fallbackRecommended: false,
    };
  }

  // 2) Too repetitive (likely scrambled PDF or OCR failure)
  if (ratio < 0.25) {
    return { 
      quality: 'repetitive', 
      usable: false, 
      reason: 'Extracted text appears corrupted or overly repetitive',
      wordCount,
      ratio,
      shortButReadable: false,
      fallbackRecommended: true,
    };
  }

  return {
    quality: 'good',
    usable: true,
    wordCount,
    ratio,
    shortButReadable: false,
    fallbackRecommended: false,
  };
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
  assessQuality,
  isLikelyWatermarkLine,
};
