import { PRODUCT_NAME } from "../config/product";

export function App() {
  return (
    <div class="app-shell">
      <header class="command-header">
        <p class="system-label">Browser-local task system</p>
        <h1>{PRODUCT_NAME}</h1>
        <p class="storage-note">Your list is stored only in this browser.</p>
      </header>

      <main aria-labelledby="active-bay-heading" class="task-surface">
        <div class="section-heading">
          <h2 id="active-bay-heading">Active Bay</h2>
          <span aria-label="0 active tasks">0 / 8</span>
        </div>
        <p class="empty-state">No active tasks. Add one when you are ready.</p>
      </main>
    </div>
  );
}
