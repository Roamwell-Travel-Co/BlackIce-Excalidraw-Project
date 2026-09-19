import { STORAGE_KEYS } from "../app_constants";

export type RememberedCollaboration = Readonly<{
  roomId: string;
  roomKey: string;
  createdAt: number;
  lastUsedAt: number;
}>;

type RememberedCollaborationInput = Pick<
  RememberedCollaboration,
  "roomId" | "roomKey"
>;

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ROOM_KEY_PATTERN = /^[a-zA-Z0-9_-]{22}$/;

const isValidTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isValidRoomLinkData = (roomId: unknown, roomKey: unknown) =>
  typeof roomId === "string" &&
  ROOM_ID_PATTERN.test(roomId) &&
  typeof roomKey === "string" &&
  ROOM_KEY_PATTERN.test(roomKey);

const isValidRememberedCollaboration = (
  value: unknown,
): value is RememberedCollaboration => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isValidRoomLinkData(record.roomId, record.roomKey) &&
    isValidTimestamp(record.createdAt) &&
    isValidTimestamp(record.lastUsedAt)
  );
};

const removeRememberedCollaboration = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECENT_COLLABORATION);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

/**
 * Returns the single remembered collaboration for this browser, if one exists.
 * Invalid stored data is removed so it cannot affect normal collaboration.
 */
export const getRememberedCollaboration =
  (): RememberedCollaboration | null => {
    let storedRecord: string | null = null;

    try {
      storedRecord = localStorage.getItem(STORAGE_KEYS.RECENT_COLLABORATION);
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
      if (isValidRememberedCollaboration(record)) {
        return record;
      }
    } catch (error: any) {
      console.error(error);
    }

    removeRememberedCollaboration();
    return null;
  };

/**
 * Replaces the browser's remembered collaboration with one explicitly chosen
 * by the user. Browser storage failures never interrupt collaboration.
 */
export const rememberCollaboration = (
  { roomId, roomKey }: RememberedCollaborationInput,
  now = Date.now(),
): RememberedCollaboration | null => {
  if (!isValidRoomLinkData(roomId, roomKey) || !isValidTimestamp(now)) {
    return null;
  }

  const record: RememberedCollaboration = {
    roomId,
    roomKey,
    createdAt: now,
    lastUsedAt: now,
  };

  try {
    localStorage.setItem(
      STORAGE_KEYS.RECENT_COLLABORATION,
      JSON.stringify(record),
    );
    return record;
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return null;
  }
};

/**
 * Updates the timestamp after a successful Jump Back In action.
 */
export const markRememberedCollaborationUsed = (
  now = Date.now(),
): RememberedCollaboration | null => {
  if (!isValidTimestamp(now)) {
    return null;
  }

  const record = getRememberedCollaboration();
  if (!record) {
    return null;
  }

  const updatedRecord: RememberedCollaboration = {
    ...record,
    lastUsedAt: now,
  };

  try {
    localStorage.setItem(
      STORAGE_KEYS.RECENT_COLLABORATION,
      JSON.stringify(updatedRecord),
    );
    return updatedRecord;
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return null;
  }
};

export const forgetRememberedCollaboration = () => {
  removeRememberedCollaboration();
};
