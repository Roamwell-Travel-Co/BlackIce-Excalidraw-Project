import { useState } from "react";

import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { copyIcon, save } from "@excalidraw/excalidraw/components/icons";
import { useCopyStatus } from "@excalidraw/excalidraw/hooks/useCopiedIndicator";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createSaveLink } from "../data/savedScenes";

import "./SaveMyWorkTrigger.scss";

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; link: string }
  | { phase: "error" };

/**
 * Persistent, always-available "Save my work" control for anonymous guests
 * in a multiplayer session. Purely additive: it doesn't read from or write
 * to the collaboration/room-join code path at all, only to the mocked
 * savedScenes store — see excalidraw-app/data/savedScenes.ts for what's real
 * vs. simulated in that layer.
 */
export const SaveMyWorkTrigger = ({
  excalidrawAPI,
  isCollaborating,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isCollaborating: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SaveState>({ phase: "idle" });
  const { onCopy, copyStatus } = useCopyStatus();

  // Only meaningful once a guest is actually in a shared session — a solo
  // local session already persists to this browser's localStorage on its
  // own, so there's nothing to "claim" yet.
  if (!isCollaborating || !excalidrawAPI) {
    return null;
  }

  const handleOpen = async () => {
    setIsOpen(true);
    setState({ phase: "saving" });
    try {
      const link = await createSaveLink({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
      });
      setState({ phase: "saved", link });
    } catch (error: any) {
      console.error("Failed to create save link", error);
      setState({ phase: "error" });
    }
  };

  return (
    <>
      <Button
        className="save-my-work-button"
        type="button"
        onSelect={handleOpen}
        title="Save my work"
      >
        {save}
      </Button>
      {isOpen && (
        <Dialog
          size="small"
          onCloseRequest={() => setIsOpen(false)}
          title="Save my work"
        >
          <div className="SaveMyWork">
            {state.phase === "saving" && (
              <p className="SaveMyWork__status">Saving your board…</p>
            )}
            {state.phase === "error" && (
              <p className="SaveMyWork__status SaveMyWork__status--error">
                Couldn't save right now — try again.
              </p>
            )}
            {state.phase === "saved" && (
              <>
                <p className="SaveMyWork__description">
                  This link is yours — no account needed. Anyone who has it can
                  reopen this exact board and keep editing. Saving again later
                  replaces it with a new link, so keep whichever one you save
                  last.
                </p>
                <div className="SaveMyWork__linkRow">
                  <TextField
                    readonly
                    fullWidth
                    label="Link"
                    value={state.link}
                  />
                  <FilledButton
                    size="large"
                    label="Copy"
                    icon={copyIcon}
                    status={copyStatus}
                    onClick={async () => {
                      await copyTextToSystemClipboard(state.link);
                      onCopy();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
};

SaveMyWorkTrigger.displayName = "SaveMyWorkTrigger";
