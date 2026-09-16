import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const draftKey = "mecha-todo:composer-draft:v1";

test("renders opening, blocked-upgrade, and local-data failure states without task mutations", async ({
  page,
}) => {
  await renderWithStartup(page, "opening");
  await expect(page.getByText("Opening local data...")).toBeVisible();
  await expect(page.getByText("No active tasks. Add one when you are ready.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);

  await renderWithStartup(page, "blocked");
  await expect(page.getByText("Close MECHA//TODO in other tabs, then retry.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);

  await renderWithStartup(page, "local-data");
  await expect(page.getByRole("heading", { name: "Local data could not be opened." })).toBeVisible();
  await expect(page.getByText("Error: invalid-todo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Erase local data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
});

test("restores, validates, commits, and clears the persistent composer draft", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, "Resume calibration"), draftKey);
  await page.reload();

  const input = page.getByRole("textbox", { name: "New task" });
  await expect(input).toHaveValue("Resume calibration");
  await input.fill(" \n\t ");
  await input.press("Enter");
  await expect(page.locator("#composer-error")).toHaveText("Enter a task.");
  await expect(page.getByRole("status")).toHaveText("Enter a task.");
  await expect(page.locator(".todo-row")).toHaveCount(0);

  await input.fill("Calibrate left arm");
  await input.press("Enter");
  await expect(page.locator(".active-bay .todo-text")).toHaveText("Calibrate left arm");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();

  await input.fill("Calibrate left arm");
  await input.press("Enter");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(2);

  await input.fill("Unfinished relay check");
  await page.reload();
  await expect(input).toHaveValue("Unfinished relay check");
  await expect(page.locator(".active-bay .todo-row")).toHaveCount(2);
});

test("keeps todo creation usable when local storage throws", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.goto("/");

  const input = page.getByRole("textbox", { name: "New task" });
  await input.fill("Works without draft storage");
  await input.press("Enter");
  await expect(page.locator(".active-bay .todo-row")).toContainText(
    "Works without draft storage",
  );
});

test("may dismiss the composer after a coarse-pointer add", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query !== "(pointer: coarse)") return nativeMatchMedia(query);
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      };
    };
  });
  await page.goto("/");

  const input = page.getByRole("textbox", { name: "New task" });
  await input.fill("Dismiss keyboard");
  await input.press("Enter");
  await expect(page.locator(".active-bay .todo-row")).toContainText("Dismiss keyboard");
  await expect(input).not.toBeFocused();
});

test("places overflow in Standby and collapses disclosures again after reload", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "New task" });

  for (let index = 1; index <= 9; index += 1) {
    await input.fill(`Task ${index}`);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }

  await expect(page.locator(".active-bay .todo-row")).toHaveCount(8);
  await expect(page.getByRole("status")).toHaveText("ADDED TO STANDBY");
  const standby = page.getByRole("button", { name: /Standby 1/ });
  await expect(standby).toHaveAttribute("aria-expanded", "false");
  await standby.click();
  await expect(page.locator("#standby-tasks .todo-row")).toContainText("Task 9");

  await page.reload();
  await expect(page.getByRole("button", { name: /Standby 1/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#standby-tasks")).toHaveCount(0);
});

test("pages Standby oldest first and Completed newest first", async ({ page }) => {
  await page.goto("/");
  await seedHistory(page, 21, 21);
  await page.reload();

  const standby = page.getByRole("button", { name: /Standby 21/ });
  const completed = page.getByRole("button", { name: /Completed 21/ });
  await expect(standby).toHaveAttribute("aria-expanded", "false");
  await expect(completed).toHaveAttribute("aria-expanded", "false");

  await standby.click();
  await expect(page.locator("#standby-tasks .todo-row")).toHaveCount(20);
  await expect(page.locator("#standby-tasks .todo-row").first()).toContainText("Standby 0");
  await expect(page.locator("#standby-tasks .todo-row").last()).toContainText("Standby 19");
  await page.getByRole("button", { name: "Show 20 more" }).click();
  await expect(page.locator("#standby-tasks .todo-row")).toHaveCount(21);
  await expect(page.locator("#standby-tasks .todo-row").last()).toContainText("Standby 20");

  await completed.click();
  await expect(page.locator("#completed-tasks .todo-row")).toHaveCount(20);
  await expect(page.locator("#completed-tasks .todo-row").first()).toContainText("Completed 20");
  await expect(page.locator("#completed-tasks .todo-row").last()).toContainText("Completed 1");
  await page.getByRole("button", { name: "Show 20 older" }).click();
  await expect(page.locator("#completed-tasks .todo-row")).toHaveCount(21);
  await expect(page.locator("#completed-tasks .todo-row").last()).toContainText("Completed 0");

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);
});

