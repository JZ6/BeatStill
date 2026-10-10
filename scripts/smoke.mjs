#!/usr/bin/env node
// Headless browser smoke test for Beat Still.
//
// Expects a fresh build in dist/ (`npm run smoke` builds first). Serves it with
// `vite preview`, drives headless Chrome over the DevTools protocol, plays two
// short endless runs (with a pause/resume check), a boss check (Sentinel and
// Phantom phase changes on bar lines), a mutator check (phrase-boundary
// activation, key change, double-time tempo, kept across a palette switch), the
// first campaign level (with the dev Skip Wave completing it on a bar line) and a
// level-designer song-settings round trip, the first-run tutorial driven by real
// input (move, aim and fire must complete; finishing or skipping starts endless
// exactly once), a run with Options → Heartbeat off (no heart notes), and a theme
// preview in the collection, and fails on any uncaught exception,
// console error, or failed resource load, when the time scale / conductor clock /
// pause freeze misbehave, when enemies don't fire on the step grid, when endless
// enemy groups don't spawn on bar lines across more than one bar, when a level's
// first wave misses its bar line or its music.bpm isn't the conductor's tempo,
// when held-fire player shots leave their weapon's grid or the lead role (the
// player's shots) schedules no notes, or when the audio engine doesn't start,
// schedules too few notes, or reports errors. Prints the audio dropped/scheduled
// ratio.
// No extra dependencies: uses Node's built-in WebSocket.
//
// Env overrides: CHROME_PATH, SMOKE_PREVIEW_PORT, SMOKE_DEBUG_PORT.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_PORT = Number(process.env.SMOKE_PREVIEW_PORT ?? 4317);
const DEBUG_PORT = Number(process.env.SMOKE_DEBUG_PORT ?? 9339);
const APP_URL = `http://127.0.0.1:${PREVIEW_PORT}/BeatStill/`;
const ARTIFACT_DIR = join(ROOT, "smoke-artifacts");
const VIEWPORT = { width: 1280, height: 720 };

const problems = [];
const warnings = [];
/** The smoke segment running now; console warnings are tagged with it. */
let segment = "boot";
const children = [];
let userDataDir = null;
let shuttingDown = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (err) {
      lastErr = err;
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${label}${lastErr ? ` (${lastErr.message})` : ""}`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found; set CHROME_PATH");
  return found;
}

function startChild(cmd, args, name) {
  const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code !== null && code !== 0) log(`${name} exited with code ${code}\n${output.slice(-2000)}`);
    else if (signal && signal !== "SIGTERM") log(`${name} killed by ${signal}`);
  });
  children.push(child);
  return child;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const l of this.listeners) l(msg.method, msg.params);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(`evaluate failed: ${d.exception?.description ?? d.text}`);
  }
  return r.result.value;
}

const GAME = "window.__BEATSTILL__.game";

async function screenshot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const file = join(ARTIFACT_DIR, `${name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function mouse(cdp, type, x, y, pressed) {
  await cdp.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? (pressed ? "left" : "none") : "left",
    buttons: pressed ? 1 : 0,
    clickCount: type === "mouseMoved" ? 0 : 1,
  });
}

function readGameState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const s = ${GAME}.scene.getScene("GameScene");
      return {
        active: ${GAME}.scene.isActive("GameScene"),
        wave: s.wave,
        score: s.score,
        enemies: s.enemies?.getLength() ?? 0,
        timeScale: typeof s.timeScale === "number" ? s.timeScale : null,
        beat: s.conductor ? s.conductor.beat : null,
        bpm: s.conductor ? s.conductor.bpm : null,
        conductorPaused: !!s.conductor?.paused,
        menuOpen: !!s.pauseMenu?.isActive,
        clockPaused: !!s.time?.paused,
        tweensPaused: !!s.tweens?.paused,
        levelId: s.level ? s.level.levelDef.id : null,
        audioStarted: !!window.__BEATSTILL__.audio().started,
        audioReady: window.__BEATSTILL__.audio().contextState === "running",
        gameOver: !!s.gameOver,
      };
    })()`,
  );
}

/** Audio engine counters (window.__BEATSTILL__.audio()) plus dropped notes per reason and scheduled notes per role. */
function readAudio(cdp) {
  return evaluate(
    cdp,
    `({ ...window.__BEATSTILL__.audio(), drops: window.__BEATSTILL__.audioDrops(), roles: window.__BEATSTILL__.audioRoles() })`,
  );
}

/** Every run must schedule enough notes and never hit an engine error. */
const MIN_RUN_NOTES = 20;
/** Most dropped notes allowed per scheduled note over the whole smoke run. */
const MAX_DROP_RATIO = 0.5;

function checkAudio(label, before, after, minNotes) {
  const notes = after.scheduled - before.scheduled;
  const dropped = after.dropped - before.dropped;
  log(
    `${label} audio: started=${after.started} context=${after.contextState} palette=${after.palette} ` +
      `scheduled=+${notes} dropped=+${dropped} merged=+${after.merged - before.merged} ` +
      `dropped/scheduled=${fmt(notes > 0 ? dropped / notes : NaN)} errors=${after.errors} droneVoices=${after.droneVoices}`,
  );
  if (!after.started) problems.push(`${label}: audio engine not started`);
  if (!(notes > minNotes)) problems.push(`${label}: only ${notes} notes scheduled (want > ${minNotes})`);
  if (after.errors > 0) problems.push(`${label}: audio engine reported ${after.errors} error(s)`);
}

const fmt = (n, digits = 2) => (typeof n === "number" ? n.toFixed(digits) : String(n));

/**
 * Counts the current run's enemyFired and bossPhaseChanged events (GameScene recreates its bus
 * every run, so call this after each start). A volley is on the grid if it carries the 16th-note
 * tick it fired on and that tick's lateBy.
 */
async function watchEnemyFire(cdp) {
  await evaluate(
    cdp,
    `(() => {
      const s = ${GAME}.scene.getScene("GameScene");
      const w = (window.__smokeFire = { volleys: 0, onGrid: 0, types: {}, phases: [] });
      s.gameEvents.on("enemyFired", (p) => {
        w.volleys++;
        if (typeof p.lateBy === "number" && Number.isInteger(p.tick) && p.tick % 6 === 0) w.onGrid++;
        w.types[p.enemyType] = (w.types[p.enemyType] ?? 0) + 1;
      });
      s.gameEvents.on("bossPhaseChanged", (p) => w.phases.push({ ...p, ticksPerBar: s.conductor.ticksPerBar }));
      return true;
    })()`,
  );
}

const readEnemyFire = (cdp) => evaluate(cdp, `window.__smokeFire ?? null`);

/** Enemies must have fired, every volley on the step grid. */
function checkEnemyFire(label, fire) {
  log(`${label} enemy fire: volleys=${fire?.volleys} onGrid=${fire?.onGrid} byType=${JSON.stringify(fire?.types ?? {})}`);
  if (!fire || !(fire.volleys > 0)) problems.push(`${label}: no enemy fired during the run`);
  else if (fire.onGrid !== fire.volleys) problems.push(`${label}: ${fire.volleys - fire.onGrid} of ${fire.volleys} volleys were off the step grid`);
}

/**
 * Counts the current run's player shots (call after each start, like watchEnemyFire). A shot is on
 * the grid if it carries a tick and lateBy and the tick is a multiple of the ship's fire interval
 * at that moment. Only the first shot of a press may leave the grid (late grace, 16th fallback or
 * immediate); every later shot while fire is held must be on it.
 */
async function watchPlayerFire(cdp) {
  await evaluate(
    cdp,
    `(() => {
      const s = ${GAME}.scene.getScene("GameScene");
      const w = (window.__smokePlayer = { shots: 0, held: 0, heldOnGrid: 0, firstGrid: 0, firstStep: 0, firstImmediate: 0, onBeat: 0, intervals: {} });
      s.gameEvents.on("playerFired", (p) => {
        const interval = s.ship.fireInterval;
        const timed = typeof p.lateBy === "number" && Number.isInteger(p.tick);
        const onGrid = timed && p.tick % interval === 0;
        w.shots++;
        w.intervals[interval] = (w.intervals[interval] ?? 0) + 1;
        if (onGrid && p.tick % 24 === 0) w.onBeat++;
        if (p.first) {
          if (onGrid) w.firstGrid++;
          else if (timed) w.firstStep++;
          else w.firstImmediate++;
        } else {
          w.held++;
          if (onGrid) w.heldOnGrid++;
        }
      });
      return true;
    })()`,
  );
}

const readPlayerFire = (cdp) => evaluate(cdp, `window.__smokePlayer ?? null`);

/** The player must have fired, every held-fire shot on its weapon's grid, and the lead must have sounded. */
function checkPlayerFire(label, fire, audioBefore, audioAfter) {
  const lead = (audioAfter.roles?.lead ?? 0) - (audioBefore.roles?.lead ?? 0);
  log(
    `${label} player fire: shots=${fire?.shots} held=${fire?.held} heldOnGrid=${fire?.heldOnGrid} ` +
      `first(grid/step/immediate)=${fire?.firstGrid}/${fire?.firstStep}/${fire?.firstImmediate} onBeat=${fire?.onBeat} ` +
      `intervals=${JSON.stringify(fire?.intervals ?? {})} leadNotes=+${lead}`,
  );
  if (!fire || !(fire.shots > 0)) {
    problems.push(`${label}: the player never fired`);
    return;
  }
  if (!(fire.held > 0)) problems.push(`${label}: no held-fire shots (only first shots)`);
  if (fire.heldOnGrid !== fire.held) problems.push(`${label}: ${fire.held - fire.heldOnGrid} of ${fire.held} held-fire shots were off the weapon's grid`);
  if (!(lead > 0)) problems.push(`${label}: the lead role scheduled no notes`);
}

