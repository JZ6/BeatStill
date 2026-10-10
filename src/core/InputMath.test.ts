import { describe, expect, it } from "vitest";
import { analogStick, keyboardVector, stickAngle } from "./InputMath";

describe("analogStick", () => {
  const R = 60;
  const DZ = 0.12;

  it("reads 0 inside the dead zone", () => {
    expect(analogStick(0, 0, R, DZ).magnitude).toBe(0);
    expect(analogStick(R * DZ * 0.99, 0, R, DZ)).toEqual({ x: 0, y: 0, magnitude: 0 });
    expect(analogStick(0, -R * DZ, R, DZ).magnitude).toBe(0);
  });

  it("rescales past the dead zone so full deflection still reaches 1", () => {
    expect(analogStick(R, 0, R, DZ).magnitude).toBeCloseTo(1, 12);
    expect(analogStick(R * 3, 0, R, DZ).magnitude).toBe(1);
    const mid = R * DZ + (R - R * DZ) / 2;
    expect(analogStick(0, mid, R, DZ).magnitude).toBeCloseTo(0.5, 12);
    expect(analogStick(R * DZ * 1.01, 0, R, DZ).magnitude).toBeGreaterThan(0);
  });

  it("keeps the deflection direction", () => {
    const v = analogStick(-R, R, R, DZ);
    expect(v.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(v.y).toBeCloseTo(Math.SQRT1_2, 12);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(v.magnitude, 12);
  });

  it("is safe with a zero radius or NaN input", () => {
    expect(analogStick(10, 10, 0, DZ).magnitude).toBe(0);
    expect(analogStick(Number.NaN, 0, R, DZ).magnitude).toBe(0);
  });
});

describe("stickAngle", () => {
  it("returns null within the dead zone (stale direction)", () => {
    expect(stickAngle(0, 0, 6)).toBeNull();
    expect(stickAngle(3, 4, 5)).toBeNull();
  });

  it("returns the atan2 angle past the dead zone", () => {
    expect(stickAngle(10, 0, 6)).toBe(0);
    expect(stickAngle(0, 10, 6)).toBeCloseTo(Math.PI / 2, 12);
    expect(stickAngle(-10, 0, 6)).toBeCloseTo(Math.PI, 12);
  });
});

describe("keyboardVector", () => {
  it("is zero with no keys or opposing keys", () => {
    expect(keyboardVector(false, false, false, false)).toEqual({ x: 0, y: 0, magnitude: 0 });
    expect(keyboardVector(true, true, true, true)).toEqual({ x: 0, y: 0, magnitude: 0 });
  });

  it("moves along one axis at unit speed", () => {
    expect(keyboardVector(false, true, false, false)).toEqual({ x: 1, y: 0, magnitude: 1 });
    expect(keyboardVector(false, false, true, false)).toEqual({ x: 0, y: -1, magnitude: 1 });
  });

  it("normalizes diagonals so they aren't faster", () => {
    const v = keyboardVector(true, false, false, true);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 12);
    expect(v.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(v.y).toBeCloseTo(Math.SQRT1_2, 12);
    expect(v.magnitude).toBe(1);
  });
});
