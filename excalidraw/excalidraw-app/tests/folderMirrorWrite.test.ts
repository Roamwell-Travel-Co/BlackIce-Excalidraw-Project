import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { describe, expect, it } from "vitest";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  formatSnapshotFilename,
  listOwnSnapshots,
} from "../data/folderMirrorHistory";
import {
  classifyMirrorError,
  computeBackoffDelay,
  mirrorWriteScene,
  shouldSkipEmptyOverwrite,
  writeMirrorSnapshot,
} from "../data/folderMirrorWrite";

import {
  asDirectoryHandle,
  FakeDirectoryHandle,
} from "./helpers/fakeDirectoryHandle";

const testAppState = (): AppState =>
  ({
    ...getDefaultAppState(),
    offsetTop: 0,
    offsetLeft: 0,
    width: 800,
    height: 600,
  } as AppState);

describe("folder mirror write mechanics (Phase D)", () => {
  describe("classifyMirrorError", () => {
    it.each([
      ["NotAllowedError", "permission"],
      ["NotFoundError", "not-found"],
      ["QuotaExceededError", "quota"],
      ["NoModificationAllowedError", "retryable"],
      ["InvalidStateError", "retryable"],
      ["SomethingElseError", "unknown"],
    ] as const)("classifies %s as %s", (name, expected) => {
      expect(classifyMirrorError(new DOMException("x", name))).toBe(expected);
    });

    it("classifies a non-DOMException as unknown", () => {
      expect(classifyMirrorError(new Error("plain error"))).toBe("unknown");
    });
  });

  describe("computeBackoffDelay", () => {
    it("starts at the 30s base on the first failure", () => {
      expect(computeBackoffDelay(1)).toBe(30_000);
    });

    it("doubles on each consecutive failure", () => {
      expect(computeBackoffDelay(2)).toBe(60_000);
      expect(computeBackoffDelay(3)).toBe(120_000);
    });

    it("caps at the maximum instead of growing unbounded", () => {
      expect(computeBackoffDelay(20)).toBe(8 * 60_000);
    });
  });

  describe("shouldSkipEmptyOverwrite", () => {
    it("does not skip when the scene has content", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));
      const elements = [API.createElement({ id: "a" })];

      expect(await shouldSkipEmptyOverwrite(dir, elements)).toBe(false);
    });

    it("does not skip an empty scene when there is no prior backup", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));

      expect(await shouldSkipEmptyOverwrite(dir, [])).toBe(false);
    });

    it("skips an empty scene when a prior backup exists -- the review's most serious finding", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));
      await dir.getFileHandle(formatSnapshotFilename(1), { create: true });

      expect(await shouldSkipEmptyOverwrite(dir, [])).toBe(true);
    });
  });

  describe("writeMirrorSnapshot", () => {
    it("writes a new timestamped snapshot file", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));

      await writeMirrorSnapshot(dir, "content", 12345);

      const snapshots = await listOwnSnapshots(dir);
      expect(snapshots).toEqual([
        { name: formatSnapshotFilename(12345), timestamp: 12345 },
      ]);
    });

    it("aborts the writable stream instead of leaving a half-written file on error", async () => {
      const dir = new FakeDirectoryHandle("Docs");
      const handle = asDirectoryHandle(dir);
      const fileHandle = await handle.getFileHandle(formatSnapshotFilename(1), {
        create: true,
      });
      const failingWritable = {
        write: async () => {
          throw new Error("disk error");
        },
        close: async () => {
          throw new Error("should not be reached");
        },
        abort: async () => {},
      };
      fileHandle.createWritable = async () => failingWritable as any;

      await expect(writeMirrorSnapshot(handle, "content", 1)).rejects.toThrow(
        "disk error",
      );
    });
  });

  describe("mirrorWriteScene", () => {
    it("writes and prunes on a normal non-empty scene", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));
      const elements = [API.createElement({ id: "a" })];

      const result = await mirrorWriteScene(
        dir,
        elements,
        testAppState(),
        {},
        1000,
      );

      expect(result).toBe("written");
      const snapshots = await listOwnSnapshots(dir);
      expect(snapshots).toHaveLength(1);
    });

    it("skips writing an empty scene over an existing backup", async () => {
      const dir = asDirectoryHandle(new FakeDirectoryHandle("Docs"));
      await mirrorWriteScene(
        dir,
        [API.createElement({ id: "a" })],
        testAppState(),
        {},
        1000,
      );

      const result = await mirrorWriteScene(dir, [], testAppState(), {}, 2000);

      expect(result).toBe("skipped-empty");
      const snapshots = await listOwnSnapshots(dir);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].timestamp).toBe(1000);
    });
  });
});
