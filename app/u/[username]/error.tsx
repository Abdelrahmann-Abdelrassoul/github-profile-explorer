"use client";

import { Button } from "@/components/ui/button";

/**
 * Safety net for genuinely unexpected failures.
 *
 * Known GitHub failures (rate limit, network, bad token) are handled on the page itself
 * via <DataError />, because Next sanitizes Server Component error messages in
 * production and an error boundary cannot tell them apart. Anything reaching here is a
 * real bug rather than an expected upstream condition.
 *
 * Uses `unstable_retry` (added in 16.2.0) rather than `reset`: `reset` re-renders
 * without re-fetching, so the button would appear to do nothing.
 */
export default function ProfileError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            This profile could not be loaded
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Something went wrong while rendering the page. Retrying will re-fetch the
            data from GitHub.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>

        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </main>
  );
}
