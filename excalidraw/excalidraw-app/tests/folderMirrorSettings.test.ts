import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import { clearStoredMirrorDirectoryHandle } from "../data/folderMirror";
import {
  chooseOrChangeMirrorFolder,
  getFolderMirrorStatus,
  isAutosaveEnabled,
  pauseAutosave,
  resetMirrorFolder,
  resumeAutosave,
} from "../data/folderMirrorSettings";
import { hasSeenStorageDisclosure } from "../data/storageDisclosure";

import {
  asDirectoryHandle,
  FakeDirectoryHandle,
} from "./helpers/fakeDirectoryHandle";

describe("folder mirror settings (Phase C)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    await clearStoredMirrorDirectoryHandle();
  });

  describe("getFolderMirrorStatus", () => {
    it("reports browser-only with autosave off when nothing has been chosen", async () => {
      expect(await getFolderMirrorStatus()).toEqual({
        enabled: false,
        folderName: null,
      });
    });
  });

  describe("chooseOrChangeMirrorFolder", () => {
    it("picks a folder and turns autosave on", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      const picker = vi.fn().mockResolvedValue(root);

      const folderName = await chooseOrChangeMirrorFolder(picker);

      expect(folderName).toBe("BlackIce Backups");
      expect(isAutosaveEnabled()).toBe(true);
      expect(await getFolderMirrorStatus()).toEqual({
        enabled: true,
        folderName: "BlackIce Backups",
      });
    });

    it("returns null and leaves autosave off when the picker is cancelled", async () => {
      const picker = vi
        .fn()
        .mockRejectedValue(new DOMException("cancelled", "AbortError"));

      const folderName = await chooseOrChangeMirrorFolder(picker);

      expect(folderName).toBeNull();
      expect(isAutosaveEnabled()).toBe(false);
    });
  });

  describe("pause / resume", () => {
    it("pauses without forgetting the chosen folder", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      await chooseOrChangeMirrorFolder(vi.fn().mockResolvedValue(root));

      pauseAutosave();

      expect(await getFolderMirrorStatus()).toEqual({
        enabled: false,
        folderName: "BlackIce Backups",
      });
    });

    it("resumes to the already-chosen folder", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      await chooseOrChangeMirrorFolder(vi.fn().mockResolvedValue(root));
      pauseAutosave();

      expect(await resumeAutosave()).toBe(true);
      expect(isAutosaveEnabled()).toBe(true);
    });

    it("fails to resume when no folder was ever chosen", async () => {
      expect(await resumeAutosave()).toBe(false);
      expect(isAutosaveEnabled()).toBe(false);
    });
  });

  describe("resetMirrorFolder", () => {
    it("clears the folder, disables autosave, and re-arms the disclosure banner", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      await chooseOrChangeMirrorFolder(vi.fn().mockResolvedValue(root));
      localStorage.setItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN, "1");

      await resetMirrorFolder();

      expect(await getFolderMirrorStatus()).toEqual({
        enabled: false,
        folderName: null,
      });
      expect(hasSeenStorageDisclosure()).toBe(false);
    });
  });
});
