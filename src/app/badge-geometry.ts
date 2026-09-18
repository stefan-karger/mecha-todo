import type { BadgeSilhouette } from "../domain/badge-descriptor";

/**
 * Hand-authored light components from the concept and user-supplied
 * badge-colonel-refined.png / badge-marshal-refined.png references.
 * Lieutenant/Major diamonds and General's star are solid by user direction.
 * One 32-unit drawing per rank, shared at every size. Gaps are transparent;
 * no source accent, dark outline, or shaded facet is painted into the SVG.
 */
export const BADGE_GEOMETRY: Readonly<Record<BadgeSilhouette, string>> = {
  "cadet-chevron":
    '<polygon points="3,9.4 16,17.4 29,9.4 29,14.4 16,22.4 3,14.4"/>',
  "specialist-twin-chevron": [
    '<polygon points="3.5,5.8 16,13.3 28.5,5.8 28.5,11 16,18.5 3.5,11"/>',
    '<polygon points="3.5,12.6 16,20.1 28.5,12.6 28.5,17.8 16,25.3 3.5,17.8"/>',
  ].join(""),
  "sergeant-triple-chevron": [
    '<polygon points="4,2.6 16,9.8 28,2.6 28,7.4 16,14.6 4,7.4"/>',
    '<polygon points="4,9 16,16.2 28,9 28,13.8 16,21 4,13.8"/>',
    '<polygon points="4,15.4 16,22.6 28,15.4 28,20.2 16,27.4 4,20.2"/>',
  ].join(""),
  "lieutenant-diamond":
    '<polygon points="16,3.2 23.2,14.6 16,26 8.8,14.6"/>',
  "captain-double-diamond": [
    '<polygon points="16,2.5 20,8.4 16,14.3 12,8.4"/>',
    '<polygon points="16,15.7 20,21.6 16,27.5 12,21.6"/>',
  ].join(""),
  "major-winged-diamond": [
    '<polygon points="16,7.8 20.7,15.6 16,23.4 11.3,15.6"/>',
    '<polygon points="2,10.6 12.6,10.6 11.1,13.2 3.6,13.2"/>',
    '<polygon points="30,10.6 19.4,10.6 20.9,13.2 28.4,13.2"/>',
    '<polygon points="4.3,14.4 10.4,14.4 9.8,15.6 10.6,17 5.9,17"/>',
    '<polygon points="27.7,14.4 21.6,14.4 22.2,15.6 21.4,17 26.1,17"/>',
    '<polygon points="6.6,18.2 11.3,18.2 12.8,20.8 8.2,20.8"/>',
    '<polygon points="25.4,18.2 20.7,18.2 19.2,20.8 23.8,20.8"/>',
  ].join(""),
  "colonel-hexagon-bars": [
    '<path fill-rule="evenodd" d="M16 2 25.9 7.95 25.9 21.55 16 27.5 6.1 21.55 6.1 7.95ZM16 3.65 7.5 8.8 7.5 20.7 16 25.85 24.5 20.7 24.5 8.8Z"/>',
    '<polygon points="16,4.95 17.95,6.1 17.95,23.4 16,24.55 14.05,23.4 14.05,6.1"/>',
    '<polygon points="8.9,9.6 12,7.8 12,21.7 8.9,19.8"/>',
    '<polygon points="23.1,9.6 20,7.8 20,21.7 23.1,19.8"/>',
  ].join(""),
  "general-star-wing": [
    '<polygon points="16,6.5 18.1,12.5 23,12.5 18.9,16.2 21,23 16,19.4 11,23 13.1,16.2 9,12.5 13.9,12.5"/>',
    '<polygon points="2,10 13.3,10 12.8,11.4 6.4,11.4 8,12.8 3.6,12.8"/>',
    '<polygon points="30,10 18.7,10 19.2,11.4 25.6,11.4 24,12.8 28.4,12.8"/>',
    '<polygon points="4.3,14 9.4,14 11.8,16.1 11.6,16.6 5.9,16.6"/>',
    '<polygon points="27.7,14 22.6,14 20.2,16.1 20.4,16.6 26.1,16.6"/>',
    '<polygon points="6.6,17.8 11.2,17.8 10.4,20.4 8.2,20.4"/>',
    '<polygon points="25.4,17.8 20.8,17.8 21.6,20.4 23.8,20.4"/>',
  ].join(""),
  "marshal-heavy-crest": [
    '<polygon points="16,2 19.3,11.8 16,21.6 12.7,11.8"/>',
    '<polygon points="13.2,7.65 11.25,12.4 8.9,11.1"/>',
    '<polygon points="18.8,7.65 20.75,12.4 23.1,11.1"/>',
    '<polygon points="2,8.2 11,13.1 16,25.9 21,13.1 30,8.2 28.2,12.7 21.8,16.9 16,28 10.2,16.9 3.8,12.7"/>',
    '<polygon points="4.3,14 9.8,17.4 12.9,24 6.2,18.7"/>',
    '<polygon points="27.7,14 22.2,17.4 19.1,24 25.8,18.7"/>',
  ].join(""),
};
