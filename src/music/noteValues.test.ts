import { describe, expect, it } from "vitest";
import { ALL_WEAPONS } from "../systems/Weapons";
import { MIN_FIRE_TICKS, TICK_LADDER, climbLadder, fireIntervalTicks, ladderIndex, noteName } from "./noteValues";

describe("TICK_LADDER", () => {
  it("runs from slowest to fastest without repeats", () => {
    expect(TICK_LADDER).toEqual([96, 48, 36, 24, 18, 16, 12, 8, 6, 4, 3]);
    TICK_LADDER.slice(1).forEach((t, i) => expect(t).toBeLessThan(TICK_LADDER[i]));
    expect(TICK_LADDER[TICK_LADDER.length - 1]).toBe(MIN_FIRE_TICKS);
  });

  it("holds every weapon's note value", () => {
    for (const w of ALL_WEAPONS) expect(TICK_LADDER, w.id).toContain(w.noteTicks);
  });

  it("gives each weapon the planned note value", () => {
    const names = Object.fromEntries(ALL_WEAPONS.map((w) => [w.id, noteName(w.noteTicks)]));
    expect(names).toEqual({
      standard: "1/8",
      shotgun: "1/4",
      laser: "1/16",
      cannon: "1/4",
      homing: "1/8",
      nova: "1/4",
      railgun: "1/8T",
      nuke: "1/2",
      swarm: "1/8",
      minigun: "1/32",
    });
  });
});

describe("noteName", () => {
  it("names every rung of the ladder", () => {
    expect(TICK_LADDER.map(noteName)).toEqual([
      "1/1",
      "1/2",
      "dotted 1/4",
      "1/4",
      "dotted 1/8",
      "1/4T",
      "1/8",
      "1/8T",
      "1/16",
      "1/16T",
      "1/32",
    ]);
  });

  it("names the halved (overclocked) intervals and falls back to ticks", () => {
    expect(noteName(9)).toBe("dotted 1/16");
    expect(noteName(2)).toBe("1/32T");
    expect(noteName(72)).toBe("dotted 1/2");
    expect(noteName(5)).toBe("5 ticks");
    expect(noteName(0)).toBe("?");
    expect(noteName(Number.NaN)).toBe("?");
  });
});

describe("ladder climbing", () => {
  it("finds rungs, mapping off-ladder intervals to the nearest faster rung", () => {
    expect(ladderIndex(96)).toBe(0);
    expect(ladderIndex(12)).toBe(6);
    expect(ladderIndex(3)).toBe(10);
    expect(ladderIndex(20)).toBe(ladderIndex(18));
    expect(ladderIndex(500)).toBe(0);
    expect(ladderIndex(1)).toBe(TICK_LADDER.length - 1);
    expect(ladderIndex(Number.NaN)).toBe(TICK_LADDER.length - 1);
  });

  it("climbs one rung per level and stops at the last", () => {
    expect([0, 1, 2, 3].map((n) => climbLadder(12, n))).toEqual([12, 8, 6, 4]);
    expect([0, 1, 2, 3].map((n) => climbLadder(24, n))).toEqual([24, 18, 16, 12]);
    expect(climbLadder(6, 5)).toBe(3);
    expect(climbLadder(3, 2)).toBe(3);
    expect(climbLadder(12, -1)).toBe(12);
    expect(climbLadder(12, Number.NaN)).toBe(12);
  });

  it("fireIntervalTicks: level rungs, then Overclock halves (never below a 32nd)", () => {
    expect(fireIntervalTicks(12, 0)).toBe(12);
    expect(fireIntervalTicks(12, 2)).toBe(6);
    expect(fireIntervalTicks(12, 0, true)).toBe(6);
    expect(fireIntervalTicks(48, 0, true)).toBe(24);
    expect(fireIntervalTicks(24, 1, true)).toBe(9);
    expect(fireIntervalTicks(12, 3, true)).toBe(MIN_FIRE_TICKS);
    expect(fireIntervalTicks(3, 0, true)).toBe(MIN_FIRE_TICKS);
  });
});
