# client-poke.io

A React + TypeScript multiplayer game client that renders a top-down arena, listens to a Socket.IO game server, and updates players, projectiles, objects, and HUD state in real time.

## Overview

This project is the frontend for a small browser-based multiplayer action game. It connects to a Socket.IO backend, spawns the current player into the map, renders other connected players, tracks projectile movement, and displays lightweight gameplay UI such as the life bar and respawn message.

The client is currently implemented as a single-page React app with most game state managed through a global context provider.

## Features

- Real-time multiplayer communication through `socket.io-client`
- Large tiled map rendered with static assets from `public/`
- Player rendering with directional sprites
- Keyboard and mouse-driven movement / aiming
- Projectile spawning and live projectile position updates
- World object rendering
- Basic HUD elements for life and respawn state

## Tech Stack

- React 18
- TypeScript
- Create React App
- Socket.IO client
- Chakra UI
- Framer Motion

## Requirements

- Node.js 16+ recommended
- npm
- A compatible Socket.IO game server running separately

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend URL

The Socket.IO client reads its backend URL from `public/config.json` at app startup.

`public/config.json` is intended to be a local, uncommitted file. The repository keeps a template in [public/config.example.json](./public/config.example.json), and `.gitignore` excludes the real runtime file.

Create your local runtime config from the example:

```bash
cp public/config.example.json public/config.json
```

Default config:

```json
{
  "backendUrl": "http://localhost:3001/"
}
```

If your backend runs somewhere else, update `backendUrl` before starting the app or building the image.

### 3. Start the development server

```bash
npm start
```

The app opens at `http://localhost:3000`.

## Available Scripts

```bash
npm start
```

Runs the app in development mode.

```bash
npm run build
```

Builds the production bundle into `build/`.

```bash
npm test
```

Runs the test suite.

## Docker

This repository includes a production `Dockerfile` that builds the React app and serves the generated static files with nginx.

### Build the image

```bash
docker build -t client-poke .
```

### Run the container

```bash
docker run --rm -p 8080:80 client-poke
```

Then open `http://localhost:8080`.

### Notes

- The container serves the compiled frontend only.
- The game server is still a separate dependency and must be reachable by the frontend.
- The backend URL comes from your local `public/config.json`, so create or update that file before building or deploying.

## Gameplay Controls

- `Mouse move`: updates the pointer position used for aiming
- `Click`: emits a `move` event to the server
- `Arrow keys`: moves the local player in 16px steps
- `Q`: fires a projectile toward the current mouse position
- `Right click`: disabled in the browser to avoid context menu interruptions

## Runtime Event Model

The client expects the game server to emit and receive Socket.IO events such as:

- `addPlayer`
- `removePlayer`
- `move`
- `shotProjectil`
- `moveProjectil{id}`
- `explodeProjectil`
- `addObject`
- `playerHurt`
- `playerDeath`
- `playerReborn`

Most of the event wiring lives in [src/components/game/Network.tsx](./src/components/game/Network.tsx), [src/components/game/Ship.tsx](./src/components/game/Ship.tsx), and [src/components/ux/game/lifeBar.tsx](./src/components/ux/game/lifeBar.tsx).

## Project Structure

```text
public/
  character0/         Character sprites
  map0/               Map tile assets
  objects/            World object sprites
  *.png, *.gif        Game art and icons

src/
  components/
    game/
      Game.tsx        Root gameplay composition
      Network.tsx     Socket event subscriptions
      UserControl.tsx Input listeners and client emits
      Map.tsx         World container and mouse tracking
      Ship.tsx        Per-player rendering and movement listener
      Missile.tsx     Projectile rendering
      Objects.tsx     Static object rendering
    ux/
      game/           HUD components
      login/          Unused login UI stub
  context/
    appContext.tsx    Shared game state and reducer
  App.tsx             App entry component
```

## Architecture Notes

- The app renders the main game directly from [src/App.tsx](./src/App.tsx).
- [src/components/game/Game.tsx](./src/components/game/Game.tsx) composes the provider, network layer, controls, world, entities, and HUD.
- [src/context/appContext.tsx](./src/context/appContext.tsx) stores players, projectiles, objects, mouse state, and respawn state.
- Assets are served from `public/` and referenced by absolute paths such as `/character0/TestChar_Up.png`.

## Known Limitations

- Runtime config is file-based through `public/config.json`, not environment-driven yet.
- `public/config.json` is a required local file but is intentionally not committed.
- The test file in [src/App.test.tsx](./src/App.test.tsx) is still the default Create React App test and does not match the current UI.
- Several files contain experimental or unused code paths, especially around login, camera handling, and reducer actions.
- Some state collections are treated like sparse arrays keyed by server IDs, which can make behavior harder to reason about.

## Verification Status

At the time this README was written, `npm test` and `npm run build` could not be executed in this workspace because project dependencies were not installed yet, so `react-scripts` was unavailable.

Install dependencies first with:

```bash
npm install
```

## Next Improvements

- Add an environment-driven runtime config strategy for container deployments
- Replace placeholder tests with gameplay-relevant tests
- Clean up unused context actions and legacy comments
- Document the backend event contract in a dedicated spec
- Add screenshots or a short gameplay preview

# Contact developer

junior.jimenez@klys.dev