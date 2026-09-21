/**
 * In-memory stand-in for the File System Access API's directory handle,
 * used by tests in place of the real native picker.
 *
 * Two reasons a fake, not OPFS, as suggested as an alternative in the
 * PRD1 review response: the real picker can't be automated regardless of
 * environment, and this project's test environment (jsdom) implements
 * neither the File System Access API nor OPFS at all -- verified
 * directly (no `showDirectoryPicker`, no `navigator.storage`).
 *
 * Implements only the subset of FileSystemDirectoryHandle this codebase
 * actually uses: `getDirectoryHandle`, `queryPermission`,
 * `requestPermission`.
 */

type PermissionMode = "read" | "readwrite";

export class FakeDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;

  private children = new Map<string, FakeDirectoryHandle>();
  private permissionState: PermissionState;

  constructor(name = "", permissionState: PermissionState = "granted") {
    this.name = name;
    this.permissionState = permissionState;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeDirectoryHandle> {
    let child = this.children.get(name);
    if (!child) {
      if (!options?.create) {
        throw new DOMException(
          `directory "${name}" not found`,
          "NotFoundError",
        );
      }
      child = new FakeDirectoryHandle(name, this.permissionState);
      this.children.set(name, child);
    }
    return child;
  }

  async queryPermission(_opts: {
    mode: PermissionMode;
  }): Promise<PermissionState> {
    return this.permissionState;
  }

  async requestPermission(_opts: {
    mode: PermissionMode;
  }): Promise<PermissionState> {
    return this.permissionState;
  }

  /** Test-only helper, not part of the real API. */
  _setPermissionState(state: PermissionState) {
    this.permissionState = state;
  }

  /** Test-only helper, not part of the real API. */
  _hasChild(name: string): boolean {
    return this.children.has(name);
  }
}

/**
 * The fake only implements the subset of FileSystemDirectoryHandle this
 * codebase actually uses (see class comment above), so this cast is the
 * intentional seam between the fake and the real type -- not a mistake
 * to "fix" by broadening the fake to the full API.
 */
export const asDirectoryHandle = (
  fake: FakeDirectoryHandle,
): FileSystemDirectoryHandle => fake as unknown as FileSystemDirectoryHandle;
