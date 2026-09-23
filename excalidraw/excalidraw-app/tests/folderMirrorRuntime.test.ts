import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "@excalidraw/excalidraw/types";

import { FolderMirrorRuntime } from "../data/folderMirrorRuntime";

import type { MirrorStatus } from "../data/folderMirrorRuntime";

const { verifyDirectoryPermission } = vi.hoisted(() => ({
  verifyDirectoryPermission: vi.fn(),
}));
vi.mock("../data/folderMirror", () => ({ verifyDirectoryPermission }));

const { isAnotherTabAheadOfMirror, claimMirrorVersion } = vi.hoisted(() => ({
  isAnotherTabAheadOfMirror: vi.fn(),
  claimMirrorVersion: vi.fn(),
}));
vi.mock("../data/folderMirrorTabGuard", () => ({
  isAnotherTabAheadOfMirror,
  claimMirrorVersion,
}));

const { mirrorWriteScene } = vi.hoisted(() => ({
  mirrorWriteScene: vi.fn(),
}));
vi.mock("../data/folderMirrorWrite", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../data/folderMirrorWrite")
  >();
  return { ...actual, mirrorWriteScene };
});

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@excalidraw/excalidraw/analytics", () => ({ trackEvent }));

const testAppState = (): AppState =>
  ({
    ...getDefaultAppState(),
    offsetTop: 0,
    offsetLeft: 0,
    width: 800,
    height: 600,
  } as AppState);

const fakeDir = {} as FileSystemDirectoryHandle;

describe("folder mirror runtime (Phase D+E orchestration)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    verifyDirectoryPermission.mockReset().mockResolvedValue(true);
    isAnotherTabAheadOfMirror.mockReset().mockReturnValue(false);
    claimMirrorVersion.mockReset();
    mirrorWriteScene.mockReset().mockResolvedValue("written");
    trackEvent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeRuntime = (
    overrides: Partial<{
      getDirectoryHandle: () => FileSystemDirectoryHandle | null;
    }> = {},
  ) => {
    const statuses: MirrorStatus[] = [];
    const elements = [API.createElement({ id: "a" })];
    const runtime = new FolderMirrorRuntime({
      getDirectoryHandle: overrides.getDirectoryHandle ?? (() => fakeDir),
      getSceneSnapshot: () => ({
        elements,
        appState: testAppState(),
        files: {},
      }),
      onStatusChange: (status) => statuses.push(status),
    });
    return { runtime, statuses, elements };
  };

  it("does nothing when no folder has been chosen", async () => {
    const { runtime } = makeRuntime({ getDirectoryHandle: () => null });

    await runtime.flush();

    expect(mirrorWriteScene).not.toHaveBeenCalled();
  });

  it("writes on a normal flush", async () => {
    const { runtime } = makeRuntime();

    await runtime.flush();

    expect(mirrorWriteScene).toHaveBeenCalledTimes(1);
  });

  it("skips a second flush when nothing changed since the last write", async () => {
    const { runtime } = makeRuntime();

    await runtime.flush();
    await runtime.flush();

    expect(mirrorWriteScene).toHaveBeenCalledTimes(1);
  });

  it("writes again after resetDirtyState even with the same scene", async () => {
    const { runtime } = makeRuntime();

    await runtime.flush();
    runtime.resetDirtyState();
    await runtime.flush();

    expect(mirrorWriteScene).toHaveBeenCalledTimes(2);
  });

  it("enters paused-permission and skips the write when permission isn't granted", async () => {
    verifyDirectoryPermission.mockResolvedValue(false);
    const { runtime, statuses } = makeRuntime();

    await runtime.flush();

    expect(mirrorWriteScene).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({ kind: "paused-permission" });
  });

  it("skips the write when another tab is already ahead", async () => {
    isAnotherTabAheadOfMirror.mockReturnValue(true);
    const { runtime } = makeRuntime();

    await runtime.flush();

    expect(mirrorWriteScene).not.toHaveBeenCalled();
  });

  it("claims the mirror version after a successful write", async () => {
    const { runtime } = makeRuntime();

    await runtime.flush();

    expect(claimMirrorVersion).toHaveBeenCalledTimes(1);
  });

  it("goes back to idle after a successful write once the backoff window elapses", async () => {
    mirrorWriteScene.mockRejectedValueOnce(
      new DOMException("x", "InvalidStateError"),
    );
    const { runtime, statuses } = makeRuntime();

    await runtime.flush();
    expect(statuses.at(-1)?.kind).toBe("backing-off");

    await vi.advanceTimersByTimeAsync(30_000); // past the backoff window
    runtime.resetDirtyState();
    mirrorWriteScene.mockResolvedValue("written");
    await runtime.flush();

    expect(statuses.at(-1)).toEqual({ kind: "idle" });
  });

  describe("error taxonomy", () => {
    it("NotAllowedError -> paused-permission", async () => {
      mirrorWriteScene.mockRejectedValue(
        new DOMException("x", "NotAllowedError"),
      );
      const { runtime, statuses } = makeRuntime();

      await runtime.flush();

      expect(statuses.at(-1)).toEqual({ kind: "paused-permission" });
    });

    it("NotFoundError -> not-found", async () => {
      mirrorWriteScene.mockRejectedValue(
        new DOMException("x", "NotFoundError"),
      );
      const { runtime, statuses } = makeRuntime();

      await runtime.flush();

      expect(statuses.at(-1)).toEqual({ kind: "not-found" });
      expect(trackEvent).toHaveBeenCalledWith(
        "autosave",
        "write failed",
        "not-found",
      );
    });

    it("QuotaExceededError -> quota-exceeded", async () => {
      mirrorWriteScene.mockRejectedValue(
        new DOMException("x", "QuotaExceededError"),
      );
      const { runtime, statuses } = makeRuntime();

      await runtime.flush();

      expect(statuses.at(-1)).toEqual({ kind: "quota-exceeded" });
    });

    it("a retryable error backs off instead of retrying every tick", async () => {
      mirrorWriteScene.mockRejectedValue(
        new DOMException("x", "InvalidStateError"),
      );
      const { runtime, statuses } = makeRuntime();

      await runtime.flush();

      const last = statuses.at(-1);
      expect(last?.kind).toBe("backing-off");
      if (last?.kind === "backing-off") {
        expect(last.errorKind).toBe("retryable");
        expect(last.retryAt).toBeGreaterThan(0);
      }
    });

    it("does not attempt another write before the backoff window elapses", async () => {
      mirrorWriteScene.mockRejectedValueOnce(
        new DOMException("x", "InvalidStateError"),
      );
      const { runtime } = makeRuntime();

      await runtime.flush(); // fails, enters backoff
      runtime.resetDirtyState();
      mirrorWriteScene.mockResolvedValue("written");
      await runtime.flush(); // immediately after -- still within backoff

      expect(mirrorWriteScene).toHaveBeenCalledTimes(1);
    });
  });
});
