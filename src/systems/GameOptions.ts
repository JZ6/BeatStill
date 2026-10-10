import type Phaser from "phaser";

export interface GameOptions {
  targetFps: number;       // 30 | 60 | 120 | 240 | 0 = uncapped
  particleQuality: number; // max particles: 0=off, 150=low, 300=med, 500=high, 800=ultra
  bulletGlow: boolean;
  showFps: boolean;
  masterVolume: number;    // 0-100
  resolution: number;      // 0=low(480), 1=medium(720), 2=high(1080), 3=ultra(1440)
  controls: number;        // 0=auto, 1=keyboard+mouse, 2=touch
  shipColor: number;       // hex color for ship outline
  themeId: string;         // sound theme id
  starterWeapon: string;   // weapon id for run start
  audioLatencyMs: number;  // 0-200: the music's scheduling latency (game, menu and previews)
  droneVolume: number;     // 0-100: the slow-motion drone's loudness (70 = as designed)
  heartbeat: boolean;      // the heartbeat on beats 1 and 3
  beatVisualizer: boolean; // a subtle screen-edge pulse on beats (for players who can't hear well)
  reduceFlashing: boolean; // no beat flashes or grid pulse; gentler camera shake
  haptics: boolean;        // short vibrations on player hits and bar downbeats (where supported)
}

export const FPS_VALUES: readonly number[] = [30, 60, 120, 240, 0];
export const PARTICLE_VALUES: readonly number[] = [0, 150, 300, 500, 800];
const RESOLUTION_VALUES: readonly number[] = [0, 1, 2, 3];
const CONTROLS_VALUES: readonly number[] = [0, 1, 2];
const MAX_ID_LENGTH = 64;
export const LATENCY_MIN_MS = 0;
export const LATENCY_MAX_MS = 200;
export const DEFAULT_LATENCY_MS = 50;
export const DEFAULT_DRONE_VOLUME = 70;
/** Camera shake intensity and duration are scaled by this with reduceFlashing on. */
export const REDUCED_SHAKE = 0.3;

function detectResolution(): number {
  // Not in a browser (e.g. unit tests): fall back to medium.
  if (typeof window === "undefined") return 1;
  const dpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 0;
  const h = window.innerHeight * (dpr || 1);
  if (h >= 1440) return 3;
  if (h >= 1080) return 2;
  if (h >= 720) return 1;
  return 0;
}

const DEFAULTS: GameOptions = {
  targetFps: 60,
  particleQuality: 500,
  bulletGlow: true,
  showFps: false,
  masterVolume: 70,
  resolution: detectResolution(),
  controls: 0,
  shipColor: 0x00ffff,
  themeId: "theremin",
  starterWeapon: "standard",
  audioLatencyMs: DEFAULT_LATENCY_MS,
  droneVolume: DEFAULT_DRONE_VOLUME,
  heartbeat: true,
  beatVisualizer: false,
  reduceFlashing: false,
  haptics: false,
};

