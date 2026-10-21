/**
 * Normalize a date string to a consistent "Mon YYYY" display format.
 * Handles multiple input formats:
 *   - YYYY-MM-DD  →  Mon YYYY
 *   - YYYY-MM     →  Mon YYYY
 *   - Mon YYYY    →  Mon YYYY  (pass-through)
 *   - Month YYYY  →  Mon YYYY  (long month → abbreviated)
 *   - YYYY        →  YYYY       (no month to extract)
 *   - empty/undefined/null → ''
 *   - "Present" is left unchanged.
 *
 * @param {string|undefined|null} dateStr
 * @returns {string} Normalized date string
 */
function toDisplayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.toLowerCase() === 'present') return trimmed;

  // Already looks like "Mon YYYY" (e.g. "Jan 2020", "Mar 2021")
  if (/^[A-Z][a-z]{2} \d{4}$/.test(trimmed)) return trimmed;

  // Bare year (e.g. "2024") — no month to extract, keep as-is
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  // Try parsing with the Date constructor (handles ISO: YYYY-MM-DD, YYYY-MM)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // Long month name: "January 2024" → "Jan 2024"
  const longMonthMatch = trimmed.match(/^([A-Z][a-z]{2,8})\s+(\d{4})$/);
  if (longMonthMatch) {
    const monthName = longMonthMatch[1];
    const year = longMonthMatch[2];
    const parsedLong = new Date(`${monthName} 1, ${year}`);
    if (!isNaN(parsedLong.getTime())) {
      return parsedLong.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }

  // Give up — return as-is
  return trimmed;
}

module.exports = { toDisplayDate };
