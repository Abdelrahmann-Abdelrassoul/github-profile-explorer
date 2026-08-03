import { compareUsers } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Entry point to the comparison view, shown on a profile.
 *
 * A Server Action like the search form, so it works without JavaScript. The current
 * profile travels in a hidden field rather than being read from the URL on the client.
 */
export function CompareForm({ username }: { username: string }) {
  return (
    <section
      aria-labelledby="compare-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="compare-heading" className="font-heading text-sm font-semibold">
        Compare with another user
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        See repositories, stars, followers, account age and commit activity side by side.
      </p>

      <form action={compareUsers} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="username" value={username} />
        <label htmlFor="otherUsername" className="sr-only">
          GitHub username to compare with
        </label>
        <Input
          id="otherUsername"
          name="otherUsername"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Another username"
          className="h-9 min-w-0 flex-1 font-mono text-sm"
        />
        <Button type="submit" size="sm" variant="outline" className="h-9">
          Compare
        </Button>
      </form>
    </section>
  );
}
