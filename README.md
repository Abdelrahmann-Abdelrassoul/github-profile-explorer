# GitHub Profile Explorer

GitHub Profile Explorer is a Next.js application for searching GitHub users, browsing a profile and its repositories, comparing two users side by side, generating an AI summary of a profile, chatting with an AI grounded in a specific repository's real data, and saving personal notes on profiles and repos. It is a take-home style deliverable, judged primarily on code quality and error handling.

**Live demo:** _(link to be added once deployed)_

## Features

- Search for any GitHub user by login
- View a profile: avatar, bio, stats, and repository list
- Compare two users side by side: repositories, stars received, followers, account age, and commits in the last 12 months
- Generate an AI-written summary of a profile on demand
- Chat with an AI that is grounded in one repository's README, file tree, and recent commit history
- Save notes on any profile or repository, all visible from the landing page
- Graceful, specific error handling for GitHub and AI provider failures (rate limits, missing tokens, network issues, unknown users)

## Tech stack

- [Next.js](https://nextjs.org/) 16.2.12 (App Router, Turbopack)
- [React](https://react.dev/) 19.2.4
- TypeScript 5, `strict` mode
- [Tailwind CSS](https://tailwindcss.com/) v4, CSS-first configuration (no `tailwind.config.js`; tokens live in `app/globals.css`)
- [shadcn/ui](https://ui.shadcn.com/) components in `components/ui/`
- radix-ui 1.6.7, lucide-react 1.28.0
- [Vercel AI SDK](https://sdk.vercel.ai/) `ai` 7.0.48 with `@ai-sdk/groq` 4.0.19
- Self-hosted fonts via `next/font/local` (`app/fonts/*.woff2`)
- Path alias `@/*` maps to the repository root (there is no `src/` directory)

## Getting started

### Prerequisites

- Node.js 20.9 or newer
- npm
- A GitHub account (to create a personal access token)

### Setup

```bash
git clone https://github.com/Abdelrahmann-Abdelrassoul/github-profile-explorer.git
cd github-profile-explorer
npm install
cp .env.example .env.local
```

Fill in `GITHUB_TOKEN` and `GROQ_API_KEY` in `.env.local` (see below), then start the dev server:

```bash
npm run dev
```

The app serves on [http://localhost:3000](http://localhost:3000).

## Environment variables

Both variables are read only on the server and are never exposed to the browser.

| Variable | Required | Purpose | Where to get it |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Yes | Authenticates requests to the GitHub REST API, raising the rate limit from 60/hr to 5,000/hr | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GROQ_API_KEY` | Yes | Powers the AI profile summary and the repository-grounded chat | [console.groq.com/keys](https://console.groq.com/keys) |

### Creating a GitHub personal access token

1. Go to Settings → Developer settings → Personal access tokens → Tokens (classic).
2. Click "Generate new token" (classic).
3. Select the `public_repo` scope; no other scopes are needed.
4. Generate the token and copy it immediately — it is shown only once.
5. Paste it into `.env.local` as `GITHUB_TOKEN`.

### Creating a Groq key

1. Go to [console.groq.com/keys](https://console.groq.com/keys) and sign in with an email address (no credit card required for the free tier).
2. Create a new API key.
3. Paste it into `.env.local` as `GROQ_API_KEY`.

## Available scripts

```bash
npm run dev     # start the development server
npm run build   # production build; must pass before a change is considered done
npm run start   # start the production server (after a build)
npm run lint    # run eslint
```

## Architecture

```
app/                  routes (App Router)
components/           shared UI
components/ui/        shadcn/ui primitives
lib/                  client-safe helpers (localStorage wrappers, formatting)
lib/server/           server-only logic: GitHub API wrapper, AI provider chain, prompt building
types/                shared DTOs
docs/                 spec and task list
```

### Routes

- `/` — landing page: search form plus a list of all saved notes
- `/u/[username]` — profile: avatar, bio, stats, repo list, AI summary trigger, notes
- `/u/[username]/compare/[otherUsername]` — side-by-side comparison of two users
- `/u/[username]/[repo]/chat` — chat grounded in a specific repository
- `POST /api/summary` — streams the AI profile summary as plain text
- `POST /api/chat` — streams a grounded repository answer as plain text
- `POST /api/chat/suggestions` — returns `{ questions: string[] }`, non-streaming

### Data flow

Browser → Next.js Route Handler or Server Component → GitHub REST API or Groq → streamed or JSON response back to the browser. All GitHub and AI calls happen server-side; API keys never reach the client. The AI routes accept only identifiers (username, repository, chat messages) and re-fetch the grounding data server-side, so the browser has no way to dictate what the model is shown.

GitHub access is centralized in `lib/server/github.ts`, which exports `fetchUser`, `fetchUserRepos`, `fetchRepo`, `fetchReadme`, `fetchRepoContents`, `fetchFile`, `fetchCommits`, `fetchCommitCount`, and a `GitHubError` class. Responses are cached with Next's `revalidate` at roughly five minutes. `GitHubError` carries a discriminated `kind` (`not-found`, `rate-limited`, `unauthorized`, `network`, `config`, `unknown`) so callers can react appropriately instead of showing a generic failure.

## Persistence and why

There is no database. Notes and chat history are stored entirely in the browser's `localStorage`, under namespaced keys:

- `gpe:note:user:<login>`
- `gpe:note:repo:<owner>/<repo>`
- `gpe:chat:<username>/<repo>`

All access goes through `lib/notes-storage.ts` and `lib/chat-storage.ts`. Chat history is capped at 40 messages per repository, and if a write fails due to quota it retries with only the newest 6 messages. Note bodies are capped at 5,000 characters, and emptying a note deletes its key rather than storing an empty string. Values read back from storage are treated as untrusted and shape-checked rather than cast, storage is read inside an effect rather than during render (to avoid a hydration mismatch), and every access is wrapped in error handling because `localStorage` can throw outright in hardened or private browsing modes.

This design follows the project's original specification, which mandated client-only persistence with no backend. The trade-off is real and worth stating plainly: notes and chat history are per-browser, not shared across devices, and are lost if the user clears site data.

**Next step:** moving persistence to Vercel KV, or a small Postgres table such as `notes(id, subject_type, subject_id, body, created_at)`, would make notes durable and available across devices. That would require standing up a backend store and introducing some notion of user identity to key records by, which is why it was deferred rather than built by default.

## AI provider: Groq, not Gemini

The original specification called for Google Gemini 2.5 Flash, chosen because it was free without a credit card. That stopped being true during development: the Gemini key returned `403 PERMISSION_DENIED`, and the project now requires a billable Google Cloud project to use it. Groq's free tier needs only an email address to sign up.

Because all AI calls go through the Vercel AI SDK, switching providers touched a single file, `lib/server/ai.ts`, plus one environment variable. The requirement for an AI-generated summary and grounded chat is unchanged; only the provider moved.

AI calls are routed through an ordered chain of free models rather than a single model, failing over to the next entry when one is rate limited. Each entry in the chain carries its own provider and configuration check, so adding another provider is one array entry plus an environment variable. The chain, in order:

1. `llama-3.3-70b-versatile`
2. `openai/gpt-oss-120b`
3. `llama-3.1-8b-instant`
4. `openai/gpt-oss-20b`

A smaller model, `llama-3.1-8b-instant`, is used separately to generate follow-up question suggestions.

The repository chat is grounded by direct context injection: the README, the top-level file tree, and the last roughly 20 commit messages are placed in the prompt. The model is instructed to answer only from that context and to refuse — stating what it would need — rather than guess. Oversized input is truncated with an explicit marker, and the UI states what the model actually received. Untrusted GitHub text (READMEs, bios, commit messages, descriptions) is fenced in the prompt and marked as data, never as instructions.

## Error handling

Expected GitHub failures — rate limiting, network errors, a missing or invalid token, an unknown user — are caught at the point data is fetched and rendered as a real, specific message through a shared error component. `error.tsx` boundaries exist only as a safety net for genuine bugs, not for expected failures. This split is deliberate: in production, Next.js sanitizes error messages thrown from Server Components, so a boundary only ever receives an opaque digest and cannot distinguish a rate limit from a network failure. Provider (Groq) failures are mapped to plain-language messages that say whether waiting is likely to help.

## Deployment (Vercel)

1. Import the repository into Vercel.
2. Under Project Settings → Environment Variables, set `GITHUB_TOKEN` and `GROQ_API_KEY`.
3. Deploy.

No `vercel.json` is used; the project relies on Vercel's Next.js defaults.

## Known limitations

- The repository list is capped at 100 repos (one page, sorted by last update), so aggregates like total stars are approximations for accounts with more than that.
- Commit-frequency comparison counts only the user's own repositories and excludes organization contributions; this is labeled in the UI.
- A repository literally named `compare` collides with the `/u/[username]/compare/[otherUsername]` route.
- AI capacity is bounded by the free-tier limits of the underlying models, so heavy or concurrent use may hit rate limits.
- Notes and chat history are stored per-browser and are not shared across devices or browsers.