/**
 * Holds the left button for `ms` while circling the mouse around (cx, cy). With `until`, stops as
 * soon as it resolves truthy (checked every 5 moves) and returns whether it did.
 */
async function holdFire(cdp, ms, { cx, cy, rx = 200, ry = 150, onSample, until } = {}) {
  await mouse(cdp, "mouseMoved", cx, cy, false);
  await mouse(cdp, "mousePressed", cx, cy, true);
  const start = Date.now();
  let satisfied = false;
  for (let i = 0; Date.now() - start < ms; i++) {
    const a = i * 0.25;
    await mouse(cdp, "mouseMoved", cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, true);
    if (onSample && i % 5 === 0) await onSample();
    if (until && i % 5 === 0 && (await until())) {
      satisfied = true;
      break;
    }
    await sleep(50);
  }
  await mouse(cdp, "mouseReleased", cx, cy, false);
  return satisfied;
}

/** Starts GameScene from the menu, the same way the menu buttons do. `dataExpr` is a JS expression. */
async function startGameScene(cdp, dataExpr, label) {
  await evaluate(cdp, `${GAME}.scene.getScene("StartScene").scene.start("GameScene", ${dataExpr}); true`);
  await waitFor(
    () => evaluate(cdp, `${GAME}.scene.isActive("GameScene") && !!${GAME}.scene.getScene("GameScene").ship`),
    10000,
    `GameScene to start (${label})`,
  );
}

/** Back to the menu; audio is already unlocked, so its conductor's heartbeat must sound at once. */
async function returnToMenu(cdp) {
  const before = await readAudio(cdp);
  await evaluate(cdp, `${GAME}.scene.getScene("GameScene").scene.start("StartScene"); true`);
  await waitFor(() => evaluate(cdp, `${GAME}.scene.isActive("StartScene")`), 10000, "return to StartScene");
  await sleep(500);
  const after = await readAudio(cdp);
  const menu = await evaluate(
    cdp,
    `(() => { const c = ${GAME}.scene.getScene("StartScene").menuMusic?.conductor; return c ? { tick: c.currentTick, timeScale: c.timeScale } : null; })()`,
  );
  const tick = menu?.tick ?? null;
  log(`menu: conductorTick=${tick} timeScale=${fmt(menu?.timeScale)} scheduled=+${after.scheduled - before.scheduled} droneVoices=${after.droneVoices}`);
  if (typeof tick !== "number" || tick < 0) problems.push(`menu: conductor did not run (tick=${tick})`);
  // The idle menu heart must keep a few-second pulse: the menu conductor has a time-scale floor.
  if (!(menu?.timeScale >= 0.35)) problems.push(`menu: conductor time scale ${menu?.timeScale} below the 0.35 floor`);
  if (!(after.scheduled > before.scheduled)) problems.push("menu: no heartbeat note scheduled after returning to the menu");
}

async function playEndlessRun(cdp, label, { checkPause = false } = {}) {
  await startGameScene(cdp, `{ mode: "endless" }`, label);
  await watchEnemyFire(cdp);
  await watchPlayerFire(cdp);
  const audioBefore = await readAudio(cdp);

  // Hold fire while circling the mouse: should start audio and speed time (and the clock) up.
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;
  const beforeHold = await readGameState(cdp);
  let maxTimeScale = 0;
  await holdFire(cdp, 3000, {
    cx,
    cy,
    onSample: async () => {
      const st = await readGameState(cdp);
      if (st.timeScale !== null) maxTimeScale = Math.max(maxTimeScale, st.timeScale);
    },
  });
  const afterHold = await readGameState(cdp);
  const shot = await screenshot(cdp, `${label}-playing`);
  const holdBeats = afterHold.beat - beforeHold.beat;

  // Idle: time should slow back down, and the conductor nearly stop.
  await sleep(1500);
  const idle = await readGameState(cdp);
  await sleep(1000);
  const idleEnd = await readGameState(cdp);
  const idleBeats = idleEnd.beat - idle.beat;

  log(
    `${label}: wave=${afterHold.wave} score=${afterHold.score} enemies=${afterHold.enemies} ` +
      `maxTimeScale=${fmt(maxTimeScale)} idleTimeScale=${fmt(idle.timeScale, 3)} ` +
      `bpm=${afterHold.bpm} holdBeats=${fmt(holdBeats)} idleBeats=${fmt(idleBeats, 3)} ` +
      `audio=${afterHold.audioReady} gameOver=${idleEnd.gameOver} screenshot=${shot}`,
  );

  if (!afterHold.audioStarted) problems.push(`${label}: audio did not start after pointer input`);
  if (afterHold.wave < 1) problems.push(`${label}: no wave started (wave=${afterHold.wave})`);
  if (afterHold.enemies === 0 && afterHold.score === 0) problems.push(`${label}: no enemies and no score`);
  if (maxTimeScale < 0.5) problems.push(`${label}: time did not speed up while shooting (max ${maxTimeScale})`);
  if (!idle.gameOver && idle.timeScale !== null && idle.timeScale > 0.2) {
    problems.push(`${label}: time did not slow down when idle (${idle.timeScale})`);
  }
  if (typeof beforeHold.beat !== "number" || typeof afterHold.beat !== "number") {
    problems.push(`${label}: conductor missing (beat=${afterHold.beat})`);
  } else if (!(holdBeats >= 0.5)) {
    problems.push(`${label}: conductor advanced only ${fmt(holdBeats, 3)} beats over the 3 s hold (want ≥ 0.5)`);
  }
  if (!idleEnd.gameOver && !(idleBeats <= 0.15)) {
    problems.push(`${label}: conductor advanced ${fmt(idleBeats, 3)} beats over 1 s idle (want ≤ 0.15)`);
  }

  if (checkPause) await pauseCheck(cdp, label);
  const audioAfter = await readAudio(cdp);
  checkAudio(label, audioBefore, audioAfter, MIN_RUN_NOTES);
  checkEnemyFire(label, await readEnemyFire(cdp));
  checkPlayerFire(label, await readPlayerFire(cdp), audioBefore, audioAfter);
  await checkEndlessSpawns(cdp, label);
}

