import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FolderMirrorScheduler } from "../data/folderMirrorScheduler";

describe("folder mirror scheduler (Phase D)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("solo editing: debounce + max-wait", () => {
    it("fires once after the debounce settles", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.notifyChange();
      await vi.advanceTimersByTimeAsync(2_999);
      expect(attempt).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(attempt).toHaveBeenCalledTimes(1);
    });

    it("resets the debounce on each change, not firing until it's quiet", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.notifyChange();
      await vi.advanceTimersByTimeAsync(2_000);
      scheduler.notifyChange(); // resets the 3s debounce
      await vi.advanceTimersByTimeAsync(2_000);
      expect(attempt).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(attempt).toHaveBeenCalledTimes(1);
    });

    it("forces a write at the 15s max-wait ceiling under continuous editing", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      // a change every 2s, forever resetting the 3s debounce
      for (let i = 0; i < 7; i++) {
        scheduler.notifyChange();
        await vi.advanceTimersByTimeAsync(2_000);
      }
      // 14s elapsed, debounce never settled -- still nothing
      expect(attempt).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000); // crosses the 15s ceiling
      expect(attempt).toHaveBeenCalledTimes(1);
    });
  });

  describe("collaboration: flat periodic tick", () => {
    it("fires every 15s regardless of change frequency", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      scheduler.notifyChange();
      scheduler.notifyChange();
      scheduler.notifyChange();

      await vi.advanceTimersByTimeAsync(14_999);
      expect(attempt).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(attempt).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000);
      expect(attempt).toHaveBeenCalledTimes(2);
    });

    it("does not also run the solo debounce while collaborating", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      scheduler.notifyChange();

      await vi.advanceTimersByTimeAsync(3_000); // would have fired solo debounce
      expect(attempt).not.toHaveBeenCalled();
    });

    it("stops ticking once collaboration ends", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      scheduler.setCollaborating(false);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(attempt).not.toHaveBeenCalled();
    });

    it("returns to solo debounce behavior after leaving collaboration", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      scheduler.setCollaborating(false);
      scheduler.notifyChange();

      await vi.advanceTimersByTimeAsync(3_000);
      expect(attempt).toHaveBeenCalledTimes(1);
    });
  });

  describe("single-flight", () => {
    it("skips a trigger that lands while a write is still in flight", async () => {
      const attempt = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 5_000)),
        );
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      await vi.advanceTimersByTimeAsync(15_000); // first tick starts a 5s write
      expect(attempt).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000); // second tick lands mid-write
      expect(attempt).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000); // write finished by now, ticks again
      expect(attempt).toHaveBeenCalledTimes(2);
    });
  });

  describe("flush", () => {
    it("attempts immediately and cancels any pending solo debounce", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.notifyChange();
      await scheduler.flush();
      expect(attempt).toHaveBeenCalledTimes(1);

      // the debounce that was pending before flush must not also fire later
      await vi.advanceTimersByTimeAsync(15_000);
      expect(attempt).toHaveBeenCalledTimes(1);
    });

    it("still respects single-flight", async () => {
      let resolveFirst: () => void = () => {};
      const attempt = vi
        .fn()
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => (resolveFirst = resolve)),
        )
        .mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      const firstFlush = scheduler.flush();
      await scheduler.flush(); // lands while the first is still pending
      expect(attempt).toHaveBeenCalledTimes(1);

      resolveFirst();
      await firstFlush;
    });
  });

  describe("dispose", () => {
    it("cancels all pending timers", async () => {
      const attempt = vi.fn().mockResolvedValue(undefined);
      const scheduler = new FolderMirrorScheduler(attempt);

      scheduler.setCollaborating(true);
      scheduler.dispose();

      await vi.advanceTimersByTimeAsync(60_000);
      expect(attempt).not.toHaveBeenCalled();
    });
  });
});
