import { bytesToHexString } from "@excalidraw/common";
import {
  compressData,
  decompressData,
} from "@excalidraw/excalidraw/data/encode";
import { generateEncryptionKey } from "@excalidraw/excalidraw/data/encryption";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

type RestoredAppState = ReturnType<typeof restoreAppState>;

/**
 * ---------------------------------------------------------------------------
 * "Save my work" — mocked persistence layer
 * ---------------------------------------------------------------------------
 * This is a demo/prototype stand-in for a real backend endpoint. It's written
 * against a small, deliberately server-shaped API (create / resolve, plus a
 * guest-token helper) so that swapping in a real HTTP API later means
 * rewriting this one file, not any of its callers.
 *
 * WHAT'S REAL: the link format (`#saved=<claimId>,<claimKey>`) mirrors the
 * app's existing `#room=` and `#json=` hash-link conventions, and reuses the
 * same encryption/compression primitives the real "shareable link" export
 * feature uses (see ../data/index.ts's exportToBackend/importFromBackend).
 * The server never sees the key — it lives only in the URL fragment, which
 * browsers don't send to servers.
 *
 * WHAT'S FAKED: there is no server. "Claims" are written to this browser's
 * localStorage standing in for a database table. That means a save link only
 * resolves on the *same browser* it was created on — pasting it into another
 * device or browser (or a private window) will correctly show a
 * "link not found" state, not the saved scene. A real implementation would
 * POST to an API and the link would work from anywhere.
 * ---------------------------------------------------------------------------
 */

const GUEST_TOKEN_STORAGE_KEY = "excalidraw-guest-token";
const CLAIM_STORAGE_PREFIX = "excalidraw-saved-scene:";
const LATEST_CLAIM_STORAGE_PREFIX = "excalidraw-guest-latest-claim:";

const CLAIM_ID_BYTES = 10;

const randomToken = (bytes: number) => {
  const buffer = new Uint8Array(bytes);
  window.crypto.getRandomValues(buffer);
  return bytesToHexString(buffer);
};

// base64 helpers that don't blow the call stack on large scenes (avoids
// `String.fromCharCode(...bigArray)` spreading the whole array as arguments).
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// ---------------------------------------------------------------------------
// guest identity
// ---------------------------------------------------------------------------

/**
 * A guest token identifies "this browser" so we know which claim to
 * supersede when the same guest saves again. It is NOT a verified identity —
 * anyone can carry it, forge it, or lose it by clearing site data. That's an
 * acceptable trade-off for an anonymous, no-signup save link, and is called
 * out here explicitly since a real implementation would need a
 * server-verified session instead.
 */
export const getOrCreateGuestToken = (): string => {
  try {
    const existing = localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
    if (existing) {
      return existing;
    }
  } catch (error: any) {
    console.error(error);
  }

  const token = randomToken(16);
  try {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
  } catch (error: any) {
    console.error(error);
  }
  return token;
};

/**
 * Adopts an existing guest token as "this browser's" — used when reopening a
 * save link, so a later "Save my work" click from the resumed scene
 * supersedes *that* lineage instead of starting an unrelated one.
 */
const adoptGuestToken = (guestToken: string) => {
  try {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestToken);
  } catch (error: any) {
    console.error(error);
  }
};

