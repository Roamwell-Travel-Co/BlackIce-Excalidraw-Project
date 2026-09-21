import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  _resetMirrorTabGuardForTests,
  claimMirrorVersion,
  isAnotherTabAheadOfMirror,
} from "../data/folderMirrorTabGuard";

describe("folder mirror tab guard (Phase D)", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetMirrorTabGuardForTests();
  });

  it("does not report another tab ahead on a fresh tab with a pre-existing stored value", () => {
    // Simulates the bug this module fixes: some prior session already
    // wrote a version timestamp, and this tab has never checked before.
    // A naive "storage > my in-memory baseline (which starts at -1)"
    // check would treat this as another tab being ahead, permanently.
    localStorage.setItem(STORAGE_KEYS.MIRROR_STATE_VERSION, "999999");

    expect(isAnotherTabAheadOfMirror()).toBe(false);
  });

  it("stays caught up across repeated checks with no new writes", () => {
    localStorage.setItem(STORAGE_KEYS.MIRROR_STATE_VERSION, "1000");

    expect(isAnotherTabAheadOfMirror()).toBe(false);
    expect(isAnotherTabAheadOfMirror()).toBe(false);
    expect(isAnotherTabAheadOfMirror()).toBe(false);
  });

  it("reports another tab ahead once a newer value appears after the baseline is set", () => {
    localStorage.setItem(STORAGE_KEYS.MIRROR_STATE_VERSION, "1000");
    expect(isAnotherTabAheadOfMirror()).toBe(false); // establishes baseline at 1000

    localStorage.setItem(STORAGE_KEYS.MIRROR_STATE_VERSION, "2000"); // another tab wrote

    expect(isAnotherTabAheadOfMirror()).toBe(true);
  });

  it("claiming a version updates both localStorage and this tab's own baseline", () => {
    claimMirrorVersion(5000);

    expect(localStorage.getItem(STORAGE_KEYS.MIRROR_STATE_VERSION)).toBe(
      "5000",
    );
    // this tab's own claim must not make it think itself is "ahead of
    // itself" on the next check
    expect(isAnotherTabAheadOfMirror()).toBe(false);
  });

  it("does not block when localStorage is unavailable", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(isAnotherTabAheadOfMirror()).toBe(false);
  });
});
