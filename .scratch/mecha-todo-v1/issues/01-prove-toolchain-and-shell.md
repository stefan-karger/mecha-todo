# 01: Prove the toolchain and static shell

**What to build:** Establish a runnable MECHA//TODO website on the approved Solid 2 toolchain, with one accessible static shell and no application behavior yet.

**Blocked by:** None (can start immediately).

**Status:** DONE

**Specification:** [V1 feature specification](../spec.md)

- [x] Pin the exact Node, npm, Solid, Vite, TypeScript, Tailwind, font, IndexedDB, validation, Playwright, and axe-helper versions from the implementation plan and commit the npm lockfile.
- [x] Do not add a PWA package, manifest, service worker, router, component kit, gesture dependency, state library, or second test runner.
- [x] Development build, production build, and typecheck commands pass without dependency compatibility warnings.
- [x] One Chrome smoke test renders an accessible empty shell at the configured product name.
- [x] Package names, the future database name, and browser-storage keys use the neutral product slug.
- [x] JetBrains Mono Variable loads from the production bundle, and the shell makes no third-party runtime request.

## Comments

- 2026-09-14: Implemented the pinned Solid 2, Vite, TypeScript, Tailwind, and Playwright scaffold. `npm run typecheck`, `npm run build`, and `npm run test:smoke` pass. The Chrome smoke test includes an axe scan, rejects third-party runtime requests, and confirms the bundled Latin JetBrains Mono Variable font.