const getLatestClaimId = (guestToken: string): string | null => {
  try {
    return localStorage.getItem(LATEST_CLAIM_STORAGE_PREFIX + guestToken);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

const setLatestClaimId = (guestToken: string, claimId: string) => {
  try {
    localStorage.setItem(LATEST_CLAIM_STORAGE_PREFIX + guestToken, claimId);
  } catch (error: any) {
    console.error(error);
  }
};

// ---------------------------------------------------------------------------
// claim store (the "mocked database")
// ---------------------------------------------------------------------------

type StoredClaim = {
  claimId: string;
  guestToken: string;
  createdAt: number;
  superseded: boolean;
  /** base64 of the compressed + encrypted scene payload */
  payload: string;
};

const claimStorageKey = (claimId: string) => CLAIM_STORAGE_PREFIX + claimId;

const readClaim = (claimId: string): StoredClaim | null => {
  try {
    const raw = localStorage.getItem(claimStorageKey(claimId));
    return raw ? (JSON.parse(raw) as StoredClaim) : null;
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

const writeClaim = (claim: StoredClaim) => {
  localStorage.setItem(claimStorageKey(claim.claimId), JSON.stringify(claim));
};

/** Marks a guest's previously-saved claim (if any) as superseded. */
const invalidatePreviousClaim = (guestToken: string) => {
  const previousClaimId = getLatestClaimId(guestToken);
  if (!previousClaimId) {
    return;
  }
  const previousClaim = readClaim(previousClaimId);
  if (previousClaim && !previousClaim.superseded) {
    writeClaim({ ...previousClaim, superseded: true });
  }
};

// ---------------------------------------------------------------------------
// link encode/decode
// ---------------------------------------------------------------------------

export type SaveLinkData = { claimId: string; claimKey: string };

const RE_SAVE_LINK = /^#saved=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/;

export const isSaveLink = (link: string): boolean => {
  try {
    return RE_SAVE_LINK.test(new URL(link).hash);
  } catch (error: any) {
    return false;
  }
};

export const getSaveLinkData = (link: string): SaveLinkData | null => {
  try {
    const match = new URL(link).hash.match(RE_SAVE_LINK);
    return match ? { claimId: match[1], claimKey: match[2] } : null;
  } catch (error: any) {
    return null;
  }
};

const getSaveLink = ({ claimId, claimKey }: SaveLinkData): string =>
  `${window.location.origin}${window.location.pathname}#saved=${claimId},${claimKey}`;

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * Claims the current scene for this guest and returns a magic link back to
 * it. Regenerates on every call: the guest's previous claim (if any) is
 * marked superseded, so a guest always has exactly one valid link — their
 * latest. Reopening an older, superseded link resolves to "no longer valid"
 * rather than silently serving stale content.
 */
export const createSaveLink = async ({
  elements,
  appState,
  files,
}: {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}): Promise<string> => {
  const guestToken = getOrCreateGuestToken();
  const claimId = randomToken(CLAIM_ID_BYTES);
  const claimKey = await generateEncryptionKey("string");

  const json = serializeAsJSON(elements, appState, files, "database");
  const payload = await compressData(new TextEncoder().encode(json), {
    encryptionKey: claimKey,
  });

  invalidatePreviousClaim(guestToken);

  writeClaim({
    claimId,
    guestToken,
    createdAt: Date.now(),
    superseded: false,
    payload: bytesToBase64(payload),
  });
  setLatestClaimId(guestToken, claimId);

  return getSaveLink({ claimId, claimKey });
};

export type ResolvedSaveLink =
  | {
      status: "ok";
      elements: ExcalidrawElement[];
      appState: RestoredAppState;
      files: BinaryFileData[];
    }
  | { status: "not_found" }
  | { status: "superseded" };

/**
 * Resolves a save link back into a scene. Also adopts the claim's guest
 * token as this browser's own, so continuing to edit and saving again
 * supersedes *this* claim rather than starting an unrelated lineage.
 */
export const resolveSaveLink = async ({
  claimId,
  claimKey,
}: SaveLinkData): Promise<ResolvedSaveLink> => {
  const claim = readClaim(claimId);
  if (!claim) {
    return { status: "not_found" };
  }
  if (claim.superseded) {
    return { status: "superseded" };
  }

  try {
    const { data } = await decompressData(base64ToBytes(claim.payload), {
      decryptionKey: claimKey,
    });
    const imported = JSON.parse(new TextDecoder().decode(data));

    adoptGuestToken(claim.guestToken);
    setLatestClaimId(claim.guestToken, claim.claimId);

    return {
      status: "ok",
      elements: restoreElements(imported.elements ?? [], null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      }),
      appState: restoreAppState(imported.appState ?? null, null),
      files: Object.values(imported.files ?? {}),
    };
  } catch (error: any) {
    // Wrong/corrupted key, or the stored payload was tampered with — treat
    // the same as "not found" rather than surfacing a decryption error.
    console.error("Failed to decrypt saved scene link", error);
    return { status: "not_found" };
  }
};
