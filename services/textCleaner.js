/**
 * textCleaner.js
 * 
 * Centralized utility for scrubbing watermarks, timestamps, and metadata 
 * from extracted PDF text to prevent LLM hallucinations and corruption.
 */

function scrubWatermarks(text) {
  if (!text) return "";

  return text
    // 1) Destroy specific date/time watermarks "- Feb 17, 2026 9:41 AM -"
    .replace(/\-\s*[a-zA-Z]{3,12}\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*[AP]M\s*\-/gi, " ")
    
    // 2) Aggressively destroy repetitive uppercase project tags like B540LT-B540LT or B568CR
    .replace(/\b[A-Z0-9]{5,15}\b(?:-\b[A-Z0-9]{5,15}\b)*/gi, (match) => {
      // If it's a fully uppercase/numeric code block like B540LT, destroy it
      // We check if it has at least one digit to avoid destroying actual character names (though those are usually followed by colon)
      const hasNumbers = /\d/.test(match);
      if (match === match.toUpperCase() && match.length > 5 && hasNumbers) return " ";
      return match;
    })

    // 3) Targeted project codes and common agency watermarks
    .replace(/\bB\d{3,}[A-Z0-9]*\b/gi, " ")
    .replace(/\b[A-Z]\d{3,}[A-Z]{2}\b/gi, " ") // B123BC, C456DE etc
    .replace(/(?:B540LT|B568CR|74222|B540|B568)/gi, " ")
    .replace(/Sides by Breakdown Services - Actors Access/gi, " ")
    .replace(/Page \d+ of \d+/gi, " ")
    .replace(/This document.*confidential/gi, " ")
    .replace(/CONFIDENTIAL/g, " ")
    
    // 4) Timestamps and date strings
    .replace(/\b\d{1,2}:\d{2}:\d{2}\s*[AP]M\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi, " ")
    .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/gm, " ")
    .replace(/^\d{1,2}:\d{2}:\d{2}\s*$/gm, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ") // Date like 04/07/26
    
    // 5) Repetitive numeric sequences (often watermarks)
    .replace(/\b\d{5,}\b/g, " ")
    
    // 6) Clean up formatting artifacts
    .replace(/^[0-9\s\-_:]+$/gm, " ") // Lines with only numbers/symbols
    .replace(/^[A-Za-z]{1,2}\s*$/gm, " ") // Single/double letter lines (often artifacts)
    .replace(/\-{2,}/g, " ") // Long dashes
    .replace(/\n{3,}/g, "\n\n") // Excessive newlines
    .replace(/[ \t]{2,}/g, " ") // Multiple spaces
    .trim();
}

/**
 * Assesses the quality of the text based on common corruption markers.
 */
function assessQuality(text, wordCount) {
  if (!text || wordCount < 10) return { quality: "poor", reason: "empty_or_too_short" };

  const repetitivePatterns = [
    /\b\d{5,}\b/g,
    /\b[A-Z0-9]{6,12}-[A-Z0-9]{6,12}\b/g,
    /\d{1,2}:\d{2}:\d{2}/g,
  ];

  const repetitiveMatches = repetitivePatterns.reduce((count, pattern) => {
    return count + (text.match(pattern) || []).length;
  }, 0);

  const repetitiveRatio = repetitiveMatches / Math.max(wordCount, 1);

  if (repetitiveRatio > 0.5) return { quality: "poor", reason: "heavy_watermarks", ratio: repetitiveRatio };
  if (wordCount < 50) return { quality: "low", reason: "minimal_content" };

  return { quality: "good", reason: "sufficient_content" };
}

module.exports = {
  scrubWatermarks,
  assessQuality
};
