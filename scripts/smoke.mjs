#!/usr/bin/env node
// Headless browser smoke test for Beat Still.
//
// Expects a fresh build in dist/ (`npm run smoke` builds first). Serves it with
// `vite preview`, drives headless Chrome over the DevTools protocol, plays two
// short endless runs (with a pause/resume check) and the first campaign level,
// and fails on any uncaught exception, console error, or failed resource load,
// or when the time scale / conductor clock / pause freeze misbehave.
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
        audioStarted: !!s.audioStarted,
        audioReady: !!s.audioManager?.isStarted,
        gameOver: !!s.gameOver,
      };
    })()`,
  );
}

const fmt = (n, digits = 2) => (typeof n === "number" ? n.toFixed(digits) : String(n));

/** Holds the left button for `ms` while circling the mouse around (cx, cy). */
async function holdFire(cdp, ms, { cx, cy, rx = 200, ry = 150, onSample } = {}) {
  await mouse(cdp, "mouseMoved", cx, cy, false);
  await mouse(cdp, "mousePressed", cx, cy, true);
  const start = Date.now();
  for (let i = 0; Date.now() - start < ms; i++) {
    const a = i * 0.25;
    await mouse(cdp, "mouseMoved", cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, true);
    if (onSample && i % 5 === 0) await onSample();
    await sleep(50);
  }
  await mouse(cdp, "mouseReleased", cx, cy, false);
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

async function returnToMenu(cdp) {
  await evaluate(cdp, `${GAME}.scene.getScene("GameScene").scene.start("StartScene"); true`);
  await waitFor(() => evaluate(cdp, `${GAME}.scene.isActive("StartScene")`), 10000, "return to StartScene");
  await sleep(500);
}

async function playEndlessRun(cdp, label, { checkPause = false } = {}) {
  await startGameScene(cdp, `{ mode: "endless" }`, label);

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

/** Campaign level 1, started like LevelSelectScene does. */
async function playCampaignLevel(cdp) {
  const label = "campaign";
  await startGameScene(
    cdp,
    `{ mode: "level", levelDef: window.__BEATSTILL__.levels.find((l) => l.id === 1) }`,
    label,
  );
  const before = await readGameState(cdp);
  // Aim up the hallway at the tanks.
  await holdFire(cdp, 2000, { cx: VIEWPORT.width / 2, cy: VIEWPORT.height * 0.3, rx: 120, ry: 60 });
  const after = await readGameState(cdp);
  const shot = await screenshot(cdp, `${label}-level1`);

  log(
    `${label}: levelId=${after.levelId} score=${after.score} enemies=${after.enemies} ` +
      `beats=${fmt(after.beat - before.beat)} gameOver=${after.gameOver} screenshot=${shot}`,
  );

  if (!after.active) problems.push(`${label}: GameScene is not active`);
  if (after.levelId !== 1) problems.push(`${label}: level runner missing or wrong level (levelId=${after.levelId})`);
  if (!(after.beat > before.beat)) problems.push(`${label}: conductor did not advance (${before.beat} → ${after.beat})`);
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
        else if (params.type === "warning") warnings.push(text);
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

    await playEndlessRun(cdp, "run1", { checkPause: true });

    // Back to the menu and play again to exercise scene restart paths.
    await returnToMenu(cdp);
    await playEndlessRun(cdp, "run2");

    await returnToMenu(cdp);
    await playCampaignLevel(cdp);

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
  for (const w of [...new Set(warnings)].slice(0, 20)) log(`  warn: ${w}`);
}
if (problems.length) {
  log(`FAILED with ${problems.length} problem(s):`);
  for (const p of problems) log(`  - ${p}`);
  exitCode = 1;
} else {
  log("PASSED");
}
process.exit(exitCode);
