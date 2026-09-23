import { Excalidraw } from "@excalidraw/excalidraw";
import {
  fireEvent,
  render,
  screen,
} from "@excalidraw/excalidraw/tests/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Provider } from "../app-jotai";
import { AppMainMenu } from "../components/AppMainMenu";

const rememberedCollaboration = {
  roomId: "room-1",
  roomKey: "key-1",
  createdAt: 100,
  lastUsedAt: 100,
  leftAt: null,
  secondSessionCountedAt: null,
  secondSessionWindowMissedAt: null,
};

const renderMenu = async (
  hasRememberedCollaboration: boolean,
  isCurrentCollaborationRemembered = false,
) => {
  const onJumpBackIn = vi.fn();
  const onForgetCollaboration = vi.fn();

  await render(
    <Provider>
      <Excalidraw>
        <AppMainMenu
          onCollabDialogOpen={vi.fn()}
          onJumpBackIn={onJumpBackIn}
          onForgetCollaboration={onForgetCollaboration}
          isCollaborating={false}
          isCollabEnabled={false}
          rememberedCollaboration={
            hasRememberedCollaboration ? rememberedCollaboration : null
          }
          isCurrentCollaborationRemembered={isCurrentCollaborationRemembered}
          theme="light"
          refresh={vi.fn()}
          onRestoreAutosavedScene={vi.fn()}
        />
      </Excalidraw>
    </Provider>,
  );

  fireEvent.click(screen.getByTestId("main-menu-trigger"));

  return { onJumpBackIn, onForgetCollaboration };
};

describe("AppMainMenu", () => {
  it("shows Jump Back In and Forget for a remembered collaboration", async () => {
    const { onJumpBackIn, onForgetCollaboration } = await renderMenu(true);

    fireEvent.click(screen.getByText("Jump Back In"));
    expect(onJumpBackIn).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByText("Delete Jump Back In collaboration"));
    expect(onForgetCollaboration).toHaveBeenCalledOnce();
  });

  it("hides remembered-collaboration actions when none exists", async () => {
    await renderMenu(false);

    expect(screen.queryByText("Jump Back In")).toBeNull();
    expect(screen.queryByText("Delete Jump Back In collaboration")).toBeNull();
  });

  it("hides Jump Back In when the remembered room is already open", async () => {
    const { onJumpBackIn, onForgetCollaboration } = await renderMenu(
      true,
      true,
    );

    expect(screen.queryByText("Jump Back In")).toBeNull();
    fireEvent.click(screen.getByText("Delete Jump Back In collaboration"));
    expect(onJumpBackIn).not.toHaveBeenCalled();
    expect(onForgetCollaboration).toHaveBeenCalledOnce();
  });
});
