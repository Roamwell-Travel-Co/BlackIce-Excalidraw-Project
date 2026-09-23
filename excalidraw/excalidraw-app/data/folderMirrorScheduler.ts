/**
 * PRD1 Phase D: when to attempt a mirror write. Pure timing policy --
 * knows nothing about dirty-checking, multi-tab guards, or disk I/O;
 * those live in the `attempt` callback the caller provides.
 *
 * Two modes (D-C, Decisions 010-011):
 * - Solo editing: a 3s debounce with a 15s max-wait ceiling, so
 *   continuous editing can't starve the debounce forever (3.4).
 * - Collaboration: a flat 15s periodic tick, dirty-gated by whatever
 *   the `attempt` callback does -- a change-triggered debounce would
 *   otherwise be driven into that same starvation ceiling almost
 *   continuously by N simultaneous editors (Decision 011).
 *
 * Single-flight (3.5): a trigger landing while a write is already in
 * progress is skipped, not queued -- the next trigger picks up the
 * latest state.
 */

export type MirrorAttempt = () => Promise<void>;

export type FolderMirrorSchedulerConfig = {
  /** Solo-editing debounce, ms. */
  debounceMs: number;
  /** Solo-editing starvation ceiling, ms. */
  maxWaitMs: number;
  /** Collaboration periodic tick, ms. */
  collabTickMs: number;
  setTimeout: (
    handler: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

// 3s/15s are still placeholders pending a real measurement (the
// review response's own §5 note); 15s for the collab tick is Decision
// 011's finalized figure, not a placeholder.
export const DEFAULT_SCHEDULER_CONFIG: Omit<
  FolderMirrorSchedulerConfig,
  "setTimeout" | "clearTimeout"
> = {
  debounceMs: 3_000,
  maxWaitMs: 15_000,
  collabTickMs: 15_000,
};

export class FolderMirrorScheduler {
  private attempt: MirrorAttempt;
  private config: FolderMirrorSchedulerConfig;
  private collaborating = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private collabTimer: ReturnType<typeof setTimeout> | null = null;
  private writeInFlight = false;

  constructor(
    attempt: MirrorAttempt,
    config: Partial<FolderMirrorSchedulerConfig> = {},
  ) {
    this.attempt = attempt;
    this.config = {
      ...DEFAULT_SCHEDULER_CONFIG,
      setTimeout: (handler, ms) => setTimeout(handler, ms),
      clearTimeout: (id) => clearTimeout(id),
      ...config,
    };
  }

  setCollaborating(collaborating: boolean): void {
    if (collaborating === this.collaborating) {
      return;
    }
    this.collaborating = collaborating;
    this.clearSoloTimers();
    if (collaborating) {
      this.scheduleCollabTick();
    } else {
      this.stopCollabTick();
    }
  }

  isCollaborating(): boolean {
    return this.collaborating;
  }

  /** Called on every scene change. */
  notifyChange(): void {
    if (this.collaborating) {
      // the periodic tick is already running; nothing to reschedule
      // per-change in collab mode.
      return;
    }
    this.scheduleDebounce();
  }

  /**
   * Immediate attempt, bypassing debounce/tick timing -- for leave-room
   * (the resumeSave("collaboration") call site, per §1.2) and
   * flush-on-visibilitychange/pagehide. The dirty-check inside
   * `attempt` still decides whether anything actually gets written.
   */
  async flush(): Promise<void> {
    this.clearSoloTimers();
    await this.runAttempt();
  }

  dispose(): void {
    this.clearSoloTimers();
    this.stopCollabTick();
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer) {
      this.config.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = this.config.setTimeout(() => {
      this.debounceTimer = null;
      this.clearMaxWait();
      void this.runAttempt();
    }, this.config.debounceMs);

    if (!this.maxWaitTimer) {
      this.maxWaitTimer = this.config.setTimeout(() => {
        this.maxWaitTimer = null;
        this.clearDebounce();
        void this.runAttempt();
      }, this.config.maxWaitMs);
    }
  }

  private scheduleCollabTick(): void {
    this.collabTimer = this.config.setTimeout(() => {
      void this.runAttempt().then(() => {
        if (this.collaborating) {
          this.scheduleCollabTick();
        }
      });
    }, this.config.collabTickMs);
  }

  private stopCollabTick(): void {
    if (this.collabTimer) {
      this.config.clearTimeout(this.collabTimer);
      this.collabTimer = null;
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      this.config.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearMaxWait(): void {
    if (this.maxWaitTimer) {
      this.config.clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }

  private clearSoloTimers(): void {
    this.clearDebounce();
    this.clearMaxWait();
  }

  private async runAttempt(): Promise<void> {
    if (this.writeInFlight) {
      return;
    }
    this.writeInFlight = true;
    try {
      await this.attempt();
    } finally {
      this.writeInFlight = false;
    }
  }
}
