import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/search-form";

/**
 * Reached when fetchUser throws `not-found` — i.e. GitHub has no such user.
 * Scoped to this route segment, so it renders in place of the profile.
 */
export default function UserNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            404
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            No such GitHub user
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            That username does not exist on GitHub. Check the spelling — usernames are
            exact, and this app looks up accounts rather than searching for them.
          </p>
        </div>

        <SearchForm variant="hero" />

        <Button asChild variant="ghost" size="sm">
          <Link href="/">Back to search</Link>
        </Button>
      </div>
    </main>
  );
}
