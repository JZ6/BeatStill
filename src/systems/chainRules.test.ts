import { describe, expect, it } from "vitest";
import { CHAIN_GRACE_BEATS, CHAIN_LINK_BEATS, CHAIN_SUSTAIN_BEATS, CHAIN_WINDOW_BEATS, chainWindowBeats } from "./chainRules";

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
