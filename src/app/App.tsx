import { For, Show, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { PRODUCT_NAME } from "../config/product";
import { loadComposerDraft, saveComposerDraft } from "../persistence/composer-draft";
import type { TodoRecord, TodoStatus } from "../persistence/models";
import { DeleteUndoController } from "./delete-undo";
import {
  IndexedDbAppRepository,
  TODO_PAGE_SIZE,
  type AppProjection,
  type AppRepository,
  type LocalDataTechnicalCategory,
  type TodoPageCursor,
} from "../persistence/repository";

type ReadyState = Readonly<{ kind: "ready"; projection: AppProjection }>;
type ApplicationState =
  | Readonly<{ kind: "opening" }>
  | ReadyState
  | Readonly<{ kind: "blocked"; message: string }>
  | Readonly<{
      kind: "local-data-error";
      technicalCategory: LocalDataTechnicalCategory;
    }>;

type AppProps = Readonly<{ repository?: AppRepository }>;
type BrowseStatus = "standby" | "completed";
type EditState = Readonly<{ id: string; draft: string; error: string; saving: boolean }>;

const COMPLETION_HOLD_MS = 240;

export function App(props: AppProps = {}) {
  const repository = props.repository ?? new IndexedDbAppRepository();
  const [state, setState] = createSignal<ApplicationState>({ kind: "opening" });
  const [draft, setDraft] = createSignal(loadComposerDraft());
  const [composerError, setComposerError] = createSignal("");
  const [feedback, setFeedback] = createSignal("");
  const [adding, setAdding] = createSignal(false);
  const [erasing, setErasing] = createSignal(false);
  const [editState, setEditState] = createSignal<EditState | null>(null);
  const [pendingCompletionIds, setPendingCompletionIds] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  const [optimisticStatuses, setOptimisticStatuses] = createSignal<
    Readonly<Record<string, TodoStatus>>
  >({});
  const [pendingDeleteIds, setPendingDeleteIds] = createSignal<ReadonlySet<string>>(new Set());
  const [undoAvailable, setUndoAvailable] = createSignal(false);
  const deleteUndo = new DeleteUndoController(undefined, setUndoAvailable);

  const [standbyOpen, setStandbyOpen] = createSignal(false);
  const [standbyItems, setStandbyItems] = createSignal<TodoRecord[]>([]);
  const [standbyCursor, setStandbyCursor] = createSignal<TodoPageCursor | null>(null);
  const [standbyHasMore, setStandbyHasMore] = createSignal(false);
  const [standbyLoading, setStandbyLoading] = createSignal(false);

  const [completedOpen, setCompletedOpen] = createSignal(false);
  const [completedItems, setCompletedItems] = createSignal<TodoRecord[]>([]);
  const [completedCursor, setCompletedCursor] = createSignal<TodoPageCursor | null>(null);
  const [completedHasMore, setCompletedHasMore] = createSignal(false);
  const [completedLoading, setCompletedLoading] = createSignal(false);

  let composerInput: HTMLInputElement | undefined;
  let eraseDialog: HTMLDialogElement | undefined;

  const openApplication = async (): Promise<void> => {
    setState({ kind: "opening" });
    setFeedback("");
    const result = await repository.initialize({ summaryOnly: true });

    if (result.ok) {
      setState({ kind: "ready", projection: result.projection });
      return;
    }

    if (result.category === "blocked") {
      setState({ kind: "blocked", message: result.message });
      return;
    }

    setState({ kind: "local-data-error", technicalCategory: result.technicalCategory });
  };

  queueMicrotask(() => void openApplication());
  onCleanup(() => {
    deleteUndo.clear();
    repository.close();
  });

  const resetBrowseState = (): void => {
    setStandbyOpen(false);
    setStandbyItems([]);
    setStandbyCursor(null);
    setStandbyHasMore(false);
    setCompletedOpen(false);
    setCompletedItems([]);
    setCompletedCursor(null);
    setCompletedHasMore(false);
  };

  const loadPage = async (status: BrowseStatus, append: boolean): Promise<void> => {
    const setLoading = status === "standby" ? setStandbyLoading : setCompletedLoading;
    const cursor = status === "standby" ? standbyCursor() : completedCursor();
    const setItems = status === "standby" ? setStandbyItems : setCompletedItems;
    const setCursor = status === "standby" ? setStandbyCursor : setCompletedCursor;
    const setHasMore = status === "standby" ? setStandbyHasMore : setCompletedHasMore;

    setLoading(true);
    try {
      const page = await repository.getTodoPage(status, append ? cursor ?? undefined : undefined);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setFeedback("Tasks could not be loaded. Retry.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBrowse = (status: BrowseStatus, count: number): void => {
    const isOpen = status === "standby" ? standbyOpen() : completedOpen();
    const setOpen = status === "standby" ? setStandbyOpen : setCompletedOpen;
    setOpen(!isOpen);
    if (!isOpen && count > 0) void loadPage(status, false);
  };

  const focusRowAction = (id: string, action: "toggle" | "delete" | "edit"): void => {
    queueMicrotask(() => {
      const element = [...document.querySelectorAll<HTMLElement>(`[data-todo-${action}]`)].find(
        (candidate) => candidate.dataset[`todo${action[0].toUpperCase()}${action.slice(1)}`] === id,
      );
      element?.focus();
    });
  };

  const updateLoadedTodo = (todo: TodoRecord): void => {
    const replace = (items: TodoRecord[]) =>
      items.map((item) => (item.id === todo.id ? todo : item));
    setStandbyItems(replace);
    setCompletedItems(replace);
  };

  const reloadBrowseStatus = async (status: BrowseStatus): Promise<void> => {
    const isOpen = untrack(status === "standby" ? standbyOpen : completedOpen);
    if (!isOpen) return;

    const previousLength = untrack(
      status === "standby"
        ? () => standbyItems().length
        : () => completedItems().length,
    );
    const setItems = status === "standby" ? setStandbyItems : setCompletedItems;
    const setCursor = status === "standby" ? setStandbyCursor : setCompletedCursor;
    const setHasMore = status === "standby" ? setStandbyHasMore : setCompletedHasMore;
    const setLoading = status === "standby" ? setStandbyLoading : setCompletedLoading;

    setLoading(true);
    try {
      let page = await repository.getTodoPage(status);
      const items = [...page.items];
      while (page.hasMore && items.length < previousLength && page.nextCursor) {
        page = await repository.getTodoPage(status, page.nextCursor);
        items.push(...page.items);
      }
      setItems(items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setFeedback("Tasks could not be loaded. Retry.");
    } finally {
      setLoading(false);
    }
  };

  const applyCommittedProjection = async (fallback: AppProjection): Promise<void> => {
    setState({ kind: "ready", projection: fallback });
    try {
      const projection = await repository.getSummaryProjection();
      setState({ kind: "ready", projection });
    } catch {
      // The committed mutation projection remains usable if the refresh fails.
    }
    await Promise.all([reloadBrowseStatus("standby"), reloadBrowseStatus("completed")]);
  };

  const startEdit = (todo: TodoRecord): void => {
    setEditState({ id: todo.id, draft: todo.text, error: "", saving: false });
  };

  const changeEditDraft: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    const current = editState();
    if (!current) return;
    setEditState({ ...current, draft: event.currentTarget.value, error: "" });
  };

  const cancelEdit = (id: string): void => {
    if (editState()?.id === id) {
      setEditState(null);
      focusRowAction(id, "edit");
    }
  };

  const saveEdit = async (id: string): Promise<void> => {
    const current = editState();
    if (!current || current.id !== id || current.saving) return;

    setEditState({ ...current, saving: true, error: "" });
    const result = await repository.editTodo(id, current.draft);

    if (!result.ok) {
      const error = result.category === "validation" ? result.validation.message : result.message;
      if (untrack(editState)?.id === id) {
        setEditState({ id, draft: current.draft, error, saving: false });
        focusRowAction(id, "edit");
      }
      return;
    }

    setState({ kind: "ready", projection: result.projection });
    if (untrack(editState)?.id === id) setEditState(null);
    updateLoadedTodo(result.todo);
    focusRowAction(id, "edit");
  };

  const toggleTodo = async (todo: TodoRecord): Promise<void> => {
    if (pendingCompletionIds().has(todo.id)) return;
    const completed = todo.status !== "completed";
    const optimisticStatus: TodoStatus = completed ? "completed" : "active";

    setPendingCompletionIds((current) => new Set(current).add(todo.id));
    setOptimisticStatuses((current) => ({ ...current, [todo.id]: optimisticStatus }));
    const result = await repository.setTodoCompleted(todo.id, completed);

    if (!result.ok) {
      setOptimisticStatuses((current) => {
        const next = { ...current };
        delete next[todo.id];
        return next;
      });
      setPendingCompletionIds((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
      setFeedback(result.message);
      focusRowAction(todo.id, "toggle");
      return;
    }

    setFeedback(
      result.action === "reopened"
        ? "TASK REOPENED · XP RETAINED"
        : result.alreadyCredited
          ? "TASK COMPLETE · ALREADY CREDITED"
          : "TASK COMPLETE",
    );

    if (completed && result.changed) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, COMPLETION_HOLD_MS));
    }
    await applyCommittedProjection(result.projection);
    setOptimisticStatuses((current) => {
      const next = { ...current };
      delete next[todo.id];
      return next;
    });
    setPendingCompletionIds((current) => {
      const next = new Set(current);
      next.delete(todo.id);
      return next;
    });
  };

  const deleteTodo = async (todo: TodoRecord): Promise<void> => {
    if (pendingDeleteIds().has(todo.id)) return;
    setPendingDeleteIds((current) => new Set(current).add(todo.id));
    const result = await repository.deleteTodo(todo.id);
    setPendingDeleteIds((current) => {
      const next = new Set(current);
      next.delete(todo.id);
      return next;
    });

    if (!result.ok) {
      setFeedback(result.message);
      focusRowAction(todo.id, "delete");
      return;
    }

    deleteUndo.offer(result.deletedTodo);
    setFeedback(result.retainedAward ? "TASK DELETED · XP RETAINED" : "TASK DELETED");
    await applyCommittedProjection(result.projection);
  };

  const undoDelete = async (): Promise<void> => {
    const result = await deleteUndo.undo((snapshot) => repository.restoreDeletedTodo(snapshot));
    if (!result) return;
    if (!result.ok) {
      setFeedback(result.category === "validation" ? result.validation.message : result.message);
      return;
    }
    setFeedback("TASK RESTORED");
    await applyCommittedProjection(result.projection);
  };

  const handleDraftInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    const value = event.currentTarget.value;
    setDraft(value);
    setComposerError("");
    saveComposerDraft(value);
  };

  const addTodo: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (event) => {
    event.preventDefault();
    if (adding()) return;

    setAdding(true);
    setComposerError("");
    const result = await repository.addTodo(draft());
    setAdding(false);

    if (!result.ok) {
      if (result.category === "validation") setComposerError(result.validation.message);
      else setFeedback(result.message);
      queueMicrotask(() => composerInput?.focus());
      return;
    }

    setState({ kind: "ready", projection: result.projection });
    setDraft("");
    saveComposerDraft("");
    setFeedback(result.todo.status === "standby" ? "ADDED TO STANDBY" : "Task added.");

    if (result.todo.status === "standby" && standbyOpen() && !standbyHasMore()) {
      if (standbyItems().length < TODO_PAGE_SIZE) {
        setStandbyItems((items) => [...items, result.todo]);
      } else {
        setStandbyHasMore(true);
      }
    }

    queueMicrotask(() => {
      if (globalThis.matchMedia?.("(pointer: coarse)").matches) composerInput?.blur();
      else composerInput?.focus();
    });
  };

  const retry = (): void => {
    deleteUndo.clear();
    setEditState(null);
    repository.close();
    void openApplication();
  };

  const confirmErase = async (): Promise<void> => {
    if (erasing()) return;
    setErasing(true);
    const result = await repository.eraseLocalData({ confirmed: true });
    setErasing(false);

    if (!result.ok) {
      if (result.category !== "cancelled") {
        setState({ kind: "local-data-error", technicalCategory: result.technicalCategory });
      }
      return;
    }

    eraseDialog?.close();
    deleteUndo.clear();
    setEditState(null);
    resetBrowseState();
    setDraft("");
    saveComposerDraft("");
    setComposerError("");
    setFeedback("Local data erased.");
    setState({ kind: "ready", projection: result.projection });
  };

  return (
    <div class="app-shell">
      <header class="product-header">
        <h1>{PRODUCT_NAME}</h1>
        <p>Your list is stored only in this browser.</p>
      </header>

      <Show when={state().kind === "opening"}>
        <main class="system-state" aria-busy="true">
          <span class="state-indicator" aria-hidden="true" />
          <p>Opening local data...</p>
        </main>
      </Show>

      <Show when={state().kind === "blocked"}>
        <main class="system-state system-state--warning">
          <p>{(state() as Extract<ApplicationState, { kind: "blocked" }>).message}</p>
          <button class="button button--primary" type="button" onClick={retry}>Retry</button>
        </main>
      </Show>

      <Show when={state().kind === "local-data-error"}>
        <main class="system-state system-state--error">
          <h2>Local data could not be opened.</h2>
          <p>Retry, or erase this browser's MECHA//TODO data and start again.</p>
          <p class="technical-category">
            Error: {(state() as Extract<ApplicationState, { kind: "local-data-error" }>).technicalCategory}
          </p>
          <div class="state-actions">
            <button class="button button--primary" type="button" onClick={retry}>Retry</button>
            <button class="button button--danger" type="button" onClick={() => eraseDialog?.showModal()}>
              Erase local data
            </button>
          </div>
        </main>
      </Show>

      <Show when={state().kind === "ready"}>
        {(() => {
          const projection = () => (state() as ReadyState).projection;
          return (
            <main class="task-system" aria-labelledby="active-bay-heading">
              <section class="hud" aria-label="Progression status">
                <div class="rank-mark" aria-hidden="true"><span>//</span></div>
                <div class="hud-level">
                  <p>LV {String(projection().progression.level).padStart(3, "0")} · {projection().rank}</p>
                  <span>{projection().progression.xpForCurrentLevel} / {projection().progression.xpForNextLevel} XP</span>
                </div>
                <progress
                  aria-label={`Level ${projection().progression.level}, ${projection().rank}: ${projection().progression.xpForCurrentLevel} of ${projection().progression.xpForNextLevel} XP`}
                  max={projection().progression.xpForNextLevel}
                  value={projection().progression.xpForCurrentLevel}
                />
                <p class="hud-capacity">Active {projection().activeTodos.length} / {projection().activeCapacity}</p>
              </section>

              <section class="active-bay">
                <div class="section-heading">
                  <h2 id="active-bay-heading">Active Bay</h2>
                  <span aria-label={`${projection().activeTodos.length} active tasks out of ${projection().activeCapacity}`}>
                    {projection().activeTodos.length} / {projection().activeCapacity}
                  </span>
                </div>
                <Show when={projection().activeTodos.length > 0} fallback={<p class="empty-state">No active tasks. Add one when you are ready.</p>}>
                  <TodoList
                    items={projection().activeTodos}
                    editState={editState()}
                    optimisticStatuses={optimisticStatuses()}
                    pendingCompletionIds={pendingCompletionIds()}
                    pendingDeleteIds={pendingDeleteIds()}
                    onCancelEdit={cancelEdit}
                    onChangeEditDraft={changeEditDraft}
                    onDelete={(todo) => void deleteTodo(todo)}
                    onSaveEdit={(id) => void saveEdit(id)}
                    onStartEdit={startEdit}
                    onToggle={(todo) => void toggleTodo(todo)}
                  />
                </Show>
              </section>

              <BrowseSection
                count={projection().standbyCount}
                emptyCopy="No tasks in Standby."
                hasMore={standbyHasMore()}
                items={standbyItems()}
                loading={standbyLoading()}
                moreLabel="Show 20 more"
                open={standbyOpen()}
                status="standby"
                title="Standby"
                editState={editState()}
                optimisticStatuses={optimisticStatuses()}
                pendingCompletionIds={pendingCompletionIds()}
                pendingDeleteIds={pendingDeleteIds()}
                onCancelEdit={cancelEdit}
                onChangeEditDraft={changeEditDraft}
                onDelete={(todo) => void deleteTodo(todo)}
                onLoadMore={() => void loadPage("standby", true)}
                onSaveEdit={(id) => void saveEdit(id)}
                onStartEdit={startEdit}
                onToggle={() => toggleBrowse("standby", projection().standbyCount)}
                onToggleTodo={(todo) => void toggleTodo(todo)}
              />
              <BrowseSection
                count={projection().completedCount}
                emptyCopy="No completed tasks yet."
                hasMore={completedHasMore()}
                items={completedItems()}
                loading={completedLoading()}
                moreLabel="Show 20 older"
                open={completedOpen()}
                status="completed"
                title="Completed"
                editState={editState()}
                optimisticStatuses={optimisticStatuses()}
                pendingCompletionIds={pendingCompletionIds()}
                pendingDeleteIds={pendingDeleteIds()}
                onCancelEdit={cancelEdit}
                onChangeEditDraft={changeEditDraft}
                onDelete={(todo) => void deleteTodo(todo)}
                onLoadMore={() => void loadPage("completed", true)}
                onSaveEdit={(id) => void saveEdit(id)}
                onStartEdit={startEdit}
                onToggle={() => toggleBrowse("completed", projection().completedCount)}
                onToggleTodo={(todo) => void toggleTodo(todo)}
              />

              <div class="composer-dock">
                <form class="composer" onSubmit={addTodo} novalidate>
                  <label for="new-task">New task</label>
                  <div class="composer-controls">
                    <input
                      ref={composerInput}
                      id="new-task"
                      name="task"
                      type="text"
                      inputmode="text"
                      enterkeyhint="done"
                      autocomplete="off"
                      value={draft()}
                      aria-describedby={composerError() ? "composer-error" : undefined}
                      aria-invalid={composerError() ? "true" : undefined}
                      onInput={handleDraftInput}
                    />
                    <button class="button button--primary" type="submit" disabled={adding()}>
                      {adding() ? "Adding..." : "Add task"}
                    </button>
                  </div>
                  <Show when={composerError()}>
                    <p id="composer-error" class="field-error">{composerError()}</p>
                  </Show>
                </form>

                <div class="feedback" role="status" aria-live="polite" aria-atomic="true">
                  <span>{feedback()}</span>
                  <Show when={undoAvailable()}>
                    <button class="undo-action" type="button" onClick={() => void undoDelete()}>
                      Undo
                    </button>
                  </Show>
                </div>
              </div>
            </main>
          );
        })()}
      </Show>

      <dialog class="erase-dialog" ref={eraseDialog} aria-labelledby="erase-title">
        <form method="dialog">
          <h2 id="erase-title">Erase local data?</h2>
          <p>This permanently removes every task and completion award stored in this browser.</p>
          <div class="state-actions">
            <button class="button" type="submit" value="cancel" disabled={erasing()}>Cancel</button>
            <button class="button button--danger" type="button" disabled={erasing()} onClick={() => void confirmErase()}>
              {erasing() ? "Erasing..." : "Erase local data"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

type BrowseSectionProps = Readonly<{
  count: number;
  emptyCopy: string;
  hasMore: boolean;
  items: TodoRecord[];
  loading: boolean;
  moreLabel: string;
  open: boolean;
  status: BrowseStatus;
  title: string;
  editState: EditState | null;
  optimisticStatuses: Readonly<Record<string, TodoStatus>>;
  pendingCompletionIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  onCancelEdit: (id: string) => void;
  onChangeEditDraft: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onDelete: (todo: TodoRecord) => void;
  onLoadMore: () => void;
  onSaveEdit: (id: string) => void;
  onStartEdit: (todo: TodoRecord) => void;
  onToggle: () => void;
  onToggleTodo: (todo: TodoRecord) => void;
}>;

function BrowseSection(props: BrowseSectionProps) {
  const panelId = () => `${props.status}-tasks`;
  return (
    <section class="browse-section">
      <button class="disclosure" type="button" aria-controls={panelId()} aria-expanded={props.open ? "true" : "false"} onClick={props.onToggle}>
        <span class="disclosure-marker" aria-hidden="true">{props.open ? "−" : "+"}</span>
        <span>{props.title}</span>
        <span class="section-count">{props.count}</span>
      </button>
      <Show when={props.open}>
        <div id={panelId()} class="browse-panel" aria-busy={props.loading ? "true" : "false"}>
          <Show when={props.count > 0} fallback={<p class="empty-state">{props.emptyCopy}</p>}>
            <TodoList
              items={props.items}
              editState={props.editState}
              optimisticStatuses={props.optimisticStatuses}
              pendingCompletionIds={props.pendingCompletionIds}
              pendingDeleteIds={props.pendingDeleteIds}
              onCancelEdit={props.onCancelEdit}
              onChangeEditDraft={props.onChangeEditDraft}
              onDelete={props.onDelete}
              onSaveEdit={props.onSaveEdit}
              onStartEdit={props.onStartEdit}
              onToggle={props.onToggleTodo}
            />
            <Show when={props.loading && props.items.length === 0}>
              <p class="loading-copy">Loading tasks...</p>
            </Show>
            <Show when={props.hasMore}>
              <button class="load-more" type="button" disabled={props.loading} onClick={props.onLoadMore}>
                {props.loading ? "Loading..." : props.moreLabel}
              </button>
            </Show>
          </Show>
        </div>
      </Show>
    </section>
  );
}

type TodoListProps = Readonly<{
  items: TodoRecord[];
  editState: EditState | null;
  optimisticStatuses: Readonly<Record<string, TodoStatus>>;
  pendingCompletionIds: ReadonlySet<string>;
  pendingDeleteIds: ReadonlySet<string>;
  onCancelEdit: (id: string) => void;
  onChangeEditDraft: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onDelete: (todo: TodoRecord) => void;
  onSaveEdit: (id: string) => void;
  onStartEdit: (todo: TodoRecord) => void;
  onToggle: (todo: TodoRecord) => void;
}>;

function TodoList(props: TodoListProps) {
  return (
    <ul class="todo-list">
      <For each={props.items}>
        {(todo) => {
          const visualStatus = createMemo(
            () => props.optimisticStatuses[todo.id] ?? todo.status,
          );
          const rowEdit = createMemo(() =>
            props.editState?.id === todo.id ? props.editState : null,
          );
          const editing = () => rowEdit() !== null;
          const editErrorId = () => `todo-edit-error-${todo.id}`;
          return (
            <li
              class={`todo-row todo-row--${visualStatus()}`}
              data-todo-id={todo.id}
              aria-busy={
                props.pendingCompletionIds.has(todo.id) || props.pendingDeleteIds.has(todo.id)
                  ? "true"
                  : undefined
              }
            >
              <button
                class="todo-status"
                type="button"
                role="checkbox"
                aria-checked={visualStatus() === "completed" ? "true" : "false"}
                aria-label={visualStatus() === "completed" ? `Reopen ${todo.text}` : `Complete ${todo.text}`}
                data-todo-toggle={todo.id}
                disabled={props.pendingCompletionIds.has(todo.id)}
                onClick={() => props.onToggle(todo)}
              >
                <span aria-hidden="true">
                  {visualStatus() === "completed" ? "✓" : visualStatus() === "standby" ? "Ⅱ" : "●"}
                </span>
              </button>

              <Show
                when={editing()}
                fallback={
                  <button
                    class="todo-text"
                    type="button"
                    data-todo-edit={todo.id}
                    onClick={() => props.onStartEdit(todo)}
                  >
                    {todo.text}
                  </button>
                }
              >
                <form
                  class="todo-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    props.onSaveEdit(todo.id);
                  }}
                >
                  <label class="sr-only" for={`todo-edit-${todo.id}`}>Edit {todo.text}</label>
                  <input
                    id={`todo-edit-${todo.id}`}
                    type="text"
                    inputmode="text"
                    enterkeyhint="done"
                    autocomplete="off"
                    value={rowEdit()?.draft ?? todo.text}
                    data-todo-edit={todo.id}
                    aria-describedby={rowEdit()?.error ? editErrorId() : undefined}
                    aria-invalid={rowEdit()?.error ? "true" : undefined}
                    readonly={rowEdit()?.saving}
                    onInput={props.onChangeEditDraft}
                    onBlur={() => queueMicrotask(() => props.onSaveEdit(todo.id))}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        props.onCancelEdit(todo.id);
                      }
                    }}
                    ref={(element) => queueMicrotask(() => element.focus())}
                  />
                  <p
                    id={editErrorId()}
                    class="field-error"
                    hidden={!rowEdit()?.error}
                  >
                    {rowEdit()?.error}
                  </p>
                </form>
              </Show>

              <button
                class="todo-delete"
                type="button"
                aria-label={`Delete ${todo.text}`}
                data-todo-delete={todo.id}
                disabled={props.pendingDeleteIds.has(todo.id)}
                onClick={() => props.onDelete(todo)}
              >
                Delete
              </button>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
