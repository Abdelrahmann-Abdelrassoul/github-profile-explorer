import Link from "next/link";

import { SearchForm } from "@/components/search-form";

const EXAMPLES = ["torvalds", "gaearon", "sindresorhus"];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-10">
        <div className="space-y-3">
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            GitHub Profile Explorer
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Look up any GitHub user to see their profile, repositories and language mix.
          </p>
        </div>

        <div className="space-y-3">
          <SearchForm variant="hero" />
          <p id="search-hint" className="font-mono text-xs text-muted-foreground">
            Enter an exact username, e.g. torvalds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted-foreground">Try</span>
          {EXAMPLES.map((login) => (
            <Link
              key={login}
              href={`/u/${login}`}
              className="rounded-sm font-mono text-foreground underline underline-offset-4 decoration-muted-foreground/40 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {login}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
