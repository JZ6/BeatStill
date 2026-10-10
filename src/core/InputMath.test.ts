import { describe, expect, it } from "vitest";
import { keyboardVector } from "./InputMath";

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
