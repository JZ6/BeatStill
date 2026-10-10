import { describe, it, expect } from "vitest";
import { defaultOptions, normalizeOptions, type GameOptions } from "./GameOptions";

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
};

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
    });
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
