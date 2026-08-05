import { groq } from "@ai-sdk/groq";

/**
 * The app's AI provider and its model chain.
 *
 * Groq rather than Gemini: docs/spec.md picked Gemini for being free without a credit
 * card, and that stopped being true — the key returned 403 PERMISSION_DENIED and the
 * project now needs billing. Groq's free tier needs only an email. Because everything goes
 * through the Vercel AI SDK, swapping providers is this file plus an env var.
 */

/**
 * Models tried in order, best first.
 *
 * One free key reaches several models, and Groq meters each one separately, so a chain
 * multiplies both the daily budget and the per-minute ceiling rather than leaning on a
 * single allowance. Measured limits, and what they buy:
 *
 *   llama-3.3-70b-versatile   12,000 TPM   100,000 TPD   best answers
 *   openai/gpt-oss-120b        8,000 TPM   (undocumented)
 *   llama-3.1-8b-instant       6,000 TPM   500,000 TPD   the deep reserve
 *   openai/gpt-oss-20b         8,000 TPM   (undocumented)
 *
 * Ordered by answer quality, with the largest daily allowance placed late so it survives
 * to cover the rest of the day once the others are spent.
 *
 * Every model here was checked against the two tests that matter for the repo chat: it
 * must recall commits that only exist in the injected context, and it must refuse when
 * asked about source it was not given. `qwen/qwen3.6-27b` is deliberately absent — it
 * grounds correctly but emits its `<think>` reasoning into the visible answer.
 *
 * Model ids get retired; verify against console.groq.com/docs/models if calls start
 * returning 404.
 */
export const AI_MODEL_CHAIN = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
] as const;

/** Kept for the follow-up suggestions, which never need a large model. */
export const AI_SMALL_MODEL_ID = "llama-3.1-8b-instant";

/** The head of the chain, for anything that wants a single model. */
export const AI_MODEL_ID = AI_MODEL_CHAIN[0];

export function aiModel(modelId: string = AI_MODEL_ID) {
  return groq(modelId);
}

export function aiSmallModel() {
  return groq(AI_SMALL_MODEL_ID);
}

/**
 * Retries within a single model are capped low on purpose.
 *
 * The SDK treats every 429 as retryable, so an exhausted daily budget was retried three
 * times over seven seconds — none of which could have succeeded, since the reset was
 * eighteen minutes out. Groq even returns `x-should-retry: false` on those. With a chain
 * in place the useful move is to change model, not to ask the same one again.
 */
export const AI_MAX_RETRIES = 0;

/** The provider reads GROQ_API_KEY itself; this is only so routes can fail clearly. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Models known to be rate limited, and when they are worth trying again.
 *
 * A daily budget takes hours to reset, so without this every request would spend a call
 * rediscovering that the first model is still exhausted. Module scope means it is per
 * serverless instance rather than global — imperfect, but it costs nothing and removes
 * most of the waste. Instances that have not learned it yet simply find out once.
 */
const cooldowns = new Map<string, number>();

export function isModelCoolingDown(modelId: string): boolean {
  const until = cooldowns.get(modelId);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    cooldowns.delete(modelId);
    return false;
  }
  return true;
}

export function markModelCoolingDown(modelId: string, seconds: number): void {
  // Cap it: a wrong or hostile retry-after should not sideline a model indefinitely.
  const bounded = Math.min(Math.max(seconds, 1), 60 * 60);
  cooldowns.set(modelId, Date.now() + bounded * 1000);
}

/** Chain order minus anything currently rate limited, best first. */
export function availableModels(): string[] {
  const usable = AI_MODEL_CHAIN.filter((id) => !isModelCoolingDown(id));
  // If everything is cooling down, still try the best one — a cooldown is an estimate,
  // and failing without attempting anything is worse than one wasted call.
  return usable.length > 0 ? [...usable] : [AI_MODEL_CHAIN[0]];
}
