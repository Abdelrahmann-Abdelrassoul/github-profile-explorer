# Tasks — build in this order

Work through these one at a time. For each: plan first, review the plan,
approve, implement, review the diff, commit, then move to the next.

- [x] 0. Scaffold: Next.js + TypeScript app, Tailwind, basic layout, `.env.example`
      (Next 16 + React 19 + Tailwind v4; `app/page.tsx` is still the create-next-app
      placeholder and gets replaced by the search page in task 2)
- [x] 1. `lib/server/github.ts`: authenticated GitHub API wrapper (user, repos, readme,
      contents, commits) with error handling for 404 / rate-limit
- [x] 2. `/` search page → `/u/[username]` profile page: avatar, bio, stats, repo list
      (with loading + not-found states)
- [ ] 3. Compare feature: `/u/[username]/compare/[otherUsername]`
- [ ] 4. AI profile summary (server route + UI trigger on the profile page)
- [ ] 5. AI repo chat: grounding data fetch + Vercel AI SDK streaming + chat UI
- [ ] 6. Chat history persistence (localStorage, per repo)
- [ ] 7. Notes feature (profiles + repos), localStorage, shown on load
- [ ] 8. Polish pass: error boundaries, empty states, basic responsive layout
- [ ] 9. README (setup, env vars, persistence decision, demo link) + deploy to Vercel
