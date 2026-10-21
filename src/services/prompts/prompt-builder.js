const SkillMatcher = require('../content/skill-matcher');
const LanguageDetector = require('../content/language-detector');
const { sanitizeJdTitle } = require('../../utils/jd-title-sanitizer');
const { toDisplayDate } = require('../../utils/date-format');

/**
 * Builds LLM prompts for CV and cover letter generation.
 * All prompt template construction lives here — no LLM calls, no I/O.
 */
class PromptBuilder {
  constructor(deps = {}) {
    this.skillMatcher = deps.skillMatcher || new SkillMatcher();
    this.languageDetector = deps.languageDetector || new LanguageDetector();
  }

  _fmtSkillAnnotation(s) {
    const base = s.matchStrength === 'complementary'
      ? `${s.name} (level: ${s.level}, complementary)`
      : `${s.name} (level: ${s.level}, match: ${s.matchStrength})`;
    return s.alwaysInclude ? base.slice(0, -1) + ', alwaysInclude)' : base;
  }

  // Relevance order for capping the growth tier: stronger match first, then by
  // level, then name for determinism. exact > strong > moderate > weak/complementary.
  _skillRelevanceRank(s) {
    const strengthRank = { exact: 4, strong: 3, moderate: 2, weak: 1, complementary: 1 };
    const levelRank = { expert: 4, proficient: 4, advanced: 3, intermediate: 2, beginner: 1, basic: 1, learning: 1 };
    return strengthRank[s.matchStrength] ?? 1;
  }

  /**
   * Cap the growth tier to the most relevant skills so vague JD requirements
   * ("experience with other languages") can't balloon the "In Entwicklung"
   * section with every beginner-level skill in the profile.
   */
  _capGrowthSkills(tieredSkills, limit = 5) {
    const growth = tieredSkills.filter((s) => s.tier === 'growth');
    const sorted = growth.sort((a, b) =>
      this._skillRelevanceRank(b) - this._skillRelevanceRank(a)
      || (a.name || '').localeCompare(b.name || '')
    );
    return sorted.slice(0, limit);
  }

  _formatProjects(projects) {
    return Array.isArray(projects)
      ? projects.map((proj) => `- ${proj?.name || ''}: ${proj?.description || ''}${proj?.url ? ` | URL: ${proj.url}` : ''}${proj?.technologies ? ` | Technologies: ${proj.technologies}` : ''}`).join('\n')
      : 'No projects provided';
  }

  _formatKeyAchievements(keyAchievements) {
    return Array.isArray(keyAchievements) && keyAchievements.length > 0
      ? keyAchievements.map((ach) => `- ${ach?.title || ''}: ${ach?.description || ''}`).join('\n')
      : 'None provided — synthesise from experience and projects';
  }

  /**
   * Compute the display end date for an experience entry.
   * Gate: `current` boolean is the source of truth.
   *   true  → "Present" regardless of endDate
   *   false → endDate value as-is (may be empty)
   *   missing → legacy fallback: endDate || "Present"
   * @param {Object} exp - Experience entry
   * @returns {string} Display end date
   */
  _formatExperienceEndDate(exp) {
    if (exp?.current === true) return 'Present';
    if (exp?.current === false) return exp?.endDate || '';
    // Missing current → legacy fallback
    return exp?.endDate || 'Present';
  }

  /**
   * Format a full date range string for an experience entry: "(startDate-endDate)".
   * @param {Object} exp - Experience entry
   * @returns {string} e.g. "(Jan 2020-Jun 2025)" or "(Jan 2020-Present)"
   */
  _formatExperienceDateRange(exp) {
    const endDisplay = this._formatExperienceEndDate(exp);
    const endDate = endDisplay === 'Present' ? 'Present' : toDisplayDate(endDisplay);
    return `(${toDisplayDate(exp?.startDate)}-${endDate})`;
  }

