# V1 release checklist

Run the local release gate with:

```sh
npm run release:check
```

Playwright type-checks and builds the application, starts Vite preview on a dedicated strict port, and runs the required mobile, tablet, and desktop Chrome projects against that production bundle. It never reuses a running server. After the browser suite passes, the command audits the same `dist` output for forbidden production features. Production deployment and origin-specific checks are deferred.

## Todo behavior

| Acceptance criterion | Evidence |
|---|---|
| A fresh dataset shows level 0 Cadet and an empty Active Bay. | `tests/e2e/shell.spec.ts`, `tests/e2e/progression-settings-badges.spec.ts` |
| A valid todo saves in one action and survives reload. | `tests/e2e/application.spec.ts` |
| Text normalization and the 280-code-point limit match the contract. | `tests/domain/todo-text.spec.ts`, `tests/e2e/release-gates.spec.ts` |
| Active, Standby, and Completed ordering remains stable across clock changes. | `tests/e2e/repository.spec.ts` |
| Capacity affects new placement but never blocks reopen. | `tests/domain/capacity.spec.ts`, `tests/e2e/completion-repository.spec.ts` |
| Completion and Active deletion share the transaction helper that promotes the oldest Standby todos. | `tests/e2e/completion-repository.spec.ts`, `tests/e2e/delete-repository.spec.ts` |
| A committed status change keeps one row visible while an open paged list refresh is delayed or fails. | `tests/e2e/todo-row-actions.spec.ts` (`keeps a reopened todo in one section while Completed refresh is delayed`, `reports a committed mutation when a paged-list refresh fails`) |
| Editing any status has no XP or ordering side effect. | `tests/e2e/todo-row-actions.spec.ts` |
| Every task action has a visible touch, mouse, and keyboard path. | `tests/e2e/todo-row-actions.spec.ts`, `tests/e2e/release-gates.spec.ts` |
| Delete commits immediately, offers a five-second in-memory Undo, and retains XP. | `tests/domain/delete-undo.spec.ts`, `tests/e2e/delete-repository.spec.ts`, `tests/e2e/todo-row-actions.spec.ts` |

## Rewards and progression

| Acceptance criterion | Evidence |
|---|---|
| First completion creates exactly one immutable award. | `tests/e2e/completion-repository.spec.ts` |
| Reopen and re-complete create no additional XP. | `tests/e2e/completion-repository.spec.ts`, `tests/e2e/progression-settings-badges.spec.ts` |
| The reopen, over-capacity, and re-complete progression scenario remains stable across ten consecutive runs. | `tests/e2e/todo-row-actions.spec.ts` (`completes both open statuses, reopens over capacity, and re-completes without XP`) |
| Deletion never changes Lifetime XP. | `tests/e2e/delete-repository.spec.ts` |
| LINK and milestone-only COMBO match rules V1. | `tests/domain/rewards.spec.ts`, `tests/e2e/progression-settings-badges.spec.ts` |
| Deleted awards continue to count for ordinals, LINK, and progression. | `tests/e2e/completion-repository.spec.ts`, `tests/e2e/delete-repository.spec.ts` |
| Level thresholds and procedural ranks match the reference cases. | `tests/domain/progression.spec.ts`, `tests/domain/ranks.spec.ts` |
| Current-level XP appears in the HUD and Lifetime XP appears in Progression details. | `tests/e2e/progression-settings-badges.spec.ts` |
| Every tested rank produces a deterministic badge and accessible canonical title. | `tests/domain/badge.spec.ts`, `tests/domain/rank-badge-renderer.spec.ts`, `tests/e2e/progression-settings-badges.spec.ts` |

## Browser-local data

| Acceptance criterion | Evidence |
|---|---|
| IndexedDB is authoritative and task data never enters a network request. | `tests/e2e/database.spec.ts`, `tests/e2e/release-gates.spec.ts` |
| Todos, awards, ordering, and XP survive a normal reload. | `tests/e2e/application.spec.ts`, `tests/e2e/repository.spec.ts` |
| Transaction constraints prevent duplicate awards and daily ordinals. | `tests/e2e/completion-repository.spec.ts` |
| Another tab's removal produces a reload instruction. | `tests/e2e/repository.spec.ts`, `tests/e2e/delete-repository.spec.ts` |
| Invalid or inaccessible data produces the blocking local-data error state. | `tests/e2e/startup-erasure.spec.ts`, `tests/e2e/application.spec.ts` |
| No automatic path deletes, repairs, or replaces the database. | `tests/e2e/startup-erasure.spec.ts` |
| Confirmed erasure returns the app to level 0 and clears the composer draft. | `tests/e2e/startup-erasure.spec.ts`, `tests/e2e/application.spec.ts` |
| Settings states that data is browser-local and cannot be transferred in V1. | `tests/e2e/progression-settings-badges.spec.ts` |

## Responsive interface and accessibility

| Acceptance criterion | Evidence |
|---|---|
| The three release viewports pass in Chrome. | `mobile-chrome`, `tablet-chrome`, and `desktop-chrome` projects in `playwright.config.ts` |
| All viewports use the same one-column, task-first hierarchy. | `tests/e2e/release-gates.spec.ts` |
| Mobile uses dynamic viewport sizing with contained sticky regions. | `tests/e2e/release-gates.spec.ts` |
| A 280-code-point todo and long rank preserve actions without horizontal overflow. | `tests/e2e/release-gates.spec.ts` |
| Settings is full-screen on mobile and constrained on tablet and desktop. | `tests/e2e/progression-settings-badges.spec.ts`, `tests/e2e/release-gates.spec.ts` |
| Accessibility checks cover focus, motion, forced colors, text enlargement, target size, and axe. | `tests/e2e/release-gates.spec.ts` |
| Reward feedback does not block the next task action. | `tests/e2e/progression-settings-badges.spec.ts`, `tests/e2e/todo-row-actions.spec.ts` |

## Privacy and release

| Acceptance criterion | Evidence |
|---|---|
| Production makes no third-party request and sends no task content off device. | `tests/e2e/release-gates.spec.ts`, `scripts/verify-production.mjs` |
| Production omits manifest, service worker, install, file-data, storage-protection, and synchronization code. | `scripts/verify-production.mjs` |
| Every Playwright command type-checks and builds before Vite preview starts on dedicated strict ports, with server reuse disabled. | `playwright.config.ts`, `vite.playwright.config.ts`, `package.json` |
| The release command audits the same production output tested by the browser suite and rejects Tailwind output. | `package.json`, `scripts/verify-production.mjs` |
| The three required Chrome projects pass. | `npm run release:check` |

## Visual review

`tests/e2e/visual-review.spec.ts` captures empty, ordinary, expanded, reward, long-content, Settings, local-data error, and erasure-confirmation states in each release project. The completed review covered all generated artifacts under `test-results/`.
