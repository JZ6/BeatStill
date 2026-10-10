import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL_BPM,
  MIN_LEVEL_BPM,
  normalizeBpm,
  normalizeKey,
  normalizeLevelDef,
  normalizeLevelMusic,
  normalizeMode,
  normalizeProgression,
  normalizeTheme,
  progressionError,
} from "./LevelValidation";
import { ALL_LEVELS } from "./Levels";

function level(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1000,
    name: "Test",
    description: "desc",
    shipRx: 0.5,
    shipRy: 0.8,
    waves: [{ enemies: [{ type: "basic", rx: 0.5, ry: 0.2 }] }],
    ...overrides,
  };
}

describe("normalizeLevelDef", () => {
  it("round-trips a valid level, preserving unknown fields on level, music, waves and entries", () => {
    const raw = level({
      music: { theme: "bell", bpm: 120, key: "A", mode: "aeolian", progression: "i VI III VII", swing: 0.1 },
      tags: ["hard"],
      waves: [
        {
          bars: 8,
          enemies: [{ type: "sniper", rx: 0.1, ry: -0.04, voice: "lead" }],
          walls: [
            { rx: 0.1, ry: 0.2, rw: 0.3, rh: 0.02, type: "glass", hp: 2 },
            { rx: 0.3, ry: 0.3, rw: 0.4, rh: 0.02, type: "solid", oneWay: "down" },
          ],
          asteroids: [{ rx: 0.7, ry: 0.7, size: "small" }],
          initialBullets: [{ rx: 0.5, ry: 0.1, angle: 1.57, speed: 120 }],
        },
        { enemies: [] },
      ],
    });

    expect(normalizeLevelDef(raw)).toEqual(raw);
  });

  it("returns a deep copy that does not alias the input", () => {
    const raw = level({ music: { bpm: 100 } });
    const out = normalizeLevelDef(raw)!;

    out.waves[0].enemies[0].rx = 0.9;
    (out as unknown as { music: { bpm: number } }).music.bpm = 1;

    expect((raw.waves as { enemies: { rx: number }[] }[])[0].enemies[0].rx).toBe(0.5);
    expect((raw.music as { bpm: number }).bpm).toBe(100);
  });

  it("returns null for garbage", () => {
    for (const bad of [
      null, undefined, 42, "level", true, [], [level()],
      {}, { id: "1000", waves: [] }, { id: Number.NaN }, { id: Infinity },
      level({ waves: "nope" }), level({ waves: { 0: { enemies: [] } } }),
      { id: 1, fn: () => 0 },
    ]) {
      expect(normalizeLevelDef(bad)).toBeNull();
    }
  });

  it("fills defaults for name and description", () => {
    expect(normalizeLevelDef({ id: 7 })).toEqual({
      id: 7, name: "Custom Level", description: "", waves: [{ enemies: [] }],
    });
    expect(normalizeLevelDef(level({ name: "   " }))!.name).toBe("Custom Level");
    expect(normalizeLevelDef(level({ name: 5, description: null }))).toMatchObject({
      name: "Custom Level", description: "",
    });
  });

  it("trims names and caps them at 40 characters", () => {
    expect(normalizeLevelDef(level({ name: "  Hello  " }))!.name).toBe("Hello");
    expect(normalizeLevelDef(level({ name: "x".repeat(60) }))!.name).toBe("x".repeat(40));
  });

  it("turns missing, empty or all-invalid waves into one empty wave", () => {
    expect(normalizeLevelDef(level({ waves: undefined }))!.waves).toEqual([{ enemies: [] }]);
    expect(normalizeLevelDef(level({ waves: null }))!.waves).toEqual([{ enemies: [] }]);
    expect(normalizeLevelDef(level({ waves: [] }))!.waves).toEqual([{ enemies: [] }]);
    expect(normalizeLevelDef(level({ waves: [null, 3, "w"] }))!.waves).toEqual([{ enemies: [] }]);
  });

  it("drops invalid waves and gives a wave without enemies an empty list", () => {
    const out = normalizeLevelDef(level({ waves: [null, { bars: 4 }, { enemies: "x" }] }))!;
    expect(out.waves).toEqual([{ enemies: [], bars: 4 }, { enemies: [] }]);
  });

  it("filters invalid enemies, including phantom decoys", () => {
    const out = normalizeLevelDef(level({
      waves: [{
        enemies: [
          { type: "basic", rx: 0.1, ry: 0.1 },
          { type: "phantom_decoy", rx: 0.2, ry: 0.2 },
          { type: "dragon", rx: 0.3, ry: 0.3 },
          { type: "toString", rx: 0.3, ry: 0.3 },
          { type: "tank", rx: "0.4", ry: 0.4 },
          { type: "tank", rx: Number.NaN, ry: 0.4 },
          { type: "swarm", rx: 0.5 },
          null,
          "basic",
          { type: "phantom", rx: 0.6, ry: 0.6 },
        ],
      }],
    }))!;

    expect(out.waves[0].enemies).toEqual([
      { type: "basic", rx: 0.1, ry: 0.1 },
      { type: "phantom", rx: 0.6, ry: 0.6 },
    ]);
  });

  it("filters invalid walls and strips invalid optional wall fields", () => {
    const out = normalizeLevelDef(level({
      waves: [{
        enemies: [],
        walls: [
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "lava" },
          { rx: 0.1, ry: 0.1, rw: 0, rh: 0.02, type: "solid" },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: -1, type: "solid" },
          { rx: 0.1, ry: Infinity, rw: 0.2, rh: 0.02, type: "solid" },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "glass", hp: 0 },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "glass", hp: 2.5 },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "solid", hp: 3 },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "bounce", oneWay: "sideways" },
          { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "bounce", oneWay: "left" },
        ],
      }],
    }))!;

    expect(out.waves[0].walls).toEqual([
      { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "glass" },
      { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "glass" },
      { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "solid" },
      { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.1, ry: 0.1, rw: 0.2, rh: 0.02, type: "bounce", oneWay: "left" },
    ]);
  });

  it("filters invalid asteroids and initial bullets", () => {
    const out = normalizeLevelDef(level({
      waves: [{
        enemies: [],
        asteroids: [
          { rx: 0.1, ry: 0.1, size: "huge" },
          { rx: 0.1, ry: 0.1 },
          { rx: 0.2, ry: 0.2, size: "large" },
        ],
        initialBullets: [
          { rx: 0.1, ry: 0.1, angle: 0 },
          { rx: 0.1, ry: 0.1, angle: "up", speed: 100 },
          { rx: 0.3, ry: 0.3, angle: 0, speed: 100 },
        ],
      }],
    }))!;

    expect(out.waves[0].asteroids).toEqual([{ rx: 0.2, ry: 0.2, size: "large" }]);
    expect(out.waves[0].initialBullets).toEqual([{ rx: 0.3, ry: 0.3, angle: 0, speed: 100 }]);
  });

  it("turns non-array optional lists into empty lists", () => {
    const out = normalizeLevelDef(level({
      waves: [{ enemies: [], walls: "x", asteroids: null, initialBullets: {} }],
    }))!;
    expect(out.waves[0]).toEqual({ enemies: [], walls: [], asteroids: [], initialBullets: [] });
  });

  it("clamps positions to [-0.2, 1.2] and keeps legitimate off-screen spawns", () => {
    const out = normalizeLevelDef(level({
      waves: [{
        enemies: [
          { type: "basic", rx: 5, ry: -1 },
          { type: "swarm", rx: 0.5, ry: -0.04 },
        ],
        walls: [{ rx: -3, ry: 2, rw: 9, rh: 0.02, type: "solid" }],
        asteroids: [{ rx: -0.5, ry: 1.5, size: "medium" }],
        initialBullets: [{ rx: 2, ry: -2, angle: 0, speed: 50 }],
      }],
    }))!;
    const w = out.waves[0];

    expect(w.enemies).toEqual([
      { type: "basic", rx: 1.2, ry: -0.2 },
      { type: "swarm", rx: 0.5, ry: -0.04 },
    ]);
    expect(w.walls).toEqual([{ rx: -0.2, ry: 1.2, rw: 1.4, rh: 0.02, type: "solid" }]);
    expect(w.asteroids).toEqual([{ rx: -0.2, ry: 1.2, size: "medium" }]);
    expect(w.initialBullets).toEqual([{ rx: 1.2, ry: -0.2, angle: 0, speed: 50 }]);
  });

  it("clamps the ship start to [0, 1] and drops a non-numeric one", () => {
    expect(normalizeLevelDef(level({ shipRx: 1.5, shipRy: -0.3 }))).toMatchObject({ shipRx: 1, shipRy: 0 });

    const out = normalizeLevelDef(level({ shipRx: "0.5", shipRy: undefined }))!;
    expect(out).not.toHaveProperty("shipRx");
    expect(out).not.toHaveProperty("shipRy");
  });

  it("keeps a wave's bars only when it is a number from 1 to 64 (floored)", () => {
    const bars = [4, 1, 64, 2.9, 0, -2, 65, "4", null, Number.NaN];
    const out = normalizeLevelDef(level({ waves: bars.map((b) => ({ enemies: [], bars: b })) }))!;
    expect(out.waves.map((w) => w.bars)).toEqual([4, 1, 64, 2, undefined, undefined, undefined, undefined, undefined, undefined]);
    expect(out.waves[4]).not.toHaveProperty("bars");
  });

  it("survives a JSON round-trip", () => {
    const first = normalizeLevelDef(level({ music: { bpm: 90 } }))!;
    expect(normalizeLevelDef(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });

  it("leaves every campaign level unchanged", () => {
    for (const def of ALL_LEVELS) {
      expect(normalizeLevelDef(def), `level ${def.id}`).toEqual(def);
    }
  });

  it("validates the level's music and drops invalid fields", () => {
    const out = normalizeLevelDef(level({
      music: { theme: "lava", bpm: 200, key: "H", mode: "majorPentatonic", progression: "I IIII", mood: "dark" },
    }))!;
    expect(out.music).toEqual({ mood: "dark" });
  });

  it("drops music that is not an object or ends up empty", () => {
    for (const music of [null, 5, "fast", [], {}, { bpm: "120" }, { key: 4, mode: null }]) {
      expect(normalizeLevelDef(level({ music })), JSON.stringify(music)).not.toHaveProperty("music");
    }
  });
});

