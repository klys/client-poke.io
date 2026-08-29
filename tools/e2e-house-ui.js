/* Headless-Chrome verification of the housing window UI.
 * Seeds an apartment door on Ruta1 (restored on exit), starts server :3001 +
 * static client :3000, walks a fresh user onto the door, screenshots each
 * window state and asserts DOM markers. Run from client-poke.io (after `npm run build`; redis-dev up, nothing on :3000/:3001):
 *   NODE_PATH=node_modules:../server-poke.io/node_modules node tools/e2e-house-ui.js
 *   VW=390 VH=844 … for the phone viewport; screenshots land in build/e2e-house-ui/ (or $SHOT_DIR).
 */
const { createClient } = require("redis");
const { io } = require("socket.io-client");
const WebSocket = require("ws");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "..", "..");
const SERVER_DIR = `${ROOT}/server-poke.io`;
const CLIENT_DIR = `${ROOT}/client-poke.io`;
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "build", "e2e-house-ui");
fs.mkdirSync(OUT, { recursive: true });
const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 800);
const PROFILE = `${OUT}/chrome-profile`;
const TEST_MAP = "map-essentials-020";
const DOOR = { id: "housedoor-ui", x: 33, y: 36 };
const START = { x: 33, y: 37 };
const MAPS_KEY = "designer:section:maps";
const MAPS_PROBE_KEY = "designer:section:maps:probe";
const HOUSES_KEY = "world:houses";
const ITEMS_KEY = "designer:section:items";
const ITEMS_PROBE_KEY = "designer:section:items:probe";
const OBJECTS_KEY = "designer:section:objects";
const OBJECTS_PROBE_KEY = "designer:section:objects:probe";
// Furniture item linked to a 2-tile-wide solid map object.
const SOFA = { id: "item-uisofa", name: "Sofá UI", description: "Un sofá de prueba" };
const OBJ = { id: "object-uisofa", name: "Sofá objeto UI", imageSrc: "/objects/Rock.png", width: 64, height: 32, objectType: "obstacle" };

