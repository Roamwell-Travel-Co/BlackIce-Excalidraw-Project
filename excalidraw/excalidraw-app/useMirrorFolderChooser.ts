import { useState } from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";

import { getStoredMirrorDirectoryHandle } from "./data/folderMirror";

import {
  chooseOrChangeMirrorFolder,
  restorePriorSnapshot,
} from "./data/folderMirrorSettings";

import type { Snapshot } from "./data/folderMirrorHistory";

/**
 * The "(re-)pick an autosave folder, then offer to restore a prior
 * snapshot found there" flow -- shared by the two places a user can
 * trigger it: the Preferences composite block's Choose/Change action,
 * and the startup disclosure banner's "click here". Sharing this hook
 * is what keeps those two entry points from drifting apart the way
 * the banner's link once did (it used to just call
 * requestPersistentStorage() and dismiss, a Phase A placeholder that
 * was never updated once the real folder picker landed in a later
 * phase).
 */
export const useMirrorFolderChooser = (
  onRestoreScene: (scene: RestoredDataState) => void,
  onAutosaveStateChanged?: () => void,
) => {
  const [pendingRestore, setPendingRestore] = useState<Snapshot | null>(null);

  /** Returns true if a folder was actually chosen (false if the user
   * cancelled the native picker or it otherwise failed). */
  const chooseFolder = async (
    picker?: () => Promise<FileSystemDirectoryHandle>,
  ): Promise<boolean> => {
    const result = await chooseOrChangeMirrorFolder(picker);
    if (!result) {
      return false;
    }
    trackEvent("autosave", "location chosen");
    onAutosaveStateChanged?.();
    if (result.priorSnapshot) {
      setPendingRestore(result.priorSnapshot);
    }
    return true;
  };

  const handleRestore = async () => {
    const snapshot = pendingRestore;
    setPendingRestore(null);
    if (!snapshot) {
      return;
    }
    const dir = await getStoredMirrorDirectoryHandle();
    if (!dir) {
      return;
    }
    const scene = await restorePriorSnapshot(dir, snapshot);
    if (scene) {
      onRestoreScene(scene);
    }
  };

  const handleStartFresh = () => setPendingRestore(null);

  return { chooseFolder, pendingRestore, handleRestore, handleStartFresh };
};
