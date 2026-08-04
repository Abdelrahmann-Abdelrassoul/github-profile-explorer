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

/**
 * A smaller model for secondary work.
 *
 * Groq's quotas are per-model, so routing follow-up suggestions here keeps them from
 * eating the answer budget — the free tier's 100k daily tokens on the main model is only
 * around forty exchanges, and suggestions were previously taking half of it. Proposing
 * three short questions does not need a 70B model.
 */
export const AI_SMALL_MODEL_ID = "llama-3.1-8b-instant";

export function aiModel() {
  return groq(AI_MODEL_ID);
}

export function aiSmallModel() {
  return groq(AI_SMALL_MODEL_ID);
}

/**
 * Retries are capped low on purpose.
 *
 * The SDK treats every 429 as retryable, so an exhausted daily budget was retried three
 * times over seven seconds — none of which could have succeeded, since the reset was
 * eighteen minutes out. Groq even returns `x-should-retry: false` on those. One retry
 * still covers a genuine blip without making the reader wait through a hopeless sequence.
 */
export const AI_MAX_RETRIES = 1;

/** The provider reads GROQ_API_KEY itself; this is only so routes can fail clearly. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
