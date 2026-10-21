/**
 * Showcase stub for the LLM client.
 *
 * In production this module is the multi-provider client: OpenAI, Anthropic,
 * Ollama, OpenRouter and any custom OpenAI-compatible endpoint, with token
 * accounting, cost resolution, retry/backoff and a thinking-trace stripper.
 *
 * It is deliberately excluded from this public slice, which demonstrates the
 * deterministic layers (prompt assembly, skill match post-processing,
 * language detection). The unit tests here mock this module.
 */
module.exports = {
  generateText: async () => {
    throw new Error('LLM calls are not part of the public showcase slice.');
  },
};
