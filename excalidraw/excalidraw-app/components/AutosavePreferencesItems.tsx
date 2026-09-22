import { useCallback, useEffect, useState } from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import DropdownMenuItem from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItem";
import DropdownMenuItemCheckbox from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemCheckbox";
import DropdownMenuItemCustom from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemCustom";
import { emptyIcon } from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";

import { useAtomValue } from "../app-jotai";
import {
  getStoredMirrorDirectoryHandle,
  isFolderMirrorSupported,
} from "../data/folderMirror";
import {
  chooseOrChangeMirrorFolder,
  getFolderMirrorStatus,
  pauseAutosave,
  resetMirrorFolder,
  restorePriorSnapshot,
  resumeAutosave,
} from "../data/folderMirrorSettings";
import { mirrorStatusAtom } from "../data/folderMirrorRuntime";

import { RestoreSnapshotDialog } from "./RestoreSnapshotDialog";

import type { Snapshot } from "../data/folderMirrorHistory";
import type { FolderMirrorStatus } from "../data/folderMirrorSettings";
import type { MirrorStatus } from "../data/folderMirrorRuntime";

/** 3.1/3.8: a persistent status, not a one-off dismissible banner that
 * could be dismissed once and then silently stay broken. */
const mirrorStatusLabel = (status: MirrorStatus): string | null => {
  switch (status.kind) {
    case "idle":
      return null;
    case "paused-permission":
      return t("autosave.pausedPermission");
    case "not-found":
      return t("autosave.folderNotFound");
    case "quota-exceeded":
      return t("autosave.quotaExceeded");
    case "backing-off":
      return t("autosave.retrying");
  }
};

/**
 * PRD1 Phase C/D: the composite status + Choose/Change/Reset block
 * inside the existing Preferences submenu (Decision 006's
 * `additionalItems` extension point) -- not a bare toggle, per the
 * review response's own requirements-gap fix. Renders nothing on
 * browsers without a directory picker: a real answer (the Phase A
 * disclosure banner still covers them), not a dead-end disabled
 * control.
 */
export const AutosavePreferencesItems = ({
  onRestoreScene,
  onAutosaveStateChanged,
  onRetryAutosave,
}: {
  /** Loads a restored prior snapshot into the live canvas. */
  onRestoreScene: (scene: RestoredDataState) => void;
  /** Called after autosave is toggled, or the folder is chosen/changed/
   * reset -- anything that changes what the mirror runtime should be
   * writing to (or whether it should write at all). */
  onAutosaveStateChanged?: () => void;
  /** Forces an immediate mirror write attempt -- used by the
   * paused-permission "click to resume" action, since a user gesture
   * here is also what makes the browser re-prompt for permission. */
  onRetryAutosave?: () => void;
}) => {
  const [status, setStatus] = useState<FolderMirrorStatus | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Snapshot | null>(null);
  const mirrorStatus = useAtomValue(mirrorStatusAtom);

  const refresh = useCallback(() => {
    getFolderMirrorStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isFolderMirrorSupported() || !status) {
    return null;
  }

  const afterFolderChosen = (priorSnapshot: Snapshot | null) => {
    trackEvent("autosave", "location chosen");
    onAutosaveStateChanged?.();
    refresh();
    if (priorSnapshot) {
      setPendingRestore(priorSnapshot);
    }
  };

  const handleToggle = async (event: Event) => {
    event.preventDefault();
    if (status.enabled) {
      pauseAutosave();
      trackEvent("autosave", "toggled", "off");
      onAutosaveStateChanged?.();
      refresh();
      return;
    }
    const resumed = await resumeAutosave();
    if (resumed) {
      trackEvent("autosave", "toggled", "on");
      onAutosaveStateChanged?.();
      refresh();
      return;
    }
    // No folder has ever been chosen -- there's nothing to resume.
    const result = await chooseOrChangeMirrorFolder();
    if (result) {
      afterFolderChosen(result.priorSnapshot);
    }
  };

  const handleChooseOrChange = async () => {
    const result = await chooseOrChangeMirrorFolder();
    if (result) {
      afterFolderChosen(result.priorSnapshot);
    }
  };

  const handleReset = async () => {
    await resetMirrorFolder();
    trackEvent("autosave", "location reset");
    onAutosaveStateChanged?.();
    refresh();
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

  const statusLabel =
    (status.enabled && mirrorStatusLabel(mirrorStatus)) ||
    (status.folderName
      ? t("autosave.statusFolder", { folder: status.folderName })
      : t("autosave.statusBrowserOnly"));

  return (
    <>
      <DropdownMenuItemCustom>{statusLabel}</DropdownMenuItemCustom>
      <DropdownMenuItemCheckbox
        checked={status.enabled}
        onSelect={handleToggle}
      >
        {t("autosave.toggle")}
      </DropdownMenuItemCheckbox>
      <DropdownMenuItem icon={emptyIcon} onSelect={handleChooseOrChange}>
        {status.folderName ? t("autosave.change") : t("autosave.choose")}
      </DropdownMenuItem>
      {status.folderName && (
        <DropdownMenuItem icon={emptyIcon} onSelect={handleReset}>
          {t("autosave.reset")}
        </DropdownMenuItem>
      )}
      {status.enabled &&
        mirrorStatus.kind === "paused-permission" &&
        onRetryAutosave && (
          <DropdownMenuItem icon={emptyIcon} onSelect={onRetryAutosave}>
            {t("autosave.resume")}
          </DropdownMenuItem>
        )}
      {pendingRestore && (
        <RestoreSnapshotDialog
          snapshot={pendingRestore}
          onRestore={handleRestore}
          onStartFresh={() => setPendingRestore(null)}
        />
      )}
    </>
  );
};
