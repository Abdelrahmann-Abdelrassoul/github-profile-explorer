import { availableModels, markModelCoolingDown } from "@/lib/server/ai";
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
 * Only rate limits move to the next model. A malformed request or a retired model id would
 * fail identically everywhere, so retrying those would waste the rest of the chain and
 * delay a real error reaching the reader.
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
 * `build` is called once per attempt and must wire `onError` into streamText, because a
 * provider rejection is reported there rather than thrown — see the comment in the routes.
 */
export async function streamWithFallback(
  build: (modelId: string, onError: (error: unknown) => void) => StreamLike,
): Promise<StreamRun> {
  let lastError: unknown = null;

  for (const modelId of availableModels()) {
    let providerError: unknown = null;
    const result = build(modelId, (error) => {
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
      return { ok: true, modelId, first, iterator };
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
    if (failure.status !== 429) return { ok: false, error: providerError };

    // Remember roughly how long this one is out, so later requests skip it rather than
    // spending an attempt rediscovering the same limit.
    markModelCoolingDown(modelId, failure.retryAfterSeconds ?? 60);
    console.warn(`AI model ${modelId} rate limited; trying the next in the chain`);
  }

  return { ok: false, error: lastError };
}
