/**
 * Narrow DTOs for the GitHub data we actually use.
 *
 * GitHub's REST payloads carry 100+ fields per user/repo; these types describe only
 * what the app reads, in camelCase. `lib/server/github.ts` maps raw responses into
 * these shapes so components never see GitHub's wire format directly.
 */

export type GitHubErrorKind =
  | "not-found"
  | "rate-limited"
  | "unauthorized"
  | "network"
  | "config"
  | "unknown";

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  /** ISO 8601. Used for account age in the compare view. */
  createdAt: string;
  htmlUrl: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  /** ISO 8601 — repo list is sorted by this. */
  updatedAt: string;
  htmlUrl: string;
  isFork: boolean;
  topics: string[];
}

export interface GitHubReadme {
  /** Decoded UTF-8 text, not base64. */
  content: string;
  /** True when `content` was cut short by the safety cap — surface this to the model. */
  truncated: boolean;
}

export interface GitHubContentEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  /** Bytes. GitHub reports 0 for directories. */
  size: number;
}

export interface GitHubCommit {
  sha: string;
  /** Full commit message, including body if present. */
  message: string;
  authorName: string | null;
  /** ISO 8601. */
  date: string;
}
