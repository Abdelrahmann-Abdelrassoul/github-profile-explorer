import type { Metadata } from "next";
import Link from "next/link";

import type { GitHubRepo, GitHubUser } from "@/types/github";
import { GitHubError, fetchCommitCount, fetchUser, fetchUserRepos } from "@/lib/server/github";
import { accountAge, identityColors, totalStars, type Metric } from "@/lib/compare";
import { formatCount } from "@/lib/format";
import { CompareHeader } from "@/components/compare-header";
import { LanguageBar } from "@/components/language-bar";
import { MetricComparison } from "@/components/metric-comparison";
import { DataError } from "@/components/data-error";
import { Button } from "@/components/ui/button";

type ComparePageProps = {
  params: Promise<{ username: string; otherUsername: string }>;
};

type SideResult =
  | { ok: true; user: GitHubUser; repos: GitHubRepo[] }
  | { ok: false; login: string; error: GitHubError };

/**
 * Load one side independently.
 *
 * Deliberately does NOT call notFound(): on this route the useful information is *which*
 * of the two logins is bad, and a 404 page would discard it. The wrapper was built to
 * stay framework-agnostic for exactly this case.
 */
async function loadSide(login: string): Promise<SideResult> {
  try {
    const [user, repos] = await Promise.all([fetchUser(login), fetchUserRepos(login)]);
    return { ok: true, user, repos };
  } catch (error) {
    if (error instanceof GitHubError) return { ok: false, login, error };
    throw error;
  }
}

/**
 * Commit counts are a secondary metric on a rate-limited search bucket, so a failure
 * degrades to null rather than taking the page down. Sequential on purpose: concurrent
 * search requests trip GitHub's secondary rate limit almost immediately.
 */
async function loadCommitCounts(
  logins: string[],
  since: Date,
): Promise<(number | null)[]> {
  const counts: (number | null)[] = [];
  for (const login of logins) {
    try {
      counts.push(await fetchCommitCount(login, since));
    } catch {
      counts.push(null);
    }
  }
  return counts;
}

export async function generateMetadata({
  params,
}: ComparePageProps): Promise<Metadata> {
  const { username, otherUsername } = await params;
  const a = decodeURIComponent(username);
  const b = decodeURIComponent(otherUsername);
  return {
    title: `${a} vs ${b} — GitHub Profile Explorer`,
    description: `Side-by-side comparison of GitHub users ${a} and ${b}.`,
  };
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { username, otherUsername } = await params;
  const aLogin = decodeURIComponent(username);
  const bLogin = decodeURIComponent(otherUsername);

  const [aSide, bSide] = await Promise.all([loadSide(aLogin), loadSide(bLogin)]);

  return (
    <>
      <CompareNav aLogin={aLogin} bLogin={bLogin} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {aSide.ok && bSide.ok ? (
          <Comparison a={aSide} b={bSide} />
        ) : (
          <FailedSides a={aSide} b={bSide} />
        )}
      </main>
    </>
  );
}

async function Comparison({
  a,
  b,
}: {
  a: Extract<SideResult, { ok: true }>;
  b: Extract<SideResult, { ok: true }>;
}) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const [aCommits, bCommits] = await loadCommitCounts(
    [a.user.login, b.user.login],
    since,
  );

  const [aColor, bColor] = identityColors(a.repos, b.repos);
  const aAge = accountAge(a.user.createdAt);
  const bAge = accountAge(b.user.createdAt);

  const metrics: Metric[] = [
    {
      label: "Repositories",
      aValue: a.user.publicRepos,
      bValue: b.user.publicRepos,
      aDisplay: formatCount(a.user.publicRepos),
      bDisplay: formatCount(b.user.publicRepos),
    },
    {
      label: "Stars received",
      note: "across fetched repos",
      aValue: totalStars(a.repos),
      bValue: totalStars(b.repos),
      aDisplay: formatCount(totalStars(a.repos)),
      bDisplay: formatCount(totalStars(b.repos)),
    },
    {
      label: "Followers",
      aValue: a.user.followers,
      bValue: b.user.followers,
      aDisplay: formatCount(a.user.followers),
      bDisplay: formatCount(b.user.followers),
    },
    {
      label: "Account age",
      aValue: aAge?.days ?? null,
      bValue: bAge?.days ?? null,
      aDisplay: aAge?.label ?? "—",
      bDisplay: bAge?.label ?? "—",
    },
    {
      label: "Commits, last 12 months",
      note: "own repositories only",
      aValue: aCommits,
      bValue: bCommits,
      aDisplay: aCommits === null ? "unavailable" : formatCount(aCommits),
      bDisplay: bCommits === null ? "unavailable" : formatCount(bCommits),
    },
  ];

  return (
    <div className="space-y-10">
      <CompareHeader a={a.user} b={b.user} aColor={aColor} bColor={bColor} />

      <MetricComparison
        metrics={metrics}
        aLogin={a.user.login}
        bLogin={b.user.login}
        aColor={aColor}
        bColor={bColor}
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">@{a.user.login}</p>
          <LanguageBar repos={a.repos} />
        </div>
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">@{b.user.login}</p>
          <LanguageBar repos={b.repos} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Commit counts come from GitHub&rsquo;s commit search, which indexes default
        branches only and lags real time slightly. They cover repositories each user owns,
        so contributions to other people&rsquo;s projects are not included.
      </p>
    </div>
  );
}

/** One or both logins failed. Name which, rather than showing a generic 404. */
function FailedSides({ a, b }: { a: SideResult; b: SideResult }) {
  const failures = [a, b].filter((side): side is Extract<SideResult, { ok: false }> => !side.ok);
  const missing = failures.filter((side) => side.error.kind === "not-found");
  const other = failures.find((side) => side.error.kind !== "not-found");

  // A non-404 problem (rate limit, network, token) affects the whole page equally.
  if (other) return <DataError kind={other.error.kind} resetAt={other.error.resetAt} />;

  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <h1 className="font-heading text-lg font-semibold">
        {missing.length === 2 ? "Neither user exists" : "One of these users does not exist"}
      </h1>
      <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
        GitHub has no account for{" "}
        {missing.map((side, index) => (
          <span key={side.login}>
            {index > 0 && " or "}
            <span className="font-mono text-foreground">@{side.login}</span>
          </span>
        ))}
        . Usernames are exact.
      </p>

      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Back to search</Link>
      </Button>
    </div>
  );
}

function CompareNav({ aLogin, bLogin }: { aLogin: string; bLogin: string }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link
          href="/"
          className="rounded-sm font-heading text-sm font-semibold outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          GitHub Profile Explorer
        </Link>
        <p className="font-mono text-xs text-muted-foreground">
          {aLogin} vs {bLogin}
        </p>
      </div>
    </div>
  );
}
