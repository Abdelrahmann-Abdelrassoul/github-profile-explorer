"use client";

import { Button } from "@/components/ui/button";

/**
 * Safety net only. Expected GitHub failures are rendered by the page itself, since Next
 * sanitizes Server Component error messages in production and a boundary could not tell
 * a rate limit from a network failure.
 *
 * `unstable_retry` rather than `reset`: reset re-renders without re-fetching, so the
 * button would appear to do nothing.
 */
export default function CompareError({
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
            This comparison could not be loaded
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Something went wrong while rendering the page. Retrying will re-fetch both
            profiles from GitHub.
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
