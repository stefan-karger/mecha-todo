import { render } from "@solidjs/web";
import { App } from "../../src/app/App";
import type { AppRepository } from "../../src/persistence/repository";

export function mountApp(repository: AppRepository): void {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing test root.");
  const replacement = root.cloneNode(false) as HTMLElement;
  root.replaceWith(replacement);
  render(() => App({ repository }), replacement);
}