test("does not offer another page for exactly 20 Standby records", async ({ page }) => {
  await page.goto("/");
  await seedHistory(page, 20, 0);
  await page.reload();

  await page.getByRole("button", { name: /Standby 20/ }).click();
  await expect(page.locator("#standby-tasks .todo-row")).toHaveCount(20);
  await expect(page.getByRole("button", { name: "Show 20 more" })).toHaveCount(0);
});

test("confirmed local-data erasure clears the composer draft", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async (key) => {
    localStorage.setItem(key, "Discard this draft");
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase("mecha-todo");
      deletion.onsuccess = () => resolve();
      deletion.onerror = () => reject(deletion.error);
    });
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("mecha-todo", 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore("unexpected");
      opening.onsuccess = () => {
        opening.result.close();
        resolve();
      };
      opening.onerror = () => reject(opening.error);
    });
  }, draftKey);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Local data could not be opened." })).toBeVisible();
  await page.getByRole("button", { name: "Erase local data" }).click();
  const dialog = page.getByRole("dialog", { name: "Erase local data?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Erase local data" }).click();
  await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue("");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
});

async function renderWithStartup(
  page: Page,
  state: "opening" | "blocked" | "local-data",
): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (requestedState) => {
    const fixturePath = "/tests/fixtures/mount-app.ts";
    const { mountApp } = await import(fixturePath);

    const initialize = () => {
      if (requestedState === "opening") return new Promise(() => undefined);
      if (requestedState === "blocked") {
        return Promise.resolve({
          ok: false as const,
          category: "blocked" as const,
          message: "Close MECHA//TODO in other tabs, then retry.",
          retryable: true as const,
        });
      }
      return Promise.resolve({
        ok: false as const,
        category: "local-data" as const,
        technicalCategory: "invalid-todo" as const,
        message: "Local data could not be opened." as const,
        retryable: true as const,
      });
    };

    const repository = {
      initialize,
      getProjection: async () => {
        throw new Error("Not used");
      },
      getSummaryProjection: async () => {
        throw new Error("Not used");
      },
      getTodoPage: async () => ({ items: [], hasMore: false, nextCursor: null }),
      addTodo: async () => {
        throw new Error("Not used");
      },
      editTodo: async () => {
        throw new Error("Not used");
      },
      setTodoCompleted: async () => {
        throw new Error("Not used");
      },
      deleteTodo: async () => {
        throw new Error("Not used");
      },
      restoreDeletedTodo: async () => {
        throw new Error("Not used");
      },
      eraseLocalData: async () => {
        throw new Error("Not used");
      },
      close: () => undefined,
    };
    mountApp(repository);
  }, state);
}

async function seedHistory(page: Page, standbyCount: number, completedCount: number): Promise<void> {
  await page.evaluate(
    async ({ completedCount: completedTotal, standbyCount: standbyTotal }) => {
      const databasePath = "/src/persistence/db.ts";
      const { openVersionedDatabase } = await import(databasePath);
      await new Promise<void>((resolve, reject) => {
        const deletion = indexedDB.deleteDatabase("mecha-todo");
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => reject(deletion.error);
      });
      const opened = await openVersionedDatabase({ name: "mecha-todo", createdAt: 0 });
      if (!opened.ok) throw new Error(opened.category);

      const transaction = opened.database.transaction(
        ["todos", "completionAwards", "meta"],
        "readwrite",
      );
      const todos = transaction.objectStore("todos");
      const awards = transaction.objectStore("completionAwards");
      const meta = transaction.objectStore("meta");

      for (let index = 0; index < standbyTotal; index += 1) {
        await todos.add({
          id: `standby-${String(index).padStart(2, "0")}`,
          text: `Standby ${index}`,
          status: "standby",
          creationOrder: index,
          completionOrder: null,
          createdAt: index,
          updatedAt: index,
          completedAt: null,
        });
      }

      for (let index = 0; index < completedTotal; index += 1) {
        const id = `completed-${String(index).padStart(2, "0")}`;
        const timestamp = 100 + index;
        await todos.add({
          id,
          text: `Completed ${index}`,
          status: "completed",
          creationOrder: standbyTotal + index,
          completionOrder: index,
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: timestamp,
        });
        await awards.add({
          todoId: id,
          awardedAt: timestamp,
          dayKey: `2026-01-${String(index + 1).padStart(2, "0")}`,
          dailyOrdinal: 1,
          baseXp: 10,
          linkBonus: 0,
          comboBonus: 0,
          totalXp: 10,
          rulesVersion: 1,
        });
      }

      await Promise.all([
        meta.put({
          key: "core",
          createdAt: 0,
          rulesVersion: 1,
          nextCreationOrder: standbyTotal + completedTotal,
          nextCompletionOrder: completedTotal,
        }),
        meta.put({
          key: "derived-stats",
          lifetimeXp: completedTotal * 10,
          awardCount: completedTotal,
        }),
      ]);
      await transaction.done;
      opened.database.close();
    },
    { completedCount, standbyCount },
  );
}
