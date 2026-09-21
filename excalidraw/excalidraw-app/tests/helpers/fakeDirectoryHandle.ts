/**
 * In-memory stand-in for the File System Access API's directory/file
 * handles, used by tests in place of the real native picker.
 *
 * Two reasons a fake, not OPFS, as suggested as an alternative in the
 * PRD1 review response: the real picker can't be automated regardless of
 * environment, and this project's test environment (jsdom) implements
 * neither the File System Access API nor OPFS at all -- verified
 * directly (no `showDirectoryPicker`, no `navigator.storage`).
 *
 * Implements the subset of FileSystemDirectoryHandle/FileSystemFileHandle
 * this codebase actually uses: `getDirectoryHandle`, `getFileHandle`,
 * `removeEntry`, `values`, `queryPermission`, `requestPermission`,
 * `createWritable`/`write`/`close`/`abort`, `getFile`.
 */

type PermissionMode = "read" | "readwrite";

export class FakeFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private content = "";

  constructor(name: string) {
    this.name = name;
  }

  async getFile(): Promise<{ text(): Promise<string> }> {
    const content = this.content;
    return { text: async () => content };
  }

  async createWritable(): Promise<FakeWritableStream> {
    return new FakeWritableStream(this);
  }

  /** Test-only helper, not part of the real API. */
  _setContent(content: string) {
    this.content = content;
  }
}

class FakeWritableStream {
  private handle: FakeFileHandle;
  private buffer = "";
  private aborted = false;

  constructor(handle: FakeFileHandle) {
    this.handle = handle;
  }

  async write(data: string): Promise<void> {
    if (this.aborted) {
      throw new DOMException("stream aborted", "InvalidStateError");
    }
    this.buffer += data;
  }

  async close(): Promise<void> {
    if (this.aborted) {
      throw new DOMException("stream aborted", "InvalidStateError");
    }
    this.handle._setContent(this.buffer);
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }
}

export class FakeDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;

  private dirs = new Map<string, FakeDirectoryHandle>();
  private files = new Map<string, FakeFileHandle>();
  private permissionState: PermissionState;

  constructor(name = "", permissionState: PermissionState = "granted") {
    this.name = name;
    this.permissionState = permissionState;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeDirectoryHandle> {
    let child = this.dirs.get(name);
    if (!child) {
      if (!options?.create) {
        throw new DOMException(
          `directory "${name}" not found`,
          "NotFoundError",
        );
      }
      child = new FakeDirectoryHandle(name, this.permissionState);
      this.dirs.set(name, child);
    }
    return child;
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeFileHandle> {
    let file = this.files.get(name);
    if (!file) {
      if (!options?.create) {
        throw new DOMException(`file "${name}" not found`, "NotFoundError");
      }
      file = new FakeFileHandle(name);
      this.files.set(name, file);
    }
    return file;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw new DOMException(`"${name}" not found`, "NotFoundError");
    }
  }

  async *values(): AsyncIterableIterator<FakeDirectoryHandle | FakeFileHandle> {
    yield* this.dirs.values();
    yield* this.files.values();
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
    return this.dirs.has(name);
  }

  /** Test-only helper, not part of the real API. */
  _fileNames(): string[] {
    return [...this.files.keys()];
  }
}

/**
 * The fake only implements the subset of the real API this codebase
 * actually uses (see class comments above), so this cast is the
 * intentional seam between the fake and the real type -- not a mistake
 * to "fix" by broadening the fake to the full API.
 */
export const asDirectoryHandle = (
  fake: FakeDirectoryHandle,
): FileSystemDirectoryHandle => fake as unknown as FileSystemDirectoryHandle;
