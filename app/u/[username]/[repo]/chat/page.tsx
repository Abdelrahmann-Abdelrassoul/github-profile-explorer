import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GitHubError } from "@/lib/server/github";
import { loadRepoContext, type RepoContext } from "@/lib/server/repo-context";
import { DataError } from "@/components/data-error";
import { NotesPanel } from "@/components/notes-panel";
import { RepoChat } from "@/components/repo-chat";
import { RepoHeading } from "@/components/repo-heading";

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

  /*
   * The fixed-height shell is in layout.tsx so every state shares it. Here the nav and
   * repository card stay put and the composer stays reachable, so only the transcript
   * moves — context about what is being discussed never scrolls out of view.
   */
  return (
    <>
      <ChatNav owner={owner} repo={name} />
      <main className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-6 pt-6 pb-4">
        {result.ok ? (
          <>
            <RepoHeading context={result.context} />
            {/* Collapsed by default — this route's height is fixed, and the transcript
                should keep the space rather than a textarea that is usually idle. */}
            <div className="mb-4 shrink-0">
              <NotesPanel
                subject={{ kind: "repo", owner, repo: name }}
                label={`${owner}/${name}`}
                collapsible
              />
            </div>
            <RepoChat username={owner} repo={name} />
          </>
        ) : (
          <DataError kind={result.error.kind} resetAt={result.error.resetAt} />
        )}
      </main>
    </>
  );
}

function ChatNav({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div className="shrink-0 border-b border-border">
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