/** The endless section's enemy-group spawn ticks (WaveDirector.spawnTicks) and the bar length. */
const readSpawns = (cdp) =>
  evaluate(cdp, `(() => { const s = ${GAME}.scene.getScene("GameScene"); return { ticks: [...s.waves.spawnTicks], ticksPerBar: s.conductor.ticksPerBar, wave: s.wave }; })()`);

const distinctBars = (spawns) => new Set(spawns.ticks.map((t) => Math.floor(t / spawns.ticksPerBar))).size;

/**
 * Endless waves spawn continuously: enemy groups land on bar lines (downbeats), on more than one bar
 * of the run. If the run so far covered only one bar line, keep shooting (god mode) until a second
 * group arrives, then idle so the run's last notes die away before the menu.
 */
async function checkEndlessSpawns(cdp, label) {
  const tag = `${label} spawns`;
  let spawns = await readSpawns(cdp);
  let extended = false;
  if (distinctBars(spawns) < 2) {
    extended = true;
    const scene = `${GAME}.scene.getScene("GameScene")`;
    await evaluate(cdp, `${scene}.godMode = true; true`);
    await holdFire(cdp, 15000, {
      cx: VIEWPORT.width / 2,
      cy: VIEWPORT.height / 2,
      until: async () => distinctBars(await readSpawns(cdp)) >= 2,
    });
    await evaluate(cdp, `${scene}.godMode = false; true`);
    spawns = await readSpawns(cdp);
    await sleep(2000);
  }
  const offBar = spawns.ticks.filter((t) => t % spawns.ticksPerBar !== 0);
  log(`${tag}: ticks=${JSON.stringify(spawns.ticks)} ticksPerBar=${spawns.ticksPerBar} bars=${distinctBars(spawns)} extended=${extended} wave=${spawns.wave}`);
  if (spawns.ticks.length === 0) problems.push(`${tag}: no endless enemy group spawned`);
  if (offBar.length > 0) problems.push(`${tag}: ${offBar.length} enemy group(s) spawned off a bar line (${JSON.stringify(offBar)})`);
  if (distinctBars(spawns) < 2) problems.push(`${tag}: enemy groups spawned on only ${distinctBars(spawns)} bar(s) (want spawning across more than one bar)`);
}

/**
 * Endless boss waves, started like the DevPanel's "Set Wave" (the boss arrives two bars after the
 * wave's bar line, so the probe shoots to keep time moving). A hit past the phase-2 threshold
 * queues phase 2; it must take effect on a bar line (bossPhaseChanged on a tick that is a multiple
 * of the bar), and the boss must fire on the grid. God mode keeps the probe alive.
 */
async function bossCheck(cdp) {
  const label = "boss";
  await startGameScene(cdp, `{ mode: "endless" }`, label);
  await watchEnemyFire(cdp);
  await watchPlayerFire(cdp);
  const audioBefore = await readAudio(cdp);
  const scene = `${GAME}.scene.getScene("GameScene")`;
  for (const [type, wave] of [["sentinel", 5], ["phantom", 10]]) {
    const tag = `${label} ${type}`;
    await evaluate(
      cdp,
      `(() => { const s = ${scene}; s.godMode = true; s.wave = ${wave - 1}; s.waves.clearField(); s.waves.spawnEndlessWave(); return true; })()`,
    );
    const findBoss = `${scene}.enemies.getChildren().find((e) => e.enemyType === "${type}")`;
    // The wave starts on the next bar line and the boss arrives on the downbeat after a two-bar
    // warning, all in conductor time: keep time moving (shooting down, away from the arrival point).
    const arrived = await holdFire(cdp, 20000, {
      cx: VIEWPORT.width / 2,
      cy: VIEWPORT.height * 0.92,
      rx: 250,
      ry: 20,
      until: () => evaluate(cdp, `!!${findBoss}`),
    });
    if (!arrived) {
      problems.push(`${tag}: boss did not arrive`);
      continue;
    }
    const phasesBefore = (await readEnemyFire(cdp)).phases.length;
    const volleysBefore = (await readEnemyFire(cdp)).types[type] ?? 0;
    // 40% of max hp: past the phase-2 threshold of both bosses.
    await evaluate(cdp, `(() => { const b = ${findBoss}; b.takeDamage(Math.ceil(b.maxHp * 0.4)); return true; })()`);
    // Shoot down, away from the boss, so time runs past at least one bar line (≈ 8 beats).
    await holdFire(cdp, 6000, { cx: VIEWPORT.width / 2, cy: VIEWPORT.height * 0.92, rx: 250, ry: 20 });
    const fire = await readEnemyFire(cdp);
    const changes = fire.phases.slice(phasesBefore).filter((p) => p.bossType === type);
    const volleys = (fire.types[type] ?? 0) - volleysBefore;
    const alive = await evaluate(cdp, `!!${findBoss}`);
    log(`${tag}: phaseChanges=${JSON.stringify(changes.map(({ phase, tick, ticksPerBar }) => ({ phase, tick, ticksPerBar })))} volleys=${volleys} alive=${alive}`);
    if (changes.length === 0) problems.push(`${tag}: no phase change after crossing the phase-2 threshold`);
    for (const c of changes) {
      if (c.phase !== 2) problems.push(`${tag}: expected phase 2, got ${c.phase}`);
      if (!Number.isInteger(c.tick) || c.tick % c.ticksPerBar !== 0 || typeof c.lateBy !== "number") {
        problems.push(`${tag}: phase change off the bar line (tick=${c.tick}, lateBy=${c.lateBy})`);
      }
    }
    if (!(volleys > 0)) problems.push(`${tag}: boss never fired`);
  }
  log(`${label}: screenshot=${await screenshot(cdp, `${label}-phantom`)}`);
  // Idle like the endless runs, so the run's last heartbeat has died away before the menu's first
  // one: released voices stay busy until their tails end, and the heart has only two.
  await sleep(2000);
  await evaluate(cdp, `${scene}.godMode = false; true`);
  const audioAfter = await readAudio(cdp);
  checkAudio(label, audioBefore, audioAfter, MIN_RUN_NOTES);
  checkEnemyFire(label, await readEnemyFire(cdp));
  checkPlayerFire(label, await readPlayerFire(cdp), audioBefore, audioAfter);
}

/**
 * Endless mutators are section modifiers: wave 6 rolls one (forced to double_time here), it switches
 * on at the next 4-bar phrase boundary, modulates the harmony up a whole step, and double_time
 * raises the conductor tempo ×1.2. God mode keeps the probe alive.
 */
