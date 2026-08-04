"use client";

import { useState } from "react";

import type { GitHubRepo } from "@/types/github";
import { Button } from "@/components/ui/button";
import { RepoCard } from "@/components/repo-card";

/**
 * The profile's repository list, revealed a page at a time.
 *
 * Previously this used a `?repos=all` query parameter, which meant expanding re-rendered
 * the route and threw the reader back to the top of the page. Every repo is already in
 * memory here — the profile fetches up to 100 in one call — so revealing more is local
 * state, costs no request, and leaves scroll position alone.
 */
const PAGE_SIZE = 20;

export function RepoList({
  repos,
  username,
  showAll = false,
}: {
  repos: GitHubRepo[];
  username: string;
  /** Set by the ?repos=all fallback, so the no-JS path still reaches the whole list. */
  showAll?: boolean;
}) {
  const [visible, setVisible] = useState(showAll ? repos.length : PAGE_SIZE);

  if (repos.length === 0) {
    return (
      <section aria-labelledby="repos-heading" className="space-y-4">
        <RepoListHeading count={0} />
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          This user has no public repositories.
        </p>
      </section>
    );
  }

  const shown = repos.slice(0, visible);
  const remaining = repos.length - shown.length;
  const nextStep = Math.min(PAGE_SIZE, remaining);

  return (
    <section aria-labelledby="repos-heading" className="space-y-4">
      <RepoListHeading count={repos.length} />

      <ul className="space-y-3">
        {shown.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="font-mono text-xs text-muted-foreground">
          Showing {shown.length} of {repos.length}
          {repos.length === 100 && " most recently updated"}
        </p>

        {remaining > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
          >
            Load {nextStep} more
          </Button>
        )}
      </div>

      {/*
        Without JavaScript the button cannot reveal anything, so offer the server-rendered
        full list instead. The profile page still honours ?repos=all for exactly this.
      */}
      {remaining > 0 && (
        <noscript>
          <a
            href={`/u/${encodeURIComponent(username)}?repos=all`}
            className="text-sm underline underline-offset-4"
          >
            Show all {repos.length} repositories
          </a>
        </noscript>
      )}
    </section>
  );
}

function RepoListHeading({ count }: { count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id="repos-heading" className="font-heading text-lg font-semibold">
        Repositories
      </h2>
      <span className="font-mono text-sm text-muted-foreground">{count}</span>
    </div>
  );
}
