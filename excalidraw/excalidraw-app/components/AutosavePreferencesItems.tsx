import { useCallback, useEffect, useState } from "react";

import DropdownMenuItem from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItem";
import DropdownMenuItemCheckbox from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemCheckbox";
import DropdownMenuItemCustom from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemCustom";
import { emptyIcon } from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";

import { isFolderMirrorSupported } from "../data/folderMirror";
import {
  chooseOrChangeMirrorFolder,
  getFolderMirrorStatus,
  pauseAutosave,
  resetMirrorFolder,
  resumeAutosave,
} from "../data/folderMirrorSettings";

import type { FolderMirrorStatus } from "../data/folderMirrorSettings";

/**
 * PRD1 Phase C: the composite status + Choose/Change/Reset block inside
 * the existing Preferences submenu (Decision 006's `additionalItems`
 * extension point) -- not a bare toggle, per the review response's own
 * requirements-gap fix. Renders nothing on browsers without a directory
 * picker: a real answer (the Phase A disclosure banner still covers
 * them), not a dead-end disabled control.
 */
export const AutosavePreferencesItems = () => {
  const [status, setStatus] = useState<FolderMirrorStatus | null>(null);

  const refresh = useCallback(() => {
    getFolderMirrorStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isFolderMirrorSupported() || !status) {
    return null;
  }

  const handleToggle = async (event: Event) => {
    event.preventDefault();
    if (status.enabled) {
      pauseAutosave();
      refresh();
      return;
    }
    const resumed = await resumeAutosave();
    if (resumed) {
      refresh();
      return;
    }
    // No folder has ever been chosen -- there's nothing to resume.
    if (await chooseOrChangeMirrorFolder()) {
      refresh();
    }
  };

  const handleChooseOrChange = async () => {
    if (await chooseOrChangeMirrorFolder()) {
      refresh();
    }
  };

  const handleReset = async () => {
    await resetMirrorFolder();
    refresh();
  };

  return (
    <>
      <DropdownMenuItemCustom>
        {status.folderName
          ? t("autosave.statusFolder", { folder: status.folderName })
          : t("autosave.statusBrowserOnly")}
      </DropdownMenuItemCustom>
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
    </>
  );
};
