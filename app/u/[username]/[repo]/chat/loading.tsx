import { Skeleton } from "@/components/ui/skeleton";

/** Grounding is fetched before the chat renders, so this covers those three calls. */
export default function Loading() {
  return (
    // Matches the page's spacing so the view does not jolt when content replaces this.
    <main className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-6 pt-6 pb-4">
      <div
        className="space-y-6"
        aria-busy
        role="status"
        aria-label="Loading repository context"
      >
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-44 rounded-md" />
          ))}
        </div>
      </div>
    </main>
  );
}
