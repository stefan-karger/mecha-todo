export function trapDialogTab(event: KeyboardEvent, dialog: HTMLDialogElement): void {
  if (event.key !== "Tab") return;

  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => element.getClientRects().length > 0);
  const first = controls.at(0);
  const last = controls.at(-1);
  if (!first || !last) return;

  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
