/**
 * Server-only wrapper around the GitHub REST API.
 *
 * Every call to api.github.com in this app goes through `githubFetch` so that auth,
 * caching, and rate-limit handling live in exactly one place. Never import this from a
 * client component — it reads `process.env.GITHUB_TOKEN`.
 */

import type {
  GitHubCommit,
  GitHubContentEntry,
  GitHubErrorKind,
  GitHubReadme,
  GitHubRepo,
  GitHubUser,
} from "@/types/github";

const API_ROOT = "https://api.github.com";

/**
 * Cache GitHub responses for 5 minutes (docs/spec.md).
 *
 * In Next.js 16 `fetch` is *uncached* by default ("auto no cache"), so this is what opts
 * us into the Data Cache — it is not narrowing an existing cache the way it would in
 * Next 14. Do not add a `cache` option alongside it; Next ignores both when they conflict.
 */
const REVALIDATE_SECONDS = 300;

/** Most-recently-updated repos, one page. See `fetchUserRepos`. */
const REPOS_PER_PAGE = 100;

/** Coarse guard against multi-megabyte READMEs. Task 5 applies its own token budget. */
const MAX_README_CHARS = 50_000;

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number;
  /** When a rate limit lifts, from `x-ratelimit-reset`. Only set for `rate-limited`. */
  readonly resetAt?: Date;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    status = 0,
    resetAt?: Date,
  ) {
    super(message);
    this.name = "GitHubError";
    this.kind = kind;
    this.status = status;
    this.resetAt = resetAt;
  }
}

/** Raw wire shapes — only the fields we map. Not exported; DTOs are the public contract. */
interface RawUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
  html_url: string;
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
  fork: boolean;
  topics?: string[];
}

interface RawReadme {
  content: string;
  encoding: string;
}

interface RawContentEntry {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string | null; date: string } | null;
  };
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GitHubError(
      "config",
      "GITHUB_TOKEN is not set. Locally, copy .env.example to .env.local and add a GitHub " +
        "personal access token; when deployed, set GITHUB_TOKEN in the host's environment variables.",
    );
  }
  return token;
}

/**
 * Work out when a rate limit lifts.
 *
 * `retry-after` is a delay in seconds and takes precedence, since it accompanies the
 * secondary limit; `x-ratelimit-reset` is an absolute UTC epoch in seconds.
 */
function resolveResetAt(
  retryAfter: string | null,
  rateLimitReset: string | null,
): Date | undefined {
  const delaySeconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(delaySeconds) && delaySeconds >= 0) {
    return new Date(Date.now() + delaySeconds * 1000);
  }

  const resetEpoch = Number(rateLimitReset);
  if (rateLimitReset && Number.isFinite(resetEpoch) && resetEpoch > 0) {
    return new Date(resetEpoch * 1000);
  }

  return undefined;
}

/** Build a GitHubError from a non-OK response, without echoing GitHub's body back out. */
function errorFromResponse(response: Response, context: string): GitHubError {
  const { status, headers } = response;

  if (status === 404) {
    return new GitHubError("not-found", `${context} was not found on GitHub.`, status);
  }

  if (status === 401) {
    return new GitHubError(
      "unauthorized",
      "GitHub rejected the access token. Check that GITHUB_TOKEN in .env.local is valid and has not expired.",
      status,
    );
  }

  // GitHub signals two different rate limits, and a bare 403 is not enough to identify
  // either — it is also what a scope/permission problem looks like. Classify only on a
  // positive signal, so we never tell someone to "wait an hour" for a token that will
  // never work by waiting:
  //   - primary limit: 403 with `x-ratelimit-remaining: 0`, reset as an epoch timestamp
  //   - secondary (abuse) limit: 403 or 429 with `retry-after` in seconds
  const remaining = headers.get("x-ratelimit-remaining");
  const retryAfter = headers.get("retry-after");
  if (status === 429 || (status === 403 && (remaining === "0" || retryAfter))) {
    const resetAt = resolveResetAt(retryAfter, headers.get("x-ratelimit-reset"));
    return new GitHubError(
      "rate-limited",
      resetAt
        ? `GitHub API rate limit exceeded. Access returns at ${resetAt.toISOString()}.`
        : "GitHub API rate limit exceeded. Try again shortly.",
      status,
      resetAt,
    );
  }

  return new GitHubError(
    "unknown",
    `GitHub request for ${context} failed with status ${status}.`,
    status,
  );
}

/**
 * The single exit point to api.github.com.
 *
 * @param path      API path beginning with `/`, already encoded.
 * @param context   Human-readable subject used in error messages, e.g. `User "torvalds"`.
 * @throws {GitHubError} on any non-OK response or transport failure.
 */