async function mutatorCheck(cdp) {
  const label = "mutator";
  await startGameScene(cdp, `{ mode: "endless" }`, label);
  const scene = `${GAME}.scene.getScene("GameScene")`;
  await evaluate(
    cdp,
    `(() => {
      const s = ${scene};
      s.godMode = true;
      const m = s.mutators;
      const roll = m.rollMutator.bind(m);
      // Math.random() = 0 picks the first available mutator: double_time.
      m.rollMutator = () => { const r = Math.random; Math.random = () => 0; try { return roll(); } finally { Math.random = r; } };
      s.wave = 5; s.waves.clearField(); s.waves.spawnEndlessWave();
      return true;
    })()`,
  );
  const shoot = { cx: VIEWPORT.width / 2, cy: VIEWPORT.height * 0.92, rx: 250, ry: 20 };
  const started = await holdFire(cdp, 15000, { ...shoot, until: () => evaluate(cdp, `${scene}.wave === 6`) });
  const queued = await evaluate(
    cdp,
    `(() => { const s = ${scene}; return { queued: s.mutators.getQueued().map((q) => ({ id: q.mutator.id, tick: q.tick })), active: s.mutators.getActive().map((m) => m.id), bpm: s.conductor.bpm, key: s.music.keyOffset, phrase: 4 * s.conductor.ticksPerBar, waveTick: s.conductor.currentTick }; })()`,
  );
  const activated = await holdFire(cdp, 25000, { ...shoot, until: () => evaluate(cdp, `${scene}.mutators.getActive().length > 0`) });
  const after = await evaluate(
    cdp,
    `(() => { const s = ${scene}; return { active: s.mutators.getActive().map((m) => m.id), bpm: s.conductor.bpm, baseBpm: s.music.baseBpm, key: s.music.keyOffset, keyPc: s.music.director.harmony.keyPc, homePc: s.music.director.palette.key }; })()`,
  );
  await evaluate(cdp, `${scene}.godMode = false; true`);
  log(`${label}: started=${started} queued=${JSON.stringify(queued)} activated=${activated} after=${JSON.stringify(after)}`);
  if (!started) {
    problems.push(`${label}: wave 6 did not start`);
    return;
  }
  const q = queued.queued[0];
  if (!q || q.id !== "double_time") problems.push(`${label}: double_time was not queued (${JSON.stringify(queued.queued)})`);
  else if (q.tick % queued.phrase !== 0) problems.push(`${label}: queued off a phrase boundary (tick=${q.tick})`);
  if (queued.active.length > 0 && !(q && q.tick <= queued.waveTick)) problems.push(`${label}: mutator active before its phrase boundary`);
  if (!activated) {
    problems.push(`${label}: the mutator never switched on`);
    return;
  }
  if (after.key !== 2) problems.push(`${label}: key offset ${after.key} after one activation (want 2)`);
  if (Math.abs(after.bpm - after.baseBpm * 1.2) > 1e-6) problems.push(`${label}: tempo ${after.bpm} (want ${after.baseBpm} × 1.2)`);

  // DevPanel palette switch (same path: MusicControl.setPalette) must keep the mutators' key and tempo.
  const switched = await evaluate(
    cdp,
    `(() => { const s = ${scene}; s.music.setPalette(s.music.director.palette); return { bpm: s.conductor.bpm, baseBpm: s.music.baseBpm, key: s.music.keyOffset, keyPc: s.music.director.harmony.keyPc }; })()`,
  );
  log(`${label} palette switch: ${JSON.stringify(switched)}`);
  if (switched.key !== 2 || switched.keyPc !== after.keyPc) problems.push(`${label}: palette switch lost the key change (${JSON.stringify(switched)})`);
  if (Math.abs(switched.bpm - switched.baseBpm * 1.2) > 1e-6) problems.push(`${label}: palette switch lost the double-time tempo (${switched.bpm})`);
}

/**
 * Level designer song settings: open campaign level 1, edit its music in the SONG modal (with an
 * invalid progression rejected), audition it with PREVIEW (pad and heartbeat notes, no engine
 * errors), apply, set wave 1's bars, then play-test: the run must use the edited tempo and bars.
 */
async function editorCheck(cdp) {
  const label = "editor";
  await evaluate(
    cdp,
    `${GAME}.scene.getScene("StartScene").scene.start("LevelDesignerScene", { levelDef: window.__BEATSTILL__.levels.find((l) => l.id === 1) }); true`,
  );
  await waitFor(() => evaluate(cdp, `${GAME}.scene.isActive("LevelDesignerScene") && !!document.querySelector(".ld-top")`), 10000, "LevelDesignerScene");
  const ed = `${GAME}.scene.getScene("LevelDesignerScene")`;
  const loaded = await evaluate(cdp, `JSON.stringify(${ed}.music ?? null)`);
  const button = (text, scope = "document") =>
    `[...${scope}.querySelectorAll("button")].find((b) => b.textContent === ${JSON.stringify(text)})`;
  await evaluate(cdp, `${button("SONG")}.click(); true`);
  const fields = `(() => { const box = document.querySelector(".ld-modal-box"); const inputs = box.querySelectorAll("input"); const selects = box.querySelectorAll("select"); return { box, bpm: inputs[0], prog: inputs[1], theme: selects[0], key: selects[1], mode: selects[2] }; })()`;
  const setField = (field, value, evt = "input") =>
    `(() => { const f = ${fields}; f.${field}.value = ${JSON.stringify(value)}; f.${field}.dispatchEvent(new Event(${JSON.stringify(evt)}, { bubbles: true })); return true; })()`;
  await evaluate(cdp, setField("prog", "I IIII"));
  const rejected = await evaluate(cdp, `(() => { const f = ${fields}; return { applyDisabled: ${button("APPLY", "f.box")}.disabled, msg: f.box.querySelector(".ld-form-msg.error")?.textContent ?? null }; })()`);
  await evaluate(cdp, setField("prog", "i iv VII III"));
  await evaluate(cdp, setField("bpm", "130"));
  await evaluate(cdp, setField("mode", "dorian", "change"));
  const accepted = await evaluate(cdp, `(() => { const f = ${fields}; return { applyDisabled: ${button("APPLY", "f.box")}.disabled, ok: f.box.querySelector(".ld-form-msg.ok")?.textContent ?? null }; })()`);
  const shot = await screenshot(cdp, `${label}-song`);

  const audioBefore = await readAudio(cdp);
  await evaluate(cdp, `(() => { const f = ${fields}; ${button("PREVIEW", "f.box")}.click(); return true; })()`);
  await sleep(2500);
  const audioMid = await readAudio(cdp);
  const previewing = await evaluate(cdp, `!!${ed}.stopPreview`);
  await evaluate(cdp, `(() => { const f = ${fields}; ${button("APPLY", "f.box")}.click(); return true; })()`);
  const afterApply = await evaluate(
    cdp,
    `({ modal: !!document.querySelector(".ld-modal"), previewing: !!${ed}.stopPreview, music: ${ed}.music ?? null })`,
  );

  await evaluate(
    cdp,
    `(() => { const i = ${ed}.ui.barsInput; i.value = "4"; i.dispatchEvent(new Event("input")); i.dispatchEvent(new Event("change")); return true; })()`,
  );
  const bars = await evaluate(cdp, `({ bars: ${ed}.toLevelDef().waves[0].bars ?? null, tab: document.querySelector(".ld-wave-tab.active")?.textContent ?? null })`);
  const exported = await evaluate(cdp, `JSON.parse(JSON.stringify(${ed}.toLevelDef()))`);

  await evaluate(cdp, `${ed}.playTest(); true`);
  await waitFor(() => evaluate(cdp, `${GAME}.scene.isActive("GameScene") && !!${GAME}.scene.getScene("GameScene").ship`), 10000, "play-test");
  await sleep(300);
  const run = await evaluate(
    cdp,
    `(() => { const s = ${GAME}.scene.getScene("GameScene"); return { bpm: s.conductor.bpm, mode: s.music.director.harmony.mode, bars: s.level?.levelDef.waves[0].bars ?? null, waveTicks: s.level?.waveTicks ?? null }; })()`,
  );

  const pad = (audioMid.roles?.pad ?? 0) - (audioBefore.roles?.pad ?? 0);
  const heart = (audioMid.roles?.heart ?? 0) - (audioBefore.roles?.heart ?? 0);
  log(
    `${label}: loaded=${loaded} rejected=${JSON.stringify(rejected)} accepted=${JSON.stringify(accepted)} ` +
      `preview(pad=+${pad} heart=+${heart} errors=${audioMid.errors} active=${previewing}) afterApply=${JSON.stringify(afterApply)} ` +
      `bars=${JSON.stringify(bars)} exportedMusic=${JSON.stringify(exported.music)} run=${JSON.stringify(run)} screenshot=${shot}`,
  );
  if (loaded !== JSON.stringify({ bpm: 92, key: "E" })) problems.push(`${label}: level 1's music did not load (${loaded})`);
  if (!rejected.applyDisabled || !rejected.msg) problems.push(`${label}: an invalid progression was not rejected`);
  if (accepted.applyDisabled || !accepted.ok) problems.push(`${label}: valid song settings were not accepted`);
  if (!(pad > 0) || !(heart > 0)) problems.push(`${label}: preview scheduled no pad/heartbeat notes (pad=+${pad}, heart=+${heart})`);
  if (!previewing) problems.push(`${label}: preview was not running`);
  if (afterApply.modal || afterApply.previewing) problems.push(`${label}: modal or preview still open after APPLY`);
  const want = { bpm: 130, key: "E", mode: "dorian", progression: "i iv VII III" };
  if (JSON.stringify(afterApply.music) !== JSON.stringify(want)) problems.push(`${label}: applied music ${JSON.stringify(afterApply.music)}`);
  if (JSON.stringify(exported.music) !== JSON.stringify(want)) problems.push(`${label}: exported music ${JSON.stringify(exported.music)}`);
  if (bars.bars !== 4 || bars.tab !== "W1:4") problems.push(`${label}: wave bars not set (${JSON.stringify(bars)})`);
  if (run.bpm !== 130 || run.mode !== "dorian" || run.bars !== 4) problems.push(`${label}: play-test ignored the song settings (${JSON.stringify(run)})`);
}

