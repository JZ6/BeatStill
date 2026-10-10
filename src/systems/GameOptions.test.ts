import { describe, it, expect } from "vitest";
import {
  DEFAULT_DRONE_VOLUME,
  DEFAULT_LATENCY_MS,
  REDUCED_SHAKE,
  defaultOptions,
  droneGainFor,
  latencySeconds,
  normalizeOptions,
  shakeScale,
  type GameOptions,
} from "./GameOptions";

const VALID: GameOptions = {
  targetFps: 0,
  particleQuality: 150,
  bulletGlow: false,
  showFps: true,
  masterVolume: 25,
  resolution: 3,
  controls: 2,
  shipColor: 0xff8800,
  themeId: "piano",
  starterWeapon: "laser",
  audioLatencyMs: 120,
  droneVolume: 35,
  heartbeat: false,
  beatVisualizer: true,
  reduceFlashing: true,
  haptics: true,
};

describe("option helpers", () => {
  it("latencySeconds converts and clamps", () => {
    expect(latencySeconds(50)).toBeCloseTo(0.05);
    expect(latencySeconds(0)).toBe(0);
    expect(latencySeconds(500)).toBeCloseTo(0.2);
    expect(latencySeconds(NaN)).toBeCloseTo(DEFAULT_LATENCY_MS / 1000);
  });

  it("droneGainFor is 1 at the default volume and scales linearly", () => {
    expect(droneGainFor(DEFAULT_DRONE_VOLUME)).toBe(1);
    expect(droneGainFor(0)).toBe(0);
    expect(droneGainFor(35)).toBeCloseTo(0.5);
    expect(droneGainFor(100)).toBeCloseTo(100 / 70);
    expect(droneGainFor(NaN)).toBe(1);
  });

  it("shakeScale reduces shake with reduceFlashing", () => {
    expect(shakeScale(false)).toBe(1);
    expect(shakeScale(true)).toBe(REDUCED_SHAKE);
    expect(REDUCED_SHAKE).toBeLessThan(1);
  });
});

