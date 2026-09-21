import { STORAGE_KEYS } from "../app_constants";

/**
 * PRD1-lite (Phase A): tells the user where their data lives today and
 * asks the browser to protect it from eviction. No folder destination
 * yet -- that's the full folder-mirror feature, built in later phases.
 */

export const hasSeenStorageDisclosure = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN) === "1";
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
    return true;
  }
};

export const markStorageDisclosureSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN, "1");
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

/**
 * Re-arms the startup disclosure so it shows again next load. Used by
 * the Phase C "Reset" action (D-F): resetting the mirror folder clears
 * the handle and re-arms this disclosure, but never deletes existing
 * mirrored files.
 */
export const clearStorageDisclosureSeen = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

/**
 * Asks the browser to treat this origin's storage as non-evictable
 * under storage pressure. Never throws; safe to call from any browser,
 * including ones without the Storage API.
 */
export const requestPersistentStorage = async (): Promise<boolean | null> => {
  try {
    if (!navigator.storage?.persist) {
      return null;
    }
    return await navigator.storage.persist();
  } catch (error: any) {
    console.error(error);
    return null;
  }
};
