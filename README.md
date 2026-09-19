# Black Ice — Excalidraw Growth Project

Team build repo for the Black Ice project: a mock consulting engagement for Excalidraw's Head of Growth, now moving from strategy into a real MVP build.

## North Star

What can we do to make a guest's first collaborative session turn into a second one within 7 days?

## Team

- **Marc** — `marc` branch
- **Chris** — `chris` branch
- **Lola** — `lola` branch
- **Juan** — `juan` branch

Each person builds on their own branch and opens a PR into `main` when ready for review. Marc may split off an additional branch for a more technical exploration — keep it prefixed `marc/` (e.g. `marc/api-spike`) so it's clear it's his.

## Workflow

1. Work on your own branch.
2. Keep commits small and scoped — no unrelated changes bundled into a PR.
3. Open a PR into `main` before merging. No direct pushes to `main`.
4. Track PR status in `#black-ice-builds` on Slack.

## Getting started

The `excalidraw/` folder is a snapshot of the real Excalidraw codebase (MIT-licensed, imported from [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)) — this is our own independent copy to build on, separate from the original project.

```
cd excalidraw
yarn install
yarn start
```

It's a real production monorepo (React/TypeScript, Yarn workspaces), so give `yarn install` a few minutes the first time.

## Demoing the retention features locally (no waiting required)

Two of our features only normally trigger after real minutes/days pass (a guest session timer, a multi-day "come back" reminder). To see them fire immediately for a demo or review, open the app with a fake collaboration link and a demo-speed override:

```
http://localhost:3001/?reconnectDemoMs=3000#room=demoroom12345,abcdefghijklmnopqrstuv
```

- The `#room=...` part makes the app treat you as a **guest** joining someone else's session (required for both features below — a host never sees these).
- `?reconnectDemoMs=3000` makes Lola's "Circle Back" prompt fire after 3 seconds instead of the real 5-minute mark. Change the number to whatever delay you want to demo.

What you'll see, in order:
1. **Chris's "Remember this collaboration?"** toast — appears within ~1 second of loading as a guest. Click **Remember**.
2. **Lola's "Circle Back" prompt** — fires after the `reconnectDemoMs` delay. Shows the recognized board type, a mock checklist, and a "remind me in N days" picker. Pick a day, add a reason, submit.
3. **The "Ready to jump back in?" welcome-back prompt** — this one won't show immediately (it's date-based, not timer-based). To see it without waiting real days, open the browser console and run:
   ```js
   const n = JSON.parse(localStorage.getItem('excalidraw-reconnect-nudge'));
   n.targetAt = Date.now() - 1000;
   localStorage.setItem('excalidraw-reconnect-nudge', JSON.stringify(n));
   ```
   Then reload `http://localhost:3001/` (no room hash needed this time) — the welcome-back prompt appears and "Reopen the board" takes you straight back into the exact room you scheduled it from.

No local collaboration server is required to see any of this — the guest-detection and both retention features work purely off the URL and browser storage, independent of a live socket connection.
