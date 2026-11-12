# Balto Ops Command Center

A small, private operations command center for one owner. It shows a TV board and a phone page built from turnovers, calendar and an overnight Claude run. It is read-only unless the owner taps a button.

## Architecture
- **Feed**: one Google Sheet, "Command Center Feed". The only data store.
- **Bridge**: a Google Apps Script web app bound to the Feed (`bridge/`). Verifies signed requests, reads the sheet and calendar, applies the owner's taps. Pasted into Google by hand.
- **Screen app**: this Next.js app for Vercel. Stateless, talks only to the Bridge, no AI calls.
- **Workers**: a Claude scheduled task fills the Feed each weekday morning (`automations/morning-run.md`); conversation rules are in `claude/project-instructions.md`.

See `HANDOFF.md` to set it up, `PLAN.md` for what was decided, `docs/YARDI.md` for the reserved Yardi hook.

## Run locally in demo mode
No environment variables are needed. With none set the app uses an in-memory mock Bridge and shows a "DEMO DATA" ribbon.

```bash
npm install
```

```bash
TV_KEY=demo npm run dev
```

Open `http://localhost:3000/` (a fixed demo owner exists only in development demo mode) and `http://localhost:3000/tv?k=demo` for the TV board.

## Checks
```bash
npm run check
```

That runs lint, typecheck, tests (all offline) and a production build. After editing `bridge/src` run `npm run bridge:build`; after editing the schema or `automations/morning-run.template.md` run `npm run automations:build`. Tests fail if the generated files are out of date.

## Layout
`src/app` pages · `src/lib/feed` schema and validators · `src/lib/bridge` client, signer, mock · `src/lib/domain` pure logic · `src/lib/auth` sign-in and guards · `bridge` Apps Script source and builds · `automations` · `claude` · `docs` · `tests`.
