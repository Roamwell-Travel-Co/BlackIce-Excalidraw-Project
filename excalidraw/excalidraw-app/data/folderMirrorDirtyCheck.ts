import { hashElementsVersion } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

/**
 * PRD1 Phase D, design gap 3.2: `onChange` fires on pure viewport
 * changes (verified against `packages/excalidraw/components/App.tsx`:
 * `onChange` fires unconditionally from `componentDidUpdate` except
 * while loading, and `AppState` includes `scrollX`/`scrollY`/`zoom`).
 * The mirror gets its own dirty-check, independent of the existing
 * localStorage save, comparing a lightweight version key against the
 * last mirrored one -- so panning/zooming alone never triggers a disk
 * write.
 *
 * Deliberately excludes `appState` from the key: the mirror cares about
 * *content* (elements + files), not viewport or transient UI state.
 */
export const computeMirrorVersionKey = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): string => {
  const elementsHash = hashElementsVersion(elements);
  const fileIds = Object.keys(files).sort().join(",");
  return `${elementsHash}:${fileIds}`;
};
