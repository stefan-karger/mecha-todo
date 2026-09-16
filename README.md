<p align="center">
  <img src="docs/assets/appicon_logo.png" alt="MECHA//TODO helmet logo" width="160" height="160">
</p>

<h1 align="center">MECHA//TODO</h1>

<p align="center">
  An ADHD-friendly, browser-local todo web app with lightweight XP, ranks, and pixel badges.
</p>

## About

MECHA//TODO is a personal todo list built around one short loop: capture a real task, complete it, receive XP once, see your progress, and leave the app.

The task list stays at the center. Progression adds immediate feedback without introducing currencies, inventories, streak penalties, or another system to maintain.

The planned interface draws from late-1990s mecha command systems while using original artwork and product language.

## Project status

MECHA//TODO V1 implementation is complete. The repository contains the application, its automated test suite, the approved V1 implementation plan, and visual assets. Production deployment is deferred.

The [implementation plan](IMPLEMENTATION_PLAN.md) is the current product and engineering contract. It takes precedence over the earlier [product handoff](docs/MECHA_TODO_IDEA_V4.md) where the two differ.

## V1 capabilities

- Add, edit, complete, reopen, and delete one-line todos.
- Keep a focused Active Bay with overflow in a Standby queue.
- Award XP only on a todo's first completion.
- Track levels, procedural ranks, and deterministic pixel badges.
- Store todos and progression locally in IndexedDB with no account or cloud sync.
- Fit mobile, tablet, and desktop screens through one responsive task-first layout.
- Report local-data failures without silently deleting or replacing stored data.
- Provide visible keyboard, touch, and mouse controls with reduced-motion and forced-colors support.

## Stack

- Solid 2 and TypeScript
- Vite
- Handwritten CSS
- IndexedDB through `idb`
- Valibot
- Playwright

The implementation plan pins the initial dependency versions and defines the compatibility checks required before application work begins.

## Product boundaries

V1 has one local user per browser profile and website origin. It has no backend, authentication, analytics, telemetry, advertising, or third-party runtime requests. It also has no PWA installation, offline guarantee, import, export, backup, or synchronization.

Data cannot move between browsers, profiles, devices, or website addresses in V1. Clearing site data, losing the profile or device, or changing the production address may permanently remove the list. A future specification may add login and make Turso authoritative.

The interaction design may be described as ADHD-friendly or ADHD-oriented. The project does not claim to treat ADHD or provide a clinical benefit.

## Development

Use Node.js 24.15.0 and npm 11.12.1.

```sh
npm install
npm run dev
```

Run the current verification commands with:

```sh
npm run typecheck
npm run build
npm run test:smoke
npm run release:check
```

The [V1 release checklist](docs/release-checklist.md) maps each locally verified acceptance criterion to its automated evidence.
