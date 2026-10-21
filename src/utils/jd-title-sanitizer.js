/**
 * JD Title Sanitizer
 *
 * Strips gender/legal suffixes from job titles (e.g. "(m/w/d)", "(f/m/x)", "(all genders)")
 * and trailing parenthetical role descriptors (e.g. "(Backend)", "(Remote)").
 * These suffixes are common in German-speaking job postings and should not appear
 * verbatim in generated CV headlines — they make the headline look copy-pasted.
 *
 * Interface: sanitizeJdTitle(title: string|null|undefined) => string
 */

const SUFFIX_PATTERNS = [
  // Parenthesized gender/legal variants
  /\(\s*(?:m\s*\/\s*w\s*\/\s*d|f\s*\/\s*m\s*\/\s*x|f\s*\/\s*m\s*\/\s*d|m\s*\/\s*f\s*\/\s*d|m\s*\/\s*f\s*\/\s*x|m\s*\/\s*w\s*\/\s*x|d\s*\/\s*m\s*\/\s*w|m\s*\/\s*w|all\s+genders|gn)\s*\)/gi,
  // Bare gender/legal variants without parentheses: "m/w/d", "f/m/x", etc.
  /\b(?:m\s*\/\s*w\s*\/\s*d|f\s*\/\s*m\s*\/\s*x|f\s*\/\s*m\s*\/\s*d|m\s*\/\s*f\s*\/\s*d|m\s*\/\s*f\s*\/\s*x|m\s*\/\s*w\s*\/\s*x|d\s*\/\s*m\s*\/\s*w|m\s*\/\s*w)\b/gi,
  // "(all genders)" with case variations
  /\(\s*(?:all\s+genders)\s*\)/gi,
  // "(gn)"
  /\(\s*gn\s*\)/gi,
];

/**
 * Strips gender/legal suffixes and trailing role descriptors from a job title.
 * Also removes any trailing parenthetical content (e.g. "(Backend)", "(Remote)")
 * that would make a CV headline look like a raw copy-paste of the job posting.
 *
 * @param {string|null|undefined} title - The raw job title from a job description
 * @returns {string} The sanitized title, trimmed. Empty string for null/undefined.
 */
function sanitizeJdTitle(title) {
  if (title == null) return '';

  let cleaned = String(title);

  // Step 1: Strip known gender/legal suffix patterns (including mid-title and bare variants)
  for (const pattern of SUFFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Step 2: Strip any remaining trailing parenthetical content
  // This catches role descriptors like "(Backend)", "(Remote)", "(Hybrid)",
  // and any gender variants not covered by the explicit patterns above.
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/g, '');

  // Clean up leftover double spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Replaces or removes a headline's first pipe-separated segment when it matches
 * the job title verbatim (case-insensitive). A verbatim match makes the CV look
 * like a raw copy-paste of the job posting — a red flag for ATS and recruiters.
 *
 * Replacement priority:
 *   1. User's most recent experience role (if different from the job title)
 *   2. Drop the first segment, keeping the remaining segments
 *
 * @param {string} headline - The pipe-delimited headline (e.g. "Title | Skills | Achievement")
 * @param {string} jobTitle - The sanitized job title to compare against
 * @param {Object} [userProfile] - User profile, optionally with experience array
 * @returns {string} The headline with verbatim job title replaced or removed
 */
function deverbatimizeHeadline(headline, jobTitle, userProfile) {
  if (!headline || !jobTitle) return headline || '';

  const segments = headline.split('|').map((s) => s.trim());
  if (segments.length === 0) return headline;

  const firstSegment = segments[0];
  const normalizedFirst = firstSegment.toLowerCase().trim();
  const normalizedTitle = String(jobTitle).toLowerCase().trim();

  // No verbatim match — nothing to fix
  if (normalizedFirst !== normalizedTitle) return headline;

  // Try to substitute the user's most recent experience role
  const experience = Array.isArray(userProfile?.experience) ? userProfile.experience : [];
  if (experience.length > 0) {
    const mostRecent = experience[0];
    const userRole = mostRecent?.role || mostRecent?.title || '';
    const normalizedUserRole = userRole.toLowerCase().trim();
    // Only use the user's role if it's different from the job title
    if (userRole && normalizedUserRole !== normalizedTitle) {
      segments[0] = userRole;
      return segments.join(' | ');
    }
  }

  // No alternative role available — drop the verbatim first segment
  if (segments.length > 1) {
    return segments.slice(1).join(' | ');
  }

  // Edge case: headline was only the job title (single segment)
  return headline;
}

module.exports = { sanitizeJdTitle, deverbatimizeHeadline };
