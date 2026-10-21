const llmService = require('../llm');
const logger = require('../../utils/logger');
const TextPostProcessor = require('./text-post-processor');

const LEVEL_RANK = { expert: 4, proficient: 4, advanced: 3, intermediate: 2, beginner: 1, basic: 1, learning: 1 };

// Generous output ceiling for the matching call: a truncated response used to
// kill both skill gates (empty matched + empty forbidden list) and let arbitrary
// profile skills leak into the CV. With index-based job term references the
// payload stays small, but large profiles + long JDs must never truncate mid-JSON.
const MATCHING_MAX_TOKENS = 6000;

/**
 * AI-driven skill matching: takes user skills and job requirements,
 * returns structured match results with composite tier assignments.
 * Uses one LLM call; all output processing is deterministic.
 */
class SkillMatcher {
  constructor(deps = {}) {
    this.textPostProcessor = deps.textPostProcessor || new TextPostProcessor();
  }

  /**
   * Compute a composite treatment tier for a matched skill.
   *
   * Returns one of:
   *   "feature" — write about it confidently and include in skills section
   *   "mention"  — include with measured, honest language
   *   "growth"   — frame as an area of active development
   *   "omit"     — do not mention at all
   *
   * Matrix (matchStrength × userLevel):
   *
   *              | expert/proficient | advanced | intermediate | beginner/basic
   * -------------|-------------------|----------|--------------|---------------
   * exact/strong | feature           | feature  | mention      | growth
   * moderate     | feature           | mention  | mention      | growth
   * weak         | mention           | mention  | growth       | omit
   */
  _forceAlwaysIncludeSkills(alwaysIncludeSkills) {
    return alwaysIncludeSkills.map((s) => ({
      name: s.name,
      level: (s.level || 'intermediate').toLowerCase(),
      category: s.category || 'technical',
      matchStrength: 'complementary',
      matchedJobTerms: [],
      tier: this.compositeSkillTier('complementary', s.level, true),
      alwaysInclude: true,
    }));
  }

  /**
   * Resolve job term references from the LLM response back to job term strings.
   * Accepts 1-based indices (numbers or numeric strings) into allJobTerms — the
   * contracted format — and, for backward compatibility with disobedient models,
   * raw requirement strings, which are kept verbatim. Invalid entries are dropped.
   *
   * @param {Array}  entries      - Mixed array of indices and/or strings
   * @param {Array}  allJobTerms  - Numbered job terms as shown in the prompt
   * @returns {Array<string>}
   */
  _resolveJobTerms(entries, allJobTerms) {
    if (!Array.isArray(entries)) return [];
    return entries
      .map((e) => {
        if (typeof e === 'number') {
          return Number.isInteger(e) && e >= 1 && e <= allJobTerms.length ? allJobTerms[e - 1] : null;
        }
        if (typeof e === 'string') {
          const trimmed = e.trim();
          if (/^\d+$/.test(trimmed)) {
            const idx = parseInt(trimmed, 10);
            return idx >= 1 && idx <= allJobTerms.length ? allJobTerms[idx - 1] : null;
          }
          return trimmed || null;
        }
        return null;
      })
      .filter(Boolean);
  }

  compositeSkillTier(matchStrength, userLevel, alwaysInclude = false) {    if (alwaysInclude) {
      const l = LEVEL_RANK[(userLevel || '').toLowerCase()] ?? 1;
      if (l >= 3) return 'feature';
      if (l >= 2) return 'mention';
      return 'growth';
    }

    if (matchStrength === 'complementary') {
      const level = LEVEL_RANK[(userLevel || '').toLowerCase()] ?? 2;
      return level >= 2 ? 'mention' : 'growth';
    }

    const strengthRank = { exact: 3, strong: 3, moderate: 2, weak: 1 };

    const s = strengthRank[matchStrength] ?? 2;
    const l = LEVEL_RANK[(userLevel || '').toLowerCase()] ?? 2;

    if (l >= 4 && s >= 2) return 'feature';   // expert/proficient + moderate+ match → feature
    if (l >= 3 && s >= 3) return 'feature';   // advanced + exact/strong match → feature
    if (l >= 3 && s >= 2) return 'mention';   // advanced + moderate / expert + weak → mention
    if (l >= 2 && s >= 2) return 'mention';   // intermediate + moderate+ match → mention
    if (s >= 3 && l < 2)  return 'growth';
    if (s >= 2 && l < 2)  return 'growth';
    if (s < 2  && l >= 3) return 'mention';
    if (s < 2  && l >= 2) return 'growth';
    return 'omit';
  }

