import { describe, expect, it } from "vitest";
import { parsePattern } from "../../music/patterns";
import {
  EnemyRhythm,
  SENTINEL_SPIRAL_STEP_ANGLE,
  SPAWN_GRACE_STEPS,
  SPIRAL_STEP_ANGLE,
  densityDoublings,
  pickOffset,
  spiralAngle,
  weave,
  weavePitchHint,
} from "./rhythm";

const hits = (text: string) => parsePattern(text).hits;

/** Steps in [from, to) on which the rhythm fires; `blocked(step)` makes canFire false. */
function fireSteps(r: EnemyRhythm, from: number, to: number, blocked: (step: number) => boolean = () => false): number[] {
  const out: number[] = [];
  for (let s = from; s < to; s++) if (r.onStep(s, !blocked(s))) out.push(s);
  return out;
}

describe("pickOffset", () => {
  it("returns multiples of offsetStep within the pattern", () => {
    const seen = new Set<number>();
    for (let k = 0; k < 8; k++) seen.add(pickOffset(16, 4, () => k));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 4, 8, 12]);
    expect([0, 1].map((k) => pickOffset(16, 8, () => k))).toEqual([0, 8]);
    expect([0, 1].map((k) => pickOffset(2, 1, () => k))).toEqual([0, 1]);
  });

  it("asks for exactly the number of distinct offsets", () => {
    const asked: number[] = [];
    const ask = (n: number) => {
      asked.push(n);
      return 0;
    };
    pickOffset(16, 4, ask);
    pickOffset(20, 2, ask);
    pickOffset(12, 8, ask); // 0, 8, 4
    expect(asked).toEqual([4, 10, 3]);
  });

  it("is 0 for offsetStep 0, empty patterns and clamps bad random values", () => {
    expect(pickOffset(16, 0, () => 3)).toBe(0);
    expect(pickOffset(0, 4, () => 3)).toBe(0);
    expect(pickOffset(16, 4, () => 99)).toBe(12);
    expect(pickOffset(16, 4, () => -5)).toBe(0);
  });
});

describe("motion locked to the grid", () => {
  it("turns the spiral 3π/16 per 8th note, from its own phase", () => {
    expect(SPIRAL_STEP_ANGLE * 2).toBeCloseTo((3 * Math.PI) / 16);
    // ≈ the old continuous 2 rad/s: 0.6 rad per 300 ms volley.
    expect(Math.abs(SPIRAL_STEP_ANGLE * 2 - 0.6)).toBeLessThan(0.02);
    expect(spiralAngle(0, 1)).toBeCloseTo(1);
    expect(spiralAngle(2, 1) - spiralAngle(0, 1)).toBeCloseTo((3 * Math.PI) / 16);
    for (const step of [0, 31, 64, 1000]) {
      const a = spiralAngle(step, 5);
      expect(a >= 0 && a < Math.PI * 2).toBe(true);
    }
  });

  it("locks the bosses' phase-3 spirals to the step at their old turn rates", () => {
    // Old: Sentinel 3 rad/s, Phantom 2 rad/s of game time; a step is 150 ms at 100 bpm.
    expect(Math.abs(SENTINEL_SPIRAL_STEP_ANGLE / 0.15 - 3) / 3).toBeLessThan(0.02);
    expect(Math.abs(SPIRAL_STEP_ANGLE / 0.15 - 2) / 2).toBeLessThan(0.02);
    // Same step, same angle; one step later, one step angle further.
    expect(spiralAngle(12, 0, SENTINEL_SPIRAL_STEP_ANGLE)).toBe(spiralAngle(12, 0, SENTINEL_SPIRAL_STEP_ANGLE));
    expect(spiralAngle(7, 0, SENTINEL_SPIRAL_STEP_ANGLE) - spiralAngle(6, 0, SENTINEL_SPIRAL_STEP_ANGLE)).toBeCloseTo(SENTINEL_SPIRAL_STEP_ANGLE);
    // Nine full turns per 8 bars (128 steps): the pattern realigns with the phrase.
    expect(spiralAngle(128, 0, SENTINEL_SPIRAL_STEP_ANGLE)).toBeCloseTo(0);
    // Fractional steps turn smoothly between grid angles (the inner square's drawing).
    expect(spiralAngle(6.5, 0, SENTINEL_SPIRAL_STEP_ANGLE)).toBeCloseTo(6.5 * SENTINEL_SPIRAL_STEP_ANGLE);
  });

  it("weaves the snake once per beat and offers the swing as a pitch hint", () => {
    expect(weave(0, 0)).toBeCloseTo(0);
    expect(weave(0.25, 0)).toBeCloseTo(1);
    expect(weave(1.25, 0)).toBeCloseTo(1);
    expect(weave(0, 0.75)).toBeCloseTo(-1);
    expect(weavePitchHint(0.25, 0)).toBeCloseTo(1);
    expect(weavePitchHint(0.75, 0)).toBeCloseTo(0);
    expect(weavePitchHint(3, 0)).toBeCloseTo(0.5);
  });
});

