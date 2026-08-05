/**
 * Turns AI provider failures into something a reader can act on.
 *
 * The SDK's own errors are unusable as UI text: a rate-limit rejection arrives as a
 * three-deep AI_RetryError wrapping AI_APICallError, carrying the organisation id, the
 * model id, exact token counts and an upgrade link. Showing that is as unhelpful as
 * showing nothing.
 *
 * What a reader needs is which of a handful of things went wrong, and whether waiting will
 * fix it. Everything else — status codes, model names, token arithmetic — is logged
 * server-side instead.
 */

export type AiFailure = {
  /** Shown to the reader. Plain language, no jargon, no identifiers. */
  message: string;
  /** HTTP status for the route to return. */
  status: number;
  /** Seconds until it is worth retrying, when the provider tells us. */
  retryAfterSeconds?: number;
  /**
   * The provider's own status, before it was mapped to something a reader sees.
   *
   * Needed because the mapping is lossy in exactly the place the chain runner cares
   * about: a 404 (retired model id) is reported to the reader as a 502, so `status`
   * cannot distinguish it from a generic provider failure. Not for display.
   */
  providerStatus?: number;
};

/** "about 18 minutes", "about 40 seconds" — precision here is false comfort. */
function describeWait(seconds: number): string {
  if (seconds < 90) return `about ${Math.max(5, Math.round(seconds / 5) * 5)} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
}

/**
 * A failed call may be wrapped several layers deep once the SDK has retried, and the
 * useful detail is always on the innermost API error.
 */
function unwrap(error: unknown): Record<string, unknown> | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;

  const inner = record.lastError;
  if (inner && typeof inner === "object") return unwrap(inner) ?? record;

  return record;
}

function readStatus(error: Record<string, unknown>): number | undefined {
  const status = error.statusCode;
  return typeof status === "number" ? status : undefined;
}

function readRetryAfter(error: Record<string, unknown>): number | undefined {
  const headers = error.responseHeaders;
  if (typeof headers !== "object" || headers === null) return undefined;

  const value = (headers as Record<string, unknown>)["retry-after"];
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function readBody(error: Record<string, unknown>): string {
  const body = error.responseBody;
  return typeof body === "string" ? body.toLowerCase() : "";
}

/**
 * Rate limits are not one condition.
 *
 * A per-minute ceiling clears itself in seconds and is worth waiting out. A daily token
 * budget does not, and telling someone to "try again in a moment" when the answer is
 * eighteen minutes away is worse than saying nothing — they will sit there retrying.
 */
function describeRateLimit(body: string, retryAfterSeconds?: number): string {
  const isDaily = body.includes("per day") || body.includes("tpd");
  const wait = retryAfterSeconds ? ` It frees up in ${describeWait(retryAfterSeconds)}.` : "";

  if (isDaily) {
    return `The daily allowance for the AI service has been used up.${wait} Everything else on the site still works.`;
  }
  return `The AI service is being asked for too much at once.${wait} Try again shortly.`;
}

export function describeAiFailure(error: unknown): AiFailure {
  const inner = unwrap(error);
  // Classification is unchanged; the raw status rides alongside it rather than through it,
  // so nothing that reads `message` or `status` behaves differently.
  return { ...classify(inner), providerStatus: inner ? readStatus(inner) : undefined };
}

function classify(inner: Record<string, unknown> | null): Omit<AiFailure, "providerStatus"> {
  if (!inner) {
    return { message: "The AI service could not be reached. Try again in a moment.", status: 502 };
  }

  const status = readStatus(inner);
  const retryAfterSeconds = readRetryAfter(inner);
  const body = readBody(inner);

  if (status === 429) {
    return {
      message: describeRateLimit(body, retryAfterSeconds),
      status: 429,
      retryAfterSeconds,
    };
  }

  if (status === 401 || status === 403) {
    return {
      message:
        "The AI service rejected this site's credentials, so it cannot answer right now. The API key needs checking.",
      status: 502,
    };
  }

  if (status === 404) {
    return {
      message:
        "The AI model this site uses is no longer available and needs updating. Nothing you did caused this.",
      status: 502,
    };
  }

  if (status === 413 || body.includes("too large") || body.includes("context_length")) {
    return {
      message:
        "This repository is too large for the assistant to take in at once. Try a more specific question.",
      status: 502,
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      message: "The AI service is having problems at its end. Try again in a few minutes.",
      status: 502,
    };
  }

  // No status at all usually means the request never left — DNS, offline, or a timeout.
  if (status === undefined) {
    return {
      message: "The AI service could not be reached. Check your connection and try again.",
      status: 502,
    };
  }

  return {
    message: "The assistant could not produce an answer this time. Try again in a moment.",
    status: 502,
  };
}
