import { useEffect, useState } from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { CloseIcon } from "@excalidraw/excalidraw/components/icons";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  hasSeenStorageDisclosure,
  markStorageDisclosureSeen,
  requestPersistentStorage,
} from "../data/storageDisclosure";

import "./StorageDisclosureBanner.scss";

export const StorageDisclosureBanner = () => {
  const [visible, setVisible] = useState(false);

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

  const handleSaveElsewhereClick = () => {
    trackEvent("autosave", "disclosure accepted");
    // No folder destination exists yet -- that's the full folder-mirror
    // feature, built in a later phase. Today, this gives the user the
    // one durability improvement that already exists (storage.persist()
    // was already requested above; re-requesting here is harmless).
    requestPersistentStorage();
    dismiss();
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
    </div>
  );
};
