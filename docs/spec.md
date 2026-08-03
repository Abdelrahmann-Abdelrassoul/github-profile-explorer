# Spec — GitHub Profile Explorer

## Goals
A Next.js/TypeScript app to search GitHub users, view their profile + repos, compare two users,
get an AI summary of a profile, chat with an AI about a specific repo (grounded in real repo
data), and save notes — deployed on Vercel.

## Non-goals (for v1)
- No user auth/login system for the *app itself* — it's a public tool, no accounts.
- No real-time collaboration on notes.
- No support for GitHub organizations, only user accounts, unless time permits.

## Screens / Routes
- `/` — search input, recent searches (optional), landing state.
- `/u/[username]` — profile view: avatar, bio, followers, public repo count, repo list
  (name, description, stars, language, last updated), notes panel, "Summarize with AI" action,
  link into repo chat.
- `/u/[username]/compare/[otherUsername]` — side-by-side comparison view.
- `/u/[username]/[repo]/chat` — AI chat scoped to one repo.

## Data source: GitHub REST API
- Auth: server-side PAT (`GITHUB_TOKEN`, classic token, `public_repo` scope is enough) sent as
  `Authorization: Bearer <token>` on every GitHub API call. This raises the rate limit from
  60/hr (unauthenticated) to 5,000/hr — necessary since **every page load hits the API**.
- Key endpoints: `GET /users/{username}`, `GET /users/{username}/repos`,
  `GET /repos/{owner}/{repo}/readme`, `GET /repos/{owner}/{repo}/contents/{path}`,
  `GET /repos/{owner}/{repo}/commits`, `GET /repos/{owner}/{repo}/stats/contributors`
  (commit frequency).
- Cache GitHub responses briefly (Next.js `fetch` with `revalidate`, e.g. 5 min) to reduce
  repeated calls for the same profile within a session — this is your "performant at scale" story
  for the evaluation criteria.

## Feature: Compare two users
- Metrics: public repo count, total stars across repos, follower count, account age, and
  commit frequency (approximate via recent commit activity on their most active repos, or the
  contributor stats endpoint on a couple of their top repos — full-org commit history isn't
  cheaply available via REST, don't over-engineer this).
- Simple side-by-side layout; a small bar/metric comparison is enough, no need for a charting
  library unless you want one.

## Feature: AI profile summary
- Server route takes a username, gathers profile + repo list (already fetched), sends a
  structured prompt to the model ("summarize this developer's public GitHub presence: primary
  languages, activity level, notable repos"), returns text. Can be non-streaming (it's a single
  short summary, not a long chat) or streamed for a nicer UX — your call.
  **Built streaming**, since the repo chat below needs streaming anyway and this proves the
  transport on a smaller surface first.

## Feature: AI chat grounded in repo data
This is the most involved feature — the grounding requirement is explicit, don't skip it.
- On opening a repo's chat, the server fetches: README content, top-level file/dir listing
  (`contents/`), and the last ~10-20 commit messages. Assemble this into a system prompt /
  context block the model must ground its answers in.
- For v1, direct context injection (stuff README + file tree + recent commits into the system
  prompt) is sufficient — these are small enough for most repos. If a repo's README or file tree
  is unusually large, truncate and note the truncation rather than trying to build a full RAG
  pipeline; that's out of scope for "keep it simple."
- Use the Vercel AI SDK (`ai` package) for the streaming response — this gets you the
  streaming requirement essentially for free.
- **Provider changed during build: Groq (`@ai-sdk/groq`, `llama-3.3-70b-versatile`), not
  Gemini.** This spec originally specified `@ai-sdk/google` with Gemini 2.5 Flash on the
  grounds that it was free with no credit card. That premise stopped holding — the key
  returned `403 PERMISSION_DENIED` and the project required billing. Groq's free tier needs
  only an email and comfortably covers this app's usage. The requirement being satisfied is
  unchanged; only the provider moved, and because everything goes through the AI SDK the
  switch was one file (`lib/server/ai.ts`) plus an env var.
- Conversation history persists **per repo** — see Persistence below.

## Persistence: Notes and chat history
Decision for v1: **client-side persistence via `localStorage`**, keyed by
`username` (notes) and `username/repo` (chat history), no backend database. This satisfies
"notes should be shown once a user accesses the web application" for a single-browser demo,
which is what this challenge is evaluated on, and keeps the stack simple as instructed.
- If you have extra time and want to demonstrate more backend depth: swap to Vercel KV or a
  small Postgres table (`notes(id, subject_type, subject_id, body, created_at)`) — note this as
  a possible "next step" in your README either way; mentioning the tradeoff explicitly is itself
  a good signal for the "code reflects your skills" evaluation criterion.

## What "done" looks like
- All four routes work end-to-end against real GitHub usernames.
- `npm run build` passes with no type errors.
- Loading and error states exist for every async operation (search-not-found, rate-limited,
  network error) — don't let any screen just hang or show a blank page.
- README documents setup (env vars, how to get a GitHub PAT), the persistence decision above,
  and the live demo link.