/** Pause via the ESC path freezes the conductor, scene clock and tweens; resume restarts them. */
async function pauseCheck(cdp, label) {
  const tag = `${label} pause`;
  const scene = `${GAME}.scene.getScene("GameScene")`;
  // God mode only for this segment, so a stray bullet can't end the run and stop the clock.
  await evaluate(cdp, `(() => { const s = ${scene}; s.godMode = true; s.togglePause(); return true; })()`);
  const opened = await readGameState(cdp);
  await sleep(500);
  const held = await readGameState(cdp);
  const shot = await screenshot(cdp, `${label}-paused`);

  if (!opened.menuOpen) problems.push(`${tag}: pause menu did not open`);
  if (held.beat !== opened.beat) problems.push(`${tag}: conductor advanced while paused (${opened.beat} → ${held.beat})`);
  if (!held.conductorPaused) problems.push(`${tag}: conductor not paused`);
  if (!held.clockPaused) problems.push(`${tag}: scene clock not paused`);
  if (!held.tweensPaused) problems.push(`${tag}: tweens not paused`);

  await evaluate(cdp, `${scene}.togglePause(); true`);
  const resumed = await readGameState(cdp);
  await holdFire(cdp, 1000, { cx: VIEWPORT.width / 2, cy: VIEWPORT.height / 2 });
  const after = await readGameState(cdp);
  await evaluate(cdp, `${scene}.godMode = false; true`);
  const resumedBeats = after.beat - resumed.beat;

  log(
    `${tag}: pausedFor=500ms beatDelta=${fmt(held.beat - opened.beat, 4)} clockPaused=${held.clockPaused} ` +
      `tweensPaused=${held.tweensPaused} resumedBeats=${fmt(resumedBeats)} screenshot=${shot}`,
  );

  if (resumed.menuOpen || resumed.conductorPaused || resumed.clockPaused || resumed.tweensPaused) {
    problems.push(`${tag}: did not fully resume (${JSON.stringify(resumed)})`);
  }
  if (!(resumedBeats >= 0.2)) {
    problems.push(`${tag}: conductor advanced only ${fmt(resumedBeats, 3)} beats in 1 s of shooting after resume`);
  }
}

