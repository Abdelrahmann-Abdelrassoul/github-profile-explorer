import { streamText } from "ai";

import { AI_MAX_RETRIES, aiModel, isAiConfigured } from "@/lib/server/ai";
import { describeAiFailure } from "@/lib/server/ai-errors";
import { streamWithFallback } from "@/lib/server/ai-fallback";
import { GitHubError } from "@/lib/server/github";
import { buildChatInstructions, loadRepoContext } from "@/lib/server/repo-context";

/**
 * Streams a reply grounded in one repository's real data.
 *
 * The client posts only the repo coordinates and the conversation so far. Grounding is
 * re-fetched here rather than accepted from the browser, so the page cannot substitute the
 * context the model sees. Those fetches hit the same 5-minute cache the chat page just
 * populated, so repeat turns cost nothing extra.
 */

export const maxDuration = 30;

/** Keeps a long conversation from growing the prompt without bound. */
const MAX_HISTORY = 20;

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) return null;

  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim()) return null;
    messages.push({ role, content });
  }

  return messages.length > 0 ? messages : null;
}

export async function POST(request: Request) {
  let owner: string;
  let repo: string;
  let messages: ChatMessage[];

  try {
    const body: unknown = await request.json();
    const parsed =
      typeof body === "object" && body !== null
        ? (body as { username?: unknown; repo?: unknown; messages?: unknown })
        : {};

    if (typeof parsed.username !== "string" || !parsed.username.trim()) {
      return new Response("A username is required.", { status: 400 });
    }
    if (typeof parsed.repo !== "string" || !parsed.repo.trim()) {
      return new Response("A repository name is required.", { status: 400 });
    }

    const parsedMessages = parseMessages(parsed.messages);
    if (!parsedMessages) {
      return new Response("A non-empty list of messages is required.", { status: 400 });
    }

    owner = parsed.username.trim();
    repo = parsed.repo.trim();
    messages = parsedMessages.slice(-MAX_HISTORY);
  } catch {
    return new Response("Malformed request body.", { status: 400 });
  }

  if (!isAiConfigured()) {
    return new Response("The chat is not configured. Set GROQ_API_KEY.", { status: 503 });
  }

  let instructions: string;
  try {
    instructions = buildChatInstructions(await loadRepoContext(owner, repo));
  } catch (error) {
    if (error instanceof GitHubError) {
      if (error.kind === "not-found") {
        // The wrapper's message names the contents endpoint, which is an implementation
        // detail; say what the reader actually needs to know.
        return new Response(`The repository ${owner}/${repo} was not found on GitHub.`, {
          status: 404,
        });
      }
      return new Response(error.message, { status: 502 });
    }
    throw error;
  }

  const run = await streamWithFallback((modelId, onError) =>
    streamText({
      model: aiModel(modelId),
      // `system` is deprecated in ai@7 in favour of `instructions`.
      instructions,
      messages,
      maxRetries: AI_MAX_RETRIES,
      abortSignal: request.signal,
      onError: ({ error }) => onError(error),
    }),
  );

  if (!run.ok) {
    console.error("Repo chat failed", run.error);
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
        if (!first.done && first.value) controller.enqueue(encoder.encode(first.value));
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
        controller.close();
      } catch (error) {
        console.error("Repo chat stream interrupted", error);
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

