// Not @excalidraw/excalidraw/tests/test-utils -- its `render` waits for a
// canvas element that this standalone (non-Excalidraw) component never
// renders.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import { StorageDisclosureBanner } from "../components/StorageDisclosureBanner";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@excalidraw/excalidraw/analytics", () => ({ trackEvent }));

describe("StorageDisclosureBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    trackEvent.mockReset();
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

    render(<StorageDisclosureBanner />);

    expect(
      screen.getByText(/Excalidraw saves your data within the browser cache/),
    ).toBeTruthy();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure shown");
  });

  it("does not render again once the disclosure has been seen", async () => {
    localStorage.setItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN, "1");

    render(<StorageDisclosureBanner />);

    expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy();
  });

  it("dismissing hides the banner and marks the disclosure seen", async () => {
    render(<StorageDisclosureBanner />);

    fireEvent.click(screen.getByTitle("Dismiss"));

    expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN)).toBe(
      "1",
    );
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure dismissed");
  });

  it("clicking through the save-elsewhere link also dismisses the banner", async () => {
    render(<StorageDisclosureBanner />);

    fireEvent.click(screen.getByText("click here"));

    expect(screen.queryByText(/Excalidraw saves your data/)).not.toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.STORAGE_DISCLOSURE_SEEN)).toBe(
      "1",
    );
    expect(trackEvent).toHaveBeenCalledWith("autosave", "disclosure accepted");
  });
});