const stamp = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.log(`[${stamp()}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const check = (cond, label) => {
  if (!cond) throw new Error(`CHECK FAILED: ${label}`);
  passed += 1;
  log(`✔ ${label}`);
};
async function waitFor(label, fn, { timeoutMs = 10000, intervalMs = 100 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await sleep(intervalMs);
  }
}
const httpOk = (url) =>
  new Promise((resolve) => {
    http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); }).on("error", () => resolve(false));
  });
const httpJson = (url) =>
  new Promise((resolve, reject) => {
    http.get(url, (res) => { let s = ""; res.on("data", (d) => (s += d)); res.on("end", () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } }); }).on("error", reject);
  });

function mon(id) {
  return {
    id, sourcePokemonId: "pokemon-BULBASAUR", name: id, level: 12, types: ["Grass"],
    hp: 40, maxHp: 40, ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    moves: ["Placaje"], movePp: { Placaje: 35 }, experience: 0, experienceCurve: "medium",
    nextLevelExperience: 3000, statBonuses: {}
  };
}

// ── CDP mini-client ────────────────────────────────────────────────────
class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = []; }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.on("open", resolve); this.ws.on("error", reject);
      this.ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id && this.pending.has(msg.id)) { const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
        else if (msg.method) this.events.push(msg);
      });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r.result.value;
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    const file = `${OUT}/${name}.png`;
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    log(`📸 ${file}`);
  }
  async hold(key, code, vk, ms) {
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(ms);
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  async press(key, code, vk) { await this.hold(key, code, vk, 60); }
}

const procs = [];
let redis;
let mapsBackup = null, probeBackup = null, housesBackup = null, itemsBackup = null, itemsProbeBackup = null, objectsBackup = null, objectsProbeBackup = null;
let userId = 0, characterId = 0, userIdB = 0, characterIdB = 0;

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  redis = createClient({ url: "redis://127.0.0.1:6379" });
  await redis.connect();

  // ── SEED ──
  mapsBackup = await redis.get(MAPS_KEY);
  probeBackup = await redis.get(MAPS_PROBE_KEY);
  housesBackup = await redis.get(HOUSES_KEY);
  const payload = JSON.parse(mapsBackup);
  const state = payload.state ?? payload;
  const editorDataByMapId = state.editorDataByMapId;
  const candidates = state.items
    .filter((item) => item.id !== TEST_MAP && item.playableMapConfig && editorDataByMapId[item.id]?.tileMap?.collision)
    .map((item) => ({ item, area: (item.playableMapConfig.width ?? 999) * (item.playableMapConfig.height ?? 999) }))
    .filter((e) => e.area >= 36).sort((a, b) => a.area - b.area);
  const template = candidates[0].item;
  template.playableMapConfig.isHouse = true;
  editorDataByMapId[TEST_MAP].houseDoors = [{
    id: DOOR.id, x: DOOR.x, y: DOOR.y, name: "Residencias Venova",
    apartments: [{ price: 500, mapId: template.id }, { price: 700, mapId: template.id }, { price: 1200, mapId: template.id }]
  }];
  payload.version = (payload.version ?? 0) + 1;
  payload.updatedAt = new Date().toISOString();
  await redis.set(MAPS_KEY, JSON.stringify(payload));
  await redis.del(MAPS_PROBE_KEY);
  await redis.del(HOUSES_KEY);
  // Catalog: the sofa (furniture, linked to OBJ) and the map object itself.
  itemsBackup = await redis.get(ITEMS_KEY);
  itemsProbeBackup = await redis.get(ITEMS_PROBE_KEY);
  const itemsPayload = JSON.parse(itemsBackup);
  const itemsState = itemsPayload.state ?? itemsPayload;
  itemsState.items = itemsState.items.filter((item) => item.id !== SOFA.id);
  itemsState.items.push({
    id: SOFA.id, name: SOFA.name, category: "furniture", details: [],
    itemProfile: {
      essentialsId: "UISOFA", iconSrc: "/objects/Rock.png", description: SOFA.description, price: 100,
      pokemonDbCategory: "furniture", effectText: "", effectKind: "none", useCondition: "none", type: "furniture",
      furnitureObjectId: OBJ.id,
      statModifiers: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      skillId: "", skillName: "", pokeballBonusElements: [], pokeballBonusRatio: 0
    }
  });
  if (Array.isArray(itemsState.categories) && !itemsState.categories.includes("furniture")) itemsState.categories.push("furniture");
  itemsPayload.version = (itemsPayload.version ?? 0) + 1;
  itemsPayload.updatedAt = new Date().toISOString();
  await redis.set(ITEMS_KEY, JSON.stringify(itemsPayload));
  await redis.del(ITEMS_PROBE_KEY);
  objectsBackup = await redis.get(OBJECTS_KEY);
  objectsProbeBackup = await redis.get(OBJECTS_PROBE_KEY);
  const objectsPayload = objectsBackup ? JSON.parse(objectsBackup) : { state: { categories: ["E2E"], items: [] } };
  const objectsState = objectsPayload.state ?? objectsPayload;
  objectsState.items = objectsState.items.filter((item) => item.id !== OBJ.id);
  objectsState.items.push({ id: OBJ.id, name: OBJ.name, category: "E2E", details: [], mapObjectAsset: { imageSrc: OBJ.imageSrc, width: OBJ.width, height: OBJ.height, objectType: OBJ.objectType } });
  if (Array.isArray(objectsState.categories) && !objectsState.categories.includes("E2E")) objectsState.categories.push("E2E");
  objectsPayload.version = (objectsPayload.version ?? 0) + 1;
  objectsPayload.updatedAt = new Date().toISOString();
  await redis.set(OBJECTS_KEY, JSON.stringify(objectsPayload));
  await redis.del(OBJECTS_PROBE_KEY);
  log(`seeded door on ${TEST_MAP} → template ${template.id} (${template.name}); sofa item → ${OBJ.id}`);

  // ── SERVER + CLIENT ──
  let serverLog = "";
  const server = spawn(`${SERVER_DIR}/node_modules/.bin/ts-node`, ["index.ts"], {
    cwd: SERVER_DIR, env: { ...process.env, PORT: "3001", SMTP_ENABLED: "false", GIT_SHA: "ui-verify" }, stdio: ["ignore", "pipe", "pipe"], detached: true
  });
  procs.push(server);
  server.stdout.on("data", (d) => (serverLog += d.toString()));
  server.stderr.on("data", (d) => (serverLog += d.toString()));
  const serve = spawn("npx", ["serve", "-s", "build", "-l", "3000"], { cwd: CLIENT_DIR, stdio: "ignore", detached: true });
  procs.push(serve);
  await waitFor("server listening", () => serverLog.includes("Listening on port 3001"), { timeoutMs: 90000 });
  await waitFor("client served", () => httpOk("http://localhost:3000/"), { timeoutMs: 60000 });
  log("stack up");

  // ── USER ──
  const sock = io("http://localhost:3001", { transports: ["websocket"], forceNew: true });
  let session = null;
  sock.on("auth:session", (s) => { if (s?.user?.id) session = s; });
  await waitFor("socket", () => sock.connected);
  const uname = `uihouse${Date.now().toString().slice(-8)}`;
  sock.emit("auth:register", { name: "Uiana", username: uname, email: `${uname}@example.com`, password: "Aa1!aaaa" });
  await waitFor("register", () => session);
  const token = session.token;
  userId = Number(session.user.id);
  characterId = Number(session.user.characterId ?? userId);
  await redis.hSet(`auth:character:${characterId}`, {
    last_map_id: TEST_MAP, last_x: String(START.x * 32), last_y: String(START.y * 32),
    event_self_switches: JSON.stringify({ "129:2:A": true }), follower_enabled: "0", money: "5000",
    pokemon_party: JSON.stringify([mon("ui-m1"), mon("ui-m2")]),
    inventory: JSON.stringify([{ id: SOFA.id, name: SOFA.name, category: "furniture", quantity: 2, description: SOFA.description }])
  });
  await redis.hSet(`auth:user:${userId}`, { pokemon_box: JSON.stringify({ boxes: [] }) });
  sock.disconnect();
  log(`user #${userId} / character #${characterId}`);

  // ── BROWSER ──
  const chrome = spawn("google-chrome", ["--headless=new", "--remote-debugging-port=9223", `--user-data-dir=${PROFILE}`, "--mute-audio", `--window-size=${VW},${VH}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  procs.push(chrome);
  const targets = await waitFor("cdp", async () => { try { return await httpJson("http://localhost:9223/json"); } catch { return null; } }, { timeoutMs: 20000, intervalMs: 300 });
  const page = targets.find((t) => t.type === "page");
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 1, mobile: VW < 600 });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(2500);
  await cdp.eval(`localStorage.setItem('client-poke.io.auth.token', ${JSON.stringify(token)}); localStorage.setItem('client-poke.io.storage.persist-prompt-dismissed','1'); 'ok'`);
  await cdp.send("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor("game mounted", () => cdp.eval(`Boolean(document.getElementById('map'))`), { timeoutMs: 40000, intervalMs: 500 });
  await sleep(4000);
  await cdp.shot("00-ruta1");
  const windowSel = `document.querySelector('[data-house-window]')`;
  check(!(await cdp.eval(`Boolean(${windowSel})`)), "no window on spawn next to the door");

  // ── STEP ON THE DOOR ──
  await cdp.hold("ArrowUp", "ArrowUp", 38, 420);
  await waitFor("door window", () => cdp.eval(`Boolean(${windowSel})`), { timeoutMs: 6000 });
  await sleep(600);
  await cdp.shot("01-apartments");
  const rows = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(rows.length === 4 && rows[0] === `${DOOR.id}-0`, `apartments window lists 3 apartments + cancel (${rows.join(",")})`);
  const overflow = await cdp.eval(`(() => { const dlg = document.querySelector('[role="dialog"]'); const r = dlg.getBoundingClientRect(); return Array.from(dlg.querySelectorAll('[data-house-entry]')).some(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > r.right + 1); })()`);
  check(!overflow, "no row overflows the window");
  check((await cdp.eval(`document.body.dataset.houseMenuActive`)) === "1", "movement locked while the window is open");
  check((await cdp.eval(`document.querySelector('[data-house-title]').textContent`)).toUpperCase().includes("RESIDENCIAS"), "window title is the building name");

  // keyboard: down + enter selects apartment 2
  await cdp.press("ArrowDown", "ArrowDown", 40);
  await cdp.press("Enter", "Enter", 13);
  await sleep(300);
  check((await cdp.eval(`document.querySelector('[data-house-body]').dataset.houseBody`)) === "apartment", "Enter opens the apartment detail");
  await cdp.shot("02-apartment-detail");
  let entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries.join(",") === "enter,buy,back", `free apartment offers enter/buy/back (${entries.join(",")})`);

  // buy it
  await cdp.eval(`document.querySelector('[data-house-entry="buy"]').click(); 'ok'`);
  await waitFor("buy result", () => cdp.eval(`Boolean(document.querySelector('[data-house-result="ok"]'))`), { timeoutMs: 6000 });
  await cdp.shot("03-bought");
  await waitFor("window closed", () => cdp.eval(`!${windowSel}`), { timeoutMs: 6000 });
  check(true, "buy shows a result and the window closes");
  check(!(await cdp.eval(`Boolean(${windowSel})`)), "window stays closed while still standing on the door");

  // step off and back on → re-opens; owner actions
  await cdp.hold("ArrowDown", "ArrowDown", 40, 420);
  await sleep(600);
  await cdp.hold("ArrowUp", "ArrowUp", 38, 420);
  await waitFor("door window again", () => cdp.eval(`Boolean(${windowSel})`), { timeoutMs: 6000 });
  await sleep(400);
  const chips = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-chip]')).map(b => b.dataset.houseChip)`);
  check(chips.join(",") === "free,yours,free", `chips reflect ownership (${chips.join(",")})`);
  await cdp.eval(`document.querySelector('[data-house-entry="${DOOR.id}-1"]').click(); 'ok'`);
  await sleep(300);
  entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries.join(",") === "enter,setKey,sell,back", `owner offers enter/setKey/sell/back (${entries.join(",")})`);
  await cdp.shot("04-owner-actions");
  await cdp.eval(`document.querySelector('[data-house-entry="setKey"]').click(); 'ok'`);
  await sleep(300);
  for (const d of ["1", "2", "3", "4"]) await cdp.eval(`document.querySelector('[data-house-keypad-key="${d}"]').click(); 'ok'`);
  await cdp.shot("05-keypad");
  check((await cdp.eval(`document.querySelector('[data-house-keypad-value]').dataset.houseKeypadValue`)) === "1234", "keypad collects digits");
  await cdp.eval(`document.querySelector('[data-house-keypad-key="OK"]').click(); 'ok'`);
  await waitFor("key result", () => cdp.eval(`Boolean(document.querySelector('[data-house-result="ok"]'))`), { timeoutMs: 6000 });
  await waitFor("window closed", () => cdp.eval(`!${windowSel}`), { timeoutMs: 6000 });

  // A second (socket-only) user buys apartment 1 and locks it with 4321.
  const sockB = io("http://localhost:3001", { transports: ["websocket"], forceNew: true });
  let sessionB = null; const resultsB = []; let myPlayerB = "";
  sockB.on("auth:session", (s) => { if (s?.user?.id) sessionB = s; });
  sockB.on("house:result", (r) => resultsB.push(r));
  sockB.on("myPlayer", (p) => { myPlayerB = p?.id ?? "x"; });
  await waitFor("socket B", () => sockB.connected);
  const unameB = `uihouseb${Date.now().toString().slice(-8)}`;
  sockB.emit("auth:register", { name: "Beto", username: unameB, email: `${unameB}@example.com`, password: "Aa1!aaaa" });
  await waitFor("register B", () => sessionB);
  userIdB = Number(sessionB.user.id);
  characterIdB = Number(sessionB.user.characterId ?? userIdB);
  await redis.hSet(`auth:character:${characterIdB}`, {
    last_map_id: TEST_MAP, last_x: String(START.x * 32), last_y: String(START.y * 32),
    event_self_switches: JSON.stringify({ "129:2:A": true }), follower_enabled: "0", money: "5000",
    pokemon_party: JSON.stringify([mon("b-m1")]), inventory: "[]"
  });
  await redis.hSet(`auth:user:${userIdB}`, { pokemon_box: JSON.stringify({ boxes: [] }) });
  sockB.emit("addPlayer", { token: sessionB.token });
  await waitFor("B joined", () => myPlayerB);
  await sleep(800);
  sockB.emit("house:buy", { apartmentId: `${DOOR.id}-0` });
  await waitFor("B bought", () => resultsB.find((r) => r.action === "buy"));
  check(resultsB.find((r) => r.action === "buy").ok, `B bought apartment 1 (${resultsB.find((r) => r.action === "buy").messageKey})`);
  sockB.emit("house:set-key", { apartmentId: `${DOOR.id}-0`, keyCode: "4321" });
  await waitFor("B key", () => resultsB.find((r) => r.action === "key"));
  check(resultsB.find((r) => r.action === "key").ok, "B locked it with a key code");
  sockB.disconnect();

  // wrong key → inline error keeps the keypad open; right key enters
  await cdp.hold("ArrowDown", "ArrowDown", 40, 420);
  await sleep(600);
  await cdp.hold("ArrowUp", "ArrowUp", 38, 420);
  await waitFor("door window 3", () => cdp.eval(`Boolean(${windowSel})`), { timeoutMs: 6000 });
  await sleep(400);
  const chips2 = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-chip]')).map(b => b.dataset.houseChip)`);
  check(chips2.join(",") === "owned,yours,free", `chips show the other owner (${chips2.join(",")})`);
  await cdp.shot("06-mixed-list");
  await cdp.eval(`document.querySelector('[data-house-entry="${DOOR.id}-0"]').click(); 'ok'`);
  await sleep(200);
  entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries.join(",") === "enter,back", `someone else's locked apartment only offers enter/back (${entries.join(",")})`);
  await cdp.eval(`document.querySelector('[data-house-entry="enter"]').click(); 'ok'`);
  await sleep(200);
  check((await cdp.eval(`document.querySelector('[data-house-body]').dataset.houseBody`)) === "keypad", "a locked apartment asks for the code");
  for (const d of ["9", "9", "9", "9"]) await cdp.press(d, `Digit${d}`, 48 + Number(d));
  await cdp.press("Enter", "Enter", 13);
  await waitFor("wrong key notice", () => cdp.eval(`Boolean(document.querySelector('[data-house-notice="error"]'))`), { timeoutMs: 6000 });
  check((await cdp.eval(`document.querySelector('[data-house-body]').dataset.houseBody`)) === "keypad", "wrong key keeps the keypad open with an inline error");
  await cdp.shot("07-wrong-key");
  for (const d of ["4", "3", "2", "1"]) await cdp.press(d, `Digit${d}`, 48 + Number(d));
  await cdp.press("Enter", "Enter", 13);
  await waitFor("inside B's house", () => cdp.eval(`!${windowSel}`), { timeoutMs: 8000 });
  await sleep(2500);
  await cdp.shot("08-inside-other-house");
  await cdp.eval(`window.dispatchEvent(new CustomEvent('pokecraft:house-menu', { detail: {} })); 'ok'`);
  await waitFor("visitor house window", () => cdp.eval(`${windowSel}?.dataset.houseWindow === 'house'`), { timeoutMs: 4000 });
  entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries.join(",") === "leave,cancel", `visitor only gets leave/cancel (${entries.join(",")})`);
  await cdp.eval(`document.querySelector('[data-house-entry="leave"]').click(); 'ok'`);
  await waitFor("back outside", () => cdp.eval(`!${windowSel}`), { timeoutMs: 8000 });
  await sleep(2500);

  // own apartment: enter directly (owner needs no code)
  await cdp.hold("ArrowDown", "ArrowDown", 40, 420);
  await sleep(600);
  await cdp.hold("ArrowUp", "ArrowUp", 38, 420);
  await waitFor("door window 4", () => cdp.eval(`Boolean(${windowSel})`), { timeoutMs: 6000 });
  await sleep(400);
  await cdp.eval(`document.querySelector('[data-house-entry="${DOOR.id}-1"]').click(); 'ok'`);
  await sleep(200);
  await cdp.eval(`document.querySelector('[data-house-entry="enter"]').click(); 'ok'`);
  await waitFor("inside own house", () => cdp.eval(`!${windowSel}`), { timeoutMs: 8000 });
  await sleep(2500);
  await cdp.shot("09-inside-house");
  check(!(await cdp.eval(`Boolean(${windowSel})`)), "entering closes the window");

  // Furniture linked to a map object: place it next to the player (the camera
  // keeps the player at the viewport centre), it must draw the 64x32 object.
  await cdp.eval(`window.dispatchEvent(new CustomEvent('pokecraft:house-place', { detail: { itemId: ${JSON.stringify(SOFA.id)}, itemName: ${JSON.stringify(SOFA.name)} } })); 'ok'`);
  await waitFor("placing banner", () => cdp.eval(`Boolean(document.querySelector('[data-house-placing]'))`), { timeoutMs: 4000 });
  const pieceSel = `document.querySelector('[data-house-furniture-object="${OBJ.id}"]')`;
  let placedDir = null;
  for (const dir of [{ dx: 1, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 1 }, { dx: -2, dy: 1 }]) {
    const px = 1280 / 2 + dir.dx * 32 + 8, py = 800 / 2 + dir.dy * 32 + 8;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: px, y: py, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: px, y: py, button: "left", clickCount: 1 });
    await sleep(900);
    if (await cdp.eval(`Boolean(${pieceSel})`)) { placedDir = dir; break; }
    // A refused cell shows the reason under the banner; keep the placement armed.
    if (!(await cdp.eval(`Boolean(document.querySelector('[data-house-placing]'))`))) {
      await cdp.eval(`window.dispatchEvent(new CustomEvent('pokecraft:house-place', { detail: { itemId: ${JSON.stringify(SOFA.id)}, itemName: ${JSON.stringify(SOFA.name)} } })); 'ok'`);
      await sleep(200);
    }
  }
  check(placedDir !== null, `linked furniture placed (${JSON.stringify(placedDir)})`);
  const pieceBox = await cdp.eval(`(() => { const el = ${pieceSel}; const img = el.querySelector('img'); const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, imgW: img?.getAttribute('width'), src: img?.getAttribute('src') }; })()`);
  check(pieceBox.w === 64 && pieceBox.h === 32 && pieceBox.imgW === "64" && String(pieceBox.src).includes("Rock.png"), `piece draws the map object at 64x32 px (${JSON.stringify(pieceBox)})`);
  await cdp.shot("09b-linked-furniture");
  // Clicking the piece's SECOND tile must still hit it (footprint lookup).
  await waitFor("placement toast gone", () => cdp.eval(`!document.querySelector('[data-house-placing]')`), { timeoutMs: 6000 });
  const pieceRect = await cdp.eval(`(() => { const r = ${pieceSel}.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pieceRect.x + 48, y: pieceRect.y + 16, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pieceRect.x + 48, y: pieceRect.y + 16, button: "left", clickCount: 1 });
  await waitFor("furniture window", () => cdp.eval(`${windowSel}?.dataset.houseWindow === 'house'`), { timeoutMs: 4000 });
  entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries[0] === "pick", `clicking the 2nd tile of the piece offers Pick up (${entries.join(",")})`);
  await cdp.shot("09c-furniture-menu");
  await cdp.eval(`document.querySelector('[data-house-entry="pick"]').click(); 'ok'`);
  await waitFor("picked", () => cdp.eval(`!${pieceSel}`), { timeoutMs: 6000 });
  await waitFor("window closed", () => cdp.eval(`!${windowSel}`), { timeoutMs: 6000 });
  check(true, "piece picked up (removed from the map)");

  // house menu via the interact event (what Space/right-click dispatch)
  await cdp.eval(`window.dispatchEvent(new CustomEvent('pokecraft:house-menu', { detail: {} })); 'ok'`);
  await waitFor("house window", () => cdp.eval(`${windowSel}?.dataset.houseWindow === 'house'`), { timeoutMs: 4000 });
  entries = await cdp.eval(`Array.from(document.querySelectorAll('[data-house-entry]')).map(b => b.dataset.houseEntry)`);
  check(entries.join(",") === "rename,music,leave,cancel", `house window offers rename/music/leave/cancel (${entries.join(",")})`);
  await cdp.shot("10-house-menu");
  await cdp.eval(`document.querySelector('[data-house-entry="music"]').click(); 'ok'`);
  await waitFor("music list", () => cdp.eval(`document.querySelector('[data-house-body]')?.dataset.houseBody === 'music'`), { timeoutMs: 6000 });
  await sleep(300);
  const musicRows = await cdp.eval(`document.querySelectorAll('[data-house-entry]').length`);
  check(musicRows > 5, `music list populated (${musicRows} rows)`);
  const musicOverflow = await cdp.eval(`(() => { const dlg = document.querySelector('[role="dialog"]'); const r = dlg.getBoundingClientRect(); return r.bottom <= window.innerHeight && Array.from(dlg.querySelectorAll('[data-house-entry]')).every(b => b.scrollWidth <= b.clientWidth + 1); })()`);
  check(musicOverflow, "music list scrolls inside the window without overflow");
  await cdp.shot("11-music");
  await cdp.press("Escape", "Escape", 27);
  await sleep(200);
  await cdp.eval(`document.querySelector('[data-house-entry="rename"]').click(); 'ok'`);
  await sleep(300);
  await cdp.eval(`(() => { const i = document.querySelector('[data-house-name-input]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i, 'Casa de Uiana'); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
  await cdp.shot("12-rename");
  await cdp.eval(`document.querySelector('[data-house-entry="saveName"]').click(); 'ok'`);
  await waitFor("rename result", () => cdp.eval(`Boolean(document.querySelector('[data-house-result="ok"]'))`), { timeoutMs: 6000 });
  await waitFor("window closed", () => cdp.eval(`!${windowSel}`), { timeoutMs: 6000 });
  await sleep(300);
  check((await cdp.eval(`document.body.innerText`)).includes("Casa de Uiana"), "renamed house name is shown in the world");

  // leave → lands on the door → window must NOT auto-open
  await cdp.eval(`window.dispatchEvent(new CustomEvent('pokecraft:house-menu', { detail: {} })); 'ok'`);
  await waitFor("house window 2", () => cdp.eval(`${windowSel}?.dataset.houseWindow === 'house'`), { timeoutMs: 4000 });
  await cdp.eval(`document.querySelector('[data-house-entry="leave"]').click(); 'ok'`);
  await waitFor("back outside", () => cdp.eval(`!${windowSel}`), { timeoutMs: 8000 });
  await sleep(3000);
  check(!(await cdp.eval(`Boolean(${windowSel})`)), "landing on the door after leaving does not re-open the window");
  await cdp.shot("13-back-on-door");
  // …but stepping off and on again does
  await cdp.hold("ArrowDown", "ArrowDown", 40, 420);
  await sleep(600);
  await cdp.hold("ArrowUp", "ArrowUp", 38, 420);
  await waitFor("door window 4", () => cdp.eval(`Boolean(${windowSel})`), { timeoutMs: 6000 });
  check(true, "stepping off and back on re-opens the window");
  await cdp.press("Escape", "Escape", 27);
  await sleep(200);
  check(!(await cdp.eval(`Boolean(${windowSel})`)), "Esc closes the window");

  // ── DESIGNER: the type-driven item form ──
  await redis.hSet(`auth:user:${userId}`, { role: "admin" });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(3000);
  await cdp.send("Page.navigate", { url: "http://localhost:3000/#/designer/items" });
  await cdp.eval(`location.reload(); 'ok'`);
  const editSel = `document.querySelector('[aria-label="Edit ${SOFA.name}"]')`;
  // The list is paginated: search the sofa by name.
  await waitFor("designer search box", () => cdp.eval(`Boolean(document.querySelector('input[placeholder="Search items by name"]'))`), { timeoutMs: 60000, intervalMs: 500 });
  await cdp.eval(`(() => { const i = document.querySelector('input[placeholder="Search items by name"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(SOFA.name)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
  try {
    await waitFor("designer items list", () => cdp.eval(`Boolean(${editSel}) && !${editSel}.disabled`), { timeoutMs: 60000, intervalMs: 500 });
  } catch (error) {
    await cdp.shot("debug-designer");
    log("designer page text:", (await cdp.eval(`document.body.innerText.slice(0, 600)`)).replace(/\n+/g, " | "));
    log("edit buttons:", await cdp.eval(`document.querySelectorAll('[aria-label^="Edit "]').length`), "url:", await cdp.eval(`location.href`));
    throw error;
  }
  await sleep(500);
  await cdp.eval(`${editSel}.scrollIntoView({ block: 'center' }); ${editSel}.click(); 'ok'`);
  const objectSel = `document.querySelector('[data-testid="item-furniture-object"]')`;
  await waitFor("furniture form", () => cdp.eval(`Boolean(${objectSel})`), { timeoutMs: 10000 });
  await sleep(400);
  const furnitureForm = await cdp.eval(`(() => { const labels = Array.from(document.querySelectorAll('[role="dialog"] label')).map(l => l.textContent.trim()); return { object: ${objectSel}.value, labels, hasImport: document.body.innerText.includes('Essentials import data') }; })()`);
  check(furnitureForm.object === OBJ.id, `furniture item form preselects its map object (${furnitureForm.object})`);
  check(!furnitureForm.labels.some((l) => l.startsWith("Effect Kind")) && furnitureForm.labels.some((l) => l.startsWith("Map object")), `furniture form hides effect fields, shows the map object picker (${furnitureForm.labels.join(" | ")})`);
  check(furnitureForm.hasImport, "Essentials import data is tucked into a collapsed section");
  await cdp.eval(`document.querySelector('[role="dialog"]').scrollTop = 0; 'ok'`);
  await cdp.shot("14-designer-furniture-form");
  // Switching the type re-shapes the form (no save).
  await cdp.eval(`(() => { const sel = Array.from(document.querySelectorAll('[role="dialog"] select')).find(s => Array.from(s.options).some(o => o.value === 'medicine')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, 'medicine'); sel.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
  await sleep(400);
  const medicineForm = await cdp.eval(`(() => { const labels = Array.from(document.querySelectorAll('[role="dialog"] label')).map(l => l.textContent.trim()); return { labels, hasObject: Boolean(${objectSel}) }; })()`);
  check(medicineForm.labels.some((l) => l.startsWith("Effect Kind")) && medicineForm.labels.some((l) => l === "HP") && !medicineForm.hasObject, `medicine form shows effect + stat fields and drops the map object picker`);
  await cdp.shot("15-designer-medicine-form");

  log(`ALL PASSED (${passed} checks)`);
}

async function cleanup() {
  try {
    // npx/ts-node wrappers: kill the whole process group or the real server/serve child survives.
    for (const p of procs) { try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch {} } }
    try { const { execSync } = require("child_process"); execSync(`pkill -f 'user-data-dir=${PROFILE}' || true`); } catch {}
    if (redis) {
      if (mapsBackup !== null) await redis.set(MAPS_KEY, mapsBackup);
      if (probeBackup !== null) await redis.set(MAPS_PROBE_KEY, probeBackup); else await redis.del(MAPS_PROBE_KEY);
      if (housesBackup !== null) await redis.set(HOUSES_KEY, housesBackup); else await redis.del(HOUSES_KEY);
      if (itemsBackup !== null) await redis.set(ITEMS_KEY, itemsBackup);
      if (itemsProbeBackup !== null) await redis.set(ITEMS_PROBE_KEY, itemsProbeBackup); else await redis.del(ITEMS_PROBE_KEY);
      if (objectsBackup !== null) await redis.set(OBJECTS_KEY, objectsBackup); else await redis.del(OBJECTS_KEY);
      if (objectsProbeBackup !== null) await redis.set(OBJECTS_PROBE_KEY, objectsProbeBackup); else await redis.del(OBJECTS_PROBE_KEY);
      if (userId) { await redis.del(`auth:user:${userId}`); await redis.del(`auth:character:${characterId}`); }
      if (userIdB) { await redis.del(`auth:user:${userIdB}`); await redis.del(`auth:character:${characterIdB}`); }
      await redis.quit();
      log("redis restored");
    }
  } catch (e) { log("cleanup error", e.message); }
}

main().then(async () => { await cleanup(); process.exit(0); }, async (e) => { log("FAILED:", e.message); await cleanup(); process.exit(1); });
