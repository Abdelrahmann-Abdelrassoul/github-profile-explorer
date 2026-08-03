import type { GitHubRepo, GitHubUser } from "@/types/github";
import { summarizeLanguages } from "@/components/language-bar";
import { languageColor } from "@/lib/language-colors";

/**
 * Derived values for the side-by-side comparison.
 *
 * Everything here except the commit count comes from data the page has already fetched.
 */

/** Petrol accent, used only when two users cannot be told apart by language. */
const FALLBACK_IDENTITY = "#0D6E6E";

export type CompareSide = {
  user: GitHubUser;
  repos: GitHubRepo[];
  /** null when the commit search failed or was rate limited. */
  commits: number | null;
  /** This user's colour throughout the comparison. */
  color: string;
};

/**
 * Give each user a colour taken from their most-used language, so the comparison bars
 * carry meaning rather than decoration.
 *
 * Two developers frequently share a top language, which would make them indistinguishable
 * — the whole point of the view. When that happens, fall back to the second user's next
 * language, and to the petrol accent if that is unavailable too.
 */
export function identityColors(
  aRepos: GitHubRepo[],
  bRepos: GitHubRepo[],
): [string, string] {
  const aLanguages = summarizeLanguages(aRepos);
  const bLanguages = summarizeLanguages(bRepos);

  const a = languageColor(aLanguages[0]?.language ?? null);
  let b = languageColor(bLanguages[0]?.language ?? null);

  if (b === a) {
    const second = bLanguages[1]?.language;
    b = second ? languageColor(second) : FALLBACK_IDENTITY;
  }
  if (b === a) b = FALLBACK_IDENTITY;

  return [a, b];
}

export type Metric = {
  label: string;
  /** Shown under the label when the number needs qualifying. */
  note?: string;
  aValue: number | null;
  bValue: number | null;
  /** Pre-formatted for display; the raw values above drive the bar. */
  aDisplay: string;
  bDisplay: string;
};

export function totalStars(repos: GitHubRepo[]): number {
  return repos.reduce((sum, repo) => sum + repo.stars, 0);
}

/** Whole years since the account was created, plus a readable form. */
export function accountAge(iso: string): { days: number; label: string } | null {
  const created = Date.parse(iso);
  if (Number.isNaN(created)) return null;

  const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days - years * 365.25) / 30.44);

  const label = years > 0 ? `${years}y ${months}m` : `${months}m`;
  return { days, label };
}

/** The proportion of a bar each side occupies. Both zero renders as an empty bar. */
export function shares(
  a: number | null,
  b: number | null,
): { aShare: number; bShare: number; comparable: boolean } {
  if (a === null || b === null) return { aShare: 0, bShare: 0, comparable: false };

  const total = a + b;
  if (total <= 0) return { aShare: 0, bShare: 0, comparable: false };

  return { aShare: a / total, bShare: b / total, comparable: true };
}
