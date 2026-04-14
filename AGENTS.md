# AGENTS.md

This file is a quick guide for coding agents working in this repository.

## Project Summary

- React 18 + TypeScript client for a multiplayer browser game
- Built with Create React App
- Uses `socket.io-client` for real-time gameplay updates
- Uses Chakra UI, Framer Motion, and React Router
- Runtime backend URL is loaded from `public/config.json`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local runtime config:

```bash
cp public/config.example.json public/config.json
```

3. Start the app:

```bash
npm start
```

## Common Commands

```bash
npm start
npm run build
npm test
```

## Key Files

- `src/App.tsx`: Loads `/config.json`, builds the router, and mounts `AuthProvider`
- `src/endpoint.ts`: Central route definition via `createHashRouter`
- `src/context/authContext.tsx`: Authentication/session state
- `src/context/appContext.tsx`: Shared gameplay state
- `src/components/game/`: Live gameplay components, networking, movement, map, objects, and projectiles
- `src/components/ux/auth/`: Auth-related UI
- `src/components/designer/`: Designer/editor views
- `public/`: Static assets and runtime config template

## Repo-Specific Notes

- Treat `public/config.json` as local-only. It is intentionally gitignored.
- If runtime config shape changes, update `public/config.example.json` instead of committing `public/config.json`.
- Do not hand-edit `build/`. It is generated output.
- Keep new route wiring in `src/endpoint.ts` unless the routing structure is being intentionally redesigned.
- The app currently uses hash-based routing. Do not switch routing strategy casually.
- TypeScript path aliases are available:
  - `@components/*` -> `src/components/*`
  - `@context/*` -> `src/context/*`
- The codebase mixes newer typed code with some older patterns and inconsistent style. Match the surrounding file when making localized edits.

## Testing And Verification

- Run `npm run build` after meaningful code changes when possible.
- Run `npm test` for relevant UI logic changes, but note that the current suite is minimal and includes placeholder CRA-era coverage.
- Manual testing usually requires a working Socket.IO backend and a valid local `public/config.json`.

## Agent Guidelines

- Prefer editing source files under `src/` and static assets/templates under `public/`.
- Avoid broad refactors unless the task calls for them. Several areas appear mid-transition.
- When a change depends on backend behavior, document the assumption clearly in the final handoff.
