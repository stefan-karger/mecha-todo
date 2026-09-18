import { For, createSignal } from "solid-js";
import conceptUrl from "../../docs/assets/badges_concept.png";
import colonelReferenceUrl from "../../docs/assets/badge-colonel-refined.png";
import marshalReferenceUrl from "../../docs/assets/badge-marshal-refined.png";
import { BASE_RANKS } from "../domain/ranks";
import { RankBadge } from "./RankBadge";
import "../styles/badge-review.css";

const PIP_STATES = [0, 1, 2, 3, 4] as const;
const SCALE_SAMPLES = [24, 32, 44, 48, 96, 112] as const;
const RANK_NOTES = [
  "One broad V band.",
  "Two equal-width V bands.",
  "Three separate V bands.",
  "One solid upright diamond, without a center seam.",
  "Two filled diamonds on one vertical axis.",
  "One solid diamond and three wing tiers per side.",
  "A wider hexagonal frame, pointed center bar, and inward-facing side bars.",
  "A solid five-point star and three wing tiers per side.",
  "A tall diamond, two shoulders, a broad V, and two lower wing pieces.",
] as const;

function BadgeSample(props: { level: number; size: number; caption: string }) {
  return (
    <figure>
      <div class="badge-sample" style={{ "--sample-size": `${props.size}px` }}>
        <RankBadge level={props.level} size="large" />
      </div>
      <figcaption>{props.caption}</figcaption>
    </figure>
  );
}

export function BadgeShowcase() {
  const [surface, setSurface] = createSignal("dark");
  return (
    <main class="badge-lab" data-surface={surface()}>
      <header class="badge-lab__header">
        <div>
          <h1>Badge review</h1>
          <p class="badge-lab__intro">
            The concept and revised Colonel and Marshal references beside the single-color SVGs.
            Light chevrons, wing bars, and frames stay. Decorative accents and dark outlines do not.
          </p>
        </div>
        <a class="badge-lab__home" href="/">Return to tasks</a>
      </header>

      <fieldset class="badge-lab__surfaces">
        <legend>SVG preview background</legend>
        <For each={["dark", "light", "grayscale"]}>
          {(value) => (
            <label>
              <input type="radio" name="surface" value={value}
                checked={surface() === value} onChange={() => setSurface(value)} />
              {value === "dark" ? "Dark" : value === "light" ? "Light" : "Grayscale"}
            </label>
          )}
        </For>
      </fieldset>

      <section class="badge-lab__section" aria-labelledby="comparison-heading">
        <div class="badge-lab__section-heading">
          <h2 id="comparison-heading">Reference comparison</h2>
          <p>Lieutenant and Major have solid diamonds; General has a solid star. SVGs have zero progress pips.</p>
        </div>
        <div class="badge-comparisons">
          <For each={BASE_RANKS}>
            {(rank, index) => (
              <article class="badge-comparison" data-rank={rank}>
                <h3>{rank}</h3>
                <p>{RANK_NOTES[index()]}</p>
                <div class="badge-comparison__samples">
                  <figure>
                    <div class={`badge-concept-crop${rank === "Marshal" ? " badge-concept-crop--marshal" : ""}`}>
                      <img
                        src={rank === "Colonel" ? colonelReferenceUrl : rank === "Marshal" ? marshalReferenceUrl : conceptUrl}
                        alt={`${rank} in the ${rank === "Colonel" || rank === "Marshal" ? "revised reference" : "original concept"}`}
                        style={rank === "Colonel"
                          ? { width: "117.58px", height: "129.16px", left: "-1.61px", top: "-18.88px" }
                          : rank === "Marshal"
                            ? { width: "121.8px", height: "127.6px", left: "-5px", top: "-6px" }
                            : { left: `${-(28 + index() * 179.5) * 112 / 180}px` }} />
                    </div>
                    <figcaption>{rank === "Colonel" || rank === "Marshal" ? "New reference" : "Concept"}</figcaption>
                  </figure>
                  <BadgeSample level={index() * 5} size={112} caption="SVG · 112px" />
                  <BadgeSample level={index() * 5} size={48} caption="48px" />
                </div>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class="badge-lab__section" aria-labelledby="sizes-heading">
        <div class="badge-lab__section-heading">
          <h2 id="sizes-heading">Size checks</h2>
          <p>One drawing at every size. Judge recognition at 44 and 48px first.</p>
        </div>
        <div class="badge-size-list">
          <For each={BASE_RANKS}>
            {(rank, index) => (
              <article class="badge-size-row">
                <h3>{rank}</h3>
                <div class="badge-size-row__samples">
                  <For each={SCALE_SAMPLES}>
                    {(size) => <BadgeSample level={index() * 5} size={size} caption={`${size}px`} />}
                  </For>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class="badge-lab__section" aria-labelledby="base-ranks-heading">
        <div class="badge-lab__section-heading">
          <h2 id="base-ranks-heading">Progress pips</h2>
          <p>Cadet through General gain zero through four pips, separate from the concept's accents.</p>
        </div>
        <div class="badge-pip-list">
          <For each={BASE_RANKS.slice(0, -1)}>
            {(rank, index) => (
              <article class="badge-pip-row" data-rank={rank}>
                <h3>{rank}</h3>
                <div class="badge-pip-row__samples">
                  <For each={PIP_STATES}>
                    {(pip) => <BadgeSample level={index() * 5 + pip} size={48}
                      caption={`${pip} pip${pip === 1 ? "" : "s"}`} />}
                  </For>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class="badge-lab__section" aria-labelledby="marshal-heading">
        <div class="badge-lab__section-heading">
          <h2 id="marshal-heading">Plain Marshal</h2>
          <p>Levels 40 through 49 share this crest and never have pips.</p>
        </div>
        <div class="badge-marshal-samples">
          <For each={[40, 49]}>
            {(level) => <BadgeSample level={level} size={112} caption={`Marshal · LV ${level}`} />}
          </For>
        </div>
        <p class="badge-lab__intro">
          Designation artwork is pending ticket 03. Levels 50 and above currently
          reuse this base crest; distinct designation geometry is not part of this review.
        </p>
      </section>
    </main>
  );
}
