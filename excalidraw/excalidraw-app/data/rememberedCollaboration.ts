import { STORAGE_KEYS } from "../app_constants";

export type RememberedCollaboration = Readonly<{
  roomId: string;
  roomKey: string;
  createdAt: number;
  lastUsedAt: number;
  // When the user most recently left this room, or null if they haven't
  // left it since it was remembered. Decision 012's "successful second
  // session" requires this in addition to the 24h gap below.
  leftAt: number | null;
  // When the KPI event for this room's *first* qualifying return fired, or
  // null if it hasn't yet. Without this, every later qualifying return to
  // the same room would re-fire "successful second session".
  secondSessionCountedAt: number | null;
}>;

const SUCCESSFUL_SECOND_SESSION_MIN_GAP_MS = 24 * 60 * 60 * 1000;

type RememberedCollaborationInput = Pick<
  RememberedCollaboration,
  "roomId" | "roomKey"
>;

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ROOM_KEY_PATTERN = /^[a-zA-Z0-9_-]{22}$/;

const isValidTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// undefined covers records saved before a nullable field existed; treated
// as "not set" so a legacy remembered room isn't discarded outright.
const isValidNullableTimestamp = (
  value: unknown,
): value is number | null | undefined =>
  value === null || value === undefined || isValidTimestamp(value);

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
    isValidTimestamp(record.lastUsedAt) &&
    isValidNullableTimestamp(record.leftAt) &&
    isValidNullableTimestamp(record.secondSessionCountedAt)
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

const saveRememberedCollaboration = (
  record: RememberedCollaboration,
): RememberedCollaboration | null => {
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
        return {
          ...record,
          leftAt: record.leftAt ?? null,
          secondSessionCountedAt: record.secondSessionCountedAt ?? null,
        };
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
    leftAt: null,
    secondSessionCountedAt: null,
  };

  return saveRememberedCollaboration(record);
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

  return saveRememberedCollaboration(updatedRecord);
};

/**
 * Marks that the user left the remembered room. Part of Decision 012's
 * "successful second session" definition, alongside the 24h gap.
 */
export const markRememberedCollaborationLeft = (
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
    leftAt: now,
  };

  return saveRememberedCollaboration(updatedRecord);
};

/**
 * Marks that this room's one-time "successful second session" KPI event
 * has fired, so a later qualifying return to the same room never re-fires
 * it -- the KPI is about the first second session, not every session after.
 */
export const markSecondSessionCounted = (
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
    secondSessionCountedAt: now,
  };

  return saveRememberedCollaboration(updatedRecord);
};

export const forgetRememberedCollaboration = () => {
  removeRememberedCollaboration();
};

/**
 * Decision 012: a return to the remembered room only counts as a
 * successful second session if it happens more than 24h after the room
 * was created AND the user left the room at some point before returning.
 * Another collaborator's presence at return time is explicitly not part
 * of this definition.
 */
export const isSuccessfulSecondSession = (
  record: RememberedCollaboration,
  now = Date.now(),
): boolean =>
  record.leftAt !== null &&
  now - record.createdAt > SUCCESSFUL_SECOND_SESSION_MIN_GAP_MS;

/**
 * Whether this return should fire the KPI event: meets Decision 012's
 * criteria AND hasn't already been counted for this room.
 */
export const shouldCountSecondSession = (
  record: RememberedCollaboration,
  now = Date.now(),
): boolean =>
  record.secondSessionCountedAt === null &&
  isSuccessfulSecondSession(record, now);
