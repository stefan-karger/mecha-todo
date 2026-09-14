import type { TodoRecord } from "../persistence/models";

export const DELETE_UNDO_WINDOW_MS = 5_000;

type TimerHandle = ReturnType<typeof setTimeout>;

type UndoScheduler = Readonly<{
  setTimeout: (callback: () => void, delay: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}>;

export class DeleteUndoController {
  readonly #scheduler: UndoScheduler;
  #snapshot: TodoRecord | null = null;
  #expiryTimer: TimerHandle | null = null;

  constructor(
    scheduler: UndoScheduler = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    },
  ) {
    this.#scheduler = scheduler;
  }

  get hasPendingUndo(): boolean {
    return this.#snapshot !== null;
  }

  offer(snapshot: TodoRecord): void {
    this.clear();
    this.#snapshot = snapshot;
    this.#expiryTimer = this.#scheduler.setTimeout(() => {
      this.#snapshot = null;
      this.#expiryTimer = null;
    }, DELETE_UNDO_WINDOW_MS);
  }

  async undo<TResult>(restore: (snapshot: TodoRecord) => Promise<TResult>): Promise<TResult | null> {
    const snapshot = this.#snapshot;
    if (!snapshot) {
      return null;
    }

    this.clear();
    return restore(snapshot);
  }

  clear(): void {
    if (this.#expiryTimer !== null) {
      this.#scheduler.clearTimeout(this.#expiryTimer);
    }
    this.#snapshot = null;
    this.#expiryTimer = null;
  }
}
