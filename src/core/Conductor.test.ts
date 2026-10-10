import { describe, expect, it } from "vitest";
import { Conductor, MAX_REAL_DT, TICKS_PER_BEAT, TICKS_PER_STEP } from "./Conductor";

describe("Conductor", () => {
  it("emits tick 0 (a downbeat) on the first advance", () => {
    const c = new Conductor({ bpm: 120 });
    const { ticks } = c.advance(0.001);
    expect(ticks[0]).toMatchObject({ tick: 0, isBar: true, isBeat: true, isStep: true, bar: 0 });
  });

  it("advances 2 beats per real second at 120 bpm and timeScale 1", () => {
    const c = new Conductor({ bpm: 120 });
    let ticks = 0;
    for (let i = 0; i < 20; i++) ticks += c.advance(0.05).ticks.length;
    expect(c.beat).toBeCloseTo(2, 6);
    // ticks 0..48 inclusive
    expect(ticks).toBe(2 * TICKS_PER_BEAT + 1);
  });

  it("scales musical time by timeScale (one clock for world and music)", () => {
    const c = new Conductor({ bpm: 120, timeScale: 0.25 });
    const r = c.advance(0.08);
    expect(r.gameDt).toBeCloseTo(0.02, 9);
    expect(c.beat).toBeCloseTo(0.04, 9);
  });

  it("reports every crossed tick exactly once across frames, in order", () => {
    const c = new Conductor({ bpm: 133 });
    const seen: number[] = [];
    const frames = [0.016, 0.017, 0.033, 0.001, 0.05, 0.1, 0.016];
    for (const dt of frames) for (const t of c.advance(dt).ticks) seen.push(t.tick);
    seen.forEach((t, i) => expect(t).toBe(i));
    expect(seen.length).toBe(Math.floor(c.tickPosition) + 1);
  });

  it("computes lateBy from the fractional crossing time", () => {
    const c = new Conductor({ bpm: 60 }); // 24 ticks per real second
    c.advance(0.001); // emits tick 0
    const step = 1 / 24;
    const r = c.advance(step * 1.5); // crosses tick 1 at 2/3 of the frame
    expect(r.ticks.map((t) => t.tick)).toEqual([1]);
    expect(r.ticks[0].lateBy).toBeCloseTo(step * 1.5 - (step - 0.001), 9);
    expect(r.ticks[0].lateBy).toBeGreaterThanOrEqual(0);
  });

  it("flags steps, beats and bars correctly", () => {
    const c = new Conductor({ bpm: 120, beatsPerBar: 4 });
    const all = [];
    for (let i = 0; i < 100; i++) all.push(...c.advance(0.02).ticks);
    for (const t of all) {
      expect(t.isStep).toBe(t.tick % TICKS_PER_STEP === 0);
      expect(t.isBeat).toBe(t.tick % TICKS_PER_BEAT === 0);
      expect(t.isBar).toBe(t.tick % (TICKS_PER_BEAT * 4) === 0);
      expect(t.bar).toBe(Math.floor(t.tick / 96));
    }
  });

  it("does not advance or emit while paused or with non-positive dt", () => {
    const c = new Conductor({ bpm: 120 });
    c.advance(0.01);
    const before = c.tickPosition;
    c.pause();
    expect(c.advance(0.05)).toEqual({ realDt: 0, gameDt: 0, ticks: [] });
    c.resume();
    expect(c.advance(0).ticks).toEqual([]);
    expect(c.advance(-1).ticks).toEqual([]);
    expect(c.tickPosition).toBe(before);
  });

  it("clamps long frames", () => {
    const c = new Conductor({ bpm: 120 });
    const r = c.advance(5);
    expect(r.realDt).toBe(MAX_REAL_DT);
    expect(c.beat).toBeCloseTo(MAX_REAL_DT * 2, 9);
  });

  it("keeps position when tempo changes", () => {
    const c = new Conductor({ bpm: 120 });
    c.advance(0.05);
    const beat = c.beat;
    c.setBpm(60);
    expect(c.beat).toBe(beat);
    c.advance(0.05);
    expect(c.beat).toBeCloseTo(beat + 0.05, 9);
    expect(() => c.setBpm(0)).toThrow();
  });

  it("computes time conversions and next multiples", () => {
    const c = new Conductor({ bpm: 120, timeScale: 0.5 });
    expect(c.gameSecondsPerBeat()).toBe(0.5);
    expect(c.realSecondsPerTick()).toBeCloseTo(1 / (2 * 24 * 0.5), 12);
    expect(c.gameSecondsToBeats(1)).toBe(2);
    expect(c.beatsToGameSeconds(4)).toBe(2);
    c.advance(0.1); // 0.05 game s → 0.1 beats → 2.4 ticks
    expect(c.nextMultiple(TICKS_PER_STEP)).toBe(6);
    expect(c.nextMultiple(12)).toBe(12);
    expect(c.realSecondsUntilTick(6)).toBeCloseTo((6 - 2.4) * c.realSecondsPerTick(), 9);
  });

  it("reset() jumps to a position and re-emits from there", () => {
    const c = new Conductor({ bpm: 120 });
    for (let i = 0; i < 10; i++) c.advance(0.05);
    c.reset();
    expect(c.tickPosition).toBe(0);
    expect(c.advance(0.001).ticks[0].tick).toBe(0);
    c.reset(96);
    expect(c.bar).toBe(1);
    expect(c.advance(0.001).ticks[0]).toMatchObject({ tick: 96, isBar: true, bar: 1 });
  });

  it("reports beatInBar and beatPhase", () => {
    const c = new Conductor({ bpm: 60, beatsPerBar: 4 });
    c.advance(0.1); // 0.1 beat
    c.advance(0.1);
    expect(c.beatPhase).toBeCloseTo(0.2, 9);
    for (let i = 0; i < 50; i++) c.advance(0.1); // +5 beats → 5.2
    expect(c.beatInBar).toBeCloseTo(1.2, 6);
    expect(c.bar).toBe(1);
  });
});
