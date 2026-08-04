import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the profile fetches. Next wraps page.tsx in a Suspense boundary for this
 * automatically — no manual <Suspense> needed.
 *
 * The shape mirrors the real layout (avatar, name, stat grid, repo rows) so the page
 * does not jump when content arrives.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 lg:max-w-6xl">
      <div className="space-y-10" aria-busy role="status" aria-label="Loading profile">
        <div className="space-y-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Skeleton className="size-20 shrink-0 rounded-xl sm:size-28" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2 bg-card px-4 py-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>

          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
