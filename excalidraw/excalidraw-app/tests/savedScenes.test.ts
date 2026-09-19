import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  createSaveLink,
  getSaveLinkData,
  isSaveLink,
  resolveSaveLink,
} from "../data/savedScenes";

// Minimal but realistic-enough fixtures — we're exercising the save/resolve
// round trip, not element geometry, so these don't need to be exhaustive.
const fakeElements = [
  {
    id: "rect1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  },
] as unknown as readonly ExcalidrawElement[];

const fakeAppState = {} as Partial<AppState>;

beforeEach(() => {
  localStorage.clear();
});

describe("savedScenes", () => {
  it("generates a save link that round-trips the scene", async () => {
    const link = await createSaveLink({
      elements: fakeElements,
      appState: fakeAppState,
      files: {},
    });

    expect(isSaveLink(link)).toBe(true);

    const linkData = getSaveLinkData(link);
    expect(linkData).not.toBeNull();

    const result = await resolveSaveLink(linkData!);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0]).toMatchObject({
        id: "rect1",
        type: "rectangle",
        width: 100,
        height: 100,
      });
    }
  });

  it("reopens a save link on what looks like a fresh browser (same store, cleared guest token)", async () => {
    const link = await createSaveLink({
      elements: fakeElements,
      appState: fakeAppState,
      files: {},
    });

    // Simulate the guest opening the link somewhere that doesn't already
    // carry their guest token (a different tab/session) — resolution must
    // not depend on the token still being present locally.
    localStorage.removeItem("excalidraw-guest-token");

    const result = await resolveSaveLink(getSaveLinkData(link)!);
    expect(result.status).toBe("ok");
  });

  it("invalidates the previous link when the same guest saves again", async () => {
    const firstLink = await createSaveLink({
      elements: fakeElements,
      appState: fakeAppState,
      files: {},
    });
    const firstLinkData = getSaveLinkData(firstLink)!;

    // Sanity check: the first link resolves before the guest saves again.
    expect((await resolveSaveLink(firstLinkData)).status).toBe("ok");

    // Same guest (same browser / localStorage), saves again — e.g. after
    // drawing more. This should mint a new link and retire the old one.
    const secondLink = await createSaveLink({
      elements: fakeElements,
      appState: fakeAppState,
      files: {},
    });
    const secondLinkData = getSaveLinkData(secondLink)!;

    expect(secondLink).not.toBe(firstLink);

    const staleResult = await resolveSaveLink(firstLinkData);
    expect(staleResult.status).toBe("superseded");

    const freshResult = await resolveSaveLink(secondLinkData);
    expect(freshResult.status).toBe("ok");
  });

  it("treats an unknown claim id as not found", async () => {
    const result = await resolveSaveLink({
      claimId: "does-not-exist",
      claimKey: "cccccccccccccccccccccc",
    });
    expect(result.status).toBe("not_found");
  });

  it("treats a wrong decryption key as not found rather than throwing", async () => {
    const link = await createSaveLink({
      elements: fakeElements,
      appState: fakeAppState,
      files: {},
    });
    const linkData = getSaveLinkData(link)!;

    const result = await resolveSaveLink({
      claimId: linkData.claimId,
      claimKey: "wrongwrongwrongwrongww",
    });

    expect(result.status).toBe("not_found");
  });

  it("isSaveLink/getSaveLinkData ignore unrelated hashes", () => {
    expect(isSaveLink("https://example.com/#room=abc,def")).toBe(false);
    expect(isSaveLink("https://example.com/")).toBe(false);
    expect(getSaveLinkData("https://example.com/#room=abc,def")).toBeNull();
  });
});
