import { describe, expect, it } from "vitest";
import {
  normalizeAchievementState,
  normalizeLevelProgress,
  normalizeUnlockState,
  type AchievementState,
  type LevelProgress,
  type UnlockState,
} from "./saveSchemas";

const GARBAGE: unknown[] = [undefined, null, 0, 42, "", "hello", true, [], [1, 2, 3], () => {}];

const UNLOCK_DEFAULTS: UnlockState = {
  shards: 0,
  highScore: 0,
  highWave: 0,
  bestChain: 0,
  unlockedIds: [],
  weaponMastery: {},
  evolvedWeapons: [],
  shopPurchases: {},
};

const ACHIEVEMENT_DEFAULTS: AchievementState = {
  unlockedIds: [],
  totalKills: 0,
  bossesDefeated: 0,
  weaponsUsed: [],
  themesUsed: [],
  totalPickups: 0,
};

const LEVEL_DEFAULTS: LevelProgress = { completedIds: [] };

describe("normalizeUnlockState", () => {
  it.each(GARBAGE)("returns defaults for garbage input %#", (raw) => {
    expect(normalizeUnlockState(raw)).toEqual(UNLOCK_DEFAULTS);
  });

  it("returns fresh containers each call (no shared default arrays/objects)", () => {
    const a = normalizeUnlockState(undefined);
    const b = normalizeUnlockState(undefined);
    a.unlockedIds.push("theme_guitar");
    a.shopPurchases.iron_hull = 1;
    expect(b.unlockedIds).toEqual([]);
    expect(b.shopPurchases).toEqual({});
  });

  it("fills defaults for fields missing from an old partial save", () => {
    const old = { shards: 37, highScore: 12000, highWave: 6, unlockedIds: ["theme_guitar"] };
    expect(normalizeUnlockState(old)).toEqual({
      ...UNLOCK_DEFAULTS,
      shards: 37,
      highScore: 12000,
      highWave: 6,
      unlockedIds: ["theme_guitar"],
    });
  });

  it("preserves a fully valid save", () => {
    const valid: UnlockState = {
      shards: 123,
      highScore: 45678,
      highWave: 14,
      bestChain: 22,
      unlockedIds: ["theme_guitar", "color_red", "upgrade_pierce"],
      weaponMastery: { shotgun: { pickups: 12, kills: 3 }, laser: { pickups: 0, kills: 40 } },
      evolvedWeapons: ["railgun"],
      shopPurchases: { iron_hull: 3, lucky_star: 5 },
    };
    expect(normalizeUnlockState(structuredClone(valid))).toEqual(valid);
  });

  it("replaces wrongly typed, negative or non-finite numbers with defaults", () => {
    const state = normalizeUnlockState({ shards: "50", highScore: -5, highWave: Infinity, bestChain: NaN });
    expect(state.shards).toBe(0);
    expect(state.highScore).toBe(0);
    expect(state.highWave).toBe(0);
    expect(state.bestChain).toBe(0);
  });

  it("filters arrays to strings and removes duplicates", () => {
    const state = normalizeUnlockState({
      unlockedIds: ["theme_bell", 5, "theme_bell", null, "color_gold", "color_gold"],
      evolvedWeapons: "nuke",
    });
    expect(state.unlockedIds).toEqual(["theme_bell", "color_gold"]);
    expect(state.evolvedWeapons).toEqual([]);
  });

  it("keeps shopPurchases as non-negative integers only", () => {
    const state = normalizeUnlockState({
      shopPurchases: { iron_hull: 2, sharp_rounds: 1.9, swift_feet: -1, quick_draw: "3", chain_link: null, lucky_star: 0 },
    });
    expect(state.shopPurchases).toEqual({ iron_hull: 2, sharp_rounds: 1, lucky_star: 0 });
  });

  it("normalizes weapon mastery entries and drops invalid ones", () => {
    const state = normalizeUnlockState({
      weaponMastery: { shotgun: { pickups: 4 }, laser: "lots", cannon: { pickups: -2, kills: 7.5 } },
    });
    expect(state.weaponMastery).toEqual({ shotgun: { pickups: 4, kills: 0 }, cannon: { pickups: 0, kills: 7 } });
  });

  it("keeps unknown top-level fields for forward compatibility", () => {
    const state = normalizeUnlockState({ shards: 5, futureField: { a: 1 }, version: 3 }) as UnlockState & Record<string, unknown>;
    expect(state.futureField).toEqual({ a: 1 });
    expect(state.version).toBe(3);
    expect(state.shards).toBe(5);
  });
});

describe("normalizeAchievementState", () => {
  it.each(GARBAGE)("returns defaults for garbage input %#", (raw) => {
    expect(normalizeAchievementState(raw)).toEqual(ACHIEVEMENT_DEFAULTS);
  });

  it("fills totalPickups (and other missing fields) for an old save", () => {
    const old = { unlockedIds: ["first_blood"], totalKills: 250 };
    expect(normalizeAchievementState(old)).toEqual({
      ...ACHIEVEMENT_DEFAULTS,
      unlockedIds: ["first_blood"],
      totalKills: 250,
    });
  });

  it("preserves a fully valid save", () => {
    const valid: AchievementState = {
      unlockedIds: ["first_blood", "collector"],
      totalKills: 1234,
      bossesDefeated: 3,
      weaponsUsed: ["shotgun", "laser"],
      themesUsed: ["piano", "guitar"],
      totalPickups: 87,
    };
    expect(normalizeAchievementState(structuredClone(valid))).toEqual(valid);
  });

  it("removes duplicates and non-strings from id arrays", () => {
    const state = normalizeAchievementState({
      unlockedIds: ["first_blood", "first_blood", 1],
      weaponsUsed: ["shotgun", {}, "shotgun", "laser"],
      themesUsed: [null, "bell", "bell"],
    });
    expect(state.unlockedIds).toEqual(["first_blood"]);
    expect(state.weaponsUsed).toEqual(["shotgun", "laser"]);
    expect(state.themesUsed).toEqual(["bell"]);
  });

  it("defaults invalid counters", () => {
    const state = normalizeAchievementState({ totalKills: -3, bossesDefeated: "2", totalPickups: NaN });
    expect(state.totalKills).toBe(0);
    expect(state.bossesDefeated).toBe(0);
    expect(state.totalPickups).toBe(0);
  });

  it("keeps unknown fields", () => {
    const state = normalizeAchievementState({ totalKills: 1, streak: 9 }) as AchievementState & Record<string, unknown>;
    expect(state.streak).toBe(9);
  });
});

describe("normalizeLevelProgress", () => {
  it.each(GARBAGE)("returns defaults for garbage input %#", (raw) => {
    expect(normalizeLevelProgress(raw)).toEqual(LEVEL_DEFAULTS);
  });

  it("defaults completedIds when missing", () => {
    expect(normalizeLevelProgress({})).toEqual(LEVEL_DEFAULTS);
  });

  it("preserves valid progress", () => {
    expect(normalizeLevelProgress({ completedIds: [1, 2, 3, 7] })).toEqual({ completedIds: [1, 2, 3, 7] });
  });

  it("drops non-integer ids and duplicates", () => {
    const progress = normalizeLevelProgress({ completedIds: [1, 1, "2", 3.5, -1, null, NaN, 4, 4] });
    expect(progress.completedIds).toEqual([1, 4]);
  });

  it("keeps unknown fields", () => {
    const progress = normalizeLevelProgress({ completedIds: [1], stars: { 1: 3 } }) as LevelProgress & Record<string, unknown>;
    expect(progress.stars).toEqual({ 1: 3 });
  });
});
