import type { GameScene } from "../scenes/GameScene";
import { getAudioEngine } from "../audio/AudioEngine";
import type { MusicControl } from "../audio/MusicDriver";
import { musicSnapshot, safeSection } from "./crashSnapshot";

interface CrashReport {
  timestamp: string;
  error: string;
  stack: string;
  gameState: Record<string, unknown> | null;
  environment: Record<string, unknown>;
}

const MAX_REPORTS = 20;
const reports: CrashReport[] = [];
/** Every crash this session; `reports` only keeps the latest MAX_REPORTS. */
let totalCrashes = 0;

let getScene: (() => GameScene | null) | null = null;
let getMusic: (() => MusicControl | null) | null = null;
let overlayEl: HTMLDivElement | null = null;
let installed = false;

/** The run's state, section by section (each wrapped: the scene may be half torn down while crashing). */
function runSnapshot(scene: GameScene): Record<string, unknown> {
  return {
    sceneActive: safeSection(() => scene.scene.isActive()),
    run: safeSection(() => ({
      mode: scene.level ? "level" : "endless",
      levelId: scene.level?.levelDef.id ?? null,
      wave: scene.wave,
      score: scene.score,
      gameOver: scene.gameOver,
      paused: scene.pauseMenu?.isActive ?? false,
      godMode: scene.godMode,
      tutorialStep: scene.tutorial?.stepId ?? null,
    })),
    chain: safeSection(() => ({
      count: scene.chain?.chainCount ?? 0,
      tier: scene.chain?.chainTier ?? 0,
      timerBeats: scene.chain?.chainTimer ?? 0,
    })),
    player: safeSection(() =>
      scene.ship
        ? {
            x: Math.round(scene.ship.x),
            y: Math.round(scene.ship.y),
            hp: scene.ship.hp,
            maxHp: scene.ship.maxHp,
            invincible: scene.ship.isInvincible(),
            weapon: scene.stats?.weaponId ?? null,
            fireIntervalTicks: scene.ship.fireInterval,
          }
        : null,
    ),
    dilation: safeSection(() => (scene.dilation ? { scale: scene.dilation.scale, target: scene.dilation.target } : null)),
    counts: safeSection(() => ({
      enemies: scene.enemies?.getLength() ?? 0,
      playerBullets: scene.playerBullets?.getLength() ?? 0,
      enemyBullets: scene.enemyBullets?.getLength() ?? 0,
      asteroids: scene.asteroids?.getLength() ?? 0,
    })),
  };
}

function snapshotGameState(): Record<string, unknown> | null {
  if (!getScene) return null;
  const engine = getAudioEngine();
  const scene = safeSection(() => getScene?.() ?? null);
  const music = safeSection(() => getMusic?.() ?? null);
  const playing = music && !("error" in music) ? music : null;
  const sceneOk = scene && !("error" in scene) ? scene : null;
  // The music that is playing (the run's or the menu's) carries the conductor and the harmony.
  const source = playing ? (sceneOk && playing === sceneOk.music ? "game" : "menu") : null;
  return {
    ...(sceneOk ? runSnapshot(sceneOk) : { status: scene && "error" in scene ? scene : "no game scene" }),
    ...musicSnapshot(playing, engine, source),
  };
}

/** The game may be in a broken state while crashing, so a failing snapshot must not lose the report. */
function safeSnapshotGameState(): Record<string, unknown> | null {
  try {
    return snapshotGameState();
  } catch (err) {
    return {
      snapshotError: err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.trim() : String(err),
    };
  }
}

