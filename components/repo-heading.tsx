import Link from "next/link";
import {
  FileText,
  Files,
  FolderTree,
  GitCommitHorizontal,
  GitFork,
  Star,
} from "lucide-react";

import type { RepoContext } from "@/lib/server/repo-context";
import { formatCount, formatRelative } from "@/lib/format";
import { languageColor } from "@/lib/language-colors";

/**
 * The chat's heading: the repository presented as a card, matching the treatment used in
 * the profile's repo list — same language spine, same mono metadata.
 *
 * The second row states what the model was actually given. Without it the grounding is
 * invisible, and there is no way to tell a confident answer from one built on a truncated
 * README.
 */
export function RepoHeading({ context }: { context: RepoContext }) {
  const { meta, owner, repo } = context;
  const updated = formatRelative(meta.updatedAt);
  const spine = languageColor(meta.language);
  const explored = [...context.exploredDirs, ...context.exploredFiles];

  // Spacing is the container's job now that this sits in a rail alongside the notes.
  return (
    <header className="shrink-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex gap-4 p-4">
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full"
          style={{ backgroundColor: spine }}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="font-heading text-lg font-semibold">
              <Link
                href={`/u/${encodeURIComponent(owner)}`}
                className="rounded-sm font-normal text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {owner}
              </Link>
              <span className="text-muted-foreground"> / </span>
              <a
                href={meta.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {repo}
              </a>
            </h1>
            {meta.isFork && (
              <span className="font-mono text-xs text-muted-foreground">fork</span>
            )}
          </div>

          {meta.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {meta.description}
            </p>
          )}

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            {meta.language && (
              <div>
                <dt className="sr-only">Language</dt>
                <dd className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: spine }}
                  />
                  {meta.language}
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Stars</dt>
              <dd className="flex items-center gap-1">
                <Star aria-hidden className="size-3.5" />
                {formatCount(meta.stars)}
              </dd>
            </div>
            {meta.forks > 0 && (
              <div>
                <dt className="sr-only">Forks</dt>
                <dd className="flex items-center gap-1">
                  <GitFork aria-hidden className="size-3.5" />
                  {formatCount(meta.forks)}
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
      </div>

      <div
        aria-label="What the assistant can see"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          <FileText aria-hidden className="size-3.5" />
          {context.hasReadme
            ? context.readmeTruncated
              ? "README (truncated)"
              : "README"
            : "no README"}
        </span>
        <span className="flex items-center gap-1.5">
          <Files aria-hidden className="size-3.5" />
          {context.fileCount} top-level entries
        </span>
        <span className="flex items-center gap-1.5">
          <GitCommitHorizontal aria-hidden className="size-3.5" />
          {context.commitCount} recent commits
        </span>

        {/* Only present when the README was too thin to stand on its own. */}
        {explored.length > 0 && (
          <span className="flex items-center gap-1.5">
            <FolderTree aria-hidden className="size-3.5" />
            also read {explored.join(", ")}
          </span>
        )}
      </div>
    </header>
  );
}
