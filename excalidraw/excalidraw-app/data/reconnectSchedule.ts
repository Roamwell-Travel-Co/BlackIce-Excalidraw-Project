import { STORAGE_KEYS } from "../app_constants";

export type ReconnectNudge = Readonly<{
  roomId: string;
  roomKey: string;
  days: number;
  reason: string;
  createdAt: number;
  targetAt: number;
}>;

type ReconnectNudgeInput = Pick<ReconnectNudge, "roomId" | "roomKey" | "days" | "reason">;

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ROOM_KEY_PATTERN = /^[a-zA-Z0-9_-]{22}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const isValidTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isValidRoomLinkData = (roomId: unknown, roomKey: unknown) =>
  typeof roomId === "string" &&
  ROOM_ID_PATTERN.test(roomId) &&
  typeof roomKey === "string" &&
  ROOM_KEY_PATTERN.test(roomKey);

const isValidReconnectNudge = (value: unknown): value is ReconnectNudge => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isValidRoomLinkData(record.roomId, record.roomKey) &&
    typeof record.days === "number" &&
    Number.isFinite(record.days) &&
    record.days > 0 &&
    typeof record.reason === "string" &&
    isValidTimestamp(record.createdAt) &&
    isValidTimestamp(record.targetAt)
  );
};

const removeScheduledReconnectNudge = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECONNECT_NUDGE);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

/**
 * Returns the single scheduled reconnect nudge for this browser, if one
 * exists. Invalid stored data is removed so it cannot resurface later.
 */
export const getScheduledReconnectNudge = (): ReconnectNudge | null => {
  let storedRecord: string | null = null;

  try {
    storedRecord = localStorage.getItem(STORAGE_KEYS.RECONNECT_NUDGE);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return null;
  }

  if (!storedRecord) {
    return null;
  }

  try {
    const record = JSON.parse(storedRecord);
    if (isValidReconnectNudge(record)) {
      return record;
    }
  } catch (error: any) {
    console.error(error);
  }

  removeScheduledReconnectNudge();
  return null;
};

/**
 * Schedules a browser-local "come back in N days" nudge. Replaces any
 * previously scheduled nudge — only one pending nudge per browser.
 */
export const scheduleReconnectNudge = (
  { roomId, roomKey, days, reason }: ReconnectNudgeInput,
  now = Date.now(),
): ReconnectNudge | null => {
  if (
    !isValidRoomLinkData(roomId, roomKey) ||
    !Number.isFinite(days) ||
    days <= 0 ||
    !isValidTimestamp(now)
  ) {
    return null;
  }

  const record: ReconnectNudge = {
    roomId,
    roomKey,
    days,
    reason,
    createdAt: now,
    targetAt: now + days * DAY_MS,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.RECONNECT_NUDGE, JSON.stringify(record));
    return record;
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return null;
  }
};

export const isReconnectNudgeDue = (
  nudge: ReconnectNudge,
  now = Date.now(),
): boolean => now >= nudge.targetAt;

export const clearScheduledReconnectNudge = () => {
  removeScheduledReconnectNudge();
};
