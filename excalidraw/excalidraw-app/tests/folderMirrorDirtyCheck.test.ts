import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { describe, expect, it } from "vitest";

import { computeMirrorVersionKey } from "../data/folderMirrorDirtyCheck";

describe("folder mirror dirty-check (Phase D)", () => {
  it("is stable across calls when nothing changed", () => {
    const elements = [API.createElement({ id: "a" })];

    expect(computeMirrorVersionKey(elements, {})).toBe(
      computeMirrorVersionKey(elements, {}),
    );
  });

  it("changes when an element's versionNonce changes", () => {
    const before = [API.createElement({ id: "a" })];
    const after = [{ ...before[0], versionNonce: before[0].versionNonce + 1 }];

    expect(computeMirrorVersionKey(before, {})).not.toBe(
      computeMirrorVersionKey(after, {}),
    );
  });

  it("changes when a file is added, even with identical elements", () => {
    const elements = [API.createElement({ id: "a" })];

    const withoutFile = computeMirrorVersionKey(elements, {});
    const withFile = computeMirrorVersionKey(elements, {
      // @ts-ignore -- only the key matters for this check
      "file-1": {},
    });

    expect(withoutFile).not.toBe(withFile);
  });

  it("is independent of file key order", () => {
    const elements = [API.createElement({ id: "a" })];
    const filesA = { "file-1": {}, "file-2": {} };
    const filesB = { "file-2": {}, "file-1": {} };

    // @ts-ignore -- only the keys matter for this check
    expect(computeMirrorVersionKey(elements, filesA)).toBe(
      // @ts-ignore
      computeMirrorVersionKey(elements, filesB),
    );
  });
});
