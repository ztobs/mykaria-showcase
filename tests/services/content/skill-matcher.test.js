jest.mock('../../../src/services/llm', () => ({
  generateText: jest.fn(),
}));

const llmService = require('../../../src/services/llm');
const SkillMatcher = require('../../../src/services/content/skill-matcher');

// ---- Helpers -----------------------------------------------------------

const defaultUserSkills = [
  { name: 'JavaScript', level: 'expert', category: 'technical' },
  { name: 'React', level: 'advanced', category: 'technical' },
  { name: 'Python', level: 'intermediate', category: 'technical' },
  { name: 'Docker', level: 'beginner', category: 'technical' },
  { name: 'Communication', level: 'expert', category: 'soft' },
];

const defaultJobSkills = ['JavaScript', 'React.js', 'TypeScript'];

const defaultJobRequirements = ['3+ years frontend experience'];

const minimalLLMResponse = {
  matched: [
    { name: 'JavaScript', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTerms: ['JavaScript'] },
    { name: 'React', level: 'advanced', category: 'technical', matchStrength: 'strong', matchedJobTerms: ['React.js'] },
  ],
  unmatchedJobTerms: ['TypeScript'],
  irrelevantUserSkills: ['Docker'],
  complementarySkills: [],
};

function mockLLMResponse(json) {
  llmService.generateText.mockResolvedValue({ text: JSON.stringify(json), usage: {} });
}

// ---- Tests -------------------------------------------------------------

