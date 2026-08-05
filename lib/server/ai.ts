import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/**
 * The app's AI model chain.
 *
 * Groq rather than Gemini: docs/spec.md picked Gemini for being free without a credit
 * card, and that stopped being true — the key returned 403 PERMISSION_DENIED and the
 * project now needs billing. Groq's free tier needs only an email.
 *
 * Nothing outside this file names a provider. Each chain entry carries its own model
 * factory and its own "is the key present?" test, so adding a second provider is one more
 * entry plus an env var — the routes and the chain runner do not change.
 */

/**
 * One model the chain may try.
 *
 * `provider` exists to answer two questions `id` cannot: whether two entries fail together
 * because they share credentials, and whether the chain spans more than one provider —
 * which is what makes a 404 worth walking past rather than fatal. See ai-fallback.ts.
 */
export type ChainEntry = {
  /** Model id, for cooldown keys and logs. Never used to dispatch to a provider. */
  id: string;
  /** Which service's credentials this needs. Entries sharing one share its fate. */
  provider: string;
  /** Read at call time, not at module load — env is not always populated at import. */
  isConfigured: () => boolean;
  model: () => LanguageModel;
};

/** The provider reads GROQ_API_KEY itself; the predicate is only so the chain can skip. */
function groqEntry(id: string): ChainEntry {
  return {
    id,
    provider: "groq",
    isConfigured: () => Boolean(process.env.GROQ_API_KEY),
    model: () => groq(id),
  };
}

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
export const AI_MODEL_CHAIN: readonly ChainEntry[] = [
  groqEntry("llama-3.3-70b-versatile"),
  groqEntry("openai/gpt-oss-120b"),
  groqEntry("llama-3.1-8b-instant"),
  groqEntry("openai/gpt-oss-20b"),
];

/**
 * Kept for the follow-up suggestions, which never need a large model.
 *
 * Still tied to Groq on purpose: suggestions are a nicety that already fails to an empty
 * list, so they are not worth a chain. If Groq ever stops being the only provider, this is
 * the other place that needs revisiting.
 */
export const AI_SMALL_MODEL_ID = "llama-3.1-8b-instant";

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

/**
 * Whether any provider in the chain has its key set.
 *
 * Deliberately not a GROQ_API_KEY check. The point of the chain is that adding a provider
 * is one entry plus an env var; a hardcoded predicate here would quietly break that
 * promise by demanding an edit as well.
 *
 * Debt worth naming rather than discovering: the routes answer 503 with "Set
 * GROQ_API_KEY". That is still accurate while Groq is the only provider, but the moment a
 * second one lands the message needs generalising or it will name the wrong key.
 */
export function isAiConfigured(): boolean {
  return AI_MODEL_CHAIN.some((entry) => entry.isConfigured());
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

/**
 * Keyed by provider as well as model, because two providers can serve the same model id
 * (OpenRouter resells several of these) and one being exhausted says nothing about the
 * other. Keying on the id alone would sideline both at once.
 */
function cooldownKey(entry: ChainEntry): string {
  return `${entry.provider}:${entry.id}`;
}

export function isModelCoolingDown(entry: ChainEntry): boolean {
  const key = cooldownKey(entry);
  const until = cooldowns.get(key);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    cooldowns.delete(key);
    return false;
  }
  return true;
}

export function markModelCoolingDown(entry: ChainEntry, seconds: number): void {
  // Cap it: a wrong or hostile retry-after should not sideline a model indefinitely.
  const bounded = Math.min(Math.max(seconds, 1), 60 * 60);
  cooldowns.set(cooldownKey(entry), Date.now() + bounded * 1000);
}

/**
 * How many distinct providers are usable in this deployment.
 *
 * The chain runner needs it to decide whether a retired model id is fatal or worth
 * walking past.
 */
export function configuredProviderCount(): number {
  const providers = new Set<string>();
  for (const entry of AI_MODEL_CHAIN) {
    if (entry.isConfigured()) providers.add(entry.provider);
  }
  return providers.size;
}

/** Chain order minus anything unconfigured or currently rate limited, best first. */
export function availableModels(): ChainEntry[] {
  // An entry whose key is absent is skipped silently rather than attempted and failed —
  // that is what lets a provider sit in the chain before anyone has signed up for it.
  const configured = AI_MODEL_CHAIN.filter((entry) => entry.isConfigured());
  const usable = configured.filter((entry) => !isModelCoolingDown(entry));

  // If everything is cooling down, still try the best one — a cooldown is an estimate, and
  // failing without attempting anything is worse than one wasted call. Note this falls back
  // to the best *configured* entry rather than the head of the chain, which may belong to a
  // provider this deployment has no key for.
  return usable.length > 0 ? usable : configured.slice(0, 1);
}