function getEnvironment(): Record<string, unknown> {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenSize: `${screen.width}x${screen.height}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    timestamp: new Date().toISOString(),
    url: location.href,
  };
}

function formatReport(report: CrashReport): string {
  const lines: string[] = [
    "=== BEAT STILL CRASH REPORT ===",
    "",
    `Time: ${report.timestamp}`,
    "",
    "--- Error ---",
    report.error,
  ];

  if (report.stack) {
    lines.push("", "--- Stack Trace ---", report.stack);
  }

  if (report.gameState) {
    lines.push("", "--- Game State ---", JSON.stringify(report.gameState, null, 2));
  }

  lines.push("", "--- Environment ---", JSON.stringify(report.environment, null, 2));
  lines.push("", "=== END REPORT ===");
  return lines.join("\n");
}

function recordCrash(error: string, stack: string) {
  const report: CrashReport = {
    timestamp: new Date().toISOString(),
    error,
    stack,
    gameState: safeSnapshotGameState(),
    environment: getEnvironment(),
  };

  totalCrashes++;
  reports.push(report);
  if (reports.length > MAX_REPORTS) reports.shift();

  showOverlay(report);
}

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = "crash-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0, 0, 0, 0.9)",
    zIndex: "9999",
    display: "none",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "monospace",
    color: "#e8d5b0",
  });

  overlay.innerHTML = `
    <div style="max-width:700px;width:90%;max-height:80vh;display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:22px;color:#ff6644;">CRASH DETECTED</div>
      <div id="crash-error" style="font-size:14px;color:#ffaa44;word-break:break-word;"></div>
      <pre id="crash-details" style="
        flex:1;overflow:auto;background:#111;border:1px solid #333;border-radius:4px;
        padding:12px;font-size:12px;color:#ccc;white-space:pre-wrap;word-break:break-word;
        min-height:100px;max-height:50vh;
      "></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="crash-copy" style="
          background:#111;border:1px solid #444;color:#e8d5b0;font-family:monospace;
          font-size:13px;padding:6px 16px;border-radius:4px;cursor:pointer;
        ">Copy to Clipboard</button>
        <button id="crash-download" style="
          background:#111;border:1px solid #444;color:#e8d5b0;font-family:monospace;
          font-size:13px;padding:6px 16px;border-radius:4px;cursor:pointer;
        ">Download Report</button>
        <button id="crash-dismiss" style="
          background:#111;border:1px solid #444;color:#e8d5b0;font-family:monospace;
          font-size:13px;padding:6px 16px;border-radius:4px;cursor:pointer;margin-left:auto;
        ">Dismiss</button>
      </div>
      <div id="crash-count" style="font-size:11px;color:#666;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#crash-dismiss")!.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  overlay.querySelector("#crash-copy")!.addEventListener("click", () => {
    const text = (overlay.querySelector("#crash-details") as HTMLPreElement).textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      const btn = overlay.querySelector("#crash-copy") as HTMLButtonElement;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy to Clipboard"), 1500);
    }).catch(() => {});
  });

  overlay.querySelector("#crash-download")!.addEventListener("click", () => {
    const text = (overlay.querySelector("#crash-details") as HTMLPreElement).textContent ?? "";
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beatstill-crash-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}

function showOverlay(report: CrashReport) {
  if (!overlayEl) overlayEl = createOverlay();

  (overlayEl.querySelector("#crash-error") as HTMLDivElement).textContent = report.error;
  (overlayEl.querySelector("#crash-details") as HTMLPreElement).textContent = formatReport(report);
  const kept = totalCrashes > reports.length ? ` (latest ${reports.length} kept)` : "";
  (overlayEl.querySelector("#crash-count") as HTMLDivElement).textContent =
    `${totalCrashes} crash${totalCrashes !== 1 ? "es" : ""} this session${kept}`;

  overlayEl.style.display = "flex";
}

/**
 * Installs the global error hooks. `musicGetter` returns the music that is playing (the run's or
 * the menu's), whose conductor and harmony go into every report.
 */
export function initCrashReporter(sceneGetter: () => GameScene | null, musicGetter?: () => MusicControl | null) {
  if (installed) return;
  installed = true;
  getScene = sceneGetter;
  getMusic = musicGetter ?? null;

  const prevOnError = window.onerror;
  window.onerror = (_msg, _src, _line, _col, err) => {
    const message = err?.message ?? String(_msg);
    const stack = err?.stack ?? `${_src}:${_line}:${_col}`;
    recordCrash(message, stack);
    if (typeof prevOnError === "function") {
      return prevOnError.call(window, _msg, _src, _line, _col, err);
    }
  };

  const prevOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? "") : "";
    recordCrash(`Unhandled Promise: ${message}`, stack);
    if (typeof prevOnRejection === "function") {
      prevOnRejection.call(window, event);
    }
  };
}

export function getCrashReports(): CrashReport[] {
  return [...reports];
}

/** Total crashes this session, including ones no longer kept in getCrashReports(). */
export function getTotalCrashCount(): number {
  return totalCrashes;
}

export function getAllReportsText(): string {
  if (reports.length === 0) return "No crashes recorded this session.";
  const header = totalCrashes > reports.length
    ? `${totalCrashes} crashes this session; showing the latest ${reports.length}.\n`
    : "";
  return header + reports.map((r, i) => `\n--- Report ${i + 1}/${reports.length} ---\n${formatReport(r)}`).join("\n");
}
