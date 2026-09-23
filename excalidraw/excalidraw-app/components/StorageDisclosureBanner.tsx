import { useEffect, useState } from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { CloseIcon } from "@excalidraw/excalidraw/components/icons";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { t } from "@excalidraw/excalidraw/i18n";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";

import {
  hasSeenStorageDisclosure,
  markStorageDisclosureSeen,
  requestPersistentStorage,
} from "../data/storageDisclosure";
import { useMirrorFolderChooser } from "../useMirrorFolderChooser";

import { RestoreSnapshotDialog } from "./RestoreSnapshotDialog";

import "./StorageDisclosureBanner.scss";

export const StorageDisclosureBanner = ({
  onRestoreScene,
  onAutosaveStateChanged,
}: {
  /** Loads a restored prior snapshot into the live canvas. */
  onRestoreScene: (scene: RestoredDataState) => void;
  /** Called after a folder is chosen via "click here", so the mirror
   * runtime picks up the newly-chosen folder immediately. */
  onAutosaveStateChanged?: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  const { chooseFolder, pendingRestore, handleRestore, handleStartFresh } =
    useMirrorFolderChooser(onRestoreScene, onAutosaveStateChanged);

  useEffect(() => {
    if (!hasSeenStorageDisclosure()) {
      setVisible(true);
      trackEvent("autosave", "disclosure shown");
      // Requested at the same moment the disclosure is shown, regardless
      // of whether the user acts on it -- this is the durability
      // improvement PRD1-lite provides on every browser today.
      requestPersistentStorage();
    }
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    markStorageDisclosureSeen();
    setVisible(false);
  };

  const handleDismissClick = () => {
    trackEvent("autosave", "disclosure dismissed");
    dismiss();
  };

  const handleSaveElsewhereClick = async () => {
    trackEvent("autosave", "disclosure accepted");
    // Same folder picker as Preferences -> "Choose autosave
    // location..." (via the shared useMirrorFolderChooser hook) --
    // this used to just call requestPersistentStorage() and dismiss, a
    // Phase A placeholder from before the real picker existed. If the
    // user cancels the native picker, leave the banner up rather than
    // dismissing as though they'd chosen "browser only".
    if (await chooseFolder()) {
      dismiss();
    }
  };

  return (
    <div className="StorageDisclosureBanner" role="status">
      <div className="StorageDisclosureBanner__message">
        {t("storageDisclosure.messagePrefix")}{" "}
        <button
          type="button"
          className="StorageDisclosureBanner__link"
          onClick={handleSaveElsewhereClick}
        >
          {t("storageDisclosure.clickHere")}
        </button>
        {t("storageDisclosure.messageSuffix")}
      </div>
      <IconButton
        type="icon"
        icon={CloseIcon}
        title={t("storageDisclosure.dismiss")}
        aria-label={t("storageDisclosure.dismiss")}
        className="StorageDisclosureBanner__close"
        onClick={handleDismissClick}
      />
      {pendingRestore && (
        <RestoreSnapshotDialog
          snapshot={pendingRestore}
          onRestore={async () => {
            await handleRestore();
            dismiss();
          }}
          onStartFresh={() => {
            handleStartFresh();
            dismiss();
          }}
        />
      )}
    </div>
  );
};
