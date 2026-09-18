import { Show } from "solid-js";
import { APPLICATION_VERSION } from "../config/product";
import { REWARD_RULES_V1 } from "../config/rules-v1";
import { DATABASE_VERSION } from "../persistence/migrations";
import type { ApplicationViewState } from "../persistence/repository";
import { trapDialogTab } from "./dialog-focus";
import { RankBadge } from "./RankBadge";

type SettingsDialogProps = Readonly<{
  viewState: ApplicationViewState | null;
  setDialog: (dialog: HTMLDialogElement) => void;
  onClose: () => void;
  onRequestErase: (opener: HTMLButtonElement) => void;
}>;

const numberFormatter = new Intl.NumberFormat();

export function SettingsDialog(props: SettingsDialogProps) {
  return (
    <dialog
      class="settings-dialog"
      ref={(dialog) => props.setDialog(dialog)}
      aria-labelledby="settings-title"
      onClose={props.onClose}
      onKeyDown={(event) => trapDialogTab(event, event.currentTarget)}
    >
      <div class="settings-layout">
        <header class="settings-header">
          <button class="settings-back" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>
            Back
          </button>
          <h2 id="settings-title">Settings</h2>
          <button class="settings-close" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>
            Close
          </button>
        </header>

        <Show when={props.viewState} keyed>
          {(viewState) => (
            <section class="progression-details" aria-labelledby="progression-title">
              <div class="progression-badge-slot">
                <RankBadge
                  level={viewState.progression.level}
                  size="large"
                />
              </div>
              <div class="progression-copy">
                <h3 id="progression-title">Progression</h3>
                <p class="detailed-rank">{viewState.rank}</p>
                <dl class="progression-stats">
                  <div><dt>Level</dt><dd>{numberFormatter.format(viewState.progression.level)}</dd></div>
                  <div><dt>Lifetime XP</dt><dd>{numberFormatter.format(viewState.progression.lifetimeXp)}</dd></div>
                  <div><dt>Current level</dt><dd>{numberFormatter.format(viewState.progression.xpForCurrentLevel)} / {numberFormatter.format(viewState.progression.xpForNextLevel)} XP</dd></div>
                  <div><dt>Rules version</dt><dd>{REWARD_RULES_V1.rulesVersion}</dd></div>
                </dl>
              </div>
            </section>
          )}
        </Show>

        <section class="settings-section" aria-labelledby="local-data-title">
          <h3 id="local-data-title">Browser-local data</h3>
          <p>This list exists only in this browser. In V1, it cannot move between browser profiles, devices, or website addresses.</p>
        </section>

        <section class="settings-section" aria-labelledby="versions-title">
          <h3 id="versions-title">Versions</h3>
          <dl class="version-list">
            <div><dt>Application</dt><dd>{APPLICATION_VERSION}</dd></div>
            <div><dt>Database schema</dt><dd>{DATABASE_VERSION}</dd></div>
            <div><dt>Reward rules</dt><dd>{REWARD_RULES_V1.rulesVersion}</dd></div>
          </dl>
        </section>

        <section class="settings-section settings-danger" aria-labelledby="erase-settings-title">
          <h3 id="erase-settings-title">Erase local data</h3>
          <p>Permanently remove every task and completion award from this browser.</p>
          <button class="button button--danger" type="button" onClick={(event) => props.onRequestErase(event.currentTarget)}>
            Erase local data
          </button>
        </section>
      </div>
    </dialog>
  );
}
