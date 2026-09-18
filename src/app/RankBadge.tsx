import {
  badgeDescriptorForLevel,
  type BadgeDescriptor,
} from "../domain/badge-descriptor";
import { BADGE_GEOMETRY } from "./badge-geometry";

type RankBadgeProps = Readonly<{
  level: number;
  size: "compact" | "large";
}>;

const PIP_MARKS = [
  '<rect x="10" y="29" width="2" height="2"/>',
  '<rect x="14" y="29" width="2" height="2"/>',
  '<rect x="18" y="29" width="2" height="2"/>',
  '<rect x="22" y="29" width="2" height="2"/>',
] as const;

export function renderRankBadgeSvg(descriptor: BadgeDescriptor): string {
  const pips = descriptor.kind === "base-rank" ? PIP_MARKS.slice(0, descriptor.pips).join("") : "";
  const pipAttribute = descriptor.kind === "base-rank" ? ` data-pips="${descriptor.pips}"` : "";

  return `<svg viewBox="${descriptor.viewBox}" aria-hidden="true" focusable="false" data-kind="${descriptor.kind}" data-silhouette="${descriptor.silhouette}"${pipAttribute}><g fill="currentColor">${BADGE_GEOMETRY[descriptor.silhouette]}${pips}</g></svg>`;
}

export function RankBadge(props: RankBadgeProps) {
  const markup = () => renderRankBadgeSvg(badgeDescriptorForLevel(props.level));
  return (
    <span
      class={`rank-badge rank-badge--${props.size}`}
      aria-hidden="true"
      innerHTML={markup()}
    />
  );
}
