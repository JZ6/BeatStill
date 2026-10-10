import { describe, expect, it } from "vitest";
import { ALL_LEVELS } from "./Levels";
import { normalizeLevelMusic } from "./LevelValidation";

describe("campaign music", () => {
  it("every level sets a valid tempo and key and leaves the theme to the player", () => {
    for (const level of ALL_LEVELS) {
      const music = level.music;
      expect(music, `level ${level.id}`).toBeDefined();
      expect(normalizeLevelMusic(music), `level ${level.id}`).toEqual(music);
      expect(music, `level ${level.id}`).not.toHaveProperty("theme");
      expect(Object.keys(music ?? {}).sort(), `level ${level.id}`).toEqual(["bpm", "key"]);
    }
  });

  it("the tempo rises gently from 92 at level 1 to 128 at level 30", () => {
    const bpms = ALL_LEVELS.map((l) => l.music?.bpm ?? 0);
    expect(bpms[0]).toBe(92);
    expect(bpms[bpms.length - 1]).toBe(128);
    for (let i = 1; i < bpms.length; i++) {
      const step = bpms[i] - bpms[i - 1];
      expect(step, `level ${i + 1}`).toBeGreaterThanOrEqual(1);
      expect(step, `level ${i + 1}`).toBeLessThanOrEqual(2);
    }
  });

  it("the key changes with each group of five levels", () => {
    const keys = ALL_LEVELS.map((l) => l.music?.key);
    const groups = Array.from({ length: 6 }, (_, g) => keys.slice(g * 5, g * 5 + 5));
    for (const group of groups) expect(new Set(group).size).toBe(1);
    const groupKeys = groups.map((g) => g[0]);
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
  });
});
