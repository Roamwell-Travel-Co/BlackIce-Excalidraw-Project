import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  forgetRememberedCollaboration,
  getRememberedCollaboration,
  isSuccessfulSecondSession,
  markRememberedCollaborationLeft,
  markRememberedCollaborationUsed,
  markSecondSessionCounted,
  markSecondSessionWindowMissed,
  rememberCollaboration,
  shouldCountSecondSession,
  shouldMarkSecondSessionWindowMissed,
} from "../data/rememberedCollaboration";

const roomKey1 = "1234567890123456789012";
const roomKey2 = "abcdefghijklmnopqrstuv";

describe("remembered collaboration storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and returns one remembered collaboration", () => {
    expect(
      rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100),
    ).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });

    expect(getRememberedCollaboration()).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });
  });

  it("replaces the previous remembered collaboration", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);
    rememberCollaboration({ roomId: "room-2", roomKey: roomKey2 }, 200);

    expect(getRememberedCollaboration()).toEqual({
      roomId: "room-2",
      roomKey: roomKey2,
      createdAt: 200,
      lastUsedAt: 200,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });
  });

  it("updates the last-used timestamp without changing creation time", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);

    expect(markRememberedCollaborationUsed(200)).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 200,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });
  });

  it("marks when the user left the room, independent of last-used", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);

    expect(markRememberedCollaborationLeft(150)).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: 150,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });
  });

  it("returns null from markRememberedCollaborationLeft when nothing is remembered", () => {
    expect(markRememberedCollaborationLeft(150)).toBeNull();
  });

  it("marks the second session counted, independent of leftAt/last-used", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);
    markRememberedCollaborationLeft(150);

    expect(markSecondSessionCounted(200)).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: 150,
      secondSessionCountedAt: 200,
      secondSessionWindowMissedAt: null,
    });
  });

  it("returns null from markSecondSessionCounted when nothing is remembered", () => {
    expect(markSecondSessionCounted(200)).toBeNull();
  });

  it("marks the second-session window missed, independent of other fields", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);

    expect(markSecondSessionWindowMissed(200)).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: 200,
    });
  });

  it("returns null from markSecondSessionWindowMissed when nothing is remembered", () => {
    expect(markSecondSessionWindowMissed(200)).toBeNull();
  });

  it("treats a legacy record with none of the tracking fields as not set", () => {
    localStorage.setItem(
      STORAGE_KEYS.RECENT_COLLABORATION,
      JSON.stringify({
        roomId: "room-1",
        roomKey: roomKey1,
        createdAt: 100,
        lastUsedAt: 100,
      }),
    );

    expect(getRememberedCollaboration()).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: null,
      secondSessionCountedAt: null,
      secondSessionWindowMissedAt: null,
    });
  });

  describe("isSuccessfulSecondSession (Decision 012)", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it("is false before 24h have passed, even if the user left", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const left = { ...record, leftAt: 100 };

      expect(isSuccessfulSecondSession(left, DAY_MS - 1)).toBe(false);
    });

    it("is false after 24h if the user never left", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;

      expect(isSuccessfulSecondSession(record, DAY_MS + 1)).toBe(false);
    });

    it("is true after 24h once the user has left", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const left = { ...record, leftAt: 100 };

      expect(isSuccessfulSecondSession(left, DAY_MS + 1)).toBe(true);
    });

    it("is true right at the 7-day boundary", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const left = { ...record, leftAt: 100 };

      expect(isSuccessfulSecondSession(left, DAY_MS * 7)).toBe(true);
    });

    it("is false once more than 7 days have passed, even if the user left -- this is the 7-day KPI, not eventually", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const left = { ...record, leftAt: 100 };

      expect(isSuccessfulSecondSession(left, DAY_MS * 7 + 1)).toBe(false);
    });
  });

  describe("shouldMarkSecondSessionWindowMissed (the 7-day KPI's failure case)", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it("is false before 7 days have passed", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;

      expect(shouldMarkSecondSessionWindowMissed(record, DAY_MS * 7)).toBe(
        false,
      );
    });

    it("is true once more than 7 days have passed with no successful second session", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;

      expect(shouldMarkSecondSessionWindowMissed(record, DAY_MS * 7 + 1)).toBe(
        true,
      );
    });

    it("is true even if the user never left -- leaving was only ever a means to the 24h+left criteria, which can no longer be met", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;

      expect(shouldMarkSecondSessionWindowMissed(record, DAY_MS * 30)).toBe(
        true,
      );
    });

    it("is false if a successful second session was already counted", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const counted = { ...record, leftAt: 100, secondSessionCountedAt: 200 };

      expect(shouldMarkSecondSessionWindowMissed(counted, DAY_MS * 30)).toBe(
        false,
      );
    });

    it("is false once already marked missed", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const alreadyMissed = {
        ...record,
        secondSessionWindowMissedAt: DAY_MS * 8,
      };

      expect(
        shouldMarkSecondSessionWindowMissed(alreadyMissed, DAY_MS * 30),
      ).toBe(false);
    });
  });

  describe("shouldCountSecondSession (fires once per room, not every qualifying return)", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it("is true the first time criteria are met", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const left = { ...record, leftAt: 100 };

      expect(shouldCountSecondSession(left, DAY_MS + 1)).toBe(true);
    });

    it("is false once already counted, even on a later qualifying return", () => {
      const record = rememberCollaboration(
        { roomId: "room-1", roomKey: roomKey1 },
        0,
      )!;
      const leftAndCounted = {
        ...record,
        leftAt: 100,
        secondSessionCountedAt: DAY_MS + 1,
      };

      // A third session, well after the first qualifying return -- must
      // not be double-counted as another "successful second session".
      expect(shouldCountSecondSession(leftAndCounted, DAY_MS * 10)).toBe(false);
    });
  });

  it("forgets the remembered collaboration", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);

    forgetRememberedCollaboration();

    expect(getRememberedCollaboration()).toBeNull();
  });

  it("removes malformed stored data", () => {
    localStorage.setItem(STORAGE_KEYS.RECENT_COLLABORATION, "not-json");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(getRememberedCollaboration()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.RECENT_COLLABORATION)).toBeNull();
  });

  it("rejects incomplete collaboration data", () => {
    expect(
      rememberCollaboration({ roomId: "", roomKey: roomKey1 }, 100),
    ).toBeNull();
    expect(getRememberedCollaboration()).toBeNull();
  });

  it("removes stored data with an invalid room-link format", () => {
    localStorage.setItem(
      STORAGE_KEYS.RECENT_COLLABORATION,
      JSON.stringify({
        roomId: "invalid room",
        roomKey: roomKey1,
        createdAt: 100,
        lastUsedAt: 100,
      }),
    );

    expect(getRememberedCollaboration()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.RECENT_COLLABORATION)).toBeNull();
  });

  it("does not throw when browser storage is unavailable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(
      rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100),
    ).toBeNull();
  });

  it("does not throw when remembered data cannot be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(getRememberedCollaboration()).toBeNull();
  });
});
