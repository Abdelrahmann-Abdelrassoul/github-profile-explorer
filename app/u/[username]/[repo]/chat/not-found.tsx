import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Scoped to the chat segment on purpose.
 *
 * Without it the nearest boundary is the profile's not-found, which says the *username*
 * does not exist — wrong and confusing when the user is real and only the repository name
 * is bad, which is the far more likely mistake here.
 */
export default function RepoNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            404
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            No such repository
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitHub has no repository at that address. Repository names are exact, and the
            owner must match — a repository belonging to someone else will not be found
            under this user.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/">Back to search</Link>
        </Button>
      </div>
    </main>
  );
}
