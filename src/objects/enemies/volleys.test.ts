import { describe, expect, it } from "vitest";
import { basicVolley, phantomTeleportVolley, phantomVolley, sentinelVolley, spiralVolley, trackerVolley, volleyFor } from "./volleys";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("enemy volleys", () => {
  it("centres aimed volleys on the aim and keeps the old speeds", () => {
    const v = trackerVolley(1.2);
    expect(v).toHaveLength(3);
    expect(mean(v.map((b) => b.angle))).toBeCloseTo(1.2);
    expect(v.every((b) => b.speed === 220)).toBe(true);
  });

  it("turns spiral arms by the given angle", () => {
    expect(spiralVolley(0.5).map((b) => b.angle)).toEqual(spiralVolley(0).map((b) => b.angle + 0.5));
    expect(sentinelVolley(3, 0, 0.7)[0].angle).toBeCloseTo(0.7);
  });

  it("grows the Pulse ring 4 → 10 with the wave", () => {
    expect([0, 1, 2, 6, 12, 40].map((w) => basicVolley(w).length)).toEqual([4, 4, 5, 7, 10, 10]);
    expect(basicVolley(Number.NaN)).toHaveLength(4);
  });

  it("sizes boss volleys by phase and charge", () => {
    expect([1, 2, 3].map((p) => sentinelVolley(p, 0, 0).length)).toEqual([8, 15, 7]);
    expect([1, 2, 3].map((p) => phantomVolley(p, 0, 0, 0).length)).toEqual([3, 9, 12]);
    expect(phantomVolley(1, 0, 6, 0)).toHaveLength(9);
    expect(phantomTeleportVolley()).toHaveLength(8);
  });

  it("dispatches by type; the decoy never fires", () => {
    expect(volleyFor("tank")).toHaveLength(12);
    expect(volleyFor("circler")).toHaveLength(16);
    expect(volleyFor("sentinel", { phase: 2 })).toHaveLength(15);
    expect(volleyFor("phantom_decoy")).toEqual([]);
  });
});
