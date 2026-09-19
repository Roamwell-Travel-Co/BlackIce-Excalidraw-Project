# Reconnect Prompt — User Flow

This renders automatically on GitHub (in this file or pasted into a PR description).

```mermaid
graph LR
  A[Guest opens shared room link] --> B[roomLinkData present<br/>session marked as guest]
  B --> C[5-minute session timer starts]
  C --> D[Classify current board<br/>flowchart / kanban / brainstorm / sketch / whiteboard]
  D --> E[Show Reconnect Prompt<br/>message from preset for category]
  E --> F{Guest clicks<br/>Continue with your team?}
  F -->|Yes| G[Popup closes<br/>guest stays active]
  F -->|Dismissed| H[30-minute timer starts]
  H --> I[Show second Reconnect Prompt<br/>final reminder]
  I --> J{Guest clicks<br/>Continue with your team?}
  J -->|Yes| G
  J -->|Dismissed / leaves| K[Session ends<br/>retention loss point]
```

**Where each step lives in the code (once built):**
- A/B — existing `roomLinkData` check in `excalidraw-app/App.tsx`
- C/H — new timers in `excalidraw-app/components/ReconnectPrompt/ReconnectPrompt.tsx`
- D — `excalidraw-app/data/classifyBoard.ts` (local heuristic, no AI call)
- E/I — `excalidraw-app/data/reconnectPresets.ts` (curated copy per category)
