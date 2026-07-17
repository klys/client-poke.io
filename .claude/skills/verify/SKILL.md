---
name: verify
description: Build, launch, and drive the poke.io client+server stack end-to-end (headless Chrome + socket drivers) to verify client changes at the real UI surface.
---

# Verifying client-poke.io changes end-to-end

## Bring up the stack (nothing runs by default)

1. Redis with real game data: `bash ../server-poke.io/redis_dev_start.sh` (docker container `redis-dev`, data persisted in `../server-poke.io/data`).
2. Game server: `cd ../server-poke.io && npm run dev` (port 3001, reads `.env` via dotenvx).
3. Client: `npm run build` then `npx serve -s build -l 3000`. `public/config.json` + `build/config.json` already point `backendUrl` at `http://localhost:3001/`.

## Drive it

- Headless browser: `google-chrome --headless=new --remote-debugging-port=9223 --user-data-dir=<scratch> --mute-audio about:blank`, then raw CDP over WebSocket (`ws` + `socket.io-client` both resolve with `NODE_PATH=node_modules` from this repo — no installs needed). `Page.navigate`, `Runtime.evaluate`, `Page.captureScreenshot`.
- Auth: register via socket `auth:register {name, username, email, password}` — **name must be letters only**. Response event `auth:session` carries `{token, user.id}`. Seed the browser with `localStorage.setItem('client-poke.io.auth.token', token)` then reload; the app auto-joins (`addPlayer {token}`).
- Skip the Chrisanta intro autorun (it blocks the new-user screen): `docker exec redis-dev redis-cli hset auth:user:<id> event_self_switches '{"129:2:A":true}' last_map_id map-essentials-015 last_x 288 last_y 256` BEFORE the user's first `addPlayer`. The spawn override matters: EventRuntime's stranded-player recovery CLEARS a preset intro self-switch for anyone standing on the initial map (129) and replays the intro over your test — spawning in the home map (015) sidesteps it.
- `pkill -f <pattern>` from a driver script kills the driver's own wrapper shell when the pattern appears in its command line (exit 144). Kill Chrome via `kill $(pgrep -f 'user-data-dir=<profile>')` instead, and note plain `pgrep -f` also matches the wrapper — check PIDs, not just exit status.
- Party: `auth:choose-starter {pokemonId: "pokemon-CHARMANDER"}` (also SQUIRTLE/BULBASAUR); wait for `auth:info`.
- Extra node sockets can share the browser user's player (multi-connection): emit `addPlayer {token}` on a second socket, then accept challenges etc. from there. Disconnecting a non-last socket does NOT surrender battles; disconnecting a player's LAST socket mid-trainer-battle force-ends it ("surrendered") — useful to end battles deterministically.
- PvP battle: `battle:challenge-player {targetPlayerId}` (playerId = `user:<id>`, from `myPlayer`/`addPlayer` events) → target answers `battle:challenge-response {challengeId, accepted:true}`. Actions: `battle:action {battleId, action: {type:"fight", moveId}}` — PvP turns resolve only after BOTH sides act.
- Battle UI DOM markers: buttons `FIGHT/BAG/VENOMONS/GIVE UP` when the command menu is idle; while event text plays only `LOG` + the message box are present — probe for `FIGHT` OR body text like "started a battle".

## Reference driver

A full working scenario (two back-to-back PvP battles, screenshots, DOM assertions) lived at the session scratchpad as `battle-vanish-e2e.js` (2026-07-16 session 3a50c6c8); pattern is worth copying: register → preset self-switch → starter → addPlayer → CDP browser as user A → challenge/accept via companion sockets.
