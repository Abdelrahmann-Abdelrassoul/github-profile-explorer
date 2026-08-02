import type { GitHubRepo } from "@/types/github";
import { languageColor } from "@/lib/language-colors";

/**
 * Distribution of a user's repos by primary language, as a single stacked bar.
 *
 * Derived entirely from the repo list already fetched for the page — no extra API call.
 * Repos with no detected language are excluded rather than bucketed as "unknown", since
 * they are usually docs or config and would otherwise dominate the bar.
 */

const MAX_SEGMENTS = 6;

type Segment = { language: string; count: number; share: number };

export function summarizeLanguages(repos: GitHubRepo[]): Segment[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, MAX_SEGMENTS);
  const restCount = ranked.slice(MAX_SEGMENTS).reduce((sum, [, n]) => sum + n, 0);

  const segments: Segment[] = top.map(([language, count]) => ({
    language,
    count,
    share: count / total,
  }));

  if (restCount > 0) {
    segments.push({ language: "Other", count: restCount, share: restCount / total });
  }

  return segments;
}

export function LanguageBar({ repos }: { repos: GitHubRepo[] }) {
  const segments = summarizeLanguages(repos);
  if (segments.length === 0) return null;

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <section aria-labelledby="language-mix-heading" className="space-y-3">
      <h2
        id="language-mix-heading"
        className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Language mix
      </h2>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={segments
          .map((s) => `${s.language} ${Math.round(s.share * 100)} percent`)
          .join(", ")}
      >
        {segments.map((segment) => (
          <div
            key={segment.language}
            style={{
              width: `${segment.share * 100}%`,
              backgroundColor: languageColor(
                segment.language === "Other" ? null : segment.language,
              ),
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.language} className="flex items-center gap-1.5 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: languageColor(
                  segment.language === "Other" ? null : segment.language,
                ),
              }}
            />
            <span className="text-foreground">{segment.language}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(segment.share * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <p className="font-mono text-xs text-muted-foreground">
        {total} of {repos.length} repositories have a detected language
      </p>
    </section>
  );
}
