import { describe, expect, it } from "vitest";
import {
  CHAIN_GRACE_BEATS,
  CHAIN_LINK_BEATS,
  CHAIN_SUSTAIN_BEATS,
  CHAIN_WINDOW_BEATS,
  METRONOME_TOLERANCE_BEATS,
  beatDistance,
  chainWindowBeats,
  isOnBeat,
} from "./chainRules";

describe("on-beat kills (Metronome)", () => {
  it("measures the distance to the nearest beat", () => {
    expect(beatDistance(4)).toBe(0);
    expect(beatDistance(4.1)).toBeCloseTo(0.1);
    expect(beatDistance(3.9)).toBeCloseTo(0.1);
    expect(beatDistance(2.5)).toBe(0.5);
    expect(beatDistance(Number.NaN)).toBe(0.5);
  });

  it("accepts kills within ±1/8 beat of a beat", () => {
    expect(METRONOME_TOLERANCE_BEATS).toBe(0.125);
    expect(isOnBeat(8)).toBe(true);
    expect(isOnBeat(8.125)).toBe(true);
    expect(isOnBeat(7.875)).toBe(true);
    expect(isOnBeat(8.13)).toBe(false);
    expect(isOnBeat(8.5)).toBe(false);
    expect(isOnBeat(0.05)).toBe(true);
    expect(isOnBeat(8.3, 0.3)).toBe(true);
  });
});

describe("chain window", () => {
  it("is 1.5 beats (≈ the old 800 ms at 100–120 bpm) plus bonuses", () => {
    expect(CHAIN_WINDOW_BEATS).toBe(1.5);
    expect((CHAIN_WINDOW_BEATS * 60) / 100).toBeCloseTo(0.9);
    expect((CHAIN_WINDOW_BEATS * 60) / 120).toBeCloseTo(0.75);
    expect(CHAIN_GRACE_BEATS).toBe(0.75);
    expect(CHAIN_SUSTAIN_BEATS).toBe(0.5);
    expect(CHAIN_LINK_BEATS).toBe(0.25);
    expect(chainWindowBeats(0)).toBe(1.5);
    expect(chainWindowBeats(3 * CHAIN_SUSTAIN_BEATS + 3 * CHAIN_LINK_BEATS)).toBeCloseTo(3.75);
    expect(chainWindowBeats(-1)).toBe(1.5);
    expect(chainWindowBeats(Number.NaN)).toBe(1.5);
  });
});
