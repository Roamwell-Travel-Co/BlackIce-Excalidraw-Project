import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FOLDER_MIRROR_SUBFOLDER_NAME,
  chooseMirrorFolder,
  clearStoredMirrorDirectoryHandle,
  getAppSubfolder,
  getStoredMirrorDirectoryHandle,
  isFolderMirrorSupported,
  pickMirrorDirectory,
  setStoredMirrorDirectoryHandle,
  verifyDirectoryPermission,
} from "../data/folderMirror";

import {
  asDirectoryHandle,
  FakeDirectoryHandle,
} from "./helpers/fakeDirectoryHandle";

describe("folder mirror (Phase B foundations)", () => {
  afterEach(() => {
    // @ts-ignore -- test-only cleanup of a property defined in some cases
    delete window.showDirectoryPicker;
  });

  describe("isFolderMirrorSupported", () => {
    it("is false when the browser has no directory picker", () => {
      expect(isFolderMirrorSupported()).toBe(false);
    });

    it("is true when the browser exposes showDirectoryPicker", () => {
      // @ts-ignore -- simulating a supporting browser
      window.showDirectoryPicker = vi.fn();

      expect(isFolderMirrorSupported()).toBe(true);
    });
  });

  describe("getAppSubfolder", () => {
    it("creates the app-owned subfolder inside the chosen root", async () => {
      const root = new FakeDirectoryHandle("Documents");

      const appFolder = await getAppSubfolder(asDirectoryHandle(root));

      expect(appFolder.name).toBe(FOLDER_MIRROR_SUBFOLDER_NAME);
      expect(root._hasChild(FOLDER_MIRROR_SUBFOLDER_NAME)).toBe(true);
    });

    it("reuses the same subfolder on a second call, not a duplicate", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));

      const first = await getAppSubfolder(root);
      const second = await getAppSubfolder(root);

      expect(first).toBe(second);
    });
  });

  describe("pickMirrorDirectory", () => {
    it("returns the app-owned subfolder of whatever the picker returns", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      const picker = vi.fn().mockResolvedValue(root);

      const appFolder = await pickMirrorDirectory(picker);

      expect(picker).toHaveBeenCalledTimes(1);
      expect(appFolder.name).toBe(FOLDER_MIRROR_SUBFOLDER_NAME);
    });
  });

  describe("verifyDirectoryPermission", () => {
    it("returns true when permission is already granted", async () => {
      const handle = new FakeDirectoryHandle("BlackIce Backups", "granted");

      expect(await verifyDirectoryPermission(asDirectoryHandle(handle))).toBe(
        true,
      );
    });

    it("returns true when permission is granted after prompting", async () => {
      const handle = new FakeDirectoryHandle("BlackIce Backups", "prompt");
      vi.spyOn(handle, "requestPermission").mockResolvedValue("granted");

      expect(await verifyDirectoryPermission(asDirectoryHandle(handle))).toBe(
        true,
      );
    });

    it("returns false when permission is denied", async () => {
      const handle = new FakeDirectoryHandle("BlackIce Backups", "denied");

      expect(await verifyDirectoryPermission(asDirectoryHandle(handle))).toBe(
        false,
      );
    });

    it("returns false instead of throwing when the permission API errors", async () => {
      const handle = new FakeDirectoryHandle("BlackIce Backups", "prompt");
      vi.spyOn(handle, "queryPermission").mockRejectedValue(
        new Error("broken"),
      );

      expect(await verifyDirectoryPermission(asDirectoryHandle(handle))).toBe(
        false,
      );
    });
  });

  describe("stored directory handle persistence", () => {
    afterEach(async () => {
      await clearStoredMirrorDirectoryHandle();
    });

    it("returns undefined when nothing has been stored", async () => {
      expect(await getStoredMirrorDirectoryHandle()).toBeUndefined();
    });

    it("stores and returns a handle", async () => {
      const handle = asDirectoryHandle(
        new FakeDirectoryHandle(FOLDER_MIRROR_SUBFOLDER_NAME),
      );

      await setStoredMirrorDirectoryHandle(handle);

      expect(await getStoredMirrorDirectoryHandle()).toEqual(handle);
    });

    it("clears a stored handle", async () => {
      const handle = asDirectoryHandle(
        new FakeDirectoryHandle(FOLDER_MIRROR_SUBFOLDER_NAME),
      );
      await setStoredMirrorDirectoryHandle(handle);

      await clearStoredMirrorDirectoryHandle();

      expect(await getStoredMirrorDirectoryHandle()).toBeUndefined();
    });
  });

  describe("chooseMirrorFolder", () => {
    beforeEach(async () => {
      await clearStoredMirrorDirectoryHandle();
    });

    it("picks a folder and persists the app-owned subfolder", async () => {
      const root = asDirectoryHandle(new FakeDirectoryHandle("Documents"));
      const picker = vi.fn().mockResolvedValue(root);

      const appFolder = await chooseMirrorFolder(picker);

      expect(appFolder.name).toBe(FOLDER_MIRROR_SUBFOLDER_NAME);
      expect(await getStoredMirrorDirectoryHandle()).toEqual(appFolder);
    });
  });
});