/** A fresh copy of the default options. */
export function defaultOptions(): GameOptions {
  return { ...DEFAULTS };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickAllowed(value: unknown, allowed: readonly number[], fallback: number): number {
  return typeof value === "number" && allowed.includes(value) ? value : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** A finite number clamped to [min, max] and rounded; anything else falls back. */
function pickRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function pickVolume(value: unknown, fallback: number): number {
  return pickRange(value, 0, 100, fallback);
}

function pickColor(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffff
    ? value
    : fallback;
}

/** Ids are resolved by their consumers (which fall back on unknown ids); only the shape is checked here. */
function pickId(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : fallback;
}

/**
 * Validates untrusted (e.g. stored) options field by field. Invalid or missing fields fall back to
 * their defaults individually; unknown keys are dropped. Never throws.
 */
export function normalizeOptions(raw: unknown): GameOptions {
  const d = defaultOptions();
  if (!isRecord(raw)) return d;
  return {
    targetFps: pickAllowed(raw.targetFps, FPS_VALUES, d.targetFps),
    particleQuality: pickAllowed(raw.particleQuality, PARTICLE_VALUES, d.particleQuality),
    bulletGlow: pickBoolean(raw.bulletGlow, d.bulletGlow),
    showFps: pickBoolean(raw.showFps, d.showFps),
    masterVolume: pickVolume(raw.masterVolume, d.masterVolume),
    resolution: pickAllowed(raw.resolution, RESOLUTION_VALUES, d.resolution),
    controls: pickAllowed(raw.controls, CONTROLS_VALUES, d.controls),
    shipColor: pickColor(raw.shipColor, d.shipColor),
    themeId: pickId(raw.themeId, d.themeId),
    starterWeapon: pickId(raw.starterWeapon, d.starterWeapon),
    audioLatencyMs: pickRange(raw.audioLatencyMs, LATENCY_MIN_MS, LATENCY_MAX_MS, d.audioLatencyMs),
    droneVolume: pickVolume(raw.droneVolume, d.droneVolume),
    heartbeat: pickBoolean(raw.heartbeat, d.heartbeat),
    beatVisualizer: pickBoolean(raw.beatVisualizer, d.beatVisualizer),
    reduceFlashing: pickBoolean(raw.reduceFlashing, d.reduceFlashing),
    haptics: pickBoolean(raw.haptics, d.haptics),
  };
}

/** The music's scheduling latency in seconds for an audioLatencyMs value (clamped; bad values → default). */
export function latencySeconds(ms: number): number {
  return pickRange(ms, LATENCY_MIN_MS, LATENCY_MAX_MS, DEFAULT_LATENCY_MS) / 1000;
}

/** Drone gain multiplier for a droneVolume value: 1 at the default (70), 0 at 0, ≈1.43 at 100. */
export function droneGainFor(volume: number): number {
  return pickVolume(volume, DEFAULT_DRONE_VOLUME) / DEFAULT_DRONE_VOLUME;
}

/** Camera shake scale: 1, or REDUCED_SHAKE with reduceFlashing on. */
export function shakeScale(reduceFlashing: boolean): number {
  return reduceFlashing ? REDUCED_SHAKE : 1;
}

const STORAGE_KEY = "beatstill_options";

export function loadOptions(): GameOptions {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeOptions(JSON.parse(raw));
    }
  } catch {}
  return defaultOptions();
}

export function saveOptions(opts: GameOptions): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {}
}

export const options: GameOptions = loadOptions();

let _game: Phaser.Game | null = null;

export function registerGame(game: Phaser.Game): void {
  _game = game;
  applyFps(options.targetFps);
}

/**
 * Sets the frame-rate cap (0 = uncapped). Phaser's `fps.target` doesn't cap anything; the cap is
 * TimeStep's `fps.limit`, which this changes at runtime.
 */
export function applyFps(fps: number): void {
  options.targetFps = fps;
  if (!_game) return;
  setFrameLimit(_game.loop, fps);
}

function setFrameLimit(loop: Phaser.Core.TimeStep, fps: number): void {
  const limit = Number.isFinite(fps) && fps > 0 ? fps : 0;
  if (loop.fpsLimit === limit) return;
  loop.fpsLimit = limit;
  loop.hasFpsLimit = limit > 0;
  // Private in Phaser 3.90's TimeStep; it's what stepLimitFPS() compares against.
  (loop as unknown as { _limitRate: number })._limitRate = limit > 0 ? 1000 / limit : 0;
  // start()/wake() choose step() vs stepLimitFPS() once, so restart the RAF loop to switch.
  // If the loop hasn't started yet, start() will pick the right one. Deferred to a microtask so
  // it never runs inside a RAF callback, where the outer step would schedule a second loop.
  Promise.resolve().then(() => {
    if (!loop.running) return;
    loop.sleep();
    loop.wake();
  });
}
