import { describe, expect, it } from "vitest";
import { MIN_START_GAP, VoiceLedger, midiToHz, monotonicStart, pickSlot } from "./voiceMath";

describe("monotonicStart", () => {
  it("keeps a start that is already later than the last one", () => {
    expect(monotonicStart(1, 1.5, 0.1)).toBe(1.5);
    expect(monotonicStart(-Infinity, 0.2, 0.1)).toBe(0.2);
  });

  it("bumps equal or earlier starts to last + gap", () => {
    expect(monotonicStart(1, 1, 0.1)).toBeCloseTo(1 + MIN_START_GAP, 9);
    expect(monotonicStart(1, 0.95, 0.1)).toBeCloseTo(1.001, 9);
    expect(monotonicStart(1, 1.0005, 0.1)).toBeCloseTo(1.001, 9);
  });

  it("returns null when the bump would exceed maxBump", () => {
    expect(monotonicStart(1, 0.5, 0.1)).toBeNull();
    expect(monotonicStart(1, Number.NaN, 0.1)).toBeNull();
  });

  it("produces strictly increasing starts for a burst of simultaneous notes", () => {
    let last = -Infinity;
    const starts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = monotonicStart(last, 2, 0.1);
      expect(s).not.toBeNull();
      starts.push(s as number);
      last = s as number;
    }
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
  });
});

describe("VoiceLedger", () => {
  it("caps new voices to the free capacity over the whole span", () => {
    const l = new VoiceLedger(3);
    expect(l.fit(0, 1, 5)).toBe(3);
    l.add(0, 1, 2);
    expect(l.fit(0.5, 1.5, 3)).toBe(1);
    expect(l.fit(1, 2, 3)).toBe(3);
  });

  it("accounts for spans that start later inside the new span", () => {
    const l = new VoiceLedger(2);
    l.add(1, 2, 2);
    // Free at 0.5, but the later span fills the instrument at 1.
    expect(l.fit(0.5, 1.5, 2)).toBe(0);
    expect(l.fit(0.5, 0.9, 2)).toBe(2);
  });

  it("prunes finished spans", () => {
    const l = new VoiceLedger(1);
    l.add(0, 1, 1);
    l.add(0.5, 3, 1);
    l.prune(1);
    expect(l.size).toBe(1);
    expect(l.busyAt(2)).toBe(1);
    l.clear();
    expect(l.size).toBe(0);
  });

  it("ignores empty or invalid requests", () => {
    const l = new VoiceLedger(0);
    expect(l.capacity).toBe(1);
    expect(l.fit(1, 1, 2)).toBe(0);
    expect(l.fit(0, 1, 0)).toBe(0);
    l.add(0, 0, 1);
    expect(l.size).toBe(0);
  });
});

describe("pickSlot", () => {
  it("prefers the slot that has been free the longest", () => {
    const slots = [
      { lastStart: 0.5, busyUntil: 0.9 },
      { lastStart: 0.1, busyUntil: 0.4 },
      { lastStart: 0.8, busyUntil: 2 },
    ];
    expect(pickSlot(slots, 1)).toBe(1);
  });

  it("steals the earliest-started slot when none is free", () => {
    const slots = [
      { lastStart: 0.5, busyUntil: 3 },
      { lastStart: 0.2, busyUntil: 3 },
    ];
    expect(pickSlot(slots, 1)).toBe(1);
  });

  it("skips excluded slots", () => {
    const slots = [
      { lastStart: 0, busyUntil: 0 },
      { lastStart: 0, busyUntil: 0 },
    ];
    expect(pickSlot(slots, 1, new Set([0]))).toBe(1);
    expect(pickSlot(slots, 1, new Set([0, 1]))).toBe(-1);
  });
});

describe("midiToHz", () => {
  it("maps A4 and octaves", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 9);
    expect(midiToHz(57)).toBeCloseTo(220, 9);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });
});
