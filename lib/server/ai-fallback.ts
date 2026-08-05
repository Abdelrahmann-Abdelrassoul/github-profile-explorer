import type { LanguageModel } from "ai";

import { availableModels, configuredProviderCount, markModelCoolingDown } from "@/lib/server/ai";
import { describeAiFailure } from "@/lib/server/ai-errors";

/**
 * Runs a generation against the model chain, moving on when one is rate limited.
 *
 * A single free model is a single point of failure: the largest one allows 100,000 tokens
 * a day and 12,000 a minute, which at roughly 4,000 tokens per grounded chat turn is about
 * two dozen answers a day and three a minute. The same key reaches several models and Groq
 * meters each separately, so spilling over turns that into a far larger shared allowance —
 * and, just as importantly, keeps the feature working instead of failing once the first
 * model is spent.
 *
 * This file names no provider. It is handed entries by `availableModels()` and asks each
 * one for its own model, so a second provider changes nothing here.
 */

/**
 * The part of streamText's result this needs, kept structural to avoid its generics.
 * `text` is a PromiseLike rather than a Promise on the SDK's result, so it is typed that
 * way here — `await` works either way.
 */
type StreamLike = {
  textStream: AsyncIterable<string>;
  text: PromiseLike<string>;
};

export type StreamRun =
  | {
      ok: true;
      modelId: string;
      /** Already pulled, so a provider rejection is known before streaming starts. */
      first: IteratorResult<string>;
      iterator: AsyncIterator<string>;
    }
  | { ok: false; error: unknown };

/**
 * Whether a failure is worth trying the next model for.
 *
 * Rate limits always are — that is the whole point of the chain.
 *
 * A retired model id (404) depends on how many providers are configured. Within one
 * provider the rest of the chain is reached through the same account, so a dead id there
 * signals a stale config; walking on would burn the remaining models and bury the real
 * cause behind a worse answer. Across providers a dead id on one says nothing about the
 * next, and stopping would throw away the resilience the chain exists for.
 *
 * Everything else — a malformed request, a bad key — fails identically everywhere and is
 * reported straight away.
 */
function shouldTryNextModel(providerStatus: number | undefined, status: number): boolean {
  if (status === 429) return true;
  return providerStatus === 404 && configuredProviderCount() > 1;
}

/**
 * `build` is called once per attempt and must wire `onError` into streamText, because a
 * provider rejection is reported there rather than thrown — see the comment in the routes.
 * It receives a ready model rather than an id: an id would have to be mapped back to a
 * provider here, and that stops being unambiguous as soon as two of them serve the same one.
 */
export async function streamWithFallback(
  build: (model: LanguageModel, onError: (error: unknown) => void) => StreamLike,
): Promise<StreamRun> {
  let lastError: unknown = null;

  for (const entry of availableModels()) {
    let providerError: unknown = null;
    const result = build(entry.model(), (error) => {
      providerError = error;
    });

    /*
     * The SDK's `text` promise rejects when the provider does, and this function returns
     * without awaiting it on both the success path and any non-rate-limit failure. An
     * unattended rejection is fatal to the process under Node's default behaviour, so
     * claim it up front. Attaching a handler does not consume it — the `await` below
     * still sees the same result.
     */
    void Promise.resolve(result.text).catch(() => {});

    const iterator = result.textStream[Symbol.asyncIterator]();
    let first: IteratorResult<string> | undefined;
    try {
      first = await iterator.next();
    } catch (error) {
      providerError = error;
    }

    // Inlined rather than hoisted into a variable so TypeScript narrows `first` here.
    if (!providerError && first && !(first.done && !first.value)) {
      return { ok: true, modelId: entry.id, first, iterator };
    }

    // onError can fire after the stream ends, so reading it immediately races and loses
    // the reason — which is the difference between knowing to try another model and not.
    if (!providerError) {
      try {
        await result.text;
      } catch (error) {
        providerError = error;
      }
    }

    lastError = providerError;
    const failure = describeAiFailure(providerError);
    if (!shouldTryNextModel(failure.providerStatus, failure.status)) {
      return { ok: false, error: providerError };
    }

    if (failure.status === 429) {
      // Remember roughly how long this one is out, so later requests skip it rather than
      // spending an attempt rediscovering the same limit.
      markModelCoolingDown(entry, failure.retryAfterSeconds ?? 60);
      console.warn(`AI model ${entry.id} rate limited; trying the next in the chain`);
    } else {
      console.warn(`AI model ${entry.id} is no longer available; trying the next in the chain`);
    }
  }

  return { ok: false, error: lastError };
}
