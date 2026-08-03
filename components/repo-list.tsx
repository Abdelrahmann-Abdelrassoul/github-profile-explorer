import Link from "next/link";

import type { GitHubRepo } from "@/types/github";
import { RepoCard } from "@/components/repo-card";

/**
 * Only the most recently updated repos render by default.
 *
 * A 100-repo profile produced ~2,900 DOM elements and a 15,600px page, which Lighthouse
 * flags and which costs paint time for rows almost nobody scrolls to. Expanding is a
 * plain link with a query param rather than client state, so it still works with
 * JavaScript disabled.
 */
const DEFAULT_VISIBLE = 30;

export function RepoList({
  repos,
  username,
  showAll,
}: {
  repos: GitHubRepo[];
  username: string;
  showAll: boolean;
}) {
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

  const visible = showAll ? repos : repos.slice(0, DEFAULT_VISIBLE);
  const hidden = repos.length - visible.length;
  const profilePath = `/u/${encodeURIComponent(username)}`;

  return (
    <section aria-labelledby="repos-heading" className="space-y-4">
      <RepoListHeading count={repos.length} />

      <ul className="space-y-3">
        {visible.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted-foreground">
          Showing {visible.length} of {repos.length}
          {repos.length === 100 && " most recently updated"}
        </p>

        {hidden > 0 ? (
          <Link
            href={`${profilePath}?repos=all`}
            className="rounded-sm text-sm underline underline-offset-4 decoration-muted-foreground/40 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show all {repos.length} repositories
          </Link>
        ) : (
          repos.length > DEFAULT_VISIBLE && (
            <Link
              href={profilePath}
              className="rounded-sm text-sm underline underline-offset-4 decoration-muted-foreground/40 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show fewer
            </Link>
          )
        )}
      </div>
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
