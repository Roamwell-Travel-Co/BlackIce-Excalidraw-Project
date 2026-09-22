import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  forgetRememberedCollaboration,
  getRememberedCollaboration,
  isSuccessfulSecondSession,
  markRememberedCollaborationLeft,
  markRememberedCollaborationUsed,
  rememberCollaboration,
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
    });

    expect(getRememberedCollaboration()).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
      leftAt: null,
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
    });
  });

  it("returns null from markRememberedCollaborationLeft when nothing is remembered", () => {
    expect(markRememberedCollaborationLeft(150)).toBeNull();
  });

  it("treats a legacy record with no leftAt field as not having left", () => {
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
