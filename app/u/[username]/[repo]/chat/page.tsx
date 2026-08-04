import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, GitCommitHorizontal, Files } from "lucide-react";

import { GitHubError } from "@/lib/server/github";
import { loadRepoContext, type RepoContext } from "@/lib/server/repo-context";
import { DataError } from "@/components/data-error";
import { RepoChat } from "@/components/repo-chat";

type ChatPageProps = {
  params: Promise<{ username: string; repo: string }>;
};

type ContextResult =
  | { ok: true; context: RepoContext }
  | { ok: false; error: GitHubError };

/**
 * Load the grounding up front so the page can show what the model can actually see, and
 * fail before rendering a chat box that could never answer anything.
 *
 * A missing repo is a 404 here — unlike the compare view, there is only one subject, so
 * notFound() loses nothing.
 */
async function loadContext(owner: string, repo: string): Promise<ContextResult> {
  try {
    return { ok: true, context: await loadRepoContext(owner, repo) };
  } catch (error) {
    if (error instanceof GitHubError) {
      if (error.kind === "not-found") notFound();
      return { ok: false, error };
    }
    throw error;
  }
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { username, repo } = await params;
  const owner = decodeURIComponent(username);
  const name = decodeURIComponent(repo);
  return {
    title: `Chat about ${owner}/${name} — GitHub Profile Explorer`,
    description: `Ask questions about the ${owner}/${name} repository, grounded in its README, files and recent commits.`,
  };
}

export default async function RepoChatPage({ params }: ChatPageProps) {
  const { username, repo } = await params;
  const owner = decodeURIComponent(username);
  const name = decodeURIComponent(repo);
  const result = await loadContext(owner, name);

  return (
    <>
      <ChatNav owner={owner} repo={name} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        {result.ok ? (
          <>
            <GroundingSummary context={result.context} />
            <RepoChat username={owner} repo={name} />
          </>
        ) : (
          <DataError kind={result.error.kind} resetAt={result.error.resetAt} />
        )}
      </main>
    </>
  );
}

/**
 * States plainly what the model was given.
 *
 * Without this the grounding is invisible, and a user has no way to tell a confident
 * answer from one built on a truncated README.
 */
function GroundingSummary({ context }: { context: RepoContext }) {
  return (
    <section
      aria-label="What the assistant can see"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 font-mono text-xs text-muted-foreground"
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
    </section>
  );
}

function ChatNav({ owner, repo }: { owner: string; repo: string }) {
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
          <Link
            href={`/u/${encodeURIComponent(owner)}`}
            className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {owner}
          </Link>
          <span> / {repo}</span>
        </p>
      </div>
    </div>
  );
}
