import { useState } from "react";

import { getCollaborationLink } from "../../data";
import {
  clearScheduledReconnectNudge,
  getScheduledReconnectNudge,
  isReconnectNudgeDue,
} from "../../data/reconnectSchedule";

import "./ReconnectPrompt.scss";

/**
 * Checks, on every app load, whether a previously scheduled "come back in
 * N days" nudge (set from ReconnectPrompt's day-picker) has come due, and
 * if so offers to reopen that collaboration — reusing the same
 * roomId/roomKey link format Chris's "Jump Back In" feature uses.
 */
export const ReconnectNudgeWatcher = () => {
  const [dueNudge] = useState(() => {
    const nudge = getScheduledReconnectNudge();
    return nudge && isReconnectNudgeDue(nudge) ? nudge : null;
  });
  const [dismissed, setDismissed] = useState(false);

  if (!dueNudge || dismissed) {
    return null;
  }

  const reopen = () => {
    clearScheduledReconnectNudge();
    window.location.assign(getCollaborationLink(dueNudge));
  };

  const dismiss = () => {
    clearScheduledReconnectNudge();
    setDismissed(true);
  };

  return (
    <div className="ReconnectPrompt-backdrop" role="presentation">
      <div
        className="ReconnectPrompt"
        role="dialog"
        aria-labelledby="reconnect-nudge-title"
      >
        <button
          className="ReconnectPrompt__close"
          aria-label="Close"
          onClick={dismiss}
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

        <h2 className="ReconnectPrompt__title" id="reconnect-nudge-title">
          Ready to jump back in?
        </h2>

        <p className="ReconnectPrompt__subtitle">
          {dueNudge.reason
            ? `You said: "${dueNudge.reason}"`
            : "You asked us to remind you to come back to this board."}
        </p>

        <button className="ReconnectPrompt__cta" onClick={reopen}>
          Reopen the board &rarr;
        </button>
      </div>
    </div>
  );
};
