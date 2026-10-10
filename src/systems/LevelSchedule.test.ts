import { describe, expect, it } from "vitest";
import { LevelSchedule, waveMinBars, type LevelStep } from "./LevelSchedule";

const TPB = 96;

/** Runs ticks [from, to] and returns every step that fired, with its tick. */
function run(s: LevelSchedule, from: number, to: number): { tick: number; step: LevelStep }[] {
  const out: { tick: number; step: LevelStep }[] = [];
  for (let t = from; t <= to; t++) {
    const step = s.onTick(t);
    if (step) out.push({ tick: t, step });
  }
  return out;
}

describe("waveMinBars", () => {
  it("defaults to one bar", () => {
    expect(waveMinBars(undefined)).toBe(1);
    expect(waveMinBars(0)).toBe(1);
    expect(waveMinBars(-3)).toBe(1);
    expect(waveMinBars("4")).toBe(1);
    expect(waveMinBars(Number.NaN)).toBe(1);
    expect(waveMinBars(4)).toBe(4);
    expect(waveMinBars(2.7)).toBe(2);
  });
});

describe("LevelSchedule", () => {
  it("spawns the first wave on the first bar line of the run", () => {
    const s = new LevelSchedule([undefined, undefined], TPB);
    expect(s.start(0)).toBe(true);
    expect(s.pendingTick).toBe(0);
    expect(run(s, 0, 0)).toEqual([{ tick: 0, step: { kind: "wave", index: 0 } }]);
    expect(s.waveIndex).toBe(0);
  });

  it("starts on the next bar line when the run is already mid-bar", () => {
    const s = new LevelSchedule([undefined], TPB);
    s.start(30);
    expect(run(s, 30, 200)).toEqual([{ tick: TPB, step: { kind: "wave", index: 0 } }]);
  });

  it("only starts once", () => {
    const s = new LevelSchedule([undefined], TPB);
    expect(s.start(0)).toBe(true);
    expect(s.start(0)).toBe(false);
    run(s, 0, 0);
    expect(s.start(1)).toBe(false);
  });

  it("does nothing on a clear field before the first wave spawned", () => {
    const s = new LevelSchedule([undefined, undefined], TPB);
    expect(s.onFieldClear(0)).toBe(false);
    s.start(0);
    expect(s.onFieldClear(0)).toBe(false);
    expect(s.pendingStep).toEqual({ kind: "wave", index: 0 });
  });

  it("spawns the next wave on the next bar line once the field is clear", () => {
    const s = new LevelSchedule([undefined, undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    // Cleared mid bar 2: the next wave lands on bar 3.
    run(s, 1, 2 * TPB + 40);
    expect(s.onFieldClear(2 * TPB + 41)).toBe(true);
    expect(run(s, 2 * TPB + 41, 4 * TPB)).toEqual([{ tick: 3 * TPB, step: { kind: "wave", index: 1 } }]);
  });

  it("keeps at least one bar between wave spawns", () => {
    const s = new LevelSchedule([undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    // A wave with no enemies is clear at once.
    expect(s.onFieldClear(1)).toBe(true);
    expect(s.pendingTick).toBe(TPB);
  });

  it("honours a wave's minimum section length", () => {
    const s = new LevelSchedule([4, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    s.onFieldClear(1);
    expect(s.pendingTick).toBe(4 * TPB);
    expect(run(s, 1, 5 * TPB)).toEqual([{ tick: 4 * TPB, step: { kind: "wave", index: 1 } }]);
  });

  it("guards the pending spawn: clearing again doesn't reschedule, and it fires once", () => {
    const s = new LevelSchedule([undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    expect(s.onFieldClear(10)).toBe(true);
    expect(s.onFieldClear(50)).toBe(false);
    expect(s.onFieldClear(TPB + 5)).toBe(false);
    expect(s.pendingTick).toBe(TPB);
    expect(run(s, 10, 3 * TPB).map((f) => f.tick)).toEqual([TPB]);
  });

  it("is never skipped when the frame's ticks jump past the bar line", () => {
    const s = new LevelSchedule([undefined, undefined], TPB);
    s.start(0);
    s.onTick(0);
    s.onFieldClear(1);
    expect(s.onTick(TPB - 1)).toBeNull();
    expect(s.onTick(TPB + 3)).toEqual({ kind: "wave", index: 1 });
    expect(s.waveIndex).toBe(1);
  });

  it("completes the level on a bar line after the last wave", () => {
    const s = new LevelSchedule([undefined, 2], TPB);
    s.start(0);
    run(s, 0, 0);
    s.onFieldClear(10);
    run(s, 10, TPB);
    expect(s.onFieldClear(TPB + 7)).toBe(true);
    expect(s.pendingStep).toEqual({ kind: "complete" });
    // wave 2 has bars: 2, so not before bar 3.
    expect(run(s, TPB + 7, 4 * TPB)).toEqual([{ tick: 3 * TPB, step: { kind: "complete" } }]);
    expect(s.isComplete).toBe(true);
    expect(s.onFieldClear(4 * TPB)).toBe(false);
  });

  it("a level with no waves completes on the first bar line", () => {
    const s = new LevelSchedule([], TPB);
    s.start(5);
    expect(run(s, 5, TPB)).toEqual([{ tick: TPB, step: { kind: "complete" } }]);
  });
});

describe("LevelSchedule.skip", () => {
  it("queues the next wave on the next bar line, ignoring the wave's minimum bars", () => {
    const s = new LevelSchedule([4, undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 10);
    expect(s.waveIndex).toBe(0);
    expect(s.skip(11)).toEqual({ kind: "wave", index: 1 });
    expect(s.pendingTick).toBe(TPB); // not 4 bars after wave 0
    expect(run(s, 11, TPB)).toEqual([{ tick: TPB, step: { kind: "wave", index: 1 } }]);
  });

  it("advances one wave per skip, past a wave that is still queued", () => {
    const s = new LevelSchedule([undefined, undefined, undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    s.skip(1);
    expect(s.pendingStep).toEqual({ kind: "wave", index: 1 });
    s.skip(2);
    expect(s.pendingStep).toEqual({ kind: "wave", index: 2 });
    expect(run(s, 3, TPB)).toEqual([{ tick: TPB, step: { kind: "wave", index: 2 } }]);
    expect(s.waveIndex).toBe(2);
  });

  it("replaces a normally scheduled next wave (no double spawn)", () => {
    const s = new LevelSchedule([undefined, undefined, undefined], TPB);
    s.start(0);
    run(s, 0, 0);
    s.onFieldClear(1); // wave 1 queued for bar 1
    s.skip(2); // skips it: wave 2 instead
    expect(run(s, 2, 3 * TPB)).toEqual([{ tick: TPB, step: { kind: "wave", index: 2 } }]);
  });

  it("skipping the last wave completes the level; nothing to skip after that or before the start", () => {
    const s = new LevelSchedule([undefined], TPB);
    expect(s.skip(0)).toBeNull();
    s.start(0);
    // Wave 0 is queued: skipping it moves straight to the completion.
    expect(s.skip(0)).toEqual({ kind: "complete" });
    expect(s.skip(1)).toBeNull();
    expect(run(s, 0, 0)).toEqual([{ tick: 0, step: { kind: "complete" } }]);
    expect(s.isComplete).toBe(true);
    expect(s.skip(1)).toBeNull();
  });
});
