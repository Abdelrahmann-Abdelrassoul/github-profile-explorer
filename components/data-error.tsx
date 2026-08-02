import Link from "next/link";

import type { GitHubErrorKind } from "@/types/github";
import { Button } from "@/components/ui/button";

/**
 * Rendered in place of content when a GitHub call fails for a reason that is not "the
 * user does not exist" (that case uses not-found.tsx instead).
 *
 * This deliberately lives on the page rather than in error.tsx. Next.js sanitizes
 * Server Component error messages in production — an error boundary would only receive
 * a generic message plus a digest, so it could not tell a rate limit apart from a
 * network failure. Handling it here keeps the specific, actionable wording.
 */

const COPY: Record<GitHubErrorKind, { title: string; detail: string }> = {
  "rate-limited": {
    title: "GitHub rate limit reached",
    detail:
      "The GitHub API is temporarily refusing requests. This resets on its own — try again shortly.",
  },
  network: {
    title: "Could not reach GitHub",
    detail: "The request to GitHub failed. Check your connection and try again.",
  },
  unauthorized: {
    title: "GitHub rejected the access token",
    detail:
      "The configured GITHUB_TOKEN is invalid or expired. It needs replacing before profiles can load.",
  },
  config: {
    title: "GitHub token is not configured",
    detail:
      "GITHUB_TOKEN is missing, so the app cannot call the GitHub API. See the project README for setup.",
  },
  "not-found": {
    title: "Not found on GitHub",
    detail: "That resource does not exist.",
  },
  unknown: {
    title: "Something went wrong",
    detail: "GitHub returned an unexpected response. Try again in a moment.",
  },
};

export function DataError({
  kind,
  resetAt,
}: {
  kind: GitHubErrorKind;
  resetAt?: Date;
}) {
  const { title, detail } = COPY[kind];

  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">{detail}</p>

      {kind === "rate-limited" && resetAt && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Resets at {resetAt.toISOString().slice(11, 16)} UTC
        </p>
      )}

      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Back to search</Link>
      </Button>
    </div>
  );
}
