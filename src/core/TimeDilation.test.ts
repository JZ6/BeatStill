import { describe, expect, it } from "vitest";
import {
  AngularSpeedTracker,
  DEFAULT_DILATION,
  TimeDilation,
  dilationActivity,
  dilationTarget,
  wrapAngle,
} from "./TimeDilation";

const idle = { move: 0, aimSpeed: 0, firing: false };

describe("dilationTarget", () => {
  it("is the minimum when idle", () => {
    expect(dilationTarget(idle)).toBe(DEFAULT_DILATION.min);
  });

  it("does not saturate from keyboard movement alone (old WASD bug)", () => {
    const t = dilationTarget({ move: 1, aimSpeed: 0, firing: false });
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(1);
  });

  it("reaches the maximum when moving and shooting", () => {
    expect(dilationTarget({ move: 1, aimSpeed: 0, firing: true })).toBe(DEFAULT_DILATION.max);
  });

  it("aim spinning contributes, capped at spinWeight", () => {
    const slow = dilationActivity({ move: 0, aimSpeed: DEFAULT_DILATION.spinFullSpeed / 2, firing: false });
    const fast = dilationActivity({ move: 0, aimSpeed: 1000, firing: false });
    expect(slow).toBeCloseTo(DEFAULT_DILATION.spinWeight / 2, 9);
    expect(fast).toBeCloseTo(DEFAULT_DILATION.spinWeight, 9);
  });

  it("ignores garbage inputs", () => {
    expect(dilationTarget({ move: NaN, aimSpeed: -5, firing: false })).toBe(DEFAULT_DILATION.min);
    expect(dilationActivity({ move: 7, aimSpeed: 0, firing: false })).toBeCloseTo(DEFAULT_DILATION.moveWeight, 9);
  });
});

describe("TimeDilation", () => {
  it("starts at the minimum and approaches the target exponentially", () => {
    const d = new TimeDilation();
    expect(d.scale).toBe(DEFAULT_DILATION.min);
    const active = { move: 1, aimSpeed: 0, firing: true };
    d.update(active, 1 / DEFAULT_DILATION.riseRate);
    const expected = DEFAULT_DILATION.min + (1 - DEFAULT_DILATION.min) * (1 - Math.exp(-1));
    expect(d.scale).toBeCloseTo(expected, 9);
  });

  it("is frame-rate independent", () => {
    const active = { move: 1, aimSpeed: 0, firing: false };
    const a = new TimeDilation();
    const b = new TimeDilation();
    for (let i = 0; i < 144; i++) a.update(active, 1 / 144);
    for (let i = 0; i < 30; i++) b.update(active, 1 / 30);
    expect(a.scale).toBeCloseTo(b.scale, 9);
  });

  it("uses separate rise and fall rates", () => {
    const d = new TimeDilation({ riseRate: 100, fallRate: 1 });
    d.update({ move: 1, aimSpeed: 0, firing: true }, 0.2);
    expect(d.scale).toBeGreaterThan(0.99);
    d.update(idle, 0.2);
    expect(d.scale).toBeGreaterThan(0.8);
  });

  it("stays within [min, max] and reset() clamps", () => {
    const d = new TimeDilation();
    for (let i = 0; i < 100; i++) d.update({ move: 1, aimSpeed: 99, firing: true }, 0.1);
    expect(d.scale).toBeLessThanOrEqual(DEFAULT_DILATION.max);
    d.reset(-3);
    expect(d.scale).toBe(DEFAULT_DILATION.min);
  });
});

describe("wrapAngle", () => {
  it("wraps into (-π, π]", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(2 * Math.PI + 0.5)).toBeCloseTo(0.5, 12);
    expect(wrapAngle(-2 * Math.PI - 0.5)).toBeCloseTo(-0.5, 12);
  });
});

describe("AngularSpeedTracker", () => {
  it("measures steady rotation in rad per real second", () => {
    const tr = new AngularSpeedTracker();
    let a = 0;
    for (let i = 0; i < 300; i++) {
      a += 4 / 60;
      tr.update(a, 1 / 60);
    }
    expect(tr.speed).toBeCloseTo(4, 3);
  });

  it("handles wrap-around across ±π without a spike", () => {
    const tr = new AngularSpeedTracker();
    tr.update(Math.PI - 0.01, 1 / 60);
    tr.update(-Math.PI + 0.01, 1 / 60); // 0.02 rad step
    expect(tr.speed).toBeLessThan(1.5);
  });

  it("first sample and non-positive dt produce no speed", () => {
    const tr = new AngularSpeedTracker();
    expect(tr.update(1, 1 / 60)).toBe(0);
    expect(tr.update(2, 0)).toBe(0);
  });
});
