const PromptBuilder = require('../../../src/services/prompts/prompt-builder');

describe('PromptBuilder — buildCVPrompt headline fork', () => {
  let builder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  const basicJobData = {
    title: 'Fullstack Softwareentwickler (m/w/d)',
    company: 'Acme Corp',
    description: 'Building web applications with React and Node.js.',
    requirements: ['React', 'Node.js'],
    location: 'Berlin',
  };

  const basicProfile = {
    fullName: 'Test User',
    email: 'test@test.com',
    skills: [{ name: 'React', category: 'technical', level: 'advanced' }],
  };

  describe('when user has set a headline', () => {
    it('should include the user headline in the prompt', () => {
      const profile = { ...basicProfile, headline: 'Fullstack Developer | Cloud | 8 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('Fullstack Developer | Cloud | 8 Years');
    });

    it('should instruct the LLM to ADJUST the headline, not generate from scratch', () => {
      const profile = { ...basicProfile, headline: 'Fullstack Developer | Cloud | 8 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('ADJUST');
      expect(prompt).toContain('user has provided');
    });

    it('should instruct the LLM to reorder segments for JD relevance', () => {
      const profile = { ...basicProfile, headline: 'Fullstack Developer | Cloud | 8 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('reorder');
    });

    it('should forbid inflating titles', () => {
      const profile = { ...basicProfile, headline: 'Fullstack Developer | Cloud | 8 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('NOT');
      expect(prompt).toContain('senior');
      expect(prompt).toContain('lead');
      expect(prompt).toContain('inflate');
    });

    it('should NOT contain the generate-from-scratch headline instruction', () => {
      const profile = { ...basicProfile, headline: 'Fullstack Developer | Cloud | 8 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).not.toContain('Create a compelling HEADLINE');
    });
  });

  describe('when user has NOT set a headline', () => {
    it('should NOT include user headline in the prompt', () => {
      const prompt = builder.buildCVPrompt(basicJobData, basicProfile);
      expect(prompt).not.toContain('USER HEADLINE');
    });

    it('should instruct the LLM to CREATE a headline from scratch (existing behavior)', () => {
      const prompt = builder.buildCVPrompt(basicJobData, basicProfile);

      expect(prompt).toContain('Create a compelling HEADLINE');
    });
  });

  describe('JD title sanitization', () => {
    it('should strip (m/w/d) from JD title in the prompt', () => {
      const prompt = builder.buildCVPrompt(basicJobData, basicProfile);

      // The raw title has (m/w/d) — the prompt should use the cleaned version
      expect(prompt).not.toContain('Fullstack Softwareentwickler (m/w/d)');
      expect(prompt).toContain('Fullstack Softwareentwickler');
    });

    it('should clean the JD title even when user has a headline', () => {
      const profile = { ...basicProfile, headline: 'DevOps | Cloud | 5 Years' };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).not.toContain('(m/w/d)');
    });
  });

  describe('experience date formatting', () => {
    it('should include [ID: N] tags on each experience entry in the CV prompt', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Senior Dev', company: 'Acme', startDate: 'Jan 2023', endDate: 'Jun 2025', current: false },
          { role: 'Junior Dev', company: 'OldCo', startDate: 'Mar 2020', endDate: 'Dec 2022', current: false },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('[ID: 1]');
      expect(prompt).toContain('[ID: 2]');
    });

    it('should show endDate when current is false and endDate is set', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: 'Jun 2025', current: false },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('[ID: 1] Dev at Acme (Jan 2023-Jun 2025):');
      // Should NOT render "Present" in the date range for this entry
      expect(prompt).not.toContain('(Jan 2023-Present)');
    });

    it('should show Present when current is true, regardless of endDate value', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: 'Jun 2025', current: true },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('(Jan 2023-Present)');
    });

    it('should show Present when current is true and endDate is empty', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: '', current: true },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('(Jan 2023-Present)');
    });

    it('should show empty endDate when current is false and endDate is empty', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: '', current: false },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('(Jan 2023-)');
    });

    it('should fall back to legacy heuristic when current field is missing and endDate is set', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: 'Jun 2025' },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('[ID: 1] Dev at Acme (Jan 2023-Jun 2025):');
    });

    it('should fall back to legacy heuristic (Present) when current field is missing and endDate is empty', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: '' },
        ],
      };
      const prompt = builder.buildCVPrompt(basicJobData, profile);

      expect(prompt).toContain('(Jan 2023-Present)');
    });

    it('should include [ID: N] tags on experience entries in the cover letter prompt', () => {
      const profile = {
        ...basicProfile,
        experience: [
          { role: 'Dev', company: 'Acme', startDate: 'Jan 2023', endDate: 'Jun 2025', current: false, description: 'Dev work building features' },
        ],
      };
      const prompt = builder.buildCoverLetterPrompt({ ...basicJobData, title: 'Dev' }, profile);

      expect(prompt).toContain('[ID: 1]');
    });
  });

  describe('company research injection — COMPANY CULTURE section', () => {
    const companyResearch = {
      profile: {
        culture: 'Innovative and fast-paced',
        tone: 'casual and direct',
        values: ['transparency', 'customer obsession'],
        mission: 'Empower small businesses',
        industry: 'Fintech',
        size: '50-200',
      },
      skills: [],
      achievements: [],
    };

    describe('in buildCVPrompt', () => {
      it('should include COMPANY CULTURE section when profile data is available', () => {
        const jobData = { ...basicJobData, companyResearch };
        const prompt = builder.buildCVPrompt(jobData, basicProfile);

        expect(prompt).toContain('COMPANY CULTURE (from research');
        expect(prompt).toContain('Innovative and fast-paced');
        expect(prompt).toContain('casual and direct');
        expect(prompt).toContain('transparency, customer obsession');
        expect(prompt).toContain('Empower small businesses');
        expect(prompt).toContain('Fintech');
        expect(prompt).toContain('50-200');
      });

      it('should include TONE MIRRORING instructions after culture data', () => {
        const jobData = { ...basicJobData, companyResearch };
        const prompt = builder.buildCVPrompt(jobData, basicProfile);

        expect(prompt).toContain('TONE MIRRORING');
        expect(prompt).toContain('calibrate your writing voice');
      });

      it('should omit COMPANY CULTURE section when profile is null', () => {
        const jobData = { ...basicJobData, companyResearch: { profile: null, skills: [], achievements: [] } };
        const prompt = builder.buildCVPrompt(jobData, basicProfile);

        expect(prompt).not.toContain('COMPANY CULTURE (from research');
      });

      it('should omit COMPANY CULTURE section when companyResearch is absent', () => {
        const prompt = builder.buildCVPrompt(basicJobData, basicProfile);

        expect(prompt).not.toContain('COMPANY CULTURE (from research');
      });

      it('should still include existing tone matching section when culture section is added', () => {
        const jobData = { ...basicJobData, companyResearch };
        const prompt = builder.buildCVPrompt(jobData, basicProfile);

        expect(prompt).toContain('COMPANY TONE & CULTURE');
        expect(prompt).toContain('FORMALITY LEVEL');
      });
    });

    describe('in buildCoverLetterPrompt', () => {
      it('should include COMPANY CULTURE section when profile data is available', () => {
        const jobData = { ...basicJobData, companyResearch };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).toContain('COMPANY CULTURE (from research');
        expect(prompt).toContain('Innovative and fast-paced');
        expect(prompt).toContain('transparency, customer obsession');
        expect(prompt).toContain('Empower small businesses');
        expect(prompt).toContain('Fintech');
        expect(prompt).toContain('50-200');
      });

      it('should omit COMPANY CULTURE section when profile is null', () => {
        const jobData = { ...basicJobData, companyResearch: { profile: null, skills: [], achievements: [] } };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).not.toContain('COMPANY CULTURE (from research');
      });

      it('should omit COMPANY CULTURE section when companyResearch is absent', () => {
        const prompt = builder.buildCoverLetterPrompt(basicJobData, basicProfile);

        expect(prompt).not.toContain('COMPANY CULTURE (from research');
      });
    });
  });

  describe('company research injection — RECENT COMPANY ACHIEVEMENTS section', () => {
    const companyResearchWithAchievements = {
      profile: null,
      skills: [],
      achievements: [
        { headline: 'Series B funding of $50M', date: 'March 2025', relevance: 'Company is growing rapidly' },
        { headline: 'Launched new AI product', date: 'January 2025', relevance: 'Expanding product portfolio' },
      ],
    };

    describe('in buildCoverLetterPrompt', () => {
      it('should include RECENT COMPANY ACHIEVEMENTS section when achievements are available', () => {
        const jobData = { ...basicJobData, companyResearch: companyResearchWithAchievements };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).toContain('RECENT COMPANY ACHIEVEMENTS');
        expect(prompt).toContain('Series B funding of $50M');
        expect(prompt).toContain('March 2025');
        expect(prompt).toContain('Company is growing rapidly');
        expect(prompt).toContain('Launched new AI product');
        expect(prompt).toContain('January 2025');
        expect(prompt).toContain('Expanding product portfolio');
      });

      it('should instruct LLM to reference achievements concretely', () => {
        const jobData = { ...basicJobData, companyResearch: companyResearchWithAchievements };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).toContain('reference where relevant');
        expect(prompt).toContain('be specific and timely');
      });

      it('should omit RECENT COMPANY ACHIEVEMENTS section when achievements is empty', () => {
        const jobData = { ...basicJobData, companyResearch: { profile: null, skills: [], achievements: [] } };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).not.toContain('RECENT COMPANY ACHIEVEMENTS');
      });

      it('should omit RECENT COMPANY ACHIEVEMENTS section when achievements is null', () => {
        const jobData = { ...basicJobData, companyResearch: { profile: null, skills: [], achievements: null } };
        const prompt = builder.buildCoverLetterPrompt(jobData, basicProfile);

        expect(prompt).not.toContain('RECENT COMPANY ACHIEVEMENTS');
      });

      it('should omit RECENT COMPANY ACHIEVEMENTS section when companyResearch is absent', () => {
        const prompt = builder.buildCoverLetterPrompt(basicJobData, basicProfile);

        expect(prompt).not.toContain('RECENT COMPANY ACHIEVEMENTS');
      });
    });

    describe('in buildCVPrompt', () => {
      it('should NOT include RECENT COMPANY ACHIEVEMENTS in CV prompt', () => {
        const jobData = { ...basicJobData, companyResearch: companyResearchWithAchievements };
        const prompt = builder.buildCVPrompt(jobData, basicProfile);

        expect(prompt).not.toContain('RECENT COMPANY ACHIEVEMENTS');
      });
    });
  });

  // =====================================================================
  // Growth-tier skill cap
  // =====================================================================

  describe('growth-tier skill cap', () => {
    const growthMatch = {
      matched: [
        { name: 'Python', level: 'beginner', category: 'technical', matchStrength: 'exact', matchedJobTerms: [] },
        { name: 'Go', level: 'beginner', category: 'technical', matchStrength: 'strong', matchedJobTerms: [] },
        { name: 'Rust', level: 'beginner', category: 'technical', matchStrength: 'strong', matchedJobTerms: [] },
        { name: 'Kotlin', level: 'beginner', category: 'technical', matchStrength: 'moderate', matchedJobTerms: [] },
        { name: 'Angular', level: 'beginner', category: 'technical', matchStrength: 'moderate', matchedJobTerms: [] },
        { name: 'Flutter', level: 'beginner', category: 'technical', matchStrength: 'moderate', matchedJobTerms: [] },
      ],
      unmatchedJobSkills: [],
      irrelevantUserSkills: [],
      complementarySkills: [],
    };

    it('caps GROWTH skills to the 5 most relevant, dropping the rest', () => {
      const prompt = builder.buildCVPrompt(basicJobData, basicProfile, null, null, growthMatch);

      // exact + strong survive, then moderate by name; 6th (Kotlin) dropped
      expect(prompt).toContain('- Python (level: beginner, match: exact)');
      expect(prompt).toContain('- Go (level: beginner, match: strong)');
      expect(prompt).toContain('- Rust (level: beginner, match: strong)');
      expect(prompt).toContain('- Angular (level: beginner, match: moderate)');
      expect(prompt).toContain('- Flutter (level: beginner, match: moderate)');
      expect(prompt).not.toContain('- Kotlin (level: beginner, match: moderate)');
    });

    it('keeps all GROWTH skills when there are five or fewer', () => {
      const match = {
        ...growthMatch,
        matched: growthMatch.matched.slice(0, 3),
      };
      const prompt = builder.buildCVPrompt(basicJobData, basicProfile, null, null, match);

      expect(prompt).toContain('- Python (level: beginner, match: exact)');
      expect(prompt).toContain('- Go (level: beginner, match: strong)');
      expect(prompt).toContain('- Rust (level: beginner, match: strong)');
    });
  });
});
