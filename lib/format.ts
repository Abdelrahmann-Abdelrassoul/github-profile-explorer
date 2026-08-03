/**
 * Display formatting helpers.
 *
 * These run in Server Components only. Relative dates are computed once on the server,
 * so there is no client/server clock mismatch to hydrate around.
 */

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 314300 -> "314.3K". Used for stars and follower counts. */
export function formatCount(value: number): string {
  return compactNumber.format(value);
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** ISO date -> "3 days ago". Returns null for missing or unparseable input. */
export function formatRelative(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;

  let duration = (timestamp - Date.now()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTime.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return null;
}

/** ISO date -> "September 2011". Used for account age. */
export function formatMonthYear(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(timestamp);
}
