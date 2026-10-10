import { describe, expect, it } from "vitest";
import { uiScaleFor } from "./GameConfig";

describe("uiScaleFor", () => {
  it("is 1 at the 720p base in landscape", () => {
    expect(uiScaleFor(1280, 720)).toBe(1);
  });

  it("scales by the short side in landscape", () => {
    expect(uiScaleFor(2560, 1440)).toBe(2);
    expect(uiScaleFor(853, 480)).toBeCloseTo(480 / 720, 12);
  });

  it("scales by the short side (width) in portrait, not the long side", () => {
    expect(uiScaleFor(720, 1560)).toBe(1);
    expect(uiScaleFor(1080, 2340)).toBe(1.5);
  });
});