  /**
   * Build a skill gap bridging context block for injection into prompts.
   */
  buildSkillGapBridgingSection(unmatchedJobSkills = [], userExperience = [], userSkills = [], jobTitle = '') {
    if (!unmatchedJobSkills || unmatchedJobSkills.length === 0) return '';

    const gapList = unmatchedJobSkills.slice(0, 15).join(', ');

    const expSummary = Array.isArray(userExperience) && userExperience.length > 0
      ? userExperience.map((e) => (e?.role || e?.title) ? `${e.role || e.title}${e.company ? ` at ${e.company}` : ''}` : null).filter(Boolean).join('; ')
      : 'Not provided';

    const skillNames = Array.isArray(userSkills) && userSkills.length > 0
      ? userSkills.map((s) => s?.name).filter(Boolean).join(', ')
      : 'Not provided';

    return `
SKILL GAP ANALYSIS — candidate is applying despite not having all listed requirements:
Missing or unconfirmed job skills: ${gapList}
Candidate's existing experience roles: ${expSummary}
Candidate's listed skills: ${skillNames}

GAP BRIDGING INSTRUCTIONS — this is critical:
The candidate has chosen to apply to this ${jobTitle} role knowing they do not have every listed skill. Treat this as a deliberate career move where their existing experience makes them credible. Your job is to build a compelling, honest bridge between what they have and what the role needs:

1. IDENTIFY TRANSFERABLES: Look at the candidate's experience and existing skills. Find real, concrete overlaps with the missing skills — even indirect ones. Examples of valid bridging:
   - A backend developer applying to DevOps: CI/CD exposure, scripting, infrastructure-as-code mindset, deployment pipelines, system design, API reliability — all transfer.
   - A full-stack developer applying to Cloud Engineering: containerisation experience, deployment workflows, networking basics, cost-awareness from building scalable systems.
   - A software engineer applying to Data Engineering: SQL proficiency, API integration, data pipeline awareness, scripting.
   - In general: problem-solving methodology, engineering rigour, debugging, system thinking, and delivery track record all transfer across disciplines.

2. FRAME MISSING SKILLS AS GROWTH AREAS: For skills the candidate does not have, do NOT claim them. Instead, frame the candidate as someone who has the foundational engineering mindset and a track record of picking up new technologies quickly. Reference real evidence from their experience if available.

3. NARRATIVE ANGLE: The candidate's background gives them a complementary perspective that pure specialists may lack (e.g., a developer moving into DevOps understands the developer experience from the inside). Use this as a genuine differentiator.

4. HONESTY RULE: Do not invent experience, metrics, or skills. Only reference what is in the candidate's actual profile. The goal is to reframe and contextualise existing real experience to show credibility for the target role.

5. DO NOT OVER-APOLOGISE OR HIGHLIGHT THE GAP: Never write phrases like "although I lack X" or "despite not having experience in Y". Simply build the positive case from what exists.`;
  }

  /**
   * Build tone-matching instruction block.
   */
  buildToneMatchingSection() {
    return `
COMPANY TONE & CULTURE — READ AND MIRROR:
Before writing a single word, analyse the job description above for the following signals.
Your output must consistently reflect what you find.

1. FORMALITY LEVEL (scan vocabulary and sentence construction):
   - Formal ("We are seeking a highly qualified professional", "The successful candidate will…"):
     → Use formal register throughout. Full sentences. No contractions. No colloquialisms.
   - Semi-formal ("You'll be joining a team", "We'd love to meet you"):
     → Use natural professional voice. Occasional contractions are acceptable. Warm but precise.
   - Casual / startup ("We move fast", "You'll own your work", "No bullshit culture"):
     → Use direct, energetic, first-person voice. Short sentences. Confident and unpretentious.

2. COMPANY CULTURE SIGNALS (extract phrases that reveal what the company values):
   - Innovation / building ("greenfield", "from scratch", "cutting-edge", "R&D"):
     → Foreground building, creating, and solving hard problems.
   - Quality / reliability ("production-grade", "we ship with care", "scalable systems"):
     → Foreground thoroughness, stability, and ownership of outcomes.
   - Collaboration ("cross-functional", "pair programming", "we work as one team"):
     → Foreground communication, teamwork, and shared success.
   - Impact / scale ("X million users", "real-world impact", "mission-driven"):
     → Foreground outcomes, scale, and the human effect of the work.
   - Ownership / startup pace ("wear many hats", "shape the roadmap", "fast-paced"):
     → Foreground versatility, initiative, and growth mindset.

3. VOCABULARY — echo the company's own language family:
   - Identify 2–3 distinctive phrases or domain-specific terms the job posting uses.
   - Adopt their vocabulary family naturally in your output — do not copy verbatim, but
     use the same register and terminology choices.
   - If the JD uses "engineer" not "developer", use "engineer". If it uses "product" not
     "project", use "product". If it uses "craft" for quality work, echo that framing.

4. SENTENCE RHYTHM — mirror the JD's own cadence:
   - Short, punchy sentences in the JD → use shorter, direct sentences in your output.
   - Long, structured sentences in the JD → match with fuller, clause-rich sentences.
   - Bullet-heavy JD → use specific, concrete phrasing in all bullets.
   - Narrative-heavy JD → allow prose to flow with natural connective tissue.

CRITICAL: These tone signals must be applied uniformly across ALL sections of the document —
summary, experience bullets, skills framing, and (for cover letters) every paragraph.
The reader should feel the document was written by someone who genuinely read and understood
this company's voice — not by a generic template engine.
`.trim();
  }

