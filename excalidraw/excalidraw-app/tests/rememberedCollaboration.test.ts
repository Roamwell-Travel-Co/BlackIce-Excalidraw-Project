import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  forgetRememberedCollaboration,
  getRememberedCollaboration,
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
    });

    expect(getRememberedCollaboration()).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 100,
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
    });
  });

  it("updates the last-used timestamp without changing creation time", () => {
    rememberCollaboration({ roomId: "room-1", roomKey: roomKey1 }, 100);

    expect(markRememberedCollaborationUsed(200)).toEqual({
      roomId: "room-1",
      roomKey: roomKey1,
      createdAt: 100,
      lastUsedAt: 200,
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
