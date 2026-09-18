import { badgeDescriptor, type BadgeDescriptor } from "../domain/badge-descriptor";

type RankBadgeProps = Readonly<{
  level: number;
  rank: string;
  size: "compact" | "large";
}>;

const SILHOUETTES: Readonly<Record<BadgeDescriptor["silhouette"], string>> = {
  "cadet-chevron": '<path d="M7 9h5l4 5 4-5h5l-9 12z"/>',
  "specialist-twin-chevron": '<path d="M6 6h5l5 6 5-6h5L16 19zM8 19h5l3 3 3-3h5l-8 8z"/>',
  "sergeant-stepped-chevron": '<path d="M5 6h6v4h3v4h4v-4h3V6h6v8h-4v4h-4v4h-6v-4H9v-4H5z"/>',
  "lieutenant-diamond": '<path d="M16 3 27 16 16 29 5 16zm0 6-6 7 6 7 6-7z" fill-rule="evenodd"/>',
  "captain-double-diamond": '<path d="M10 4 19 13 10 22 1 13zm12 6 7 7-7 7-7-7zm-12 1-2 2 2 2 2-2zm12 5-1 1 1 1 1-1z"/>',
  "major-winged-diamond": '<path d="m16 5 8 11-8 11-8-11zm0 6-4 5 4 5 4-5zM1 9l8 3-3 4 3 4-8 3 3-7zm30 0-3 7 3 7-8-3 3-4-3-4z" fill-rule="evenodd"/>',
  "colonel-shield-bars": '<path d="M7 3h18v15l-9 10-9-10zm5 5v10h8V8zM1 7h4v4H1zm0 7h4v4H1zm26-7h4v4h-4zm0 7h4v4h-4z" fill-rule="evenodd"/>',
  "general-star-wing": '<path d="m16 2 3 8 9-2-5 8 7 6-10-1-4 9-4-9-10 1 7-6-5-8 9 2zM0 12h7v4H0zm25 0h7v4h-7z"/>',
  "marshal-heavy-crest": '<path d="M4 3h7l5 5 5-5h7v15l-5 9H9l-5-9zm7 7v10h10V10l-5 4zM0 7h3v15H0zm29 0h3v15h-3z" fill-rule="evenodd"/>',
};

const MODIFIERS: Readonly<Record<string, string>> = {
  "central-notch": '<path d="M14 0h4v5h-4z"/>',
  "forward-fins": '<path d="M0 2h7v3H3v4H0zm32 0h-7v3h4v4h3z"/>',
  crown: '<path d="M10 5V1l4 3 2-4 2 4 4-3v4z"/>',
  "upper-spires": '<path d="M7 0h3v7H7zm15 0h3v7h-3z"/>',
  "side-bars": '<path d="M0 11h4v10H0zm28 0h4v10h-4z"/>',
  "four-rays": '<path d="M15 0h2v6h-2zm0 26h2v6h-2zM0 15h6v2H0zm26 0h6v2h-6z"/>',
  "lower-hooks": '<path d="M3 22h4v5h5v4H3zm26 0h-4v5h-5v4h9z"/>',
  "outer-ring": '<path d="M2 2h28v28H2zm2 2v24h24V4z" fill-rule="evenodd"/>',
};

export function renderRankBadgeSvg(descriptor: BadgeDescriptor): string {
  const pips = Array.from({ length: descriptor.pips }, (_, index) => {
    const x = 10 + index * 4;
    return `<rect x="${x}" y="29" width="2" height="2"/>`;
  }).join("");
  const modifiers = descriptor.prestigeModifiers
    .map((modifier) => MODIFIERS[modifier])
    .join("");
  const remainder = renderRemainderHash(descriptor.prestigeRemainderHash);

  return `<svg viewBox="${descriptor.viewBox}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" data-silhouette="${descriptor.silhouette}" data-pips="${descriptor.pips}"><g fill="currentColor">${SILHOUETTES[descriptor.silhouette]}${modifiers}${remainder}${pips}</g></svg>`;
}

export function RankBadge(props: RankBadgeProps) {
  const markup = () => renderRankBadgeSvg(badgeDescriptor(props.level, props.rank));
  return (
    <span
      class={`rank-badge rank-badge--${props.size}`}
      aria-hidden="true"
      innerHTML={markup()}
    />
  );
}

function renderRemainderHash(hash: number | null): string {
  if (hash === null) return "";

  return Array.from({ length: 8 }, (_, index) => {
    const x = 5 + index * 3;
    const height = (hash & (1 << index)) === 0 ? 1 : 3;
    return `<rect x="${x}" y="${27 - height}" width="2" height="${height}"/>`;
  }).join("");
}
