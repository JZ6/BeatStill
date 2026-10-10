import { describe, expect, it } from "vitest";
import { FpsMeter } from "./FpsMeter";

describe("FpsMeter", () => {
  it("reports nothing until more than an interval has elapsed", () => {
    const m = new FpsMeter(500);
    for (let i = 0; i < 25; i++) expect(m.sample(20)).toBeNull(); // exactly 500 ms
  });

  it("reports the average over the interval, then starts over", () => {
    const m = new FpsMeter(500);
    for (let i = 0; i < 25; i++) m.sample(20);
    expect(m.sample(20)).toBeCloseTo(50, 9); // 26 frames in 520 ms
    expect(m.sample(20)).toBeNull();
  });

  it("handles uneven and long frames", () => {
    const m = new FpsMeter(500);
    expect(m.sample(100)).toBeNull();
    expect(m.sample(300)).toBeNull();
    expect(m.sample(200)).toBeCloseTo(5, 9); // 3 frames in 600 ms
    expect(m.sample(1000)).toBeCloseTo(1, 9);
  });
});
