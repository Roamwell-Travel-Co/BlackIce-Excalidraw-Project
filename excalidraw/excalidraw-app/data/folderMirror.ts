import { createStore, get, set, del } from "idb-keyval";

import { STORAGE_KEYS } from "../app_constants";

/**
 * PRD1 Phase B (foundations): capability check, directory-handle
 * persistence, and the app-owned subfolder convention -- built as a
 * testable interface before any write-path code (Phase D) depends on
 * it. No scene data is read or written here yet.
 *
 * `queryPermission`/`requestPermission` on FileSystemDirectoryHandle and
 * `window.showDirectoryPicker` are a Chromium-only extension to the File
 * System Access API and aren't part of TS's lib.dom types (verified: both
 * fail to typecheck against the project's `lib: ["dom", ...]`) -- typed
 * locally rather than left as `any`.
 */

type PermissionMode = "read" | "readwrite";

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission(opts: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission(opts: { mode: PermissionMode }): Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker(opts?: {
    mode?: PermissionMode;
  }): Promise<FileSystemDirectoryHandle>;
};

/** The only subfolder this feature ever reads or writes inside the
 * user's chosen directory -- e.g. picking `Documents` touches only
 * `Documents/BlackIce Backups/`, nothing else in `Documents`. */
export const FOLDER_MIRROR_SUBFOLDER_NAME = "BlackIce Backups";

/**
 * Checked directly rather than inferred from `browser-fs-access`'s
 * `nativeFileSystemSupported`, which only reflects `showOpenFilePicker`
 * support (verified against the installed package source) and says
 * nothing about the directory picker specifically.
 */
export const isFolderMirrorSupported = (): boolean =>
  "showDirectoryPicker" in window;

/**
 * Opens the native directory picker and returns the app-owned subfolder
 * inside whatever the user chose. Pass `picker` to substitute a fake in
 * tests -- the native picker can't be automated, and this project's test
 * environment (jsdom) implements neither the File System Access API nor
 * OPFS at all (verified directly: no `showDirectoryPicker`, no
 * `navigator.storage`).
 */
export const pickMirrorDirectory = async (
  picker: () => Promise<FileSystemDirectoryHandle> = () =>
    (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
      mode: "readwrite",
    }),
): Promise<FileSystemDirectoryHandle> => {
  const root = await picker();
  return getAppSubfolder(root);
};

export const getAppSubfolder = (
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> =>
  root.getDirectoryHandle(FOLDER_MIRROR_SUBFOLDER_NAME, { create: true });

/**
 * Checks (and if needed, prompts for) permission on a previously-picked
 * handle. Never throws -- a handle whose permission API is unavailable
 * or errors is treated as not granted.
 */
export const verifyDirectoryPermission = async (
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode = "readwrite",
): Promise<boolean> => {
  const permissionHandle = handle as PermissionCapableHandle;
  try {
    if ((await permissionHandle.queryPermission({ mode })) === "granted") {
      return true;
    }
    return (await permissionHandle.requestPermission({ mode })) === "granted";
  } catch (error: any) {
    console.error(error);
    return false;
  }
};

const directoryHandleStore = createStore(
  `${STORAGE_KEYS.IDB_FOLDER_MIRROR}-db`,
  `${STORAGE_KEYS.IDB_FOLDER_MIRROR}-store`,
);

const DIRECTORY_HANDLE_KEY = "directoryHandle";

export const getStoredMirrorDirectoryHandle = (): Promise<
  FileSystemDirectoryHandle | undefined
> => get(DIRECTORY_HANDLE_KEY, directoryHandleStore);

export const setStoredMirrorDirectoryHandle = (
  handle: FileSystemDirectoryHandle,
): Promise<void> => set(DIRECTORY_HANDLE_KEY, handle, directoryHandleStore);

export const clearStoredMirrorDirectoryHandle = (): Promise<void> =>
  del(DIRECTORY_HANDLE_KEY, directoryHandleStore);

/**
 * Picks a new mirror folder and persists the resulting app-owned
 * subfolder handle. Does not write anything into it -- that's Phase D.
 */
export const chooseMirrorFolder = async (
  picker?: () => Promise<FileSystemDirectoryHandle>,
): Promise<FileSystemDirectoryHandle> => {
  const appFolder = await pickMirrorDirectory(picker);
  await setStoredMirrorDirectoryHandle(appFolder);
  return appFolder;
};
