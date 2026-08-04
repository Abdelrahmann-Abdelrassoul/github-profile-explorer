import { streamText } from "ai";

import { aiModel, isAiConfigured } from "@/lib/server/ai";
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

  let providerError: unknown = null;

  const result = streamText({
    model: aiModel(),
    // `system` is deprecated in ai@7 in favour of `instructions`.
    instructions,
    messages,
    abortSignal: request.signal,
    onError: ({ error }) => {
      providerError = error;
    },
  });

  /*
   * Same shape as the summary route, for the same reason: streamText neither throws nor
   * reports provider failures through the text stream — the stream just ends empty, which
   * would otherwise be a 200 with a blank reply. Pull the first chunk before committing to
   * a status code.
   */
  const iterator = result.textStream[Symbol.asyncIterator]();
  let first: IteratorResult<string> | undefined;
  try {
    first = await iterator.next();
  } catch (error) {
    providerError = error;
  }

  if (providerError || !first || (first.done && !first.value)) {
    console.error("Repo chat failed", providerError);
    return new Response(describeProviderError(providerError), { status: 502 });
  }

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

function describeProviderError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;

  if (status === 401 || status === 403) {
    return "The AI provider rejected the API key. Check that GROQ_API_KEY in .env.local is valid and has not been revoked.";
  }
  if (status === 404) {
    return "The configured AI model is unavailable. Model IDs are retired periodically — check console.groq.com/docs/models.";
  }
  if (status === 429) {
    return "The AI provider's rate limit was hit. Try again in a moment.";
  }
  return "The AI provider could not answer. Try again in a moment.";
}
