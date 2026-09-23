/**
 * PRD1 Phase D: snapshot naming, history-of-5 rotation, and restore
 * detection inside the app-owned mirror subfolder.
 *
 * `FileSystemDirectoryHandle.values()` (async iteration over entries)
 * isn't part of TS's lib.dom types (verified: fails to typecheck
 * against the project's `lib: ["dom", ...]`, same gap as
 * `queryPermission`/`showDirectoryPicker` in folderMirror.ts) -- typed
 * locally rather than left as `any`.
 */

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

const SNAPSHOT_PREFIX = "blackice-backup-";
const SNAPSHOT_SUFFIX = ".excalidraw";
const SNAPSHOT_FILENAME_PATTERN = /^blackice-backup-(\d+)\.excalidraw$/;

/** Only the last this-many snapshots are kept; older ones are pruned. */
export const SNAPSHOT_HISTORY_LIMIT = 5;

export const formatSnapshotFilename = (timestamp: number): string =>
  `${SNAPSHOT_PREFIX}${timestamp}${SNAPSHOT_SUFFIX}`;

export const parseSnapshotTimestamp = (filename: string): number | null => {
  const match = SNAPSHOT_FILENAME_PATTERN.exec(filename);
  return match ? Number(match[1]) : null;
};

/** Used to decide what pruning may ever touch: never a file we didn't
 * create ourselves (1.4's least-privilege convention, extended to
 * pruning specifically). */
export const isOwnSnapshotFilename = (filename: string): boolean =>
  SNAPSHOT_FILENAME_PATTERN.test(filename);

export type Snapshot = { name: string; timestamp: number };

/** Newest first. */
export const listOwnSnapshots = async (
  dir: FileSystemDirectoryHandle,
): Promise<Snapshot[]> => {
  const snapshots: Snapshot[] = [];
  for await (const entry of (dir as IterableDirectoryHandle).values()) {
    if (entry.kind !== "file") {
      continue;
    }
    const timestamp = parseSnapshotTimestamp(entry.name);
    if (timestamp !== null) {
      snapshots.push({ name: entry.name, timestamp });
    }
  }
  return snapshots.sort((a, b) => b.timestamp - a.timestamp);
};

export const getMostRecentSnapshot = async (
  dir: FileSystemDirectoryHandle,
): Promise<Snapshot | null> => {
  const snapshots = await listOwnSnapshots(dir);
  return snapshots[0] ?? null;
};

export const readSnapshotContent = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string> => {
  const fileHandle = await dir.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
};

/**
 * Deletes our own snapshot files beyond SNAPSHOT_HISTORY_LIMIT. Only
 * ever removes files matching our own naming pattern -- pruning never
 * touches a file it didn't create, even if something else somehow put
 * a file in this app-owned subfolder.
 */
export const pruneSnapshots = async (
  dir: FileSystemDirectoryHandle,
): Promise<void> => {
  const snapshots = await listOwnSnapshots(dir);
  const toRemove = snapshots.slice(SNAPSHOT_HISTORY_LIMIT);
  for (const snapshot of toRemove) {
    try {
      await dir.removeEntry(snapshot.name);
    } catch (error: any) {
      console.error(error);
    }
  }
};
