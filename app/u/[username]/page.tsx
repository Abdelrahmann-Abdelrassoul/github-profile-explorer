import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { GitHubRepo, GitHubUser } from "@/types/github";
import { GitHubError, fetchUser, fetchUserRepos } from "@/lib/server/github";
import { CompareForm } from "@/components/compare-form";
import { DataError } from "@/components/data-error";
import { NotesPanel } from "@/components/notes-panel";
import { ProfileHeader } from "@/components/profile-header";
import { ProfileSummary } from "@/components/profile-summary";
import { RepoList } from "@/components/repo-list";
import { SearchForm } from "@/components/search-form";

type ProfilePageProps = {
  // In Next 16 both params and searchParams are async and must be awaited.
  params: Promise<{ username: string }>;
  searchParams: Promise<{ repos?: string }>;
};

type ProfileResult =
  | { ok: true; user: GitHubUser; repos: GitHubRepo[] }
  | { ok: false; error: GitHubError };

/**
 * A missing user becomes a 404 page; every other GitHub failure is returned so the page
 * can render a specific message. Unexpected non-GitHub errors are rethrown and land in
 * error.tsx.
 *
 * `notFound()` is called inside the catch, never wrapped by it, so the control-flow
 * error it throws is not swallowed.
 */
async function loadProfile(login: string): Promise<ProfileResult> {
  try {
    const [user, repos] = await Promise.all([
      fetchUser(login),
      fetchUserRepos(login),
    ]);
    return { ok: true, user, repos };
  } catch (error) {
    if (error instanceof GitHubError) {
      if (error.kind === "not-found") notFound();
      return { ok: false, error };
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const login = decodeURIComponent(username);
  return {
    title: `${login} — GitHub Profile Explorer`,
    description: `Profile, repositories and language mix for GitHub user ${login}.`,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const [{ username }, { repos: reposParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const login = decodeURIComponent(username);
  const showAllRepos = reposParam === "all";
  const result = await loadProfile(login);

  return (
    <>
      <ProfileNav login={login} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {result.ok ? (
          <div className="space-y-10">
            <ProfileHeader user={result.user} repos={result.repos} />
            <NotesPanel
              subject={{ kind: "user", login: result.user.login }}
              label={`@${result.user.login}`}
            />
            <ProfileSummary username={result.user.login} />
            <CompareForm username={result.user.login} />
            <RepoList
              repos={result.repos}
              username={result.user.login}
              showAll={showAllRepos}
            />
          </div>
        ) : (
          <DataError kind={result.error.kind} resetAt={result.error.resetAt} />
        )}
      </main>
    </>
  );
}

function ProfileNav({ login }: { login: string }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="rounded-sm font-heading text-sm font-semibold outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          GitHub Profile Explorer
        </Link>
        <SearchForm variant="compact" defaultValue={login} className="w-auto" />
      </div>
    </div>
  );
}
