// Not @excalidraw/excalidraw/tests/test-utils -- its `render` waits for a
// canvas element that this standalone (non-Excalidraw) component never
// renders.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import { StorageDisclosureBanner } from "../components/StorageDisclosureBanner";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@excalidraw/excalidraw/analytics", () => ({ trackEvent }));

const { chooseOrChangeMirrorFolder } = vi.hoisted(() => ({
  chooseOrChangeMirrorFolder: vi.fn(),
}));
vi.mock("../data/folderMirrorSettings", () => ({
  chooseOrChangeMirrorFolder,
  restorePriorSnapshot: vi.fn(),
}));

describe("StorageDisclosureBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    trackEvent.mockReset();
    chooseOrChangeMirrorFolder.mockReset();
  });

  afterEach(() => {
    // @ts-ignore -- test-only cleanup of a property we defined below
    delete navigator.storage;
  });

  it("shows the disclosure on first load and requests persistent storage", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist },
    });

    render(<StorageDisclosureBanner onRestoreScene={vi.fn()} />);

    expect(
      screen.getByText(/Excalidraw saves your data within the browser cache/),
    ).toBeTruthy();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure shown");
  });

  it("does not render again once the disclosure has been seen", async () => {
    localStorage.setItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN, "1");

    render(<StorageDisclosureBanner onRestoreScene={vi.fn()} />);

    expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy();
  });

  it("dismissing hides the banner and marks the disclosure seen", async () => {
    render(<StorageDisclosureBanner onRestoreScene={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Dismiss"));

    expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN)).toBe(
      "1",
    );
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure dismissed");
  });

  it("clicking through opens the real folder picker and dismisses on success", async () => {
    chooseOrChangeMirrorFolder.mockResolvedValue({
      folderName: "BlackIce Backups",
      priorSnapshot: null,
    });
    const onAutosaveStateChanged = vi.fn();
    render(
      <StorageDisclosureBanner
        onRestoreScene={vi.fn()}
        onAutosaveStateChanged={onAutosaveStateChanged}
      />,
    );

    fireEvent.click(screen.getByText("click here"));

    await waitFor(() =>
      expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy(),
    );
    expect(chooseOrChangeMirrorFolder).toHaveBeenCalledTimes(1);
    expect(onAutosaveStateChanged).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN)).toBe(
      "1",
    );
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure accepted");
    expect(trackEvent).toHaveBeenCalledWith("autosave", "location chosen");
  });

  it("leaves the banner open if the native picker is cancelled", async () => {
    chooseOrChangeMirrorFolder.mockResolvedValue(null);

    render(<StorageDisclosureBanner onRestoreScene={vi.fn()} />);

    fireEvent.click(screen.getByText("click here"));

    await waitFor(() =>
      expect(chooseOrChangeMirrorFolder).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByText(/Excalidraw saves your data within the browser cache/),
    ).toBeTruthy();
    expect(
      localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN),
    ).toBeNull();
  });
});
