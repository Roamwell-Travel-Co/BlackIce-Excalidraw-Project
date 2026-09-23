import { MIME_TYPES } from "@excalidraw/common";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";

import { STORAGE_KEYS } from "../app_constants";

import {
  chooseMirrorFolder,
  clearStoredMirrorDirectoryHandle,
  getStoredMirrorDirectoryHandle,
} from "./folderMirror";
import {
  getMostRecentSnapshot,
  readSnapshotContent,
} from "./folderMirrorHistory";
import { clearStorageDisclosureSeen } from "./storageDisclosure";

import type { Snapshot } from "./folderMirrorHistory";

/**
 * PRD1 Phase C/D: the settings semantics behind the Preferences
 * submenu's composite block (status text + Choose/Change/Reset), and
 * the restore-before-write detection (1.1's third fix): when a folder
 * is (re-)chosen, check for prior snapshots *before* anything gets
 * written to it, so the caller can offer to restore rather than
 * silently starting fresh next to (or over) old backups.
 */

export const isAutosaveEnabled = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.AUTOSAVE_ENABLED) === "1";
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return false;
  }
};

const setAutosaveEnabled = (enabled: boolean) => {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEYS.AUTOSAVE_ENABLED, "1");
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTOSAVE_ENABLED);
    }
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export type FolderMirrorStatus = {
  enabled: boolean;
  /** Bare folder name only -- FileSystemHandle.name is never a path. */
  folderName: string | null;
};

export const getFolderMirrorStatus = async (): Promise<FolderMirrorStatus> => {
  const handle = await getStoredMirrorDirectoryHandle();
  if (!handle) {
    return { enabled: false, folderName: null };
  }
  return { enabled: isAutosaveEnabled(), folderName: handle.name };
};

export type ChooseMirrorFolderResult = {
  folderName: string;
  /** A prior autosave found in the chosen folder, if any -- checked
   * before anything is written to it (1.1). Neither restoring it nor
   * starting fresh happens silently; the caller (UI) decides. */
  priorSnapshot: Snapshot | null;
};

/**
 * "Choose" (no folder set yet) and "Change" (replacing one already set)
 * are the same underlying action: (re-)invoke the picker and turn
 * autosave on. Returns null if the user cancelled the picker or it
 * otherwise failed.
 */
export const chooseOrChangeMirrorFolder = async (
  picker?: () => Promise<FileSystemDirectoryHandle>,
): Promise<ChooseMirrorFolderResult | null> => {
  try {
    const handle = await chooseMirrorFolder(picker);
    const priorSnapshot = await getMostRecentSnapshot(handle);
    setAutosaveEnabled(true);
    return { folderName: handle.name, priorSnapshot };
  } catch (error: any) {
    // e.g. AbortError from a cancelled native picker
    console.error(error);
    return null;
  }
};

/**
 * Reads and parses the given prior snapshot from the chosen folder,
 * ready to load into the canvas via `excalidrawAPI.updateScene` +
 * `addFiles`. Returns null (logged, not thrown) if the snapshot can't
 * be read or parsed -- restoring is best-effort, never something that
 * should crash the app.
 */
export const restorePriorSnapshot = async (
  dir: FileSystemDirectoryHandle,
  snapshot: Snapshot,
): Promise<Awaited<ReturnType<typeof loadFromBlob>> | null> => {
  try {
    const content = await readSnapshotContent(dir, snapshot.name);
    const blob = new Blob([content], { type: MIME_TYPES.excalidraw });
    return await loadFromBlob(blob, null, null);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

/** Pauses writes without forgetting the chosen folder (D-F). */
export const pauseAutosave = (): void => {
  setAutosaveEnabled(false);
};

/**
 * Resumes writes to the already-chosen folder. Returns false (and
 * leaves autosave off) if no folder has ever been chosen -- the caller
 * should fall back to chooseOrChangeMirrorFolder in that case.
 */
export const resumeAutosave = async (): Promise<boolean> => {
  const handle = await getStoredMirrorDirectoryHandle();
  if (!handle) {
    return false;
  }
  setAutosaveEnabled(true);
  return true;
};

/**
 * Clears the folder, disables autosave, and re-arms the startup
 * disclosure banner -- never deletes existing mirrored files (D-F).
 */
export const resetMirrorFolder = async (): Promise<void> => {
  await clearStoredMirrorDirectoryHandle();
  setAutosaveEnabled(false);
  clearStorageDisclosureSeen();
};