async function githubFetch<T>(path: string, context: string): Promise<T> {
  const token = requireToken();

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch {
    throw new GitHubError(
      "network",
      `Could not reach GitHub while loading ${context}. Check your connection and try again.`,
      0,
    );
  }

  if (!response.ok) {
    throw errorFromResponse(response, context);
  }

  return (await response.json()) as T;
}

function toUser(raw: RawUser): GitHubUser {
  return {
    login: raw.login,
    name: raw.name,
    avatarUrl: raw.avatar_url,
    bio: raw.bio,
    company: raw.company,
    location: raw.location,
    blog: raw.blog,
    followers: raw.followers,
    following: raw.following,
    publicRepos: raw.public_repos,
    createdAt: raw.created_at,
    htmlUrl: raw.html_url,
  };
}

function toRepo(raw: RawRepo): GitHubRepo {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    description: raw.description,
    language: raw.language,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    updatedAt: raw.updated_at,
    htmlUrl: raw.html_url,
    isFork: raw.fork,
    topics: raw.topics ?? [],
  };
}

/** Fetch a user's public profile. Throws `not-found` if the login does not exist. */
export async function fetchUser(username: string): Promise<GitHubUser> {
  const raw = await githubFetch<RawUser>(
    `/users/${encodeURIComponent(username)}`,
    `User "${username}"`,
  );
  return toUser(raw);
}

/**
 * Fetch a user's public repos, most recently updated first.
 *
 * Capped at one page of 100. For users with more repos this makes aggregate figures
 * (e.g. total stars) an approximation — acceptable per docs/spec.md, which explicitly
 * says not to over-engineer this.
 */
export async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const raw = await githubFetch<RawRepo[]>(
    `/users/${encodeURIComponent(username)}/repos?per_page=${REPOS_PER_PAGE}&sort=updated`,
    `Repositories for "${username}"`,
  );
  return raw.map(toRepo);
}

/**
 * Fetch and decode a repo's README.
 *
 * Returns `null` when the repo exists but has no README — a normal state, not an error,
 * so callers are not forced to try/catch it. A repo that does not exist still throws
 * `not-found`.
 *
 * Distinguishing those two needs a second request, because GitHub answers both with an
 * identical 404: `torvalds/pesconvert` is a real repo whose `/readme` is 404, and it is
 * byte-for-byte the same response as one for a repo that was never there. The extra call
 * only happens on the 404 path, so the common case costs nothing, and it is cached like
 * every other request.
 */
export async function fetchReadme(
  owner: string,
  repo: string,
): Promise<GitHubReadme | null> {
  const context = `README for "${owner}/${repo}"`;
  let raw: RawReadme;

  try {
    raw = await githubFetch<RawReadme>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      context,
    );
  } catch (error) {
    if (error instanceof GitHubError && error.kind === "not-found") {
      // Confirm the repo itself exists before reporting "no README". If it does not,
      // this rethrows `not-found` for the repo, which is the accurate answer.
      await githubFetch<unknown>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        `Repository "${owner}/${repo}"`,
      );
      return null;
    }
    throw error;
  }

  if (raw.encoding !== "base64") {
    throw new GitHubError(
      "unknown",
      `${context} came back in an unexpected encoding ("${raw.encoding}").`,
    );
  }

  const decoded = Buffer.from(raw.content, "base64").toString("utf-8");
  const truncated = decoded.length > MAX_README_CHARS;

  return {
    content: truncated ? decoded.slice(0, MAX_README_CHARS) : decoded,
    truncated,
  };
}

/**
 * List the entries at `path` within a repo. Defaults to the repo root.
 *
 * Only directories are supported — GitHub returns a single object rather than an array
 * when `path` points at a file.
 */
export async function fetchRepoContents(
  owner: string,
  repo: string,
  path = "",
): Promise<GitHubContentEntry[]> {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const context = `Contents of "${owner}/${repo}/${encodedPath}"`;

  const raw = await githubFetch<RawContentEntry[] | RawContentEntry>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
    context,
  );

  if (!Array.isArray(raw)) {
    throw new GitHubError(
      "unknown",
      `${context} is a file, not a directory — fetchRepoContents lists directories only.`,
    );
  }

  return raw.map((entry) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type === "dir" ? "dir" : "file",
    size: entry.size,
  }));
}

/** Fetch the most recent commits on a repo's default branch, newest first. */
export async function fetchCommits(
  owner: string,
  repo: string,
  limit = 20,
): Promise<GitHubCommit[]> {
  const raw = await githubFetch<RawCommit[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${limit}`,
    `Commits for "${owner}/${repo}"`,
  );

  return raw.map((entry) => ({
    sha: entry.sha,
    message: entry.commit.message,
    authorName: entry.commit.author?.name ?? null,
    date: entry.commit.author?.date ?? "",
  }));
}
