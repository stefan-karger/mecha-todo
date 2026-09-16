import { For, Show, createSignal, onCleanup } from "solid-js";
import type { JSX } from "@solidjs/web";
import { PRODUCT_NAME } from "../config/product";
import { loadComposerDraft, saveComposerDraft } from "../persistence/composer-draft";
import type { TodoRecord } from "../persistence/models";
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

export function App(props: AppProps = {}) {
  const repository = props.repository ?? new IndexedDbAppRepository();
  const [state, setState] = createSignal<ApplicationState>({ kind: "opening" });
  const [draft, setDraft] = createSignal(loadComposerDraft());
  const [composerError, setComposerError] = createSignal("");
  const [feedback, setFeedback] = createSignal("");
  const [adding, setAdding] = createSignal(false);
  const [erasing, setErasing] = createSignal(false);

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
  onCleanup(() => repository.close());

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
                  <TodoList items={projection().activeTodos} />
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
                onLoadMore={() => void loadPage("standby", true)}
                onToggle={() => toggleBrowse("standby", projection().standbyCount)}
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
                onLoadMore={() => void loadPage("completed", true)}
                onToggle={() => toggleBrowse("completed", projection().completedCount)}
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

                <div class="feedback" role="status" aria-live="polite" aria-atomic="true">{feedback()}</div>
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
  onLoadMore: () => void;
  onToggle: () => void;
}>;

function BrowseSection(props: BrowseSectionProps) {
  const panelId = `${props.status}-tasks`;
  return (
    <section class="browse-section">
      <button class="disclosure" type="button" aria-controls={panelId} aria-expanded={props.open ? "true" : "false"} onClick={props.onToggle}>
        <span class="disclosure-marker" aria-hidden="true">{props.open ? "−" : "+"}</span>
        <span>{props.title}</span>
        <span class="section-count">{props.count}</span>
      </button>
      <Show when={props.open}>
        <div id={panelId} class="browse-panel" aria-busy={props.loading ? "true" : "false"}>
          <Show when={props.count > 0} fallback={<p class="empty-state">{props.emptyCopy}</p>}>
            <TodoList items={props.items} />
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

function TodoList(props: Readonly<{ items: TodoRecord[] }>) {
  return (
    <ul class="todo-list">
      <For each={props.items}>
        {(todo) => (
          <li class={`todo-row todo-row--${todo.status}`}>
            <span class="todo-status" aria-hidden="true">
              {todo.status === "completed" ? "✓" : todo.status === "standby" ? "Ⅱ" : "●"}
            </span>
            <span>{todo.text}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