  /**
   * Use the LLM to intelligently match user profile skills against job requirements,
   * handling synonyms, abbreviations, and conceptual equivalences.
   *
   * Falls back to empty match (no error) if the LLM call fails, so generation still proceeds.
   *
   * @param {Array}  userSkills       - Array of { name, level, category } from the user profile
   * @param {Array}  jobSkills        - Skill strings extracted from the job description
   * @param {Array}  jobRequirements  - Requirement strings from the job description
   * @param {string} userId           - User ID for LLM provider resolution
   * @returns {Promise<{ matched: Array, unmatchedJobSkills: Array, irrelevantUserSkills: Array, complementarySkills: Array }>}
   */
  async matchSkillsToJob(userSkills = [], jobSkills = [], jobRequirements = [], userId) {
    const safeUserSkills = Array.isArray(userSkills) ? userSkills.filter((s) => s?.name) : [];
    const alwaysIncludeSkills = safeUserSkills.filter((s) => s.alwaysInclude);
    const matchableSkills = safeUserSkills.filter((s) => !s.alwaysInclude);

    const allJobTerms = [
      ...(Array.isArray(jobSkills) ? jobSkills : []),
      ...(Array.isArray(jobRequirements) ? jobRequirements : []),
    ].filter(Boolean);

    if (matchableSkills.length === 0 && alwaysIncludeSkills.length === 0 && allJobTerms.length === 0) {
      return { matched: [], unmatchedJobSkills: allJobTerms, irrelevantUserSkills: [], complementarySkills: [] };
    }

    if (matchableSkills.length === 0 || allJobTerms.length === 0) {
      return {
        matched: this._forceAlwaysIncludeSkills(alwaysIncludeSkills),
        unmatchedJobSkills: allJobTerms,
        irrelevantUserSkills: [],
        complementarySkills: [],
      };
    }

    const userSkillList = matchableSkills
      .map((s, i) => `${i + 1}. "${s.name}" | level: ${s.level || 'intermediate'} | category: ${s.category || 'technical'}`)
      .join('\n');

    const jobTermList = allJobTerms
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    const matchingPrompt = `You are a strict skill-matching assistant. Your job is to identify which candidate skills are genuinely useful for THIS specific job — and aggressively filter out everything else.

CANDIDATE SKILLS:
${userSkillList}

JOB REQUIREMENTS / SKILLS NEEDED:
${jobTermList}

TASK:
Return a JSON object with exactly three keys:

1. "matched": array of objects for candidate skills that have DIRECT or STRONG relevance to the job. A skill qualifies only if you can write one clear sentence explaining exactly why it helps with this specific job. If you cannot, put it in "irrelevantUserSkills" instead.
   Each object must include:
   - "name": the candidate's skill name (exact, as provided)
   - "level": the candidate's proficiency level (exact, as provided)
   - "category": the candidate's skill category (exact, as provided)
   - "matchStrength": one of "exact" | "strong" | "moderate" | "weak":
       * "exact"    — the skill directly satisfies a job requirement (same technology, same concept)
       * "strong"   — a very close synonym, version variant, or near-equivalent (e.g. "Postgres" for "PostgreSQL", "JS" for "JavaScript")
       * "moderate" — a related tool in the SAME domain that transfers meaningfully AND the job would genuinely benefit from it (e.g. "pandas" for a data analysis requirement, "Docker" for a Kubernetes-heavy role)
       * "weak"     — only use this for skills that are adjacent to the job domain AND the candidate is advanced/expert in them. Do NOT use "weak" for beginner/intermediate skills with only tangential relevance — those go in "irrelevantUserSkills".
   - "matchedJobTermIndices": array of integers — the 1-based numbers of the JOB REQUIREMENTS / SKILLS NEEDED entries this skill matches (e.g. [1, 4]). Do NOT repeat the requirement text, only the numbers.

2. "unmatchedJobTermIndices": array of integers — the 1-based numbers of job requirement entries that no candidate skill covers at exact/strong/moderate level. Include requirements only matched at "weak" level here too. Do NOT repeat the requirement text, only the numbers.

3. "irrelevantUserSkills": array of candidate skill names (exact as provided) with NO direct relevance to this job. Be aggressive here — if it is not genuinely useful for this role, it belongs here.
   - Any skill from a completely different technology domain belongs here (e.g. "PHP" for a Java role, "Photoshop" for a backend role, "Excel" for a DevOps role).
   - Any "weak" match for a beginner/intermediate skill belongs here.
   - When in doubt, put it here rather than in "matched".
   - Do NOT list soft skills (communication, leadership, teamwork) as irrelevant — those always stay in "matched".

4. "complementarySkills": a small array (maximum 4) of candidate skill objects that were NOT matched to any job requirement but would still be a natural and credible addition to this role's skill set — selected ONLY from the CANDIDATE SKILLS list above. Never invent or add skills not present in that list.
   Rules for inclusion:
   - Pick skills at any proficiency level — beginner through expert. Level will determine how the skill is framed in the output.
   - Only include a skill if someone holding this job title would credibly be expected to have it (e.g. a "Full Stack Developer" role that matched React and Node but missed PostgreSQL — adding PostgreSQL is credible; adding Photoshop is not).
   - Use this to fill obvious domain-branch gaps: if the job title implies frontend + backend + database but the matched skills only cover 2 of those branches, pick 1–2 skills from the missing branch.
   - If the matched skills already cover the role broadly, return an empty array — do not pad for the sake of it.
   - Hard cap: maximum 4 skills total across all branches. Fewer is better than more.
   Each object must include: "name", "level", "category" (exact as provided in CANDIDATE SKILLS).

Matching rules:
- Match synonyms: "JS" = "JavaScript", "ML" = "Machine Learning", "k8s" = "Kubernetes", "Postgres" = "PostgreSQL"
- Match abbreviations and version variants: "React" = "React.js" = "ReactJS"
- Match conceptual equivalences WITHIN the same domain: "pandas" → "data analysis"; "scikit-learn" → "machine learning"
- Cross-discipline transfers are only valid at "weak" if the candidate is advanced/expert AND the job domain is adjacent (e.g. backend dev → DevOps is adjacent; backend dev → graphic design is NOT)
- Be strict and conservative — fewer matches in "matched" is better than padding with irrelevant skills
- If a candidate skill is "beginner" for an exact job requirement, still include it in "matched" (matchStrength "exact") AND in "unmatchedJobTermIndices"

STRICT RELEVANCE RULES — the JD may contain broad phrases; do not let them over-match:
- LAYER MATCHING: match skills only to the role's actual layer. A backend/API role does NOT match frontend frameworks (React, Vue, Angular, Tailwind, HTML, CSS) or mobile frameworks (React Native, Flutter) unless the JD names them explicitly. A frontend role does not match backend/infra tools unless named. A data role does not match UI tools unless named.
- VAGUE REQUIREMENTS: catch-all phrases like "experience with other programming languages", "modern architecture", or "tools such as X" do NOT justify matching every skill in the candidate's profile. Match only the specifically named items plus near-synonyms. For a vague "other programming languages" requirement, match at most 1–2 of the candidate's most relevant additional languages, and only at "weak".
- COMPANY CONTEXT IS NOT THE ROLE: text describing what the company builds ("we run web and mobile apps") is not a requirement of this specific role. Do not treat company product descriptions as job skills or as a reason to match.

Return ONLY valid JSON, no markdown, no explanation.`;

    try {
      const { text: response } = await llmService.generateText(matchingPrompt, {
        systemPrompt: 'You are a precise skill-matching assistant. Return only valid JSON.',
        maxTokens: MATCHING_MAX_TOKENS,
        temperature: 0.1,
        action: 'ENHANCE_DOCUMENT',
      }, userId);

      const cleaned = this.textPostProcessor.extractJsonFromMarkdown(response);
      const parsed = JSON.parse(cleaned);

      const VALID_STRENGTHS = new Set(['exact', 'strong', 'moderate', 'weak']);
      const alwaysIncludeNameSet = new Set(alwaysIncludeSkills.map((s) => (s.name || '').toLowerCase()));

      const matched = (Array.isArray(parsed.matched)
        ? parsed.matched.map((s) => ({
            name: s.name || '',
            level: (s.level || 'intermediate').toLowerCase(),
            category: s.category || 'technical',
            matchStrength: VALID_STRENGTHS.has(s.matchStrength) ? s.matchStrength : 'moderate',
            matchedJobTerms: this._resolveJobTerms(s.matchedJobTermIndices ?? s.matchedJobTerms, allJobTerms),
          }))
        : [])
        .filter((s) => !alwaysIncludeNameSet.has((s.name || '').toLowerCase()));

      const unmatchedJobSkills = this._resolveJobTerms(
        parsed.unmatchedJobTermIndices ?? parsed.unmatchedJobTerms,
        allJobTerms
      );

      const irrelevantUserSkills = Array.isArray(parsed.irrelevantUserSkills)
        ? parsed.irrelevantUserSkills
        : [];

      const userSkillNameSet = new Set(matchableSkills.map((s) => (s.name || '').toLowerCase()));
      const rawComplementary = Array.isArray(parsed.complementarySkills) ? parsed.complementarySkills : [];
      const complementarySkills = rawComplementary
        .filter((s) => s?.name && userSkillNameSet.has((s.name || '').toLowerCase()))
        .slice(0, 4)
        .map((s) => ({
          name: s.name,
          level: (s.level || 'intermediate').toLowerCase(),
          category: s.category || 'technical',
          matchStrength: 'complementary',
          matchedJobTerms: [],
        }));

      // Remove alwaysInclude skills from irrelevant — they must never be omitted
      const filteredIrrelevant = irrelevantUserSkills.filter(
        (name) => !alwaysIncludeNameSet.has((name || '').toLowerCase())
      );

      // Close the partition: any matchable skill the LLM failed to place in ANY
      // bucket (matched / irrelevant / complementary) is treated as irrelevant,
      // so it lands in the FORBIDDEN list downstream instead of leaking back into
      // the CV via the experience/projects context. Soft and language skills are
      // exempt — they are surfaced through their own dedicated sections regardless
      // of job relevance, and forbidding them CV-wide would be wrong.
      const classifiedNames = new Set(
        [
          ...matched.map((s) => s.name),
          ...filteredIrrelevant,
          ...complementarySkills.map((s) => s.name),
        ].map((n) => (n || '').toLowerCase())
      );
      const EXEMPT_CATEGORIES = new Set(['soft', 'language']);
      const unclassifiedIrrelevant = matchableSkills
        .filter((s) => !classifiedNames.has((s.name || '').toLowerCase()))
        .filter((s) => !EXEMPT_CATEGORIES.has((s.category || 'technical').toLowerCase()))
        .map((s) => s.name);
      const allIrrelevant = [...filteredIrrelevant, ...unclassifiedIrrelevant];

      // Re-inject alwaysInclude skills into matched with forced tiers
      const forcedAlwaysInclude = this._forceAlwaysIncludeSkills(alwaysIncludeSkills);

      logger.info(
        `AI skill matching: ${matched.length} matched, ` +
        `${unmatchedJobSkills.length} unmatched job terms, ` +
        `${allIrrelevant.length} irrelevant user skills omitted ` +
        `(${unclassifiedIrrelevant.length} unclassified by LLM), ` +
        `${complementarySkills.length} complementary skills added, ` +
        `${forcedAlwaysInclude.length} always-include skills forced`
      );
      return { matched: [...matched, ...forcedAlwaysInclude], unmatchedJobSkills, irrelevantUserSkills: allIrrelevant, complementarySkills };
    } catch (err) {
      logger.warn('AI skill matching failed, proceeding without matched skills context:', err.message);
      return {
        matched: this._forceAlwaysIncludeSkills(alwaysIncludeSkills),
        unmatchedJobSkills: allJobTerms,
        irrelevantUserSkills: [],
        complementarySkills: [],
      };
    }
  }
}

module.exports = SkillMatcher;