  /**
   * Build skill-level guidelines block.
   */
  buildSkillLevelGuidelines() {
    return `
SKILL PROFICIENCY GUIDELINES — strictly follow these rules when writing about any skill:
- "beginner" / "basic" / "learning": The candidate is still developing this skill. Do NOT present it as a strength. Mention it as an area of active growth. Never use phrasing like "strong X", "proficient in X", or "expertise in X" for beginner skills.
- "intermediate": The candidate has working knowledge. Use measured language: "experience with X", "works with X", "familiar with X". Do not overstate.
- "advanced": The candidate has solid, demonstrable experience. Use confident language: "experienced in X", "experienced with X".
- "expert" / "proficient": The candidate has deep expertise. Use strong language: "expertise in X", "deep experience with X", "extensive experience with X".

If a key job requirement is only a beginner-level skill for the candidate, acknowledge their eagerness to grow in that area rather than claiming existing strength.`;
  }

  /**
   * Build a COMPANY CULTURE section from research data for injection into prompts.
   * Returns empty string when profile is null/absent.
   * @param {Object|null} companyProfile
   * @returns {string}
   */
  _buildCompanyCultureSection(companyProfile) {
    if (!companyProfile) return '';

    const { culture, tone, values, mission, industry, size } = companyProfile;
    const valuesStr = Array.isArray(values) ? values.join(', ') : (values || '');
    const cultureLine = culture ? `- Culture: ${culture}\n` : '';
    const valuesLine = valuesStr ? `- Values: ${valuesStr}\n` : '';
    const toneLine = tone ? `- Tone: ${tone}\n` : '';
    const missionLine = mission ? `- Mission: ${mission}\n` : '';
    const industryLine = industry ? `- Industry: ${industry}\n` : '';
    const sizeLine = size ? `- Size: ${size}\n` : '';

    return `
COMPANY CULTURE (from research — use to calibrate tone and emphasis):
${cultureLine}${valuesLine}${toneLine}${missionLine}${industryLine}${sizeLine}
TONE MIRRORING: Use the culture data above to calibrate your writing voice.
A startup that values "move fast" needs a different CV tone than a bank that values
"rigor and compliance." Match vocabulary, formality, and emphasis to this culture —
not just the JD's surface style.
`.trim();
  }

  /**
   * Build a RECENT COMPANY ACHIEVEMENTS section from research data.
   * Only for cover letters. Returns empty string when achievements are null/empty.
   * @param {Array|null} achievements
   * @returns {string}
   */
  _buildCompanyAchievementsSection(achievements) {
    if (!Array.isArray(achievements) || achievements.length === 0) return '';

    const items = achievements
      .map((a) => `- ${a.headline || ''}${a.date ? `, ${a.date}` : ''}: ${a.relevance || ''}`)
      .join('\n');

    return `
RECENT COMPANY ACHIEVEMENTS (reference where relevant — be specific and timely):
${items}
`.trim();
  }

