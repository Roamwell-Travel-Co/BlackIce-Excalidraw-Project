import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";
import { t } from "@excalidraw/excalidraw/i18n";

import type { Snapshot } from "../data/folderMirrorHistory";

/**
 * PRD1 Phase D, restore-before-write (1.1's third fix): shown when a
 * (re-)chosen folder already has a prior autosave in it. Neither
 * restoring it nor starting fresh happens silently -- the guest picks.
 */
export const RestoreSnapshotDialog = ({
  snapshot,
  onRestore,
  onStartFresh,
}: {
  snapshot: Snapshot;
  onRestore: () => void;
  onStartFresh: () => void;
}) => {
  return (
    <ConfirmDialog
      title={t("autosave.restoreDialog.title")}
      onConfirm={onRestore}
      onCancel={onStartFresh}
      confirmText={t("autosave.restoreDialog.restore")}
      cancelText={t("autosave.restoreDialog.startFresh")}
    >
      <p>
        {t("autosave.restoreDialog.message", {
          timestamp: new Date(snapshot.timestamp).toLocaleString(),
        })}
      </p>
    </ConfirmDialog>
  );
};
