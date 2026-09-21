import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { atom } from "../app-jotai";

import { verifyDirectoryPermission } from "./folderMirror";
import { computeMirrorVersionKey } from "./folderMirrorDirtyCheck";
import {
  FolderMirrorScheduler,
  type FolderMirrorSchedulerConfig,
} from "./folderMirrorScheduler";
import {
  claimMirrorVersion,
  isAnotherTabAheadOfMirror,
} from "./folderMirrorTabGuard";
import {
  classifyMirrorError,
  computeBackoffDelay,
  mirrorWriteScene,
} from "./folderMirrorWrite";

import type { MirrorErrorKind } from "./folderMirrorWrite";

/**
 * PRD1 Phase D+E (shipped together, D-I: "a backup that can fail
 * silently is worse than no backup"): the orchestration that decides,
 * on each scheduler trigger, whether to actually write -- permission
 * check (3.1), multi-tab guard (3.6), dirty-check (3.2), the
 * empty-scene guard and atomic write (folderMirrorWrite.ts), and the
 * error taxonomy + backoff (3.8) that drives the settings surface's
 * paused/error state.
 */

export type MirrorStatus =
  | { kind: "idle" }
  | { kind: "paused-permission" }
  | { kind: "not-found" }
  | { kind: "quota-exceeded" }
  | { kind: "backing-off"; errorKind: MirrorErrorKind; retryAt: number };

export const mirrorStatusAtom = atom<MirrorStatus>({ kind: "idle" });

export type FolderMirrorRuntimeDeps = {
  getDirectoryHandle: () => FileSystemDirectoryHandle | null;
  getSceneSnapshot: () => {
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  };
  onStatusChange: (status: MirrorStatus) => void;
  now?: () => number;
  schedulerConfig?: Partial<FolderMirrorSchedulerConfig>;
};

export class FolderMirrorRuntime {
  private deps: FolderMirrorRuntimeDeps;
  private scheduler: FolderMirrorScheduler;
  private now: () => number;
  private lastWrittenVersionKey: string | null = null;
  private consecutiveFailures = 0;
  private backoffUntil = 0;

  constructor(deps: FolderMirrorRuntimeDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
    this.scheduler = new FolderMirrorScheduler(
      () => this.attempt(),
      deps.schedulerConfig,
    );
  }

  notifyChange(): void {
    this.scheduler.notifyChange();
  }

  setCollaborating(collaborating: boolean): void {
    this.scheduler.setCollaborating(collaborating);
  }

  flush(): Promise<void> {
    return this.scheduler.flush();
  }

  dispose(): void {
    this.scheduler.dispose();
  }

  /** Reset so the next change is treated as dirty regardless of what
   * was last written -- used after choosing/changing/resetting the
   * folder, since "last written" no longer refers to the new folder. */
  resetDirtyState(): void {
    this.lastWrittenVersionKey = null;
  }

  private setStatus(status: MirrorStatus): void {
    this.deps.onStatusChange(status);
  }

  private async attempt(): Promise<void> {
    const dir = this.deps.getDirectoryHandle();
    if (!dir) {
      return;
    }

    const now = this.now();
    if (now < this.backoffUntil) {
      return;
    }

    if (isAnotherTabAheadOfMirror()) {
      // another tab already has a newer mirror write than what we're
      // about to make -- its own mirror cycle will pick this up (3.6).
      return;
    }

    const granted = await verifyDirectoryPermission(dir);
    if (!granted) {
      this.setStatus({ kind: "paused-permission" });
      return;
    }

    const { elements, appState, files } = this.deps.getSceneSnapshot();
    const versionKey = computeMirrorVersionKey(elements, files);
    if (versionKey === this.lastWrittenVersionKey) {
      return;
    }

    try {
      await mirrorWriteScene(dir, elements, appState, files, now);
      this.lastWrittenVersionKey = versionKey;
      this.consecutiveFailures = 0;
      this.backoffUntil = 0;
      claimMirrorVersion(now);
      this.setStatus({ kind: "idle" });
    } catch (error) {
      console.error(error);
      const errorKind = classifyMirrorError(error);
      this.consecutiveFailures += 1;

      if (errorKind === "permission") {
        this.setStatus({ kind: "paused-permission" });
        return;
      }
      if (errorKind === "not-found") {
        this.setStatus({ kind: "not-found" });
        return;
      }
      if (errorKind === "quota") {
        this.setStatus({ kind: "quota-exceeded" });
        // quota pressure won't clear itself on a timer; still back off
        // so we're not hammering a full disk every tick.
      }

      const delay = computeBackoffDelay(this.consecutiveFailures);
      this.backoffUntil = now + delay;
      if (errorKind !== "quota") {
        this.setStatus({
          kind: "backing-off",
          errorKind,
          retryAt: this.backoffUntil,
        });
      }
    }
  }
}
