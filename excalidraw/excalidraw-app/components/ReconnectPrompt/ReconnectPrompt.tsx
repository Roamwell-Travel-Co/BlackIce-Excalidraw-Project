import { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { getCollaborationLinkData } from "../../data";
import { classifyBoard } from "../../data/classifyBoard";
import {
  BOARD_TYPES,
  getCollaboratorLabel,
  getNextSessionLabel,
} from "../../data/boardTypes";
import {
  getScheduledReconnectNudge,
  isReconnectNudgeDue,
  scheduleReconnectNudge,
} from "../../data/reconnectSchedule";

import "./ReconnectPrompt.scss";

// Overridable via URL for demoing/testing without waiting on the real timer,
// e.g. ?reconnectDemoMs=3000
const DEFAULT_PROMPT_DELAY_MS = 5 * 60 * 1000;
const NUDGE_DAY_OPTIONS = [2, 3, 4, 5] as const;

const getPromptDelay = (): number => {
  const override = new URLSearchParams(window.location.search).get(
    "reconnectDemoMs",
  );
  const parsed = override ? Number(override) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_PROMPT_DELAY_MS;
};

export const ReconnectPrompt = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const [roomLinkData] = useState(() =>
    getCollaborationLinkData(window.location.href),
  );
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<"prompt" | "reason">("prompt");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([true, false, false]);
  const boardTypeRef = useRef(BOARD_TYPES.whiteboard);
  const engagedRef = useRef(false);

  useEffect(() => {
    if (!roomLinkData) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (engagedRef.current) {
        return;
      }
      // Don't stack on top of a due "welcome back" nudge from an earlier
      // session — that modal already owns the screen.
      const pendingNudge = getScheduledReconnectNudge();
      if (pendingNudge && isReconnectNudgeDue(pendingNudge)) {
        return;
      }
      const category = classifyBoard(excalidrawAPI.getSceneElements());
      boardTypeRef.current = BOARD_TYPES[category];
      setChecked([true, false, false]);
      setCollaboratorCount(excalidrawAPI.getAppState().collaborators.size);
      setVisible(true);
    }, getPromptDelay());

    return () => window.clearTimeout(timer);
  }, [roomLinkData, excalidrawAPI]);

  if (!visible) {
    return null;
  }

  const boardType = boardTypeRef.current;

  const close = () => {
    setVisible(false);
    setStage("prompt");
    setSelectedDays(null);
    setReason("");
  };

  const handleContinue = () => {
    engagedRef.current = true;
    close();
  };

  const handlePickDay = (days: number) => {
    setSelectedDays(days);
    setStage("reason");
  };

  const handleSetReminder = () => {
    if (roomLinkData && selectedDays) {
      scheduleReconnectNudge({
        roomId: roomLinkData.roomId,
        roomKey: roomLinkData.roomKey,
        days: selectedDays,
        reason,
      });
    }
    close();
  };

  const toggleChecklistItem = (index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <div className="ReconnectPrompt-backdrop" role="presentation">
      <div
        className="ReconnectPrompt"
        role="dialog"
        aria-labelledby="reconnect-prompt-title"
      >
        <button
          className="ReconnectPrompt__close"
          aria-label="Close"
          onClick={close}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="4" y1="4" x2="20" y2="20" />
            <line x1="20" y1="4" x2="4" y2="20" />
          </svg>
        </button>

        <h2 className="ReconnectPrompt__title" id="reconnect-prompt-title">
          {boardType.title}
        </h2>

        {stage === "prompt" ? (
          <>
            {collaboratorCount > 0 && (
              <div className="ReconnectPrompt__collaborators">
                {getCollaboratorLabel(collaboratorCount)}
              </div>
            )}

            <div className="ReconnectPrompt__checklist">
              {boardType.checklist.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className="ReconnectPrompt__checklistItem"
                  onClick={() => toggleChecklistItem(index)}
                  aria-pressed={checked[index]}
                >
                  <span
                    className={
                      checked[index]
                        ? "ReconnectPrompt__checkbox ReconnectPrompt__checkbox--done"
                        : "ReconnectPrompt__checkbox"
                    }
                  >
                    {checked[index] && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2f9e44"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            <hr className="ReconnectPrompt__divider" />

            <div className="ReconnectPrompt__sectionLabel">Next session</div>
            <div className="ReconnectPrompt__pill">
              {getNextSessionLabel(boardType)}
            </div>
            <p className="ReconnectPrompt__subtitle">{boardType.subtitle}</p>

            <hr className="ReconnectPrompt__divider" />

            <div className="ReconnectPrompt__sectionLabel">
              Remind me to come back
            </div>
            <div className="ReconnectPrompt__dayOptions">
              {NUDGE_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className="ReconnectPrompt__dayOption"
                  onClick={() => handlePickDay(days)}
                >
                  {days} days
                </button>
              ))}
            </div>

            <button className="ReconnectPrompt__cta" onClick={handleContinue}>
              Continue with your team &rarr;
            </button>
          </>
        ) : (
          <>
            <p className="ReconnectPrompt__subtitle">
              Great &mdash; what's the reason? (optional)
            </p>
            <textarea
              className="ReconnectPrompt__reasonInput"
              placeholder="e.g. I want to finish this with my team"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
            <button
              className="ReconnectPrompt__cta"
              onClick={handleSetReminder}
            >
              Set reminder for {selectedDays} days &rarr;
            </button>
          </>
        )}
      </div>
    </div>
  );
};
