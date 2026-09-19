import type { ExcalidrawElement } from "@excalidraw/element/types";

export type BoardCategory =
  | "flowchart"
  | "kanban"
  | "brainstorm"
  | "sketch"
  | "whiteboard";

/**
 * Local, offline heuristic for guessing what kind of board a session is.
 * No network/LLM call — classification happens instantly from whatever
 * shapes already exist in the scene.
 */
export const classifyBoard = (
  elements: readonly ExcalidrawElement[],
): BoardCategory => {
  const live = elements.filter((el) => !el.isDeleted);

  if (live.length === 0) {
    return "whiteboard";
  }

  const counts = {
    rectangle: 0,
    diamond: 0,
    ellipse: 0,
    arrow: 0,
    stickynote: 0,
    freedraw: 0,
    frame: 0,
    text: 0,
  };

  let connectedArrows = 0;

  for (const el of live) {
    if (el.type in counts) {
      counts[el.type as keyof typeof counts]++;
    }
    if (
      el.type === "arrow" &&
      (el as ExcalidrawElement & { startBinding: unknown; endBinding: unknown })
        .startBinding &&
      (el as ExcalidrawElement & { startBinding: unknown; endBinding: unknown })
        .endBinding
    ) {
      connectedArrows++;
    }
  }

  const shapeCount = counts.rectangle + counts.diamond + counts.ellipse;

  // Multiple shapes wired together by arrows with both ends bound = a process/flow.
  if (connectedArrows >= 2 && shapeCount >= 3) {
    return "flowchart";
  }

  // Two or more frames usually means columns/stages (sprint board, kanban).
  if (counts.frame >= 2) {
    return "kanban";
  }

  // Sticky notes are the strongest signal for a brainstorm; scattered text
  // with few shapes and no connections is the fallback signal.
  if (
    counts.stickynote >= 2 ||
    (counts.text >= 4 && connectedArrows === 0 && shapeCount <= 2)
  ) {
    return "brainstorm";
  }

  // Mostly freehand strokes with little structure = a rough sketch.
  if (counts.freedraw > shapeCount + counts.text) {
    return "sketch";
  }

  return "whiteboard";
};
