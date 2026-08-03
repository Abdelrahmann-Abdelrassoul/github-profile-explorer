import { groq } from "@ai-sdk/groq";

/**
 * The app's AI provider, in one place so the repo chat (task 5) cannot drift from the
 * profile summary.
 *
 * Groq rather than Gemini: docs/spec.md picked Gemini for being free without a credit
 * card, and that stopped being true — the key returned 403 PERMISSION_DENIED and the
 * project now needs billing. Groq's free tier needs only an email, allows roughly 30
 * requests/min, and streams. Because everything goes through the Vercel AI SDK, swapping
 * providers is this file plus an env var.
 */

/** Verify against https://console.groq.com/docs/models before changing — IDs get retired. */
export const AI_MODEL_ID = "llama-3.3-70b-versatile";

export function aiModel() {
  return groq(AI_MODEL_ID);
}

/** The provider reads GROQ_API_KEY itself; this is only so routes can fail clearly. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
