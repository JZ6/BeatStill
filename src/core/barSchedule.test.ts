import { describe, expect, it } from "vitest";
import { PendingSpawn, nextBarLine, nextPhraseBoundary, sectionStartTick } from "./barSchedule";

const TPB = 96;

describe("nextBarLine", () => {
  it("is the first bar line at or after the tick", () => {
    expect(nextBarLine(0, TPB)).toBe(0);
    expect(nextBarLine(1, TPB)).toBe(TPB);
    expect(nextBarLine(95, TPB)).toBe(TPB);
    expect(nextBarLine(96, TPB)).toBe(TPB);
    expect(nextBarLine(97, TPB)).toBe(2 * TPB);
    expect(nextBarLine(150.5, TPB)).toBe(2 * TPB);
  });

  it("treats ticks before the start (currentTick + 1 = 0 before the first advance) as 0", () => {
    expect(nextBarLine(-1 + 1, TPB)).toBe(0);
    expect(nextBarLine(-5, TPB)).toBe(0);
    expect(nextBarLine(Number.NaN, TPB)).toBe(0);
  });
});

describe("nextPhraseBoundary", () => {
  it("lands on bars that are multiples of the phrase length", () => {
    expect(nextPhraseBoundary(0, TPB)).toBe(0);
    expect(nextPhraseBoundary(1, TPB)).toBe(4 * TPB);
    expect(nextPhraseBoundary(4 * TPB, TPB)).toBe(4 * TPB);
    expect(nextPhraseBoundary(5 * TPB, TPB)).toBe(8 * TPB);
    expect(nextPhraseBoundary(5 * TPB, TPB, 2)).toBe(6 * TPB);
  });
});

describe("sectionStartTick", () => {
  it("is the next bar line when the previous section started long ago", () => {
    expect(sectionStartTick(5 * TPB + 10, TPB, 0)).toBe(6 * TPB);
    expect(sectionStartTick(5 * TPB, TPB, 0)).toBe(5 * TPB);
  });

  it("waits at least one bar after the previous section's start", () => {
    // Cleared right after spawning on bar 3: bar 4 is the next bar line, exactly one bar later.
    expect(sectionStartTick(3 * TPB + 1, TPB, 3 * TPB)).toBe(4 * TPB);
    // Cleared on the spawn tick itself: still bar 4, not bar 3.
    expect(sectionStartTick(3 * TPB, TPB, 3 * TPB)).toBe(4 * TPB);
  });

  it("honours a longer minimum section", () => {
    expect(sectionStartTick(3 * TPB + 1, TPB, 3 * TPB, 4)).toBe(7 * TPB);
    expect(sectionStartTick(9 * TPB + 1, TPB, 3 * TPB, 4)).toBe(10 * TPB);
  });

  it("without a previous section it is just the next bar line", () => {
    expect(sectionStartTick(0, TPB, null)).toBe(0);
    expect(sectionStartTick(7, TPB, null, 8)).toBe(TPB);
  });
});

describe("PendingSpawn", () => {
  it("can't be scheduled twice", () => {
    const p = new PendingSpawn<string>();
    expect(p.schedule(96, "a")).toBe(true);
    expect(p.schedule(192, "b")).toBe(false);
    expect(p.tick).toBe(96);
    expect(p.what).toBe("a");
  });

  it("fires exactly once, on its tick", () => {
    const p = new PendingSpawn<string>();
    p.schedule(96, "a");
    const fired: number[] = [];
    for (let t = 0; t <= 300; t++) if (p.take(t)) fired.push(t);
    expect(fired).toEqual([96]);
    expect(p.isPending).toBe(false);
  });

  it("is not skipped when its exact tick has already passed", () => {
    const p = new PendingSpawn<number>();
    p.schedule(96, 1);
    expect(p.take(95)).toBeNull();
    expect(p.take(97)).toEqual({ tick: 96, what: 1 });
    expect(p.take(98)).toBeNull();
  });

  it("can be scheduled again after firing or cancelling", () => {
    const p = new PendingSpawn<number>();
    p.schedule(0, 1);
    p.take(0);
    expect(p.schedule(96, 2)).toBe(true);
    p.cancel();
    expect(p.isPending).toBe(false);
    expect(p.take(96)).toBeNull();
    expect(p.schedule(192, 3)).toBe(true);
  });
});
