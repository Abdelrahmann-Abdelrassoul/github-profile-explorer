import { streamText } from "ai";

import { AI_MAX_RETRIES, aiModel, isAiConfigured } from "@/lib/server/ai";
import { describeAiFailure } from "@/lib/server/ai-errors";
import { streamWithFallback } from "@/lib/server/ai-fallback";
import { GitHubError, fetchUser, fetchUserRepos } from "@/lib/server/github";
import { SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt } from "@/lib/server/summary-prompt";

/**
 * Streams an AI summary of a GitHub profile.
 *
 * The client posts only a username. The profile and repo list are re-fetched here rather
 * than accepted from the browser, so the request body cannot dictate what gets sent to the
 * model. Those fetches hit the same 5-minute cache the profile page just populated, so in
 * practice they cost nothing.
 */

/** Streaming keeps this well short of the limit, but the default is tighter on Vercel. */
export const maxDuration = 30;

export async function POST(request: Request) {
  let username: string;
  try {
    const body: unknown = await request.json();
    const value =
      typeof body === "object" && body !== null
        ? (body as { username?: unknown }).username
        : undefined;
    if (typeof value !== "string" || !value.trim()) {
      return new Response("A username is required.", { status: 400 });
    }
    username = value.trim();
  } catch {
    return new Response("Malformed request body.", { status: 400 });
  }

  if (!isAiConfigured()) {
    return new Response("The AI summary is not configured. Set GROQ_API_KEY.", {
      status: 503,
    });
  }

  let prompt: string;
  try {
    const [user, repos] = await Promise.all([
      fetchUser(username),
      fetchUserRepos(username),
    ]);
    prompt = buildSummaryPrompt(user, repos);
  } catch (error) {
    if (error instanceof GitHubError) {
      // Reuse the wrapper's classification rather than inventing new wording here.
      const status = error.kind === "not-found" ? 404 : 502;
      return new Response(error.message, { status });
    }
    throw error;
  }

  /*
   * streamText does not throw when the provider rejects the request, and it does not
   * surface the failure through the text stream either — the stream simply ends with no
   * content. Returning result.toTextStreamResponse() directly therefore answers 200 with
   * an empty body, and the UI shows nothing with no way to explain why.
   *
   * So: capture the error out-of-band via onError, then pull the first chunk before
   * committing to a status code. An empty first chunk means nothing was generated, which
   * is a failure regardless of whether an error was reported. The happy path only waits
   * for the first token, so streaming is preserved.
   */
  const run = await streamWithFallback((modelId, onError) =>
    streamText({
      model: aiModel(modelId),
      // `system` is deprecated in ai@7 in favour of `instructions`.
      instructions: SUMMARY_SYSTEM_PROMPT,
      prompt,
      maxRetries: AI_MAX_RETRIES,
      onError: ({ error }) => onError(error),
    }),
  );

  if (!run.ok) {
    console.error("AI summary failed", run.error);
    const failure = describeAiFailure(run.error);
    return new Response(failure.message, {
      status: failure.status,
      headers: failure.retryAfterSeconds
        ? { "Retry-After": String(Math.ceil(failure.retryAfterSeconds)) }
        : undefined,
    });
  }

  const { first, iterator } = run;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done && first.value) {
          controller.enqueue(encoder.encode(first.value));
        }
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
        controller.close();
      } catch (error) {
        // A mid-stream failure leaves the client with a truncated summary; there is no
        // way to change the status code once bytes are on the wire.
        console.error("AI summary stream interrupted", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

