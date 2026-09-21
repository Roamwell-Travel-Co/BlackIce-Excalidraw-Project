import { render, screen, waitFor } from "@testing-library/react";
import { DropdownMenu } from "radix-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutosavePreferencesItems } from "../components/AutosavePreferencesItems";
import { clearStoredMirrorDirectoryHandle } from "../data/folderMirror";

import type { ReactElement } from "react";

// AutosavePreferencesItems renders Radix DropdownMenu.Item-based
// components, which throw outside a DropdownMenu.Root/Content ancestor
// (the real app always provides one, via the Preferences submenu).
// `forceMount` renders Content without needing to actually open the menu.
const renderInMenu = (ui: ReactElement) =>
  render(
    <DropdownMenu.Root open>
      <DropdownMenu.Trigger />
      <DropdownMenu.Content forceMount>{ui}</DropdownMenu.Content>
    </DropdownMenu.Root>,
  );

describe("AutosavePreferencesItems (smoke)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    await clearStoredMirrorDirectoryHandle();
    // @ts-ignore -- test-only cleanup
    delete window.showDirectoryPicker;
  });

  it("renders nothing when the browser has no directory picker", async () => {
    const { container } = renderInMenu(<AutosavePreferencesItems />);

    // give the status-loading effect a tick to settle -- it should still
    // render nothing, since the capability check short-circuits first.
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("shows the browser-only status once a picker is available", async () => {
    // @ts-ignore -- simulating a supporting browser
    window.showDirectoryPicker = vi.fn();

    renderInMenu(<AutosavePreferencesItems />);

    expect(
      await screen.findByText(/Autosaving to disk: Browser only/),
    ).toBeTruthy();
  });
});
