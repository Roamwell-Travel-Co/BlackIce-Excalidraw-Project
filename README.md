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

## Documentation

Planning, PRDs, decisions, and research for this project live in a
separate private repo, not in this one:
**https://github.com/PixelAndFlow/https-github.com-blackIce-excalidraw-project-docs**

## Workflow

1. Work on your own branch.
2. Keep commits small and scoped — no unrelated changes bundled into a PR.
3. Open a PR into `main` before merging. No direct pushes to `main`.
4. Track PR status in `#black-ice-builds` on Slack.

> Build/CI notifications from this repo now post automatically to
> `#black-ice-builds` via the GitHub for Slack integration (set up
> 2026-09-16). See the [docs repo](https://github.com/PixelAndFlow/https-github.com-blackIce-excalidraw-project-docs)'s
> `decisions/decisions-log.md` (Decision 001) and
> `monitoring-observability/alerting.md` for detail.

## Getting started

The `excalidraw/` folder is a snapshot of the real Excalidraw codebase (MIT-licensed, imported from [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)) — this is our own independent copy to build on, separate from the original project.

```
cd excalidraw
yarn install
yarn start
```

It's a real production monorepo (React/TypeScript, Yarn workspaces), so give `yarn install` a few minutes the first time.