  /**
   * Build CV generation prompt.
   */
  buildCVPrompt(jobData, userProfile, improvement, explicitLanguage = null, skillMatch = null) {
    const {
      title: jobTitle,
      company,
      description: jobDescription,
      requirements = [],
      location,
      companyResearch,
    } = jobData;

    const sanitizedJobTitle = sanitizeJdTitle(jobTitle);

    const {
      fullName,
      email,
      phone,
      summary,
      headline,
      experience = [],
      education = [],
      skills = [],
      projects = [],
      certifications = [],
      keyAchievements = [],
      interests = [],
    } = userProfile || {};

    const matchedSkills = skillMatch?.matched || [];
    const unmatchedJobSkills = skillMatch?.unmatchedJobSkills || [];
    const irrelevantUserSkills = new Set((skillMatch?.irrelevantUserSkills || []).map(n => (n || '').toLowerCase()));
    const complementarySkills = skillMatch?.complementarySkills || [];

    const tieredSkills = [...matchedSkills, ...complementarySkills].map((s) => ({
      ...s,
      tier: this.skillMatcher.compositeSkillTier(s.matchStrength, s.level),
    }));

    const featureSkills  = tieredSkills.filter((s) => s.tier === 'feature');
    const mentionSkills  = tieredSkills.filter((s) => s.tier === 'mention');
    const growthSkills   = this._capGrowthSkills(tieredSkills);

    const matchedSkillsText = [
      featureSkills.length  ? `FEATURE (include in skills section — match language intensity to the skill level shown, see SKILL PROFICIENCY GUIDELINES below):\n${featureSkills.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
      mentionSkills.length  ? `MENTION (include with measured language):\n${mentionSkills.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
      growthSkills.length   ? `GROWTH (include in skills section but frame as developing / intent to grow — do not present as current strength):\n${growthSkills.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') || '  (No relevant skill overlap found — build narrative from experience alone)';

    const allSoftSkills =
      (Array.isArray(skills) ? skills.filter((s) => s?.category === 'soft' && !irrelevantUserSkills.has((s?.name || '').toLowerCase())) : [])
        .map((s) => `${s.name} (${s.level || 'N/A'})`)
        .join(', ') || 'None provided';

    const mapLanguageProficiency = (level) => {
      const mapping = {
        'expert': 'Fluent', 'proficient': 'Fluent', 'fluent': 'Fluent',
        'native': 'Native',
        'advanced': 'Advanced',
        'intermediate': 'Intermediate', 'conversational': 'Conversational',
        'beginner': 'Basic', 'basic': 'Basic',
      };
      return mapping[(level || '').toLowerCase()] || level || 'N/A';
    };

    const languages =
      (Array.isArray(skills) ? skills.filter((s) => s?.category === 'language') : [])
        .map((s) => `${s.name} (${mapLanguageProficiency(s.level)})`)
        .join(', ') || 'None provided';

     return `
Create a professional CV tailored for the following position:

IMPORTANT: The company name is "${company}" and the job title is "${sanitizedJobTitle}". Use these exact spellings and capitalisation for the company name and job title references throughout — do not use any other spelling or variation, even if the job description below uses a different form. HOWEVER, in the headline's first pipe-separated segment, do NOT copy the job title verbatim — instead create a professional role descriptor that reflects your specialization (see headline instructions below).

JOB DETAILS:
- Position: ${sanitizedJobTitle}
- Company: ${company}
- Location: ${location}
- Description: ${jobDescription}
- Requirements: ${Array.isArray(requirements) ? requirements.join(", ") : 'No requirements provided'}

CANDIDATE PROFILE:
- Name: ${fullName}
- Email: ${email}
- Phone: ${phone}
- Summary: ${summary}
${headline ? `- Headline: ${headline}` : ''}

EXPERIENCE (context only — skill names appearing here do NOT qualify for the skills section unless they also appear in CANDIDATE SKILLS RANKED FOR THIS JOB below):
${Array.isArray(experience) ? experience
  .map(
    (exp, i) =>
      `- [ID: ${i + 1}] ${exp?.role || exp?.title || ''} at ${exp?.company || ''} ${this._formatExperienceDateRange(exp)}: ${exp?.description || ''}`
  )
  .join("\n") : 'No experience provided'}

EDUCATION (most recent first):
${Array.isArray(education) ? [...education]
  .sort((a, b) => {
    // Sort by endDate descending — most recent first
    const dateA = a?.endDate ? new Date(a.endDate) : new Date(0);
    const dateB = b?.endDate ? new Date(b.endDate) : new Date(0);
    return dateB - dateA;
  })
  .map(
    (edu) =>
      `- ${edu?.degree || ''} from ${edu?.institution || ''}  (${toDisplayDate(edu?.startDate)}-${toDisplayDate(edu?.endDate)})`
  )
  .join("\n") : 'No education provided'}

SOFT SKILLS: ${allSoftSkills}

LANGUAGES: ${languages}

CANDIDATE SKILLS RANKED FOR THIS JOB:
(Only skills listed here may appear in the CV. Do not invent, add, or mention any skill not in this list.)
${matchedSkillsText}

${(skillMatch?.irrelevantUserSkills || []).length > 0 ? `FORBIDDEN SKILLS — these candidate skills were deemed irrelevant to this job and MUST NOT appear anywhere in the CV (not in the skills section, not in the summary, not in experience bullets):\n${skillMatch.irrelevantUserSkills.map(n => `  - ${typeof n === 'string' ? n : n?.name || n}`).join('\n')}\n` : ''}
${this.buildSkillGapBridgingSection(unmatchedJobSkills, experience, skills, jobTitle)}

${this.buildSkillLevelGuidelines()}

${this._buildCompanyCultureSection(companyResearch?.profile)}

${this.buildToneMatchingSection()}

PROJECTS:
${this._formatProjects(projects)}

CERTIFICATIONS:
${Array.isArray(certifications) ? certifications.map((cert) => `- ${cert?.name || ''} (${toDisplayDate(cert?.date || cert?.year || '')})`).join("\n") : 'No certifications provided'}

KEY ACHIEVEMENTS:
${this._formatKeyAchievements(keyAchievements)}

INTERESTS & CAUSES:
${Array.isArray(interests) && interests.length > 0 ? interests.join(', ') : 'None provided'}

HARD CONSTRAINTS — apply these before anything else. Violations here invalidate the output:
- SKILL GATE: Use ONLY skills listed under CANDIDATE SKILLS RANKED FOR THIS JOB. Skills mentioned in the experience descriptions below are context only — do NOT surface them in the skills section unless they appear in the ranked list. Skills not in the ranked list must not appear anywhere in the CV.
- SKILL TIERS: All FEATURE, MENTION, and GROWTH skills must appear in the skills section — the tier only controls HOW you describe them in prose (professional summary, experience bullets, cover letter). FEATURE skills → describe with confident language. MENTION skills → describe with measured language. GROWTH skills → describe as areas of active development, never as current strengths. Omit-tier and irrelevant skills → do not mention anywhere.
- SKILL HONESTY: Never write "strong", "expert", "proficient", or "experienced in" for a skill marked as "beginner" or "basic". For beginner skills, mention as an area of active development only — never present as a current strength. For intermediate skills, never write "expert in", "deep expertise in", "extensive experience with", or "authority in" — use measured language only.
- SKILL LANGUAGE IN PROSE: When mentioning skills in the Professional Summary or experience bullets, follow the tier assigned in CANDIDATE SKILLS RANKED FOR THIS JOB — it already accounts for both proficiency level and job relevance. FEATURE → confident ("experienced in", "expertise in"). MENTION → measured ("experience with", "familiar with"). GROWTH → development-focused ("actively developing", "building proficiency in"), never present as current strength. If a GROWTH skill is critical to the role, mention it neutrally without a proficiency claim — do not call it a strength you don't have.
- NO FABRICATION: Never invent job titles, companies, metrics, or skills not in the provided data. Only use quantifiable achievements where the user provides real numbers.

${
  improvement
    ? `IMPROVEMENT INSTRUCTIONS:\n${improvement}\n\nPlease incorporate these specific improvements into the CV content.\n\n`
    : ""
}TASK:
Generate a tailored CV that:
1. ${explicitLanguage ? `**CRITICAL: Write the ENTIRE CV content in ${this.languageDetector.getLanguageName(explicitLanguage).toUpperCase()}. This is a user requirement that MUST be followed. Write ALL sections, descriptions, and text in ${this.languageDetector.getLanguageName(explicitLanguage)}.**` : '**CRITICAL: Write the ENTIRE CV content in the SAME LANGUAGE as the job description above.** If the job description is in German, write everything in German. If it\'s in French, write in French, etc. Match the language exactly.'}
2. Highlights relevant experience and skills for this specific position
3. For Professional Summary, rewrite what is given to highlight relevant experience for this role. If empty, create it based on the user's actual profile data
4. Matches the tone and requirements of the job description
5. Is formatted for a professional CV template
6. Education section doesnt need descriptions and make sure to use the provided degree. Order education entries by endDate descending (most recent first)
7. For job experience section bulletpoints: You are ENHANCING the candidate's existing bullets, not summarizing them. Each output bullet must be AT LEAST as detailed as the input — preserve every method, technology, context, and outcome mentioned in the original. Then align wording with the job description using the STAR method and relevant action verbs. Inject technologies from the JD where applicable. If the user has no bullet points, create them based on their role description and JD tech stack. Target 15–40 words per bullet. Keep role scope, seniority, and responsibilities accurate — never exaggerate or inflate. Only use quantifiable achievements where the user provides real metrics; do not invent numbers or outcomes
8. Only include relevant (to job description and user profile) job experience bulletpoints. Do not add fabricated bullet points beyond what the role reasonably entails
9. Create a separate "languages" array in the JSON output with objects containing "language" and "proficiency" fields. Write proficiency terms in the SAME LANGUAGE as the CV. For English: "Native", "Fluent", "Advanced", "Intermediate", "Basic". For German: "Muttersprache", "Fließend", "Fortgeschritten", "Mittelstufe", "Grundkenntnisse". For French: "Langue maternelle", "Courant", "Avancé", "Intermédiaire", "Débutant". For other languages, use the standard localized proficiency terms. NEVER use skill-level terms like "Expert" or "Proficient" for languages.
10. **SKILLS SECTION FORMAT**: In the "skills" array, the "items" field must contain ONLY skill names separated by commas — NEVER include proficiency levels in brackets. Do NOT write "Python (Expert)" or "React (Intermediate)". Write "Python, JavaScript, Docker" instead. The proficiency is expressed through category grouping, not inline labels.
11. **LANGUAGES IN SKILLS**: NEVER include languages (English, German, French, etc.) in the "skills" array. Languages belong exclusively in the "languages" array.
12. **DATE FIDELITY**: For each experience entry, COPY the endDate EXACTLY from the CANDIDATE PROFILE EXPERIENCE section above. The profile shows dates in (startDate-endDate) format — copy the endDate verbatim. If the profile shows a date like "Jun 2025", output "Jun 2025". Only output "Present" if the profile explicitly shows "Present". Do NOT infer, change, or override dates — even for the most recent role. Include the "profileId" field in each output entry matching the [ID: N] tag from the profile.
${headline
      ? `13. **ADJUST the user's provided HEADLINE** for this specific application. The user has provided the headline "${headline}". You may: (a) reorder the pipe-separated segments to prioritise JD-relevant items first, (b) lightly rephrase a segment's terminology to match JD keywords if the candidate genuinely has that skill, and (c) drop segments that are completely irrelevant to this JD. You MUST NOT: inflate titles (do NOT change "Developer" to "Senior Developer" or add "senior", "lead", "principal", "staff", "head of" unless the user wrote it), invent qualifications or skills the user does not have, or blindly copy the JD job title into the headline. The result must still be a keyword-rich one-liner with items separated by ' | '.`
      : `13. **Create a compelling HEADLINE** with exactly 3 items separated by ' | '. Format: 'Professional Role Focus | Key Qualification/Specialization | Top Achievement or Domain Expertise'. The first segment should reflect the role you're targeting but must NOT copy the job title verbatim — rephrase it to show your specific angle, specialization, or the broader professional identity you bring to this role. For example, instead of 'Software Engineer', use 'Full-Stack Engineering & Architecture' or 'Scalable Systems Development'. Do NOT list plain skills like 'SQL' or 'Python' — instead use contextualized phrases like 'Data-Driven Decision Making' or 'Cloud-Native Architecture'. Spell out acronyms when space allows. Avoid clichés like "hard-working", "strategic", "passionate", "results-driven". This should be a keyword-rich one-liner optimized for both ATS systems and human recruiters.`
    }
14. **Create a "Key Achievements" section** with exactly 3 bullet points highlighting the most impactful accomplishments. If the candidate has provided KEY ACHIEVEMENTS above, use and lightly enhance those (preserving real metrics and outcomes). If none are provided, synthesise from the candidate's experience, projects, certifications, and summary — using only real achievements, metrics, and outcomes actually present in their profile. Do not fabricate numbers or outcomes. Each point must have a brief title (2-4 words) and 1-2 sentences. Each description must not exceed 2 lines. Use specific language while avoiding overused words. Focus on outcomes that align with the job description. Example format: "Optimised Product Features: Analysed product performance data and identified gaps in feature adoption, resulting in improved customer retention and engagement."
15. **SKILL GAP BRIDGING** (applies when core job skills are missing from the candidate's profile): Follow the GAP BRIDGING INSTRUCTIONS above. In the Professional Summary, write a confident narrative that positions the candidate's existing engineering background as a strong foundation for this role. In experience bullet points, surface any work that is genuinely adjacent to the missing skills — scripting, automation, deployment, infrastructure, data handling, system design — whatever the candidate's history actually contains. The goal is to make the reader believe this person can make the transition, based entirely on real evidence.
16. **TONE & CULTURE MATCHING**: Apply the COMPANY TONE & CULTURE analysis above. The formality level, vocabulary choices, sentence rhythm, and cultural emphasis must match what you observed in the job description. A startup JD with punchy language should produce a CV that feels alive and direct. A formal corporate JD should produce polished, precise language. Mirror the company's voice — not a generic CV template voice.
17. **PROJECT DESCRIPTIONS**: For each project, write a description that covers: (a) what the project does and why it exists, (b) specific technologies and architecture choices used, and (c) measurable impact or outcome. Do not write single-line descriptions like "A task management app" — each description should be 1–3 sentences with technical depth and context. Use the candidate's original project descriptions as a baseline; do not summarize or strip detail.

IMPORTANT: Return only valid JSON in the exact structure specified in the system prompt. Ensure the "languages" array contains objects with "language" and "proficiency" fields using localized language-proficiency terms in ${explicitLanguage ? this.languageDetector.getLanguageName(explicitLanguage) : 'the same language as the job description'}. NEVER use skill-level terms like "Expert" or "Proficient" for language proficiency. ALL TEXT CONTENT in the JSON must be in ${explicitLanguage ? this.languageDetector.getLanguageName(explicitLanguage) : 'the same language as the job description'}.
`;
  }

  /**
   * Build cover letter generation prompt.
   */
  buildCoverLetterPrompt(jobData, userProfile, improvement, explicitLanguage = null, skillMatch = null) {
    const {
      title: jobTitle,
      company,
      description: jobDescription,
      requirements = [],
      companyResearch,
    } = jobData;

    const { fullName, email, summary, experience = [], skills = [], keyAchievements = [], projects = [], certifications = [] } = userProfile || {};

    const relevantExperience = Array.isArray(experience) ? experience
      .map((exp, i) => ({ ...exp, _profileId: i + 1 }))
      .filter(
        (exp) =>
          exp?.description?.toLowerCase().includes(jobTitle?.toLowerCase() || '') ||
          (Array.isArray(requirements) ? requirements.some((req) =>
            exp?.description?.toLowerCase().includes(req?.toLowerCase() || '')
          ) : false)
      ) : [];

    const matchedSkills = skillMatch?.matched || [];
    const unmatchedJobSkills = skillMatch?.unmatchedJobSkills || [];
    const irrelevantUserSkillsCL = new Set((skillMatch?.irrelevantUserSkills || []).map(n => (n || '').toLowerCase()));
    const complementarySkillsCL = skillMatch?.complementarySkills || [];

    const tieredSkillsCL = [...matchedSkills, ...complementarySkillsCL].map((s) => ({
      ...s,
      tier: this.skillMatcher.compositeSkillTier(s.matchStrength, s.level),
    }));

    const featureSkillsCL = tieredSkillsCL.filter((s) => s.tier === 'feature');
    const mentionSkillsCL = tieredSkillsCL.filter((s) => s.tier === 'mention');
    const growthSkillsCL  = this._capGrowthSkills(tieredSkillsCL);

    const matchedSkillsText = [
      featureSkillsCL.length ? `FEATURE (reference prominently — match language intensity to the skill level shown, see SKILL PROFICIENCY GUIDELINES below):\n${featureSkillsCL.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
      mentionSkillsCL.length ? `MENTION (reference with measured language):\n${mentionSkillsCL.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
      growthSkillsCL.length  ? `GROWTH (frame only as developing or intent to grow — never as current strength):\n${growthSkillsCL.map(s => `  - ${this._fmtSkillAnnotation(s)}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') || '  (No relevant skill overlap — build narrative from experience and transferable strengths alone)';

    return `
Write a compelling cover letter for ${fullName} applying to ${company} for the ${jobTitle} position.

IMPORTANT: The company name is "${company}" and the job title is "${jobTitle}". Use these exact spellings and capitalisation throughout the letter — do not use any other spelling or variation, even if the job description below uses a different form.

JOB DETAILS:
- Position: ${jobTitle}
- Company: ${company}
- Description: ${jobDescription}
- Requirements: ${Array.isArray(requirements) ? requirements.join(", ") : 'No requirements provided'}

CANDIDATE PROFILE:
- Name: ${fullName}
- Email: ${email}
- Background: ${summary}

RELEVANT EXPERIENCE:
${relevantExperience.length > 0 ? relevantExperience
  .map((exp) => `- [ID: ${exp._profileId}] ${exp?.title || ''} at ${exp?.company || ''}: ${exp?.description || ''}`)
  .join("\n") : 'No directly relevant experience found'}

KEY ACHIEVEMENTS:
${this._formatKeyAchievements(keyAchievements)}

PROJECTS:
${this._formatProjects(projects)}

CERTIFICATIONS:
${Array.isArray(certifications) ? certifications.map((cert) => `- ${cert?.name || ''} (${toDisplayDate(cert?.date || '')})`).join("\n") : 'No certifications provided'}

CANDIDATE SKILLS RANKED FOR THIS JOB (only reference skills listed here — never mention skills not in this list):
${matchedSkillsText}

${(skillMatch?.irrelevantUserSkills || []).length > 0 ? `FORBIDDEN SKILLS — these candidate skills were deemed irrelevant to this job and MUST NOT be referenced anywhere in the cover letter:\n${skillMatch.irrelevantUserSkills.map(n => `  - ${typeof n === 'string' ? n : n?.name || n}`).join('\n')}\n` : ''}
${this.buildSkillGapBridgingSection(unmatchedJobSkills, experience, skills, jobTitle)}

${this.buildSkillLevelGuidelines()}

${this._buildCompanyCultureSection(companyResearch?.profile)}

${this._buildCompanyAchievementsSection(companyResearch?.achievements)}

${this.buildToneMatchingSection()}

${
  improvement
    ? `IMPROVEMENT INSTRUCTIONS:\n${improvement}\n\nPlease incorporate these specific improvements into the cover letter content.\n\n`
    : ""
}TASK:
Write ONLY the main body paragraphs for a personalized cover letter that:
1. ${explicitLanguage ? `**CRITICAL: Write the ENTIRE cover letter content in ${this.languageDetector.getLanguageName(explicitLanguage).toUpperCase()}. This is a user requirement that MUST be followed. Write ALL paragraphs and text in ${this.languageDetector.getLanguageName(explicitLanguage)}.**` : '**CRITICAL: Write the ENTIRE cover letter content in the SAME LANGUAGE as the job description above.** If the job description is in German, write everything in German. If it\'s in French, write in French, etc. Match the language exactly.'}
2. Shows genuine interest in the company and position
3. Explains how the candidate's experience aligns with the job requirements — including bridging from adjacent experience where direct experience is missing
4. Highlights 2-3 specific achievements or transferable strengths that make them a credible candidate — drawn from the matched skills and relevant experience above
5. Uses a professional, confident tone
6. Is concise (3 paragraphs, ~180 words): first paragraph — why this role and why now; second paragraph — what the candidate brings (real experience + transferables); third paragraph — growth intent and call to action
7. **SKILL LANGUAGE BY TIER**: When referencing skills, match your language to the skill's tier (FEATURE / MENTION / GROWTH) as assigned in CANDIDATE SKILLS RANKED FOR THIS JOB — the tier already accounts for both proficiency level and relevance to this role. FEATURE skills → reference confidently ("my experience with X", "I bring expertise in X"). MENTION skills → reference with measured language ("I have worked with X", "my background includes X"). GROWTH skills → frame as areas of active development ("I am actively growing my skills in X", "I have begun working with X"), never present as current strengths. If a GROWTH skill is central to the role, mention the candidate's foundational exposure and genuine intent to develop it further — do not fabricate proficiency.
8. **SKILL GAP BRIDGING**: If core job skills are absent from the candidate's profile, the cover letter is the primary place to make the case for why the candidate is still a strong hire. Use the GAP BRIDGING INSTRUCTIONS above. Construct a confident narrative: acknowledge the direction of the move implicitly (not as a weakness), lead with what they do have, and close with a clear statement of intent to grow into the role. Example framing for a developer moving into DevOps: "My experience building and deploying backend services has given me first-hand insight into the infrastructure challenges that DevOps engineers solve — I am now seeking to formalise and deepen that work on the platform side."
9. **TONE & CULTURE MATCHING**: Apply the COMPANY TONE & CULTURE analysis above. Mirror the company's formality level, vocabulary, sentence rhythm, and cultural values in every paragraph. If the company talks about ownership and pace — your letter should feel driven and direct. If they emphasise craft and engineering excellence — your letter should feel considered and precise. Do not write a generic cover letter — write one that sounds like it was composed by someone who genuinely read and understood this specific company.

Do NOT include:
- Headers or contact information
- "Dear Hiring Manager," greeting
- Signature or closing ("Sincerely," etc.)
- Recipient address details
- Em dashes ("—") — do not use them to connect sentences; use commas, periods, or semicolons instead

Return only the main content paragraphs that go between the greeting and closing. ALL TEXT must be in ${explicitLanguage ? this.languageDetector.getLanguageName(explicitLanguage) : 'the same language as the job description'}.
`;
  }
}

module.exports = PromptBuilder;
