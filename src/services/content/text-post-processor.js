/**
 * Deterministic text post-processing for AI-generated CV and cover letter content.
 * Zero LLM cost — pure regex and string operations.
 */
class TextPostProcessor {
  /**
   * Strip common AI filler patterns from a bullet string.
   */
  stripBulletFiller(bullet) {
    if (!bullet || typeof bullet !== 'string') return bullet;

    let s = bullet;

    const trailingFiller = [
      /,?\s+contributing\s+to\s+(the\s+)?(team|company|organization|business|project)['s\s]*\w*/gi,
      /,?\s+driving\s+(business\s+)?(value|growth|success|results)/gi,
      /,?\s+resulting\s+in\s+improved\s+\w+(\s+\w+)?/gi,
      /,?\s+leading\s+to\s+(improved|enhanced|better|greater)\s+\w+(\s+\w+)?/gi,
      /,?\s+demonstrating\s+(strong\s+)?\w+\s+(skills|abilities|capabilities)/gi,
      /,?\s+showcasing\s+\w+(\s+\w+)?\s+(expertise|skills|abilities)/gi,
      /,?\s+fostering\s+(a\s+)?\w+(\s+\w+)?(\s+environment|culture|mindset)?/gi,
      /,?\s+highlighting\s+(the\s+)?(importance|value|impact)\s+of\s+\w+(\s+\w+)?/gi,
      /,?\s+underscoring\s+(the\s+)?(team|organization|company)['s\s]*\w*/gi,
    ];

    for (const pattern of trailingFiller) {
      s = s.replace(pattern, '');
    }

    s = s.replace(/\b(significantly|substantially|greatly|dramatically)\b(?!\s+\d)/gi, '');

    s = s.replace(/\s{2,}/g, ' ').trim();

    s = s.replace(/[,\s]+\.$/, '.');

    return s;
  }

  /**
   * Apply stripBulletFiller to all achievement bullets in the CV object.
   */
  cleanCVBullets(cv) {
    if (!cv || typeof cv !== 'object') return cv;
    const out = { ...cv };

    if (Array.isArray(out.experience)) {
      out.experience = out.experience.map(entry => {
        if (!Array.isArray(entry.achievements)) return entry;
        return {
          ...entry,
          achievements: entry.achievements.map(b => this.stripBulletFiller(b)),
        };
      });
    }

    return out;
  }

  /**
   * Extract JSON content from markdown code blocks.
   */
  extractJsonFromMarkdown(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }

    const cleanedContent = content
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return cleanedContent
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  /**
   * Ensure first letter of content is lowercase for German cover letters.
   * German business letter convention requires lowercase first letter after salutation.
   */
  ensureGermanFirstLetterLowercase(content, language) {
    if (language !== 'de') {
      return content;
    }

    if (!content || !content.trim()) {
      return content;
    }

    const firstLetterMatch = content.match(/^(\s*(?:<[^>]+>)*\s*)([A-ZÄÖÜ])/);

    if (firstLetterMatch) {
      const prefix = firstLetterMatch[1];
      const firstLetter = firstLetterMatch[2];
      const restOfContent = content.slice(prefix.length + firstLetter.length);

      return prefix + firstLetter.toLowerCase() + restOfContent;
    }

    return content;
  }
}

module.exports = TextPostProcessor;
