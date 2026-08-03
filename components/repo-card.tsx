import { GitFork, Star } from "lucide-react";

import type { GitHubRepo } from "@/types/github";
import { formatCount, formatRelative } from "@/lib/format";
import { languageColor } from "@/lib/language-colors";

/**
 * One repository.
 *
 * The vertical bar on the left is the "language spine" — its color is the repo's real
 * GitHub language color, which makes a long list scannable by language at a glance.
 */
export function RepoCard({ repo }: { repo: GitHubRepo }) {
  const updated = formatRelative(repo.updatedAt);
  const spine = languageColor(repo.language);

  return (
    <li className="group relative flex gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40">
      <span
        aria-hidden
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: spine }}
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="font-heading text-base font-semibold">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {repo.name}
            </a>
          </h3>
          {repo.isFork && (
            <span className="font-mono text-xs text-muted-foreground">fork</span>
          )}
        </div>

        {repo.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        )}

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          {/* Each div holds exactly one dt/dd pair; icons live inside the dd, since
              anything else between them fails the axe definition-list rule. */}
          {repo.language && (
            <div>
              <dt className="sr-only">Language</dt>
              <dd className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: spine }}
                />
                {repo.language}
              </dd>
            </div>
          )}

          <div>
            <dt className="sr-only">Stars</dt>
            <dd className="flex items-center gap-1">
              <Star aria-hidden className="size-3.5" />
              {formatCount(repo.stars)}
            </dd>
          </div>

          {repo.forks > 0 && (
            <div>
              <dt className="sr-only">Forks</dt>
              <dd className="flex items-center gap-1">
                <GitFork aria-hidden className="size-3.5" />
                {formatCount(repo.forks)}
              </dd>
            </div>
          )}

          {updated && (
            <div>
              <dt className="sr-only">Last updated</dt>
              <dd>updated {updated}</dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  );
}
