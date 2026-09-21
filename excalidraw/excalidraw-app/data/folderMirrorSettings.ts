import { STORAGE_KEYS } from "../app_constants";

import { clearStorageDisclosureSeen } from "./storageDisclosure";
import {
  chooseMirrorFolder,
  clearStoredMirrorDirectoryHandle,
  getStoredMirrorDirectoryHandle,
} from "./folderMirror";

/**
 * PRD1 Phase C: the settings semantics behind the Preferences submenu's
 * composite block (status text + Choose/Change/Reset). No scene data is
 * read or written here -- that's Phase D. "Last-saved timestamp" from
 * the review response's §1.4 display requirement isn't shown yet either,
 * since there's nothing to report a timestamp for until Phase D exists.
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

/**
 * "Choose" (no folder set yet) and "Change" (replacing one already set)
 * are the same underlying action: (re-)invoke the picker and turn
 * autosave on. Returns the new folder's name, or null if the user
 * cancelled the picker or it otherwise failed.
 */
export const chooseOrChangeMirrorFolder = async (
  picker?: () => Promise<FileSystemDirectoryHandle>,
): Promise<string | null> => {
  try {
    const handle = await chooseMirrorFolder(picker);
    setAutosaveEnabled(true);
    return handle.name;
  } catch (error: any) {
    // e.g. AbortError from a cancelled native picker
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
