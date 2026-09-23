import { describe, expect, it } from "vitest";

import {
  formatSnapshotFilename,
  getMostRecentSnapshot,
  isOwnSnapshotFilename,
  listOwnSnapshots,
  parseSnapshotTimestamp,
  pruneSnapshots,
  readSnapshotContent,
  SNAPSHOT_HISTORY_LIMIT,
} from "../data/folderMirrorHistory";

import {
  asDirectoryHandle,
  FakeDirectoryHandle,
} from "./helpers/fakeDirectoryHandle";

describe("folder mirror history (Phase D)", () => {
  describe("filename format", () => {
    it("round-trips a timestamp through format/parse", () => {
      const filename = formatSnapshotFilename(1700000000000);
      expect(filename).toBe("blackice-backup-1700000000000.excalidraw");
      expect(parseSnapshotTimestamp(filename)).toBe(1700000000000);
    });

    it("recognizes only its own naming pattern", () => {
      expect(isOwnSnapshotFilename("blackice-backup-123.excalidraw")).toBe(
        true,
      );
      expect(isOwnSnapshotFilename("my-drawing.excalidraw")).toBe(false);
      expect(isOwnSnapshotFilename("blackice-backup-abc.excalidraw")).toBe(
        false,
      );
      expect(parseSnapshotTimestamp("my-drawing.excalidraw")).toBeNull();
    });
  });

  describe("listOwnSnapshots / getMostRecentSnapshot", () => {
    it("lists only own-pattern files, newest first", async () => {
      const dir = new FakeDirectoryHandle("BlackIce Backups");
      const handle = asDirectoryHandle(dir);
      await handle.getFileHandle(formatSnapshotFilename(100), {
        create: true,
      });
      await handle.getFileHandle(formatSnapshotFilename(300), {
        create: true,
      });
      await handle.getFileHandle(formatSnapshotFilename(200), {
        create: true,
      });
      // a file that isn't ours -- must never be listed or touched
      await handle.getFileHandle("unrelated.txt", { create: true });

      const snapshots = await listOwnSnapshots(handle);

      expect(snapshots.map((s) => s.timestamp)).toEqual([300, 200, 100]);
    });

    it("returns null when the folder has no prior snapshots", async () => {
      const handle = asDirectoryHandle(new FakeDirectoryHandle("Empty"));

      expect(await getMostRecentSnapshot(handle)).toBeNull();
    });

    it("returns the newest snapshot", async () => {
      const handle = asDirectoryHandle(new FakeDirectoryHandle("Docs"));
      await handle.getFileHandle(formatSnapshotFilename(100), {
        create: true,
      });
      await handle.getFileHandle(formatSnapshotFilename(500), {
        create: true,
      });

      expect(await getMostRecentSnapshot(handle)).toEqual({
        name: formatSnapshotFilename(500),
        timestamp: 500,
      });
    });
  });

  describe("readSnapshotContent", () => {
    it("reads back what was written", async () => {
      const dir = new FakeDirectoryHandle("Docs");
      const handle = asDirectoryHandle(dir);
      const fileHandle = await handle.getFileHandle(formatSnapshotFilename(1), {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write("scene-content");
      await writable.close();

      expect(await readSnapshotContent(handle, formatSnapshotFilename(1))).toBe(
        "scene-content",
      );
    });
  });

  describe("pruneSnapshots", () => {
    it("keeps only the most recent SNAPSHOT_HISTORY_LIMIT snapshots", async () => {
      const dir = new FakeDirectoryHandle("Docs");
      const handle = asDirectoryHandle(dir);
      const timestamps = [100, 200, 300, 400, 500, 600, 700];
      for (const ts of timestamps) {
        await handle.getFileHandle(formatSnapshotFilename(ts), {
          create: true,
        });
      }

      await pruneSnapshots(handle);

      const remaining = await listOwnSnapshots(handle);
      expect(remaining).toHaveLength(SNAPSHOT_HISTORY_LIMIT);
      expect(remaining.map((s) => s.timestamp)).toEqual([
        700, 600, 500, 400, 300,
      ]);
    });

    it("never removes a file that doesn't match its own naming pattern", async () => {
      const dir = new FakeDirectoryHandle("Docs");
      const handle = asDirectoryHandle(dir);
      for (const ts of [100, 200, 300, 400, 500, 600]) {
        await handle.getFileHandle(formatSnapshotFilename(ts), {
          create: true,
        });
      }
      await handle.getFileHandle("not-ours.excalidraw", { create: true });

      await pruneSnapshots(handle);

      expect(dir._fileNames()).toContain("not-ours.excalidraw");
    });

    it("does nothing when at or under the limit", async () => {
      const dir = new FakeDirectoryHandle("Docs");
      const handle = asDirectoryHandle(dir);
      await handle.getFileHandle(formatSnapshotFilename(100), {
        create: true,
      });

      await pruneSnapshots(handle);

      expect(await listOwnSnapshots(handle)).toHaveLength(1);
    });
  });
});
