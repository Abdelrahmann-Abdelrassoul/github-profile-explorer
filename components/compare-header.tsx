import Image from "next/image";
import Link from "next/link";

import type { GitHubUser } from "@/types/github";

/**
 * The two people being compared.
 *
 * Each carries a top border in their identity colour, which is the key that makes the
 * metric bars below readable without a separate legend.
 */
export function CompareHeader({
  a,
  b,
  aColor,
  bColor,
}: {
  a: GitHubUser;
  b: GitHubUser;
  aColor: string;
  bColor: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <UserCard user={a} color={aColor} />
      <UserCard user={b} color={bColor} />
    </div>
  );
}

function UserCard({ user, color }: { user: GitHubUser; color: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div aria-hidden className="h-1" style={{ backgroundColor: color }} />
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <Image
          src={avatarAt(user.avatarUrl, 128)}
          alt=""
          width={64}
          height={64}
          loading="eager"
          fetchPriority="high"
          className="size-12 rounded-lg border border-border object-cover sm:size-16"
        />
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold sm:text-base">
            {user.name ?? user.login}
          </p>
          <Link
            href={`/u/${encodeURIComponent(user.login)}`}
            className="truncate rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            @{user.login}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Request the avatar at the size rendered rather than GitHub's ~460px default. */
function avatarAt(url: string, size: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("s", String(size));
    return parsed.toString();
  } catch {
    return url;
  }
}
