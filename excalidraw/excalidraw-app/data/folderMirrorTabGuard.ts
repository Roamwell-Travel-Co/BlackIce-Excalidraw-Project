import { STORAGE_KEYS } from "../app_constants";

/**
 * PRD1 Phase D, multi-tab guard (3.6) -- deliberately its own
 * mechanism, not a reuse of `tabSync.ts`'s
 * `isBrowserStorageStateNewer`/`updateBrowserStateVersion`.
 *
 * That shared tracker only advances when `LocalData.save()` itself
 * runs, which is gated by `LocalData.isSavePaused()`
 * (`document.hidden || <collab lock>`). A tab that hasn't had a chance
 * to run `LocalData.save()` even once since load -- verified directly:
 * a backgrounded tab, where `document.hidden` is `true` from the
 * moment it opens -- would see any pre-existing localStorage version
 * timestamp as "newer than mine" and stay permanently blocked, since
 * its own in-memory baseline never gets the chance to catch up.
 *
 * That defeats Decision 010, which specifically wants the mirror to
 * keep writing when the tab's own localStorage-save path is paused
 * (mid-collaboration, or simply backgrounded) -- reusing a
 * visibility-gated tracker for a check that must work independent of
 * visibility recreates the exact problem Decision 010 was resolving.
 *
 * This tracker instead adopts whatever's currently stored as its own
 * baseline the first time it's ever checked in this tab, rather than
 * assuming staleness just because it hasn't checked before -- so a
 * fresh or backgrounded tab starts "caught up," and only reports
 * another tab as ahead once something writes a genuinely newer value
 * after that baseline was set.
 */

let localVersion: number | null = null;

export const isAnotherTabAheadOfMirror = (): boolean => {
  let stored = -1;
  try {
    stored = Number(
      localStorage.getItem(STORAGE_KEYS.MIRROR_STATE_VERSION) ?? "-1",
    );
  } catch (error: any) {
    // Unable to access window.localStorage -- can't detect other tabs
    // either way, so don't block on their account.
    console.error(error);
    return false;
  }

  if (localVersion === null) {
    localVersion = stored;
    return false;
  }

  return stored > localVersion;
};

/** Called after a successful mirror write, so other tabs (and this
 * tab's own next check) see this write as the current baseline. */
export const claimMirrorVersion = (now: number): void => {
  localVersion = now;
  try {
    localStorage.setItem(STORAGE_KEYS.MIRROR_STATE_VERSION, String(now));
  } catch (error: any) {
    console.error(error);
  }
};

/** Test-only: resets the per-module in-memory baseline between tests. */
export const _resetMirrorTabGuardForTests = (): void => {
  localVersion = null;
};
