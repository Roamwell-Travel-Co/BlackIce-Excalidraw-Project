import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  hasSeenStorageDisclosure,
  markStorageDisclosureSeen,
  requestPersistentStorage,
} from "../data/storageDisclosure";

describe("storage disclosure", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("has not been seen before the flag is set", () => {
    expect(hasSeenStorageDisclosure()).toBe(false);
  });

  it("marks itself seen", () => {
    markStorageDisclosureSeen();

    expect(hasSeenStorageDisclosure()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN)).toBe(
      "1",
    );
  });

  it("treats localStorage access failure as already seen, so a broken banner never nags on every load", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(hasSeenStorageDisclosure()).toBe(true);
  });

  describe("requestPersistentStorage", () => {
    afterEach(() => {
      // @ts-ignore -- test-only cleanup of a property we defined below
      delete navigator.storage;
    });

    it("returns null when the Storage API is unavailable", async () => {
      // @ts-ignore -- simulate an unsupported browser
      delete navigator.storage;

      expect(await requestPersistentStorage()).toBeNull();
    });

    it("returns the grant result when supported", async () => {
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: { persist: vi.fn().mockResolvedValue(true) },
      });

      expect(await requestPersistentStorage()).toBe(true);
    });

    it("returns null instead of throwing when persist() rejects", async () => {
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persist: vi.fn().mockRejectedValue(new Error("denied")),
        },
      });

      expect(await requestPersistentStorage()).toBeNull();
    });
  });
});