describe("densityDoublings", () => {
  it("maps density factors to doublings", () => {
    expect([1, 2, 4, 0.5, 0, Number.NaN].map(densityDoublings)).toEqual([0, 1, 2, 0, 0, 0]);
  });
});

describe("EnemyRhythm", () => {
  it("fires on pattern hits shifted by the offset", () => {
    const r = new EnemyRhythm(hits("x... .... .... ...."), 4);
    // Offset 4: pattern index 0 falls on steps 12, 28, 44 …
    expect(fireSteps(r, 0, 48)).toEqual([12, 28, 44]);
    expect(r.phaseOffset).toBe(4);
  });

  it("puts snipers on the backbeat", () => {
    const pattern = hits(".... x... .... ....");
    expect(fireSteps(new EnemyRhythm(pattern, 0), 0, 32)).toEqual([4, 20]);
    expect(fireSteps(new EnemyRhythm(pattern, 8), 0, 32)).toEqual([12, 28]);
  });

  it("skips hits during the spawn grace, counted from the first step seen", () => {
    const r = new EnemyRhythm(hits("x."), 0);
    expect(SPAWN_GRACE_STEPS).toBe(4);
    expect(fireSteps(r, 101, 110)).toEqual([106, 108]);
  });

  it("holds a shot due while blocked and fires it on the next free step", () => {
    const r = new EnemyRhythm(hits("x... .... .... ...."), 0);
    const blocked = (s: number) => s >= 16 && s < 19;
    expect(fireSteps(r, 0, 40, blocked)).toEqual([19, 32]);
  });

  it("holds at most one shot, and a held shot merges with a hit", () => {
    const r = new EnemyRhythm(hits("x."), 0);
    expect(fireSteps(r, 0, 20, (s) => s >= 4 && s < 12)).toEqual([12, 14, 16, 18]);
    expect(r.holding).toBe(false);
  });

  it("never fires with an empty pattern", () => {
    expect(fireSteps(new EnemyRhythm([], 3), 0, 64)).toEqual([]);
  });

  it("doubles density at the same length and can restore it", () => {
    const r = new EnemyRhythm(hits("x... .... .... ...."), 0);
    r.setDensity(1);
    expect(r.pattern).toHaveLength(16);
    expect(fireSteps(r, 0, 32)).toEqual([8, 16, 24]);
    r.setDensity(0);
    expect(fireSteps(r, 32, 64)).toEqual([32, 48]);
  });

  it("anchors a new pattern at a step and keeps the density", () => {
    const r = new EnemyRhythm(hits("x... .... .... ...."), 0);
    r.setDensity(1);
    r.setPattern(hits("x... .... ...."), 32); // a 12-step pattern starting on bar 2
    expect(r.phaseOffset).toBe(4);
    expect(r.hitsOn(32)).toBe(true);
    expect(fireSteps(r, 4, 56)).toEqual([8, 14, 20, 26, 32, 38, 44, 50]);
  });

  it("keeps the offset (mod length) when a pattern changes without an anchor", () => {
    const r = new EnemyRhythm(hits("x... .... .... ...."), 12);
    r.setPattern(hits("x... ...."));
    expect(r.phaseOffset).toBe(4);
    r.setPattern([]);
    expect(r.phaseOffset).toBe(0);
  });
});
