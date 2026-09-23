import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  formatSnapshotFilename,
  getMostRecentSnapshot,
  pruneSnapshots,
} from "./folderMirrorHistory";

/**
 * PRD1 Phase D: the write mechanics for one mirror snapshot -- the
 * empty-scene guard (1.1's single most serious fix), atomic write
 * (3.9), and the error taxonomy + backoff (3.8) the settings surface's
 * paused/error states key off of. No scheduling or dirty-checking here
 * -- see folderMirrorScheduler.ts and folderMirrorDirtyCheck.ts.
 */

export type MirrorErrorKind =
  | "permission"
  | "not-found"
  | "quota"
  | "retryable"
  | "unknown";

/**
 * Error taxonomy (3.8): `NotAllowedError` -> permission (paused,
 * click-to-resume); `NotFoundError` -> not-found (folder no longer
 * available, re-pick action); `QuotaExceededError` -> quota (disk
 * full); `NoModificationAllowedError`/`InvalidStateError` -> retryable
 * (generic backed-off retry); anything else -> unknown, treated the
 * same as retryable by the backoff below.
 */
export const classifyMirrorError = (error: unknown): MirrorErrorKind => {
  if (!(error instanceof DOMException)) {
    return "unknown";
  }
  switch (error.name) {
    case "NotAllowedError":
      return "permission";
    case "NotFoundError":
      return "not-found";
    case "QuotaExceededError":
      return "quota";
    case "NoModificationAllowedError":
    case "InvalidStateError":
      return "retryable";
    default:
      return "unknown";
  }
};

const BACKOFF_BASE_MS = 30_000;
// Placeholder cap, like the original 3s debounce figure -- not backed
// by a real measurement yet, easy to tune later.
const BACKOFF_MAX_MS = 8 * 60_000;

/**
 * Backs off ~30s after a failure, doubling up to a cap, instead of
 * retrying every debounce/tick cycle -- a persistent failure produces
 * one visible paused/error state, not banner spam (3.8).
 */
export const computeBackoffDelay = (consecutiveFailures: number): number =>
  Math.min(
    BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1),
    BACKOFF_MAX_MS,
  );

/**
 * Atomic write (3.9): a fresh, uniquely timestamped file per snapshot,
 * so a failed write never leaves a half-written file in place of a
 * good one. `abort()` is called on any error before rethrowing, so a
 * partially-written stream is never left `close()`d.
 */
export const writeMirrorSnapshot = async (
  dir: FileSystemDirectoryHandle,
  content: string,
  now = Date.now(),
): Promise<void> => {
  const fileHandle = await dir.getFileHandle(formatSnapshotFilename(now), {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
    await writable.close();
  } catch (error) {
    await writable.abort();
    throw error;
  }
};

/**
 * The empty-scene guard (1.1): never overwrite a non-empty backup with
 * an empty scene. Returns true if the write should be skipped.
 */
export const shouldSkipEmptyOverwrite = async (
  dir: FileSystemDirectoryHandle,
  elements: readonly ExcalidrawElement[],
): Promise<boolean> => {
  if (elements.length > 0) {
    return false;
  }
  const mostRecent = await getMostRecentSnapshot(dir);
  return mostRecent !== null;
};

/**
 * The full mirror-write step for one snapshot: empty-scene guard,
 * serialize (reusing the existing export serialization, per the PRD's
 * own requirement), write, prune history to 5. Scheduling,
 * dirty-checking, and error-state UI are the caller's job -- this
 * throws on a genuine write failure rather than swallowing it, so the
 * caller's error taxonomy/backoff can react.
 */
export const mirrorWriteScene = async (
  dir: FileSystemDirectoryHandle,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  now = Date.now(),
): Promise<"written" | "skipped-empty"> => {
  if (await shouldSkipEmptyOverwrite(dir, elements)) {
    return "skipped-empty";
  }
  const content = serializeAsJSON(elements, appState, files, "local");
  await writeMirrorSnapshot(dir, content, now);
  await pruneSnapshots(dir);
  return "written";
};
