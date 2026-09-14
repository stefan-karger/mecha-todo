import { expect, test } from "@playwright/test";
import {
  DELETE_UNDO_WINDOW_MS,
  DeleteUndoController,
} from "../../src/app/delete-undo";
import type { TodoRecord } from "../../src/persistence/models";

function todo(id: string): TodoRecord {
  return {
    id,
    text: `Task ${id}`,
    status: "active",
    creationOrder: 0,
    completionOrder: null,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
  };
}

function fakeScheduler() {
  let nextHandle = 0;
  const callbacks = new Map<number, () => void>();
  const delays = new Map<number, number>();

  return {
    callbacks,
    delays,
    scheduler: {
      setTimeout(callback: () => void, delay: number) {
        nextHandle += 1;
        callbacks.set(nextHandle, callback);
        delays.set(nextHandle, delay);
        return nextHandle;
      },
      clearTimeout(handle: number) {
        callbacks.delete(handle);
        delays.delete(handle);
      },
    },
  };
}

test("keeps only the latest deleted todo for exactly five seconds", async () => {
  const fake = fakeScheduler();
  const controller = new DeleteUndoController(fake.scheduler);

  controller.offer(todo("first"));
  controller.offer(todo("second"));

  expect(controller.hasPendingUndo).toBe(true);
  expect([...fake.delays.values()]).toEqual([DELETE_UNDO_WINDOW_MS]);

  const expiry = [...fake.callbacks.values()][0];
  expiry?.();

  expect(controller.hasPendingUndo).toBe(false);
  expect(await controller.undo(async () => "restored")).toBeNull();
});

test("drops the snapshot before a successful or rejected Undo resolves", async () => {
  const fake = fakeScheduler();
  const controller = new DeleteUndoController(fake.scheduler);
  controller.offer(todo("success"));

  const success = await controller.undo(async (snapshot) => {
    expect(controller.hasPendingUndo).toBe(false);
    return snapshot.id;
  });

  expect(success).toBe("success");
  expect(controller.hasPendingUndo).toBe(false);

  controller.offer(todo("rejected"));
  const rejected = await controller.undo(async () => ({
    ok: false,
    category: "changed-in-another-tab",
  }));

  expect(rejected).toEqual({ ok: false, category: "changed-in-another-tab" });
  expect(controller.hasPendingUndo).toBe(false);
});

test("clear drops the page-owned snapshot", () => {
  const fake = fakeScheduler();
  const controller = new DeleteUndoController(fake.scheduler);
  controller.offer(todo("page-close"));

  controller.clear();

  expect(controller.hasPendingUndo).toBe(false);
  expect(fake.callbacks.size).toBe(0);
});
