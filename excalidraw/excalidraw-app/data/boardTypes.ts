import type { BoardCategory } from "./classifyBoard";

export interface BoardTypeInfo {
  title: string;
  checklist: readonly [string, string, string];
  subtitle: string;
}

/**
 * Mock, demo-facing copy per recognized board category. Not derived from
 * real canvas content — this is intentionally a static presentation layer,
 * same spirit as Chris's "Jump Back In" being a browser-local shortcut
 * rather than a server-backed feature.
 */
export const BOARD_TYPES: Record<BoardCategory, BoardTypeInfo> = {
  whiteboard: {
    title: "Design Sprint — Round 1",
    checklist: ["Brainstorm", "Wireframes", "Final concepts"],
    subtitle: "Pick up where you left off with your team.",
  },
  brainstorm: {
    title: "Design Sprint — Round 1",
    checklist: ["Brainstorm", "Wireframes", "Final concepts"],
    subtitle: "Pick up where you left off with your team.",
  },
  kanban: {
    title: "Team Board — Sprint Tracker",
    checklist: ["Plan", "Build", "Ship"],
    subtitle: "Pick up where you left off with your team.",
  },
  sketch: {
    title: "Dream Board",
    checklist: ["Thoughts", "Dreams", "Emotions"],
    subtitle: "Pick up where you left off with your team.",
  },
  flowchart: {
    title: "Process Map",
    checklist: ["Map it out", "Connect the steps", "Review the flow"],
    subtitle: "Pick up where you left off with your team.",
  },
};

/** "Next session" always mocks the second checklist step. */
export const getNextSessionLabel = (info: BoardTypeInfo): string =>
  info.checklist[1];

/**
 * Strict collaborator-count display rule: 1 or 2 show the literal count,
 * anything above 2 always reads "Team".
 */
export const getCollaboratorLabel = (count: number): string => {
  if (count <= 1) {
    return "1 collaborator";
  }
  if (count === 2) {
    return "2 collaborators";
  }
  return "Team";
};