describe("normalizeOptions", () => {
  it("returns defaults for garbage input", () => {
    const defaults = defaultOptions();
    for (const raw of [undefined, null, 42, "options", true, [], [1, 2, 3], () => {}]) {
      expect(normalizeOptions(raw)).toEqual(defaults);
    }
    expect(normalizeOptions({})).toEqual(defaults);
  });

  it("works in Node without window/localStorage (defaults resolve to medium resolution)", () => {
    expect(defaultOptions().resolution).toBe(1);
  });

  it("preserves every valid value", () => {
    expect(normalizeOptions({ ...VALID })).toEqual(VALID);
  });

  it("accepts every allowed enum value", () => {
    for (const targetFps of [0, 30, 60, 120, 240]) {
      expect(normalizeOptions({ targetFps }).targetFps).toBe(targetFps);
    }
    for (const particleQuality of [0, 150, 300, 500, 800]) {
      expect(normalizeOptions({ particleQuality }).particleQuality).toBe(particleQuality);
    }
    for (const resolution of [0, 1, 2, 3]) {
      expect(normalizeOptions({ resolution }).resolution).toBe(resolution);
    }
    for (const controls of [0, 1, 2]) {
      expect(normalizeOptions({ controls }).controls).toBe(controls);
    }
  });

  it("falls back per field, keeping the valid ones", () => {
    const d = defaultOptions();
    const result = normalizeOptions({
      ...VALID,
      targetFps: 144,
      particleQuality: "high",
      bulletGlow: "yes",
      showFps: 1,
      resolution: 7,
      controls: -1,
      shipColor: 0x1000000,
      themeId: "",
      starterWeapon: 12,
      audioLatencyMs: "fast",
      droneVolume: null,
      heartbeat: "on",
      beatVisualizer: 1,
      reduceFlashing: [],
      haptics: {},
    });
    expect(result).toEqual({
      ...VALID,
      targetFps: d.targetFps,
      particleQuality: d.particleQuality,
      bulletGlow: d.bulletGlow,
      showFps: d.showFps,
      resolution: d.resolution,
      controls: d.controls,
      shipColor: d.shipColor,
      themeId: d.themeId,
      starterWeapon: d.starterWeapon,
      audioLatencyMs: d.audioLatencyMs,
      droneVolume: d.droneVolume,
      heartbeat: d.heartbeat,
      beatVisualizer: d.beatVisualizer,
      reduceFlashing: d.reduceFlashing,
      haptics: d.haptics,
    });
  });

  it("defaults the audio and accessibility options", () => {
    const d = defaultOptions();
    expect(d.audioLatencyMs).toBe(50);
    expect(d.droneVolume).toBe(70);
    expect(d.heartbeat).toBe(true);
    expect(d.beatVisualizer).toBe(false);
    expect(d.reduceFlashing).toBe(false);
    expect(d.haptics).toBe(false);
  });

  it("keeps old saves without the new fields working (shallow merge adds defaults)", () => {
    const old = { ...VALID } as Record<string, unknown>;
    for (const k of ["audioLatencyMs", "droneVolume", "heartbeat", "beatVisualizer", "reduceFlashing", "haptics"]) delete old[k];
    const d = defaultOptions();
    expect(normalizeOptions(old)).toEqual({
      ...VALID,
      audioLatencyMs: d.audioLatencyMs,
      droneVolume: d.droneVolume,
      heartbeat: d.heartbeat,
      beatVisualizer: d.beatVisualizer,
      reduceFlashing: d.reduceFlashing,
      haptics: d.haptics,
    });
  });

  it("clamps and rounds audioLatencyMs to 0–200 and droneVolume to 0–100", () => {
    const d = defaultOptions();
    expect(normalizeOptions({ audioLatencyMs: 250 }).audioLatencyMs).toBe(200);
    expect(normalizeOptions({ audioLatencyMs: -10 }).audioLatencyMs).toBe(0);
    expect(normalizeOptions({ audioLatencyMs: 37.4 }).audioLatencyMs).toBe(37);
    expect(normalizeOptions({ audioLatencyMs: NaN }).audioLatencyMs).toBe(d.audioLatencyMs);
    expect(normalizeOptions({ droneVolume: 101 }).droneVolume).toBe(100);
    expect(normalizeOptions({ droneVolume: -1 }).droneVolume).toBe(0);
    expect(normalizeOptions({ droneVolume: "70" }).droneVolume).toBe(d.droneVolume);
  });

  it("clamps and rounds masterVolume, falling back when it isn't a finite number", () => {
    const d = defaultOptions();
    expect(normalizeOptions({ masterVolume: 150 }).masterVolume).toBe(100);
    expect(normalizeOptions({ masterVolume: -5 }).masterVolume).toBe(0);
    expect(normalizeOptions({ masterVolume: 33.6 }).masterVolume).toBe(34);
    expect(normalizeOptions({ masterVolume: "70" }).masterVolume).toBe(d.masterVolume);
    expect(normalizeOptions({ masterVolume: NaN }).masterVolume).toBe(d.masterVolume);
    expect(normalizeOptions({ masterVolume: Infinity }).masterVolume).toBe(d.masterVolume);
  });

  it("rejects non-integer or out-of-range ship colors", () => {
    const d = defaultOptions();
    expect(normalizeOptions({ shipColor: 0 }).shipColor).toBe(0);
    expect(normalizeOptions({ shipColor: 0xffffff }).shipColor).toBe(0xffffff);
    expect(normalizeOptions({ shipColor: 1.5 }).shipColor).toBe(d.shipColor);
    expect(normalizeOptions({ shipColor: -1 }).shipColor).toBe(d.shipColor);
    expect(normalizeOptions({ shipColor: "#00ffff" }).shipColor).toBe(d.shipColor);
  });

  it("tolerates unknown extra keys and drops them", () => {
    const result = normalizeOptions({ ...VALID, legacyFlag: true, nested: { a: 1 } });
    expect(result).toEqual(VALID);
    expect(Object.keys(result).sort()).toEqual(Object.keys(VALID).sort());
  });

  it("returns a fresh object each time", () => {
    const a = normalizeOptions(undefined);
    a.masterVolume = 1;
    expect(normalizeOptions(undefined).masterVolume).toBe(defaultOptions().masterVolume);
    expect(defaultOptions()).not.toBe(defaultOptions());
  });
});
