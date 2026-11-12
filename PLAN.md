# PLAN

Memory file. Re-read after a context reset; continue from the first unticked item.

## Checklist
- [x] Part 0: Project
- [x] Part 1: Personal TV dashboard
- [x] Part 2: Sign-in, roles, team views, view approval
- [x] Part 3: Overnight automations
- [x] Part 4: Approved actions
- [x] Part 5: Handoff

## Decisions
- Sign-in: Auth.js (next-auth v5 beta) installs against Next 16, so it is used.
- Next.js 16 uses `proxy.ts` for request interception.

- Production never falls back to demo data: with no `BRIDGE_MODE`, a missing `BRIDGE_URL` in production is "Setup incomplete" (mock only when `BRIDGE_MODE=mock` is explicit, or in development with no URL).
- `proxy.ts` wraps the lazy Auth.js config by awaiting `auth(callback)` (Auth.js returns a promise in lazy mode).
- `/tv?k=` pairing happens in the proxy (a page cannot set cookies); the page checks the HMAC cookie.
- Bridge protocol: payloads for mutations carry an optional `by` (the owner's address) for Audit rows; the Bridge itself cannot know the caller.
- Refusals in `decide` (`changed`, `needs_gmail`, `rate_limited`) leave the draft `proposed` and write an Audit row; only an unexpected Gmail failure sets `status=error`.
- Home and TV views are not gated by their Views status (only Team and Approvals are); only the owner can reach Home anyway.
- Switch on/off uses a native `<details>` confirm step (no client JavaScript).
- Test emails use `example.com` style addresses; the owner's real name appears only in the allowed seed/prompt files. Fixture owner is "Sam Example".
- Commits are grouped by part after the whole build was verified together, so each commit builds only with the later ones; the final commit passes `npm run check`.

## Open problems
- The Bridge Apps Script cannot be run here; it is covered by Node tests of its pure logic and the decision rules only. First live run is on the owner (HANDOFF step 2).
- Gmail advanced-service calls (`Gmail.Users.Drafts.get/send`) are untested against real Gmail.
