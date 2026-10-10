#!/usr/bin/env node
// Headless browser smoke test for Beat Still.
//
// Expects a fresh build in dist/ (`npm run smoke` builds first). Serves it with
// `vite preview`, drives headless Chrome over the DevTools protocol, plays a
// short endless run, and fails on any uncaught exception, console error, or
// failed resource load. No extra dependencies: uses Node's built-in WebSocket.
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
        timeScale: s.timeManager?.scale ?? null,
        audioStarted: !!s.audioStarted,
        audioReady: !!s.audioManager?.isStarted,
        gameOver: !!s.gameOver,
      };
    })()`,
  );
}

async function playEndlessRun(cdp, label) {
  await evaluate(cdp, `${GAME}.scene.getScene("StartScene").scene.start("GameScene"); true`);
  await waitFor(
    () => evaluate(cdp, `${GAME}.scene.isActive("GameScene") && !!${GAME}.scene.getScene("GameScene").ship`),
    10000,
    `GameScene to start (${label})`,
  );

  // Hold fire while circling the mouse: should start audio and speed time up.
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;
  await mouse(cdp, "mouseMoved", cx, cy, false);
  await mouse(cdp, "mousePressed", cx, cy, true);
  let maxTimeScale = 0;
  const holdStart = Date.now();
  for (let i = 0; Date.now() - holdStart < 3000; i++) {
    const a = i * 0.25;
    await mouse(cdp, "mouseMoved", cx + Math.cos(a) * 200, cy + Math.sin(a) * 150, true);
    if (i % 5 === 0) {
      const st = await readGameState(cdp);
      if (st.timeScale !== null) maxTimeScale = Math.max(maxTimeScale, st.timeScale);
    }
    await sleep(50);
  }
  await mouse(cdp, "mouseReleased", cx, cy, false);
  const afterHold = await readGameState(cdp);
  const shot = await screenshot(cdp, `${label}-playing`);

  // Idle: time should slow back down.
  await sleep(1500);
  const idle = await readGameState(cdp);

  log(
    `${label}: wave=${afterHold.wave} score=${afterHold.score} enemies=${afterHold.enemies} ` +
      `maxTimeScale=${maxTimeScale.toFixed(2)} idleTimeScale=${idle.timeScale?.toFixed(3)} ` +
      `audio=${afterHold.audioReady} gameOver=${idle.gameOver} screenshot=${shot}`,
  );

  if (!afterHold.audioStarted) problems.push(`${label}: audio did not start after pointer input`);
  if (afterHold.wave < 1) problems.push(`${label}: no wave started (wave=${afterHold.wave})`);
  if (afterHold.enemies === 0 && afterHold.score === 0) problems.push(`${label}: no enemies and no score`);
  if (maxTimeScale < 0.5) problems.push(`${label}: time did not speed up while shooting (max ${maxTimeScale})`);
  if (!idle.gameOver && idle.timeScale !== null && idle.timeScale > 0.2) {
    problems.push(`${label}: time did not slow down when idle (${idle.timeScale})`);
  }
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

    await playEndlessRun(cdp, "run1");

    // Back to the menu and play again to exercise scene restart paths.
    await evaluate(cdp, `${GAME}.scene.getScene("GameScene").scene.start("StartScene"); true`);
    await waitFor(() => evaluate(cdp, `${GAME}.scene.isActive("StartScene")`), 10000, "return to StartScene");
    await sleep(500);
    await playEndlessRun(cdp, "run2");

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
