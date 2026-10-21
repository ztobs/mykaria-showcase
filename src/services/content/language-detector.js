const llmService = require('../llm');
const logger = require('../../utils/logger');
const { LANGUAGES } = require('../../constants');

/**
 * Language detection — both explicit extraction from improvement text (regex)
 * and implicit detection via LLM.
 */
class LanguageDetector {
  /**
   * Get language name from ISO code.
   */
  getLanguageName(code) {
    const languageNames = {
      'en': 'English',
      'de': 'German',
      'fr': 'French',
      'es': 'Spanish',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'ru': 'Russian',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi'
    };
    return languageNames[code] || code;
  }

  /**
   * Extract explicit language instruction from improvement text.
   * Looks for patterns like "language: de", "in German", "write in French", etc.
   */
  extractExplicitLanguage(improvementText) {
    if (!improvementText || typeof improvementText !== 'string') {
      logger.info('[Language Extract] No improvement text provided or invalid type');
      return null;
    }

    logger.info('[Language Extract] Checking improvement text:', improvementText.substring(0, 200));
    const text = improvementText.toLowerCase();

    // Pattern 1: "language: XX" or "language:XX" (ISO code)
    const isoMatch = text.match(/language\s*:\s*([a-z]{2})\b/i);
    if (isoMatch && LANGUAGES.SUPPORTED_LANGUAGES.includes(isoMatch[1].toLowerCase())) {
      logger.info(`[Language Extract] Found ISO language code: ${isoMatch[1].toLowerCase()}`);
      return isoMatch[1].toLowerCase();
    }

    // Pattern 2: "in German", "in French", "in Spanish", etc.
    const languageMap = {
      'german': 'de',
      'deutsch': 'de',
      'french': 'fr',
      'français': 'fr',
      'francais': 'fr',
      'spanish': 'es',
      'español': 'es',
      'espanol': 'es',
      'italian': 'it',
      'italiano': 'it',
      'portuguese': 'pt',
      'português': 'pt',
      'portugues': 'pt',
      'dutch': 'nl',
      'nederlands': 'nl',
      'russian': 'ru',
      'русский': 'ru',
      'japanese': 'ja',
      '日本語': 'ja',
      'chinese': 'zh',
      '中文': 'zh',
      'korean': 'ko',
      '한국어': 'ko',
      'arabic': 'ar',
      'عربي': 'ar',
      'hindi': 'hi',
      'हिन्दी': 'hi',
      'english': 'en'
    };

    for (const [languageName, code] of Object.entries(languageMap)) {
      const escapedName = languageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const patterns = [
        new RegExp(`\\bin\\s+${escapedName}\\b`, 'i'),
        new RegExp(`\\bwrite\\s+in\\s+${escapedName}\\b`, 'i'),
        new RegExp(`\\buse\\s+${escapedName}\\b`, 'i'),
        new RegExp(`\\b${escapedName}\\s+language\\b`, 'i'),
        new RegExp(`\\bwrite\\s+${escapedName}\\b`, 'i'),
        new RegExp(`^${escapedName}\\b`, 'i'),
        new RegExp(`\\b${escapedName}$`, 'i')
      ];

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          logger.info(`[Language Extract] Found language instruction: "${languageName}" -> ${code} (pattern: ${pattern})`);
          return code;
        }
      }
    }

    logger.info('[Language Extract] No explicit language instruction found');
    return null;
  }

  /**
   * Detect language from content using LLM.
   */
  async detectLanguage(content, userId = null) {
    try {
      const prompt = `
Detect the language of the following text and return ONLY the two-letter ISO 639-1 language code (e.g., "en", "de", "fr", "es").

TEXT:
${content}

Return only the language code, nothing else.
`;

      const { text: response } = await llmService.generateText(prompt, {
        systemPrompt:
          'You are an expert at detecting languages. Return only the two-letter ISO 639-1 language code.',
        maxTokens: 10,
        temperature: 0.1,
        action: 'ENHANCE_DOCUMENT',
      }, userId);

      const detectedLanguage = response.trim().toLowerCase();

      if (LANGUAGES.SUPPORTED_LANGUAGES.includes(detectedLanguage)) {
        return detectedLanguage;
      } else {
        logger.warn(
          `Unexpected language detection response: "${detectedLanguage}", defaulting to English`
        );
        return LANGUAGES.DEFAULT_LANGUAGE;
      }
    } catch (error) {
      logger.error('Error detecting language with LLM:', error);
      return LANGUAGES.DEFAULT_LANGUAGE;
    }
  }
}

module.exports = LanguageDetector;
