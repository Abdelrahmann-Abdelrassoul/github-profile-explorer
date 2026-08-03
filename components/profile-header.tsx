import Image from "next/image";
import { Building2, Link2, MapPin } from "lucide-react";

import type { GitHubRepo, GitHubUser } from "@/types/github";
import { formatCount, formatMonthYear } from "@/lib/format";
import { LanguageBar } from "@/components/language-bar";

export function ProfileHeader({
  user,
  repos,
}: {
  user: GitHubUser;
  repos: GitHubRepo[];
}) {
  const joined = formatMonthYear(user.createdAt);
  const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0);

  return (
    <header className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/*
          The avatar is this page's LCP element.

          `priority` is deprecated in Next 16: it still injects a <link rel="preload">
          but no longer sets fetchpriority on the <img>, which left Lighthouse's LCP
          discovery check failing. The docs recommend loading="eager" / fetchPriority
          over preload — and preload buys little here anyway, since the avatar URL is
          not known until GitHub responds.
        */}
        <Image
          src={avatarAt(user.avatarUrl, 224)}
          alt=""
          width={112}
          height={112}
          fetchPriority="high"
          loading="eager"
          className="size-20 shrink-0 rounded-xl border border-border object-cover sm:size-28"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {user.name ?? user.login}
            </h1>
            <a
              href={user.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-mono text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              @{user.login}
            </a>
          </div>

          {user.bio && (
            <p className="max-w-prose text-sm leading-relaxed text-foreground">
              {user.bio}
            </p>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {user.company && (
              <li className="flex items-center gap-1.5">
                <Building2 aria-hidden className="size-3.5" />
                <span>{user.company}</span>
              </li>
            )}
            {user.location && (
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden className="size-3.5" />
                <span>{user.location}</span>
              </li>
            )}
            {user.blog && (
              <li className="flex items-center gap-1.5">
                <Link2 aria-hidden className="size-3.5" />
                <a
                  href={normalizeUrl(user.blog)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {user.blog.replace(/^https?:\/\//, "")}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Stat label="Repositories" value={formatCount(user.publicRepos)} />
        <Stat label="Followers" value={formatCount(user.followers)} />
        <Stat label="Following" value={formatCount(user.following)} />
        <Stat
          label="Stars received"
          value={formatCount(totalStars)}
          note={repos.length === 100 ? "top 100 repos" : undefined}
        />
      </dl>

      {joined && (
        <p className="font-mono text-xs text-muted-foreground">Joined {joined}</p>
      )}

      <LanguageBar repos={repos} />
    </header>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  // A <dl> may only contain dt/dd pairs (optionally wrapped in a div), so the note lives
  // inside the <dd> rather than as a sibling <p> — that nesting failed the axe
  // definition-list rule.
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xl font-medium tabular-nums">
        {value}
        {note && (
          <span className="block font-mono text-[0.65rem] font-normal text-muted-foreground">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Ask GitHub for an avatar at the size we actually render.
 *
 * Avatars default to ~460px but display at 112px (224 for 2x). Requesting the smaller
 * image means fewer bytes over the wire and less work for next/image to resize — the
 * avatar is the page's LCP element, so this is the one that matters.
 */
function avatarAt(url: string, size: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("s", String(size));
    return parsed.toString();
  } catch {
    return url;
  }
}

/** GitHub stores blog values with and without a scheme; links need one to be absolute. */
function normalizeUrl(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}
