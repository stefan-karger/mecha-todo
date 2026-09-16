import { For } from "solid-js";
import { BASE_RANKS, PRESTIGE_ATOMS, rankForLevel } from "../domain/ranks";
import { RankBadge } from "./RankBadge";

const PIP_STATES = [0, 1, 2, 3, 4] as const;
const PRESTIGE_LEVELS = PRESTIGE_ATOMS.map((_, index) => (BASE_RANKS.length + index) * 5);
const STRESS_LEVELS = [85, 90, 405, 725, 5_000] as const;
const SCALE_SAMPLES = [16, 24, 32, 48, 72, 112] as const;
const INK_SAMPLES = [
  { name: "Primary", color: "#b86cff" },
  { name: "Status", color: "#54ff73" },
  { name: "Warning", color: "#ffc857" },
  { name: "Paper", color: "#f5f1f8" },
] as const;

export function BadgeShowcase() {
  return (
    <main class="badge-lab">
      <header class="badge-lab__header">
        <div>
          <p class="badge-lab__kicker">Temporary renderer route</p>
          <h1>Badge inspection bench</h1>
          <p class="badge-lab__intro">
            Production SVGs at known levels. Use this page to compare silhouettes, pips,
            prestige atoms, and rendering sizes.
          </p>
        </div>
        <a class="badge-lab__home" href="/">Return to tasks</a>
      </header>

      <section class="badge-lab__section" aria-labelledby="base-ranks-heading">
        <div class="badge-lab__section-heading">
          <h2 id="base-ranks-heading">Base ranks and pips</h2>
          <p>Rows change rank. Columns add one pip.</p>
        </div>

        <div class="badge-matrix" role="table" aria-label="Base ranks at all pip states">
          <div class="badge-matrix__head" role="row">
            <span role="columnheader">Rank</span>
            <For each={PIP_STATES}>
              {(pip) => <span role="columnheader">{pip} pip{pip === 1 ? "" : "s"}</span>}
            </For>
          </div>
          <For each={BASE_RANKS}>
            {(rank, rankIndex) => (
              <div class="badge-matrix__row" role="row">
                <div class="badge-matrix__rank" role="rowheader">
                  <strong>{rank}</strong>
                  <span>LV {String(rankIndex() * 5).padStart(3, "0")}</span>
                </div>
                <For each={PIP_STATES}>
                  {(pip) => {
                    const level = rankIndex() * 5 + pip;
                    return (
                      <div
                        class="badge-matrix__cell"
                        role="cell"
                        aria-label={`${rank}, level ${level}, ${pip} pips`}
                      >
                        <RankBadge level={level} rank={rankForLevel(level)} size="compact" />
                        <span>{String(level).padStart(2, "0")}</span>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="badge-lab__section" aria-labelledby="atoms-heading">
        <div class="badge-lab__section-heading">
          <h2 id="atoms-heading">Prestige atoms</h2>
          <p>Each sample isolates the first modifier on the Marshal crest.</p>
        </div>
        <ul class="atom-rack">
          <For each={PRESTIGE_LEVELS}>
            {(level, index) => (
              <li>
                <RankBadge level={level} rank={rankForLevel(level)} size="large" />
                <strong>{PRESTIGE_ATOMS[index()]}</strong>
                <span>LV {String(level).padStart(3, "0")}</span>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="badge-lab__section" aria-labelledby="stacking-heading">
        <div class="badge-lab__section-heading">
          <h2 id="stacking-heading">Atom stacking and remainder hash</h2>
          <p>Long rank names test repeated modifiers and the eight-bit lower rail.</p>
        </div>
        <div class="badge-stress-rack">
          <For each={STRESS_LEVELS}>
            {(level) => (
              <article>
                <div class="badge-stress-rack__mark">
                  <RankBadge level={level} rank={rankForLevel(level)} size="large" />
                </div>
                <div>
                  <strong>{rankForLevel(level)}</strong>
                  <span>Level {level.toLocaleString()}</span>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class="badge-lab__section badge-lab__section--calibration" aria-labelledby="calibration-heading">
        <div class="badge-lab__section-heading">
          <h2 id="calibration-heading">Rendering calibration</h2>
          <p>The same General badge across output sizes and UI colors.</p>
        </div>
        <div class="calibration-grid">
          <div class="scale-ruler" aria-label="General badge at six sizes">
            <For each={SCALE_SAMPLES}>
              {(size) => (
                <div style={{ "--sample-size": `${size}px` }}>
                  <RankBadge level={35} rank={rankForLevel(35)} size="large" />
                  <span>{size}px</span>
                </div>
              )}
            </For>
          </div>
          <div class="ink-rack" aria-label="General badge in interface colors">
            <For each={INK_SAMPLES}>
              {(ink) => (
                <div style={{ "--sample-ink": ink.color }}>
                  <RankBadge level={35} rank={rankForLevel(35)} size="compact" />
                  <span>{ink.name}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>
    </main>
  );
}
