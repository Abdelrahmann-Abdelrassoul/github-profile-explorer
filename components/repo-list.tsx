import type { GitHubRepo } from "@/types/github";
import { RepoCard } from "@/components/repo-card";

export function RepoList({ repos }: { repos: GitHubRepo[] }) {
  if (repos.length === 0) {
    return (
      <section aria-labelledby="repos-heading" className="space-y-4">
        <RepoListHeading count={0} />
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          This user has no public repositories.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="repos-heading" className="space-y-4">
      <RepoListHeading count={repos.length} />
      <ul className="space-y-3">
        {repos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </ul>
      {repos.length === 100 && (
        <p className="font-mono text-xs text-muted-foreground">
          Showing the 100 most recently updated repositories.
        </p>
      )}
    </section>
  );
}

function RepoListHeading({ count }: { count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id="repos-heading" className="font-heading text-lg font-semibold">
        Repositories
      </h2>
      <span className="font-mono text-sm text-muted-foreground">{count}</span>
    </div>
  );
}
