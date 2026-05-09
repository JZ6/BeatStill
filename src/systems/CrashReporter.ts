import type { GameScene } from "../scenes/GameScene";

interface CrashReport {
  timestamp: string;
  error: string;
  stack: string;
  gameState: Record<string, unknown> | null;
  environment: Record<string, unknown>;
}

const MAX_REPORTS = 20;
const reports: CrashReport[] = [];

let getScene: (() => GameScene | null) | null = null;
let overlayEl: HTMLDivElement | null = null;
let installed = false;

function snapshotGameState(): Record<string, unknown> | null {
  if (!getScene) return null;
  const scene = getScene();
  if (!scene) return { status: "no active scene" };

  const enemies = scene.enemies?.getChildren() ?? [];
  const playerBullets = scene.playerBullets?.getChildren() ?? [];
  const enemyBullets = scene.enemyBullets?.getChildren() ?? [];
  const asteroids = scene.asteroids?.getChildren() ?? [];

  return {
    wave: scene.wave,
    score: scene.score,
    gameOver: scene.gameOver,
    paused: scene.paused,
    godMode: scene.godMode,
    chainCount: scene.chainCount,
    chainTimer: scene.chainTimer,
    player: scene.ship
      ? {
          x: Math.round(scene.ship.x),
          y: Math.round(scene.ship.y),
          hp: scene.ship.hp,
          maxHp: scene.ship.maxHp,
          invincible: scene.ship.isInvincible(),
          fireCooldown: Math.round(scene.ship.fireCooldown),
        }
      : null,
    timeScale: scene.timeManager?.scale ?? null,
    audioTheme: scene.audioManager?.currentTheme?.name ?? null,
    audioStarted: scene.audioStarted,
    counts: {
      enemies: enemies.length,
      playerBullets: playerBullets.length,
      enemyBullets: enemyBullets.length,
      asteroids: asteroids.length,
    },
  };
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
    "=== STILL BEAT CRASH REPORT ===",
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
    gameState: snapshotGameState(),
    environment: getEnvironment(),
  };

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
    });
  });

  overlay.querySelector("#crash-download")!.addEventListener("click", () => {
    const text = (overlay.querySelector("#crash-details") as HTMLPreElement).textContent ?? "";
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stillbeat-crash-${Date.now()}.txt`;
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
  (overlayEl.querySelector("#crash-count") as HTMLDivElement).textContent =
    `${reports.length} crash${reports.length !== 1 ? "es" : ""} this session`;

  overlayEl.style.display = "flex";
}

export function initCrashReporter(sceneGetter: () => GameScene | null) {
  if (installed) return;
  installed = true;
  getScene = sceneGetter;

  window.onerror = (_msg, _src, _line, _col, err) => {
    const message = err?.message ?? String(_msg);
    const stack = err?.stack ?? `${_src}:${_line}:${_col}`;
    recordCrash(message, stack);
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? "") : "";
    recordCrash(`Unhandled Promise: ${message}`, stack);
  };
}

export function getCrashReports(): CrashReport[] {
  return [...reports];
}

export function getAllReportsText(): string {
  if (reports.length === 0) return "No crashes recorded this session.";
  return reports.map((r, i) => `\n--- Report ${i + 1}/${reports.length} ---\n${formatReport(r)}`).join("\n");
}
