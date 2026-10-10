import { describe, expect, it } from "vitest";
import { Harmony } from "./Harmony";
import { levelPalette } from "./levelMusic";
import { getPalette } from "./palettes";

const all = () => true;
const none = () => false;

describe("levelPalette", () => {
  const theremin = getPalette("theremin");

  it("plays the player's theme unchanged without level music", () => {
    expect(levelPalette(theremin, undefined, all)).toBe(theremin);
    expect(levelPalette(theremin, {}, all)).toBe(theremin);
  });

  it("applies tempo, key, mode and progression over the player's instruments", () => {
    const p = levelPalette(theremin, { bpm: 128, key: "G", mode: "dorian", progression: "i IV" }, none);
    expect(p).toMatchObject({ id: "theremin", bpm: 128, key: "G", mode: "dorian", progression: "i IV" });
    expect(p.instruments).toBe(theremin.instruments);
    expect(theremin.bpm).toBe(100);
    expect(() => new Harmony({ key: p.key, mode: p.mode, progression: p.progression })).not.toThrow();
  });

  it("switches theme only when the player has unlocked it", () => {
    expect(levelPalette(theremin, { theme: "guitar" }, (id) => id === "guitar").id).toBe("guitar");
    expect(levelPalette(theremin, { theme: "guitar" }, none)).toBe(theremin);
    const locked = levelPalette(theremin, { theme: "synth", bpm: 92 }, none);
    expect(locked.id).toBe("theremin");
    expect(locked.bpm).toBe(92);
  });

  it("an unlocked level theme brings its own tempo and key unless the level sets them", () => {
    const bell = getPalette("bell");
    const p = levelPalette(theremin, { theme: "bell", key: "C" }, all);
    expect(p).toMatchObject({ id: "bell", bpm: bell.bpm, key: "C", mode: bell.mode, progression: bell.progression });
    expect(p.instruments).toBe(bell.instruments);
  });
});