describe("level music fields", () => {
  it("bpm: 60–180", () => {
    expect(normalizeBpm(60)).toBe(60);
    expect(normalizeBpm(180)).toBe(180);
    expect(normalizeBpm(97.5)).toBe(97.5);
    for (const bad of [59.9, 181, -100, Number.NaN, Infinity, "120", null]) expect(normalizeBpm(bad)).toBeUndefined();
    expect([MIN_LEVEL_BPM, MAX_LEVEL_BPM]).toEqual([60, 180]);
  });

  it("key: a valid note name, letter capitalised", () => {
    expect(normalizeKey("E")).toBe("E");
    expect(normalizeKey(" bb ")).toBe("Bb");
    expect(normalizeKey("f#")).toBe("F#");
    expect(normalizeKey("C♯")).toBe("C♯");
    for (const bad of ["H", "E4", "", "Ebbb", "BB", 4, null]) expect(normalizeKey(bad)).toBeUndefined();
  });

  it("mode: a 7-note mode (any case), with major/minor aliases", () => {
    expect(normalizeMode("dorian")).toBe("dorian");
    expect(normalizeMode("Phrygian")).toBe("phrygian");
    expect(normalizeMode("harmonicminor")).toBe("harmonicMinor");
    expect(normalizeMode("major")).toBe("ionian");
    expect(normalizeMode("minor")).toBe("aeolian");
    for (const bad of ["majorPentatonic", "minorPentatonic", "blues", "", 3]) expect(normalizeMode(bad)).toBeUndefined();
  });

  it("progression: parseable by Harmony, whitespace collapsed, at most 32 chords", () => {
    expect(normalizeProgression("i VI III VII")).toBe("i VI III VII");
    expect(normalizeProgression("  i:2   iv |  V7 ")).toBe("i:2 iv | V7");
    expect(progressionError("I vi IV V7")).toBeNull();
    expect(progressionError("I IIII")).toMatch(/Invalid chord numeral/);
    expect(progressionError("")).toMatch(/empty/);
    expect(progressionError(Array(33).fill("i").join(" "))).toMatch(/32/);
    for (const bad of ["", "   ", "X Y", "Iv", 5]) expect(normalizeProgression(bad)).toBeUndefined();
  });

  it("theme: a known palette id, lowercased", () => {
    expect(normalizeTheme("Guitar")).toBe("guitar");
    expect(normalizeTheme("piano")).toBe("piano");
    for (const bad of ["kazoo", "", 1, null]) expect(normalizeTheme(bad)).toBeUndefined();
  });

  it("normalizeLevelMusic keeps valid fields and unknown ones", () => {
    expect(normalizeLevelMusic({ bpm: 128, key: "f#", mode: "Minor", extra: true })).toEqual({
      bpm: 128, key: "F#", mode: "aeolian", extra: true,
    });
    expect(normalizeLevelMusic({ bpm: 1000 })).toBeUndefined();
    expect(normalizeLevelMusic(undefined)).toBeUndefined();
  });
});