/** Presses (or releases) a key the way a real keyboard would, so Phaser's Key objects see it. */
async function key(cdp, type, keyName, code, keyCode) {
  await cdp.send("Input.dispatchKeyEvent", { type, key: keyName, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

/** Screen coordinates of game point (x, y) (the canvas is scaled to fit the viewport). */
async function toScreen(cdp, x, y) {
  return evaluate(
    cdp,
    `(() => { const g = ${GAME}; const r = g.canvas.getBoundingClientRect(); return { x: r.left + ${x} * r.width / g.scale.width, y: r.top + ${y} * r.height / g.scale.height }; })()`,
  );
}

const TUTORIAL = `${GAME}.scene.getScene("GameScene").tutorial`;
const readTutorial = (cdp) =>
  evaluate(
    cdp,
    `(() => { const t = ${TUTORIAL}; const s = ${GAME}.scene.getScene("GameScene"); return { active: !!t?.isActive, step: t?.stepId ?? null, index: t?.stepIndex ?? -1, count: t?.stepCount ?? 0, timeScale: s.timeScale, enemies: s.enemies.getLength(), wave: s.wave, nextWaveTick: s.waves.nextWaveTick }; })()`,
  );

/** Waits (real time, while `drive` keeps input going) until the tutorial leaves step `id`. */
async function untilStepLeaves(cdp, id, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await readTutorial(cdp);
    if (!t.active || t.step !== id) return true;
    await sleep(100);
  }
  return false;
}

/**
 * Holds fire aimed at the nearest enemy (re-aimed every 50 ms) for up to `ms`, stopping early once
 * `until` resolves truthy. Without enemies it aims down, away from where the tutorial spawns them.
 */
async function fireAtEnemies(cdp, ms, until) {
  const nearest = `(() => { const s = ${GAME}.scene.getScene("GameScene"); let best = null, bestD = Infinity; for (const e of s.enemies.getChildren()) { if (!e.active) continue; const d = (e.x - s.ship.x) ** 2 + (e.y - s.ship.y) ** 2; if (d < bestD) { bestD = d; best = { x: e.x, y: e.y }; } } return best ?? { x: s.ship.x, y: s.ship.y + 200 }; })()`;
  const aim = async () => {
    const t = await evaluate(cdp, nearest);
    return toScreen(cdp, t.x, t.y);
  };
  let p = await aim();
  await mouse(cdp, "mouseMoved", p.x, p.y, false);
  await mouse(cdp, "mousePressed", p.x, p.y, true);
  const start = Date.now();
  let satisfied = false;
  for (let i = 0; Date.now() - start < ms; i++) {
    p = await aim();
    await mouse(cdp, "mouseMoved", p.x, p.y, true);
    if (i % 4 === 0 && (await until())) {
      satisfied = true;
      break;
    }
    await sleep(50);
  }
  await mouse(cdp, "mouseReleased", p.x, p.y, false);
  return satisfied;
}

/**
 * First-run tutorial: clears the "done" flag in-page and starts endless mode, which runs the
 * tutorial. Real input drives it: WASD to move, mouse to aim, held fire, idling (time slows), firing
 * (time speeds up), then aimed fire at the instrument enemies and the chain cluster. Asserts the
 * first three steps (move, aim, fire) complete on input and that finishing (or skipping) starts
 * endless mode exactly once. God mode keeps the probe alive.
 */
async function tutorialCheck(cdp) {
  const label = "tutorial";
  const scene = `${GAME}.scene.getScene("GameScene")`;
  try {
    await evaluate(cdp, `localStorage.removeItem("beatstill_tutorial_done"); true`);
    await startGameScene(cdp, `{ mode: "endless" }`, label);
    await evaluate(
      cdp,
      `(() => { const s = ${scene}; s.godMode = true; window.__smokeWaves = 0; s.gameEvents.on("waveStarted", () => window.__smokeWaves++); return true; })()`,
    );
    const first = await readTutorial(cdp);
    const reached = [];
    const timeouts = [];
    if (!first.active || first.step !== "move") {
      problems.push(`${label}: the tutorial did not start on the move step (${JSON.stringify(first)})`);
      return;
    }
    const center = await evaluate(cdp, `(() => { const s = ${scene}; return { x: s.ship.x, y: s.ship.y }; })()`);
    const shipScreen = await toScreen(cdp, center.x, center.y);

    // 1. Move: hold D, then let go (the step needs 3 s of real time on screen).
    await mouse(cdp, "mouseMoved", shipScreen.x, shipScreen.y - 150, false);
    await key(cdp, "keyDown", "d", "KeyD", 68);
    await sleep(1200);
    await key(cdp, "keyUp", "d", "KeyD", 68);
    if (await untilStepLeaves(cdp, "move", 8000)) reached.push("move");
    else timeouts.push("move");

    // 2. Aim: circle the mouse around the ship without firing.
    const ship = await evaluate(cdp, `(() => { const s = ${scene}; return { x: s.ship.x, y: s.ship.y }; })()`);
    const shipAt = await toScreen(cdp, ship.x, ship.y);
    if ((await readTutorial(cdp)).step === "aim") {
      const aimStart = Date.now();
      let aimed = false;
      for (let i = 0; Date.now() - aimStart < 8000; i++) {
        const a = i * 0.3;
        await mouse(cdp, "mouseMoved", shipAt.x + Math.cos(a) * 150, shipAt.y + Math.sin(a) * 150, false);
        if (i % 5 === 0 && (await readTutorial(cdp)).step !== "aim") {
          aimed = true;
          break;
        }
        await sleep(50);
      }
      if (aimed) reached.push("aim");
      else timeouts.push("aim");
    }

    // 3. Fire: hold the button (≥ 4 shots).
    if ((await readTutorial(cdp)).step === "fire") {
      const fired = await holdFire(cdp, 8000, {
        cx: shipAt.x,
        cy: shipAt.y + 120,
        rx: 120,
        ry: 40,
        until: async () => (await readTutorial(cdp)).step !== "fire",
      });
      if (fired) reached.push("fire");
      else timeouts.push("fire");
    }

    // 4. Slow: idle until time nearly stops.
    let t = await readTutorial(cdp);
    let minTimeScale = 1;
    if (t.step === "slow") {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && (t = await readTutorial(cdp)).step === "slow") {
        minTimeScale = Math.min(minTimeScale, t.timeScale);
        await sleep(100);
      }
      if (t.step !== "slow") reached.push("slow");
      else timeouts.push("slow");
    }

    // 5. Speed up: fire again.
    if ((await readTutorial(cdp)).step === "speed") {
      const ok = await holdFire(cdp, 8000, { cx: shipAt.x, cy: shipAt.y + 120, rx: 120, ry: 40, until: async () => (await readTutorial(cdp)).step !== "speed" });
      if (ok) reached.push("speed");
      else timeouts.push("speed");
    }

    // 6–7. Instruments and chain: aimed fire at whatever the step brought in (on its bar line).
    for (const id of ["instruments", "chain"]) {
      if ((await readTutorial(cdp)).step !== id) continue;
      const ok = await fireAtEnemies(cdp, 25000, async () => (await readTutorial(cdp)).step !== id);
      if (ok) reached.push(id);
      else timeouts.push(id);
    }

    let end = await readTutorial(cdp);
    let skipped = false;
    if (end.active) {
      // Not finished by play (a timeout above): the skip button must still end it cleanly.
      const box = await evaluate(cdp, `(() => { const b = ${TUTORIAL}.skipText.getBounds(); return { x: b.centerX, y: b.centerY }; })()`);
      const at = await toScreen(cdp, box.x, box.y);
      await mouse(cdp, "mouseMoved", at.x, at.y, false);
      await mouse(cdp, "mousePressed", at.x, at.y, true);
      await mouse(cdp, "mouseReleased", at.x, at.y, false);
      skipped = true;
      await sleep(200);
      end = await readTutorial(cdp);
    }
    // Endless starts on the next bar line: keep time moving until wave 1 is on.
    const started = await holdFire(cdp, 15000, {
      cx: shipAt.x,
      cy: shipAt.y + 120,
      rx: 120,
      ry: 40,
      until: () => evaluate(cdp, `${scene}.wave >= 1`),
    });
    await sleep(500);
    const after = await evaluate(
      cdp,
      `(() => { const s = ${scene}; return { wave: s.wave, waves: window.__smokeWaves, flag: localStorage.getItem("beatstill_tutorial_done"), active: !!s.tutorial?.isActive, enemies: s.enemies.getLength(), spawns: [...s.waves.spawnTicks] }; })()`,
    );
    await evaluate(cdp, `${scene}.godMode = false; true`);
    log(
      `${label}: reached=${JSON.stringify(reached)} timeouts=${JSON.stringify(timeouts)} minTimeScale=${fmt(minTimeScale, 3)} ` +
        `skipped=${skipped} endActive=${end.active} after=${JSON.stringify(after)} screenshot=${await screenshot(cdp, `${label}-end`)}`,
    );
    for (const id of ["move", "aim", "fire"]) {
      if (!reached.includes(id)) problems.push(`${label}: the ${id} step did not complete on input`);
    }
    if (reached.includes("slow") && !(minTimeScale < 0.1)) problems.push(`${label}: slow step passed without time below 0.1 (${minTimeScale})`);
    if (end.active || after.active) problems.push(`${label}: the tutorial did not end (skip=${skipped})`);
    if (after.flag !== "1") problems.push(`${label}: the done flag was not stored (${after.flag})`);
    if (!started || after.wave !== 1) problems.push(`${label}: endless did not start after the tutorial (wave=${after.wave})`);
    if (after.waves !== 1) problems.push(`${label}: endless started ${after.waves} time(s) (want exactly 1)`);
    if (timeouts.length > 0) warnings.push(`${label}: steps not completed by the probe: ${timeouts.join(", ")}`);
  } finally {
    // Later segments (and a failed run) must not see the tutorial again.
    await evaluate(cdp, `localStorage.setItem("beatstill_tutorial_done", "1"); true`);
  }
}

/**
 * Options → Heartbeat off: a short endless run must schedule no "heart" notes (the rest of the
 * music still plays), and the run's director must have picked up the audio latency option.
 */
async function heartbeatOptionCheck(cdp) {
  const label = "options";
  const opts = `window.__BEATSTILL__.options`;
  const saved = await evaluate(cdp, `({ heartbeat: ${opts}.heartbeat, audioLatencyMs: ${opts}.audioLatencyMs })`);
  try {
    await evaluate(cdp, `(() => { ${opts}.heartbeat = false; ${opts}.audioLatencyMs = 80; return true; })()`);
    await startGameScene(cdp, `{ mode: "endless" }`, label);
    const audioBefore = await readAudio(cdp);
    await holdFire(cdp, 3000, { cx: VIEWPORT.width / 2, cy: VIEWPORT.height / 2 });
    await sleep(500);
    const audioAfter = await readAudio(cdp);
    const director = await evaluate(
      cdp,
      `(() => { const d = ${GAME}.scene.getScene("GameScene").music.director; return { heartbeat: d.heartbeatEnabled, latency: d.latencySeconds }; })()`,
    );
    const heart = (audioAfter.roles?.heart ?? 0) - (audioBefore.roles?.heart ?? 0);
    const lead = (audioAfter.roles?.lead ?? 0) - (audioBefore.roles?.lead ?? 0);
    const notes = audioAfter.scheduled - audioBefore.scheduled;
    log(`${label}: heartbeat=off heartNotes=+${heart} leadNotes=+${lead} notes=+${notes} director=${JSON.stringify(director)}`);
    if (heart !== 0) problems.push(`${label}: ${heart} heart note(s) scheduled with the heartbeat off`);
    if (!(lead > 0) || !(notes > 0)) problems.push(`${label}: the music stopped with the heartbeat off (lead=+${lead}, notes=+${notes})`);
    if (director.heartbeat !== false) problems.push(`${label}: the run's director still has the heartbeat on`);
    if (Math.abs(director.latency - 0.08) > 1e-9) problems.push(`${label}: audio latency option not applied (${director.latency})`);
  } finally {
    // Back on before the menu, whose heartbeat returnToMenu checks.
    await evaluate(cdp, `(() => { ${opts}.heartbeat = ${saved.heartbeat}; ${opts}.audioLatencyMs = ${saved.audioLatencyMs}; return true; })()`);
  }
}

/**
 * Collection → Customize → ▶ on the default theme: a two-bar phrase plays (arpeggio and bass
 * notes), locked themes have no ▶, and closing the collection stops the phrase.
 */
async function themePreviewCheck(cdp) {
  const label = "preview";
  const start = `${GAME}.scene.getScene("StartScene")`;
  await evaluate(cdp, `${start}.showCollectionOverlay(); true`);
  await waitFor(() => evaluate(cdp, `!!document.querySelector(".col-overlay")`), 5000, "collection overlay");
  await evaluate(cdp, `[...document.querySelectorAll(".col-tab")].find((b) => b.textContent === "CUSTOMIZE").click(); true`);
  // Only unlocked themes get a ▶ (shards earned earlier in the smoke may have unlocked some).
  const buttons = await evaluate(cdp, `[...document.querySelectorAll("button[data-theme-preview]")].map((b) => b.getAttribute("data-theme-preview"))`);
  const lockedWithButton = await evaluate(cdp, `[...document.querySelectorAll(".col-item.locked")].filter((i) => i.querySelector("button[data-theme-preview]")).length`);
  const before = await readAudio(cdp);
  await evaluate(cdp, `document.querySelector('button[data-theme-preview="theremin"]').click(); true`);
  await sleep(1500);
  const mid = await readAudio(cdp);
  const playing = await evaluate(cdp, `document.querySelector('button[data-theme-preview="theremin"]')?.textContent ?? null`);
  await evaluate(cdp, `[...document.querySelectorAll(".col-close")][0].click(); true`);
  await sleep(300);
  const closed = await evaluate(cdp, `({ overlay: !!document.querySelector(".col-overlay"), buttons: document.querySelectorAll("button[data-theme-preview]").length })`);
  const afterClose = await readAudio(cdp);
  await sleep(1000);
  const later = await readAudio(cdp);
  const arp = (mid.roles?.arp ?? 0) - (before.roles?.arp ?? 0);
  const bass = (mid.roles?.bass ?? 0) - (before.roles?.bass ?? 0);
  const arpAfterClose = (later.roles?.arp ?? 0) - (afterClose.roles?.arp ?? 0);
  log(`${label}: buttons=${JSON.stringify(buttons)} lockedWithButton=${lockedWithButton} arp=+${arp} bass=+${bass} playingLabel=${playing} closed=${JSON.stringify(closed)} arpAfterClose=+${arpAfterClose} errors=${later.errors}`);
  if (!buttons.includes("theremin")) problems.push(`${label}: no preview button for the default theme`);
  if (lockedWithButton > 0) problems.push(`${label}: ${lockedWithButton} locked theme(s) have a preview button`);
  if (!(arp > 0) || !(bass > 0)) problems.push(`${label}: the preview scheduled no arpeggio/bass notes (arp=+${arp}, bass=+${bass})`);
  if (playing !== "■") problems.push(`${label}: the button did not show the playing state (${playing})`);
  if (closed.overlay) problems.push(`${label}: the collection did not close`);
  if (arpAfterClose !== 0) problems.push(`${label}: the preview kept playing after the collection closed (arp=+${arpAfterClose})`);
}

/** Campaign level 1, started like LevelSelectScene does. */
async function playCampaignLevel(cdp) {
  const label = "campaign";
  await startGameScene(
    cdp,
    `{ mode: "level", levelDef: window.__BEATSTILL__.levels.find((l) => l.id === 1) }`,
    label,
  );
  await watchPlayerFire(cdp);
  const before = await readGameState(cdp);
  const audioBefore = await readAudio(cdp);
  // Aim up the hallway at the tanks.
  await holdFire(cdp, 2000, { cx: VIEWPORT.width / 2, cy: VIEWPORT.height * 0.3, rx: 120, ry: 60 });
  const after = await readGameState(cdp);
  const shot = await screenshot(cdp, `${label}-level1`);
  // A 2 s probe of a two-tank level: fewer notes than an endless run, but some must sound.
  const audioAfter = await readAudio(cdp);
  checkAudio(label, audioBefore, audioAfter, 5);
  checkPlayerFire(label, await readPlayerFire(cdp), audioBefore, audioAfter);

  log(
    `${label}: levelId=${after.levelId} score=${after.score} enemies=${after.enemies} ` +
      `beats=${fmt(after.beat - before.beat)} gameOver=${after.gameOver} screenshot=${shot}`,
  );

  if (!after.active) problems.push(`${label}: GameScene is not active`);
  if (after.levelId !== 1) problems.push(`${label}: level runner missing or wrong level (levelId=${after.levelId})`);
  if (!(after.beat > before.beat)) problems.push(`${label}: conductor did not advance (${before.beat} → ${after.beat})`);

  // Song structure: the first wave spawned on a bar line, and the level's tempo replaced the theme's.
  const song = await evaluate(
    cdp,
    `(() => { const s = ${GAME}.scene.getScene("GameScene"); return { waveTicks: s.level ? [...s.level.waveTicks] : null, ticksPerBar: s.conductor.ticksPerBar, bpm: s.conductor.bpm, levelBpm: s.level?.levelDef.music?.bpm ?? null }; })()`,
  );
  log(`${label} song: waveTicks=${JSON.stringify(song.waveTicks)} ticksPerBar=${song.ticksPerBar} bpm=${song.bpm} levelBpm=${song.levelBpm}`);
  const first = song.waveTicks?.[0];
  if (!Number.isInteger(first)) problems.push(`${label}: the first wave never spawned (waveTicks=${JSON.stringify(song.waveTicks)})`);
  else if (first % song.ticksPerBar !== 0) problems.push(`${label}: the first wave spawned off a bar line (tick=${first})`);
  if (typeof song.levelBpm !== "number") problems.push(`${label}: level 1 has no music.bpm`);
  else if (song.bpm !== song.levelBpm) problems.push(`${label}: conductor bpm ${song.bpm} ≠ the level's music.bpm ${song.levelBpm}`);

  // DevPanel "Skip Wave" in a level goes through the level runner: level 1 has a single wave, so
  // skipping it completes the level, on a bar line; walls stay.
  const scene = `${GAME}.scene.getScene("GameScene")`;
  const skip = await evaluate(
    cdp,
    `(() => { const s = ${scene}; s.godMode = true; window.__smokeLevelDone = null; s.gameEvents.on("levelCompleted", (p) => (window.__smokeLevelDone = { tick: p.tick, ticksPerBar: s.conductor.ticksPerBar })); const walls = s.walls.getLength(); const ok = s.waves.skipWave(); return { ok, walls, enemies: s.enemies.getLength() }; })()`,
  );
  const completed = await holdFire(cdp, 12000, {
    cx: VIEWPORT.width / 2,
    cy: VIEWPORT.height * 0.3,
    rx: 120,
    ry: 60,
    until: () => evaluate(cdp, `!!window.__smokeLevelDone`),
  });
  const done = await evaluate(cdp, `(() => { const s = ${scene}; s.godMode = false; return { done: window.__smokeLevelDone, complete: !!s.level?.isComplete, walls: s.walls.getLength() }; })()`);
  log(`${label} skip wave: skip=${JSON.stringify(skip)} completed=${completed} after=${JSON.stringify(done)}`);
  if (!skip.ok || skip.enemies !== 0) problems.push(`${label}: Skip Wave did nothing in the level (${JSON.stringify(skip)})`);
  if (!completed || !done.complete) problems.push(`${label}: skipping the last wave did not complete the level`);
  else if (!Number.isInteger(done.done.tick) || done.done.tick % done.done.ticksPerBar !== 0) problems.push(`${label}: level completed off a bar line (${JSON.stringify(done.done)})`);
  if (done.walls !== skip.walls) problems.push(`${label}: Skip Wave removed walls (${skip.walls} → ${done.walls})`);
}

async function main() {
  if (!existsSync(join(ROOT, "dist", "index.html"))) {
    throw new Error("dist/index.html missing; run `npm run build` first (or use `npm run smoke`)");
  }

  log(`serving dist on ${APP_URL}`);
  startChild(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--port", String(PREVIEW_PORT), "--strictPort", "--host", "127.0.0.1"], "vite preview");
  await waitFor(async () => (await fetch(APP_URL)).ok, 20000, "vite preview");

  const chrome = findChrome();
  userDataDir = mkdtempSync(join(tmpdir(), "beatstill-smoke-"));
  log(`launching ${chrome}`);
  startChild(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "about:blank",
    ],
    "chrome",
  );
  const debugBase = `http://127.0.0.1:${DEBUG_PORT}`;
  await waitFor(async () => (await fetch(`${debugBase}/json/version`)).ok, 20000, "Chrome DevTools endpoint");
  const targets = await (await fetch(`${debugBase}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target in headless Chrome");

  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);
  try {
    cdp.on((method, params) => {
      if (method === "Runtime.exceptionThrown") {
        const d = params.exceptionDetails;
        problems.push(`uncaught exception: ${d.exception?.description ?? d.text}`);
      } else if (method === "Runtime.consoleAPICalled") {
        const text = params.args.map((a) => a.value ?? a.description ?? "").join(" ");
        if (params.type === "error" || params.type === "assert") problems.push(`console.${params.type}: ${text}`);
        else if (params.type === "warning") warnings.push(`[${segment}] ${text}`);
      } else if (method === "Log.entryAdded") {
        const e = params.entry;
        if (e.level === "error" && !(e.url ?? "").endsWith("/favicon.ico")) {
          problems.push(`browser log error: ${e.text}${e.url ? ` (${e.url})` : ""}`);
        }
      }
    });
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
    // Skip the first-run tutorial so the endless wave spawns immediately.
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem("beatstill_tutorial_done", "1"); } catch (e) {}`,
    });

    await cdp.send("Page.navigate", { url: APP_URL });
    await waitFor(
      () => evaluate(cdp, `!!window.__BEATSTILL__ && ${GAME}.isBooted && ${GAME}.scene.isActive("StartScene")`),
      20000,
      "StartScene",
    );
    await sleep(1000);
    log(`menu screenshot: ${await screenshot(cdp, "menu")}`);

    const stage = (name) => (segment = name);
    stage("run1");
    await playEndlessRun(cdp, "run1", { checkPause: true });

    // Back to the menu and play again to exercise scene restart paths.
    stage("menu→run2");
    await returnToMenu(cdp);
    stage("run2");
    await playEndlessRun(cdp, "run2");

    stage("menu→boss");
    await returnToMenu(cdp);
    stage("boss");
    await bossCheck(cdp);

    stage("menu→mutator");
    await returnToMenu(cdp);
    stage("mutator");
    await mutatorCheck(cdp);

    stage("menu→campaign");
    await returnToMenu(cdp);
    stage("campaign");
    await playCampaignLevel(cdp);

    stage("menu→editor");
    await returnToMenu(cdp);
    stage("editor");
    await editorCheck(cdp);

    stage("menu→tutorial");
    await returnToMenu(cdp);
    stage("tutorial");
    await tutorialCheck(cdp);

    stage("menu→options");
    await returnToMenu(cdp);
    stage("options");
    await heartbeatOptionCheck(cdp);

    stage("menu→preview");
    await returnToMenu(cdp);
    stage("preview");
    await themePreviewCheck(cdp);
    stage("end");

    const audio = await readAudio(cdp);
    log(
      `audio totals: scheduled=${audio.scheduled} dropped=${audio.dropped} merged=${audio.merged} ` +
        `dropped/scheduled=${fmt(audio.scheduled > 0 ? audio.dropped / audio.scheduled : NaN)} ` +
        `errors=${audio.errors} drops=${JSON.stringify(audio.drops)} roles=${JSON.stringify(audio.roles)}`,
    );
    if (audio.errors > 0) problems.push(`audio engine reported ${audio.errors} error(s) in total`);
    // Phase 3 (enemies on ms timers) dropped more notes than it scheduled; on the grid it must stay well below.
    if (audio.dropped > MAX_DROP_RATIO * audio.scheduled) {
      problems.push(`audio dropped ${audio.dropped} notes for ${audio.scheduled} scheduled (want ≤ ${MAX_DROP_RATIO}×)`);
    }

    const crashShown = await evaluate(
      cdp,
      `(() => { const el = document.getElementById("crash-overlay"); return !!el && el.style.display === "flex"; })()`,
    );
    if (crashShown) problems.push("crash overlay is visible");
  } finally {
    cdp.close();
  }
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  problems.push(`smoke harness error: ${err.message}`);
} finally {
  shuttingDown = true;
  for (const c of children) c.kill("SIGTERM");
  await sleep(300);
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
}

if (warnings.length) {
  log(`${warnings.length} console warning(s):`);
  for (const w of [...new Set(warnings)].slice(0, 20)) log(`  warn: ${w} (×${warnings.filter((x) => x === w).length})`);
}
if (problems.length) {
  log(`FAILED with ${problems.length} problem(s):`);
  for (const p of problems) log(`  - ${p}`);
  exitCode = 1;
} else {
  log("PASSED");
}
process.exit(exitCode);
