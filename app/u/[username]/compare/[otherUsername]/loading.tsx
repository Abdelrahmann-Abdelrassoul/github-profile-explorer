import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the comparison layout so nothing jumps when the data lands. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="space-y-10" aria-busy role="status" aria-label="Loading comparison">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-lg" />
          ))}
        </div>

        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