describe('SkillMatcher', () => {
  let skillMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    skillMatcher = new SkillMatcher();
  });

  // =====================================================================
  // compositeSkillTier
  // =====================================================================

  describe('compositeSkillTier', () => {
    // --- exact/strong column ---

    describe('exact/strong matchStrength', () => {
      it('exact × expert → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'expert')).toBe('feature');
      });
      it('exact × advanced → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'advanced')).toBe('feature');
      });
      it('exact × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'intermediate')).toBe('mention');
      });
      it('exact × beginner → growth', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'beginner')).toBe('growth');
      });

      it('strong × expert → feature', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'expert')).toBe('feature');
      });
      it('strong × advanced → feature', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'advanced')).toBe('feature');
      });
      it('strong × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'intermediate')).toBe('mention');
      });
      it('strong × beginner → growth', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'beginner')).toBe('growth');
      });
    });

    // --- moderate column ---

    describe('moderate matchStrength', () => {
      it('moderate × expert → feature', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'expert')).toBe('feature');
      });
      it('moderate × advanced → mention', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'advanced')).toBe('mention');
      });
      it('moderate × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'intermediate')).toBe('mention');
      });
      it('moderate × beginner → growth', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'beginner')).toBe('growth');
      });
    });

    // --- weak column ---

    describe('weak matchStrength', () => {
      it('weak × expert → mention', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'expert')).toBe('mention');
      });
      it('weak × advanced → mention', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'advanced')).toBe('mention');
      });
      it('weak × intermediate → growth', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'intermediate')).toBe('growth');
      });
      it('weak × beginner → omit', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'beginner')).toBe('omit');
      });
    });

    // --- complementary path ---

    describe('complementary matchStrength', () => {
      it('complementary × expert → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'expert')).toBe('mention');
      });
      it('complementary × advanced → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'advanced')).toBe('mention');
      });
      it('complementary × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'intermediate')).toBe('mention');
      });
      it('complementary × beginner → growth', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'beginner')).toBe('growth');
      });
      it('complementary × learning → growth', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'learning')).toBe('growth');
      });
    });

    // --- level aliases ---

    describe('level aliases', () => {
      it('proficient is treated as expert-equivalent', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'proficient')).toBe('feature');
      });
      it('basic is treated as beginner-equivalent', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'basic')).toBe('omit');
      });
      it('learning is treated as beginner-equivalent', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'learning')).toBe('growth');
      });
    });

    // --- alwaysInclude ---

    describe('alwaysInclude skills', () => {
      it('alwaysInclude × beginner → growth (never omit)', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'beginner', true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('moderate', 'beginner', true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('weak', 'beginner', true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('complementary', 'beginner', true)).toBe('growth');
      });

      it('alwaysInclude × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'intermediate', true)).toBe('mention');
        expect(skillMatcher.compositeSkillTier('moderate', 'intermediate', true)).toBe('mention');
        expect(skillMatcher.compositeSkillTier('weak', 'intermediate', true)).toBe('mention');
        expect(skillMatcher.compositeSkillTier('complementary', 'intermediate', true)).toBe('mention');
      });

      it('alwaysInclude × advanced → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'advanced', true)).toBe('feature');
        expect(skillMatcher.compositeSkillTier('weak', 'advanced', true)).toBe('feature');
      });

      it('alwaysInclude × expert → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'expert', true)).toBe('feature');
        expect(skillMatcher.compositeSkillTier('weak', 'expert', true)).toBe('feature');
      });

      it('alwaysInclude × basic → growth (never omit)', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'basic', true)).toBe('growth');
      });

      it('alwaysInclude × learning → growth (never omit)', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'learning', true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('complementary', 'learning', true)).toBe('growth');
      });

      it('alwaysInclude with unknown matchStrength still respects level floor', () => {
        expect(skillMatcher.compositeSkillTier('guru', 'beginner', true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('guru', 'intermediate', true)).toBe('mention');
        expect(skillMatcher.compositeSkillTier('guru', 'expert', true)).toBe('feature');
      });

      it('alwaysInclude false does not change behavior', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'beginner', false)).toBe('omit');
        expect(skillMatcher.compositeSkillTier('exact', 'expert', false)).toBe('feature');
      });

      it('alwaysInclude with null/undefined level → growth (floor)', () => {
        expect(skillMatcher.compositeSkillTier('weak', null, true)).toBe('growth');
        expect(skillMatcher.compositeSkillTier('weak', undefined, true)).toBe('growth');
      });
    });

    // --- edge cases ---

    describe('edge cases', () => {
      it('unknown matchStrength defaults to rank 2 (moderate-equivalent)', () => {
        expect(skillMatcher.compositeSkillTier('guru', 'expert')).toBe('feature');
        expect(skillMatcher.compositeSkillTier('guru', 'intermediate')).toBe('mention');
        expect(skillMatcher.compositeSkillTier('guru', 'beginner')).toBe('growth');
      });

      it('unknown userLevel defaults to rank 2 (intermediate-equivalent)', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'ninja')).toBe('mention');
        expect(skillMatcher.compositeSkillTier('moderate', 'ninja')).toBe('mention');
        expect(skillMatcher.compositeSkillTier('weak', 'ninja')).toBe('growth');
      });

      it('case insensitive for matchStrength', () => {
        expect(skillMatcher.compositeSkillTier('EXACT', 'expert')).toBe('feature');
        expect(skillMatcher.compositeSkillTier('Exact', 'expert')).toBe('feature');
      });

      it('case insensitive for userLevel', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'EXPERT')).toBe('feature');
        expect(skillMatcher.compositeSkillTier('weak', 'BEGINNER')).toBe('omit');
      });

      it('complementary × unknown level defaults to 2 → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', 'guru')).toBe('mention');
      });

      it('complementary × null userLevel → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', null)).toBe('mention');
      });

      it('complementary × undefined userLevel → mention', () => {
        expect(skillMatcher.compositeSkillTier('complementary', undefined)).toBe('mention');
      });

      it('null/undefined userLevel does not throw', () => {
        expect(() => skillMatcher.compositeSkillTier('exact', null)).not.toThrow();
        expect(() => skillMatcher.compositeSkillTier('exact', undefined)).not.toThrow();
      });

      it('null userLevel defaults to intermediate-equivalent (mention for moderate)', () => {
        expect(skillMatcher.compositeSkillTier('moderate', null)).toBe('mention');
      });
    });

    // --- rank differentiation (expert=4, advanced=3, intermediate=2) ---

    describe('expert vs advanced differentiation (new rank scale)', () => {
      // expert/proficient (rank 4): feature with moderate+ match
      it('exact × proficient → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'proficient')).toBe('feature');
      });
      it('strong × proficient → feature', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'proficient')).toBe('feature');
      });
      it('moderate × proficient → feature', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'proficient')).toBe('feature');
      });
      it('weak × proficient → mention', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'proficient')).toBe('mention');
      });

      // advanced (rank 3): feature only with exact/strong match
      it('exact × advanced → feature', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'advanced')).toBe('feature');
      });
      it('moderate × advanced → mention', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'advanced')).toBe('mention');
      });

      // intermediate (rank 2): caps at mention
      it('exact × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('exact', 'intermediate')).toBe('mention');
      });
      it('strong × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('strong', 'intermediate')).toBe('mention');
      });
      it('moderate × intermediate → mention', () => {
        expect(skillMatcher.compositeSkillTier('moderate', 'intermediate')).toBe('mention');
      });
      it('weak × intermediate → growth', () => {
        expect(skillMatcher.compositeSkillTier('weak', 'intermediate')).toBe('growth');
      });
    });
  });

  // =====================================================================
  // matchSkillsToJob
  // =====================================================================

  describe('matchSkillsToJob', () => {
    // --- happy path ---

    describe('happy path', () => {
      it('returns matched and unmatched arrays from the LLM response', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toHaveLength(2);
        expect(result.matched[0].name).toBe('JavaScript');
        expect(result.matched[0].matchStrength).toBe('exact');
        expect(result.matched[1].name).toBe('React');
        expect(result.matched[1].matchStrength).toBe('strong');
        expect(result.unmatchedJobSkills).toEqual(['TypeScript']);
        // Docker flagged irrelevant by the LLM; Python (technical) is closed into
        // irrelevant because the LLM never bucketed it; Communication (soft) is exempt
        expect(result.irrelevantUserSkills).toEqual(['Docker', 'Python']);
        expect(result.complementarySkills).toEqual([]);
      });

      it('includes proficiency levels and categories in match data', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].level).toBe('expert');
        expect(result.matched[0].category).toBe('technical');
      });
    });

    // --- empty inputs (skip LLM) ---

    describe('empty inputs skip LLM call', () => {
      it('empty user skills array returns early', async () => {
        const result = await skillMatcher.matchSkillsToJob([], defaultJobSkills, defaultJobRequirements, 'user-1');

        expect(llmService.generateText).not.toHaveBeenCalled();
        expect(result.matched).toEqual([]);
        expect(result.unmatchedJobSkills).toEqual([...defaultJobSkills, ...defaultJobRequirements]);
      });

      it('null user skills returns early', async () => {
        const result = await skillMatcher.matchSkillsToJob(null, defaultJobSkills, defaultJobRequirements, 'user-1');

        expect(llmService.generateText).not.toHaveBeenCalled();
        expect(result.matched).toEqual([]);
      });

      it('undefined user skills returns early', async () => {
        const result = await skillMatcher.matchSkillsToJob(undefined, defaultJobSkills, defaultJobRequirements, 'user-1');

        expect(llmService.generateText).not.toHaveBeenCalled();
      });

      it('empty job skills AND job requirements returns early', async () => {
        const result = await skillMatcher.matchSkillsToJob(defaultUserSkills, [], [], 'user-1');

        expect(llmService.generateText).not.toHaveBeenCalled();
        expect(result.matched).toEqual([]);
      });

      it('user skills with only empty/nameless entries treated as empty', async () => {
        const result = await skillMatcher.matchSkillsToJob(
          [{ name: '' }, { name: null }, { name: undefined }],
          defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(llmService.generateText).not.toHaveBeenCalled();
      });

      it('proceeds to LLM when jobSkills empty but jobRequirements present', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(defaultUserSkills, [], defaultJobRequirements, 'user-1');

        expect(llmService.generateText).toHaveBeenCalled();
      });
    });

    // --- LLM failure fallback ---

    describe('LLM failure fallback', () => {
      it('returns empty results when LLM throws', async () => {
        llmService.generateText.mockRejectedValue(new Error('Network error'));

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toEqual([]);
        expect(result.unmatchedJobSkills).toEqual([...defaultJobSkills, ...defaultJobRequirements]);
        expect(result.irrelevantUserSkills).toEqual([]);
        expect(result.complementarySkills).toEqual([]);
      });

      it('does not throw on LLM failure', async () => {
        llmService.generateText.mockRejectedValue(new Error('Timeout'));

        await expect(
          skillMatcher.matchSkillsToJob(defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1')
        ).resolves.toBeDefined();
      });
    });

    // --- prompt construction ---

    describe('prompt construction', () => {
      it('passes correctly formatted prompt to LLM', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];

        // User skills included in numbered format
        expect(prompt).toContain('1. "JavaScript" | level: expert | category: technical');
        expect(prompt).toContain('2. "React" | level: advanced | category: technical');
        expect(prompt).toContain('3. "Python" | level: intermediate | category: technical');
        expect(prompt).toContain('4. "Docker" | level: beginner | category: technical');
        expect(prompt).toContain('5. "Communication" | level: expert | category: soft');

        // Job terms included in numbered format
        expect(prompt).toContain('1. JavaScript');
        expect(prompt).toContain('2. React.js');
        expect(prompt).toContain('3. TypeScript');
        expect(prompt).toContain('4. 3+ years frontend experience');
      });

      it('passes correct systemPrompt, maxTokens, and temperature', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const options = llmService.generateText.mock.calls[0][1];
        expect(options.systemPrompt).toBe('You are a precise skill-matching assistant. Return only valid JSON.');
        // Generous ceiling: with index-based job term references the payload stays
        // small, but large profiles + long JDs must never truncate mid-JSON again
        expect(options.maxTokens).toBe(6000);
        expect(options.temperature).toBe(0.1);
        expect(options.action).toBe('ENHANCE_DOCUMENT');
      });

      it('passes userId through to LLM', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-42'
        );

        const userId = llmService.generateText.mock.calls[0][2];
        expect(userId).toBe('user-42');
      });

      it('uses default level intermediate for skills without level', async () => {
        mockLLMResponse(minimalLLMResponse);

        const skillsWithoutLevel = [
          { name: 'JavaScript', category: 'technical' },
        ];
        await skillMatcher.matchSkillsToJob(skillsWithoutLevel, defaultJobSkills, defaultJobRequirements, 'user-1');

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('level: intermediate');
      });

      it('uses default category technical for skills without category', async () => {
        mockLLMResponse(minimalLLMResponse);

        const skillsWithoutCategory = [
          { name: 'JavaScript', level: 'expert' },
        ];
        await skillMatcher.matchSkillsToJob(skillsWithoutCategory, defaultJobSkills, defaultJobRequirements, 'user-1');

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('category: technical');
      });
    });

    // --- strict relevance rules in matching prompt ---

    describe('strict relevance rules in matching prompt', () => {
      it('instructs layer-aware matching (no frontend skills for a backend role)', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('LAYER MATCHING');
        expect(prompt).toContain('backend');
        expect(prompt).toContain('frontend');
      });

      it('guards against vague catch-all requirements over-matching', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('VAGUE REQUIREMENTS');
        expect(prompt).toContain('other programming languages');
      });

      it('guards against company product context being treated as role skills', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('COMPANY CONTEXT');
      });
    });

    // --- matchStrength validation ---

    describe('matchStrength validation', () => {
      it('accepts valid strengths (exact, strong, moderate, weak)', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTerms: ['JavaScript'] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchStrength).toBe('exact');
      });

      it('defaults invalid matchStrength to moderate', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', level: 'expert', category: 'technical', matchStrength: 'superduper', matchedJobTerms: ['JavaScript'] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchStrength).toBe('moderate');
      });

      it('defaults missing matchStrength to moderate', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', level: 'expert', category: 'technical', matchedJobTerms: ['JavaScript'] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchStrength).toBe('moderate');
      });
    });

    // --- field defaults ---

    describe('field defaults', () => {
      it('defaults missing name to empty string', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTerms: [] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].name).toBe('');
      });

      it('defaults missing level to intermediate', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', category: 'technical', matchStrength: 'exact', matchedJobTerms: [] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].level).toBe('intermediate');
      });

      it('defaults missing category to technical', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', level: 'expert', matchStrength: 'exact', matchedJobTerms: [] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].category).toBe('technical');
      });

      it('defaults missing matchedJobTerms to empty array', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'JS', level: 'expert', category: 'technical', matchStrength: 'exact' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual([]);
      });
    });

    // --- complementary skills ---

    describe('complementary skills handling', () => {
      it('filters complementary skills not in user skill set', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: 'FakeSkill', level: 'expert', category: 'technical' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills).toEqual([]);
      });

      it('keeps complementary skills that are in user skill set', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: 'Python', level: 'intermediate', category: 'technical' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills).toHaveLength(1);
        expect(result.complementarySkills[0].name).toBe('Python');
        expect(result.complementarySkills[0].matchStrength).toBe('complementary');
      });

      it('caps complementary skills at 4', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: 'JavaScript', level: 'expert', category: 'technical' },
            { name: 'React', level: 'advanced', category: 'technical' },
            { name: 'Python', level: 'intermediate', category: 'technical' },
            { name: 'Docker', level: 'beginner', category: 'technical' },
            { name: 'Communication', level: 'expert', category: 'soft' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills).toHaveLength(4);
      });

      it('complementary skill level defaults to intermediate', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: 'Python', category: 'technical' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills[0].level).toBe('intermediate');
      });
    });

    // --- unclassified skills closure ---

    describe('unclassified skills closure', () => {
      it('marks technical skills absent from all LLM buckets as irrelevant', async () => {
        // LLM buckets JavaScript + React as matched, Docker as irrelevant,
        // but never mentions Python — the silent-drop leak path.
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).toContain('Python');
      });

      it('does not mark unclassified soft skills as irrelevant', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).not.toContain('Communication');
      });

      it('does not mark unclassified language skills as irrelevant', async () => {
        mockLLMResponse(minimalLLMResponse);

        const skills = [...defaultUserSkills, { name: 'German', level: 'expert', category: 'language' }];
        const result = await skillMatcher.matchSkillsToJob(
          skills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).not.toContain('German');
      });

      it('matches classified names case-insensitively (no double-marking)', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [
            { name: 'javascript', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTerms: ['JavaScript'] },
            { name: 'REACT', level: 'advanced', category: 'technical', matchStrength: 'strong', matchedJobTerms: ['React.js'] },
            { name: 'python', level: 'intermediate', category: 'technical', matchStrength: 'weak', matchedJobTerms: [] },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).not.toContain('Python');
        expect(result.irrelevantUserSkills).toEqual(['Docker']);
      });

      it('never marks alwaysInclude skills as irrelevant even when unclassified', async () => {
        mockLLMResponse(minimalLLMResponse);

        const skills = [...defaultUserSkills, { name: 'PHP', level: 'expert', category: 'technical', alwaysInclude: true }];
        const result = await skillMatcher.matchSkillsToJob(
          skills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).not.toContain('PHP');
        expect(result.matched.some((s) => s.name === 'PHP')).toBe(true);
      });

      it('preserves LLM-flagged irrelevant skills ahead of closed ones', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills[0]).toBe('Docker');
      });
    });

    // --- index-based job term references ---

    describe('index-based job term references', () => {
      // allJobTerms order: 1=JavaScript, 2=React.js, 3=TypeScript, 4=3+ years frontend experience

      it('maps matchedJobTermIndices back to job term strings', async () => {
        mockLLMResponse({
          matched: [
            { name: 'JavaScript', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTermIndices: [1, 4] },
            { name: 'React', level: 'advanced', category: 'technical', matchStrength: 'strong', matchedJobTermIndices: [2] },
          ],
          unmatchedJobTermIndices: [3],
          irrelevantUserSkills: ['Docker', 'Python'],
          complementarySkills: [],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual(['JavaScript', '3+ years frontend experience']);
        expect(result.matched[1].matchedJobTerms).toEqual(['React.js']);
        expect(result.unmatchedJobSkills).toEqual(['TypeScript']);
      });

      it('ignores out-of-range and non-integer indices', async () => {
        mockLLMResponse({
          matched: [
            { name: 'JavaScript', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTermIndices: [0, 99, -1, 2.5, null, 1] },
          ],
          unmatchedJobTermIndices: [0, 999],
          irrelevantUserSkills: ['React', 'Python', 'Docker'],
          complementarySkills: [],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual(['JavaScript']);
        expect(result.unmatchedJobSkills).toEqual([]);
      });

      it('accepts numeric strings as indices', async () => {
        mockLLMResponse({
          matched: [
            { name: 'React', level: 'advanced', category: 'technical', matchStrength: 'strong', matchedJobTermIndices: ['2'] },
          ],
          unmatchedJobTermIndices: ['3'],
          irrelevantUserSkills: ['JavaScript', 'Python', 'Docker'],
          complementarySkills: [],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual(['React.js']);
        expect(result.unmatchedJobSkills).toEqual(['TypeScript']);
      });

      it('accepts mixed indices and legacy raw strings', async () => {
        mockLLMResponse({
          matched: [
            { name: 'JavaScript', level: 'expert', category: 'technical', matchStrength: 'exact', matchedJobTermIndices: [1, 'React.js'] },
          ],
          unmatchedJobTerms: ['TypeScript'],
          irrelevantUserSkills: ['React', 'Python', 'Docker'],
          complementarySkills: [],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual(['JavaScript', 'React.js']);
        expect(result.unmatchedJobSkills).toEqual(['TypeScript']);
      });

      it('still supports the legacy string-array format unchanged', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched[0].matchedJobTerms).toEqual(['JavaScript']);
        expect(result.unmatchedJobSkills).toEqual(['TypeScript']);
      });

      it('prompt instructs the LLM to return indices, not repeated strings', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('matchedJobTermIndices');
        expect(prompt).toContain('unmatchedJobTermIndices');
      });
    });

    // --- markdown extraction ---

    describe('markdown extraction', () => {
      it('extracts JSON from markdown code blocks', async () => {
        llmService.generateText.mockResolvedValue({ text: '```json\n' + JSON.stringify(minimalLLMResponse) + '\n```', usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toHaveLength(2);
      });

      it('extracts JSON from plain code blocks (no json tag)', async () => {
        llmService.generateText.mockResolvedValue({ text: '```\n' + JSON.stringify(minimalLLMResponse) + '\n```', usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toHaveLength(2);
      });

      it('handles plain JSON response (no markdown)', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toHaveLength(2);
      });
    });

    // --- custom TextPostProcessor (dependency injection) ---

    describe('dependency injection', () => {
      it('accepts custom textPostProcessor in constructor', async () => {
        mockLLMResponse(minimalLLMResponse);

        const customProcessor = { extractJsonFromMarkdown: jest.fn().mockReturnValue(JSON.stringify(minimalLLMResponse)) };
        const customMatcher = new SkillMatcher({ textPostProcessor: customProcessor });

        await customMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(customProcessor.extractJsonFromMarkdown).toHaveBeenCalled();
      });
    });

    // --- handling of non-array LLM response fields ---

    describe('graceful handling of malformed LLM responses', () => {
      it('returns empty matched when parsed.matched is not an array', async () => {
        llmService.generateText.mockResolvedValue({ text: JSON.stringify({ matched: 'not-an-array' }), usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.matched).toEqual([]);
      });

      it('returns empty unmatchedJobSkills when not an array', async () => {
        llmService.generateText.mockResolvedValue({ text: JSON.stringify({ unmatchedJobTerms: 'not-an-array' }), usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.unmatchedJobSkills).toEqual([]);
      });

      it('returns empty irrelevantUserSkills when not an array', async () => {
        llmService.generateText.mockResolvedValue({ text: JSON.stringify({ irrelevantUserSkills: 123 }), usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        // No matched bucket in the malformed payload → every technical skill is
        // unclassified and closed into irrelevant (Communication is soft → exempt)
        expect(result.irrelevantUserSkills).toEqual(['JavaScript', 'React', 'Python', 'Docker']);
      });

      it('returns empty complementarySkills when not an array', async () => {
        llmService.generateText.mockResolvedValue({ text: JSON.stringify({ complementarySkills: null }), usage: {} });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills).toEqual([]);
      });
    });

    // --- irrelevant user skills ---

    describe('irrelevant user skills', () => {
      it('returns irrelevant user skills from LLM', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          irrelevantUserSkills: ['Docker', 'Python'],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).toEqual(['Docker', 'Python']);
      });
    });

    // --- filter falsy job terms ---

    describe('filters falsy job terms', () => {
      it('filters out null/undefined/empty job terms', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills,
          ['React', null, undefined, '', 'Node'],
          defaultJobRequirements,
          'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        expect(prompt).toContain('React');
        expect(prompt).toContain('Node');
        expect(prompt).not.toContain('null');
      });
    });

    // --- default value of userSkills parameter ---

    describe('default parameter value', () => {
      it('treats missing userSkills as empty (no LLM call)', async () => {
        const result = await skillMatcher.matchSkillsToJob();

        expect(llmService.generateText).not.toHaveBeenCalled();
        expect(result.matched).toEqual([]);
      });
    });

    // --- non-array inputs ---

    describe('non-array inputs', () => {
      it('handles non-array jobSkills gracefully', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, 'not-an-array', defaultJobRequirements, 'user-1'
        );

        expect(llmService.generateText).toHaveBeenCalled();
      });

      it('handles non-array jobRequirements gracefully', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, 12345, 'user-1'
        );

        expect(llmService.generateText).toHaveBeenCalled();
      });

      it('handles non-array userSkills gracefully', async () => {
        const result = await skillMatcher.matchSkillsToJob('not-an-array', defaultJobSkills, defaultJobRequirements, 'user-1');

        expect(llmService.generateText).not.toHaveBeenCalled();
        expect(result.matched).toEqual([]);
      });
    });

    // --- complementary skills edge cases ---

    describe('complementary skills edge cases', () => {
      it('filters out complementary skill with falsy name', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: '', level: 'expert', category: 'technical' },
            null,
            { name: null, level: 'advanced', category: 'technical' },
            { name: 'Python', level: 'intermediate', category: 'technical' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills).toHaveLength(1);
        expect(result.complementarySkills[0].name).toBe('Python');
      });

      it('complementary skill defaults category to technical', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          complementarySkills: [
            { name: 'Python', level: 'expert' },
          ],
        });

        const result = await skillMatcher.matchSkillsToJob(
          defaultUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.complementarySkills[0].category).toBe('technical');
      });
    });

    // --- alwaysInclude skills ---

    describe('alwaysInclude skills', () => {
      const alwaysIncludeUserSkills = [
        { name: 'JavaScript', level: 'expert', category: 'technical', alwaysInclude: true },
        { name: 'React', level: 'advanced', category: 'technical' },
        { name: 'Python', level: 'intermediate', category: 'technical' },
        { name: 'Docker', level: 'beginner', category: 'technical', alwaysInclude: true },
        { name: 'Communication', level: 'expert', category: 'soft' },
      ];

      it('excludes alwaysInclude skills from the LLM prompt', async () => {
        mockLLMResponse(minimalLLMResponse);

        await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const prompt = llmService.generateText.mock.calls[0][0];
        // JavaScript and Docker are alwaysInclude — should NOT be in candidate list
        expect(prompt).not.toContain('"JavaScript" | level:');
        expect(prompt).not.toContain('"Docker" | level:');
        // React, Python, Communication — should be in the prompt (renumbered)
        expect(prompt).toContain('"React" | level:');
        expect(prompt).toContain('"Python" | level:');
        expect(prompt).toContain('"Communication" | level:');
        expect(prompt).toContain('"Communication"');
      });

      it('re-injects alwaysInclude skills into matched even when LLM calls them irrelevant', async () => {
        // LLM says JavaScript is irrelevant — but alwaysInclude should override
        mockLLMResponse({
          ...minimalLLMResponse,
          matched: [],
          irrelevantUserSkills: ['JavaScript', 'Docker', 'React', 'Python', 'Communication'],
        });

        const result = await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const js = result.matched.find((s) => s.name === 'JavaScript');
        const docker = result.matched.find((s) => s.name === 'Docker');
        expect(js).toBeDefined();
        expect(js.tier).toBe('feature');
        expect(docker).toBeDefined();
        expect(docker.tier).toBe('growth');
      });

      it('does not include alwaysInclude skills in irrelevantUserSkills', async () => {
        mockLLMResponse({
          ...minimalLLMResponse,
          irrelevantUserSkills: ['JavaScript', 'Docker', 'Python'],
        });

        const result = await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        expect(result.irrelevantUserSkills).not.toContain('JavaScript');
        expect(result.irrelevantUserSkills).not.toContain('Docker');
        // Python is not alwaysInclude — can be irrelevant
        expect(result.irrelevantUserSkills).toContain('Python');
      });

      it('alwaysInclude expert skill gets feature tier in matched', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const js = result.matched.find((s) => s.name === 'JavaScript');
        expect(js.tier).toBe('feature');
      });

      it('alwaysInclude beginner skill gets growth tier in matched', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const docker = result.matched.find((s) => s.name === 'Docker');
        expect(docker.tier).toBe('growth');
      });

      it('non-alwaysInclude skills work as before', async () => {
        mockLLMResponse(minimalLLMResponse);

        const result = await skillMatcher.matchSkillsToJob(
          alwaysIncludeUserSkills, defaultJobSkills, defaultJobRequirements, 'user-1'
        );

        const react = result.matched.find((s) => s.name === 'React');
        expect(react.matchStrength).toBe('strong');
      });
    });
  });
});
