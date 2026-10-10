import { describe, expect, it } from "vitest";
import { howToSections } from "./HowToOverlay";

const text = (mobile: boolean) =>
  howToSections(mobile)
    .flatMap((s) => [s.heading, ...s.lines])
    .join("\n");

describe("howToSections", () => {
  it("lists the controls for each input, including pause", () => {
    const desktop = text(false);
    expect(desktop).toMatch(/WASD/);
    expect(desktop).toMatch(/Mouse — aim/);
    expect(desktop).toMatch(/ESC — pause/);
    const mobile = text(true);
    expect(mobile).toMatch(/Left stick — move/);
    expect(mobile).toMatch(/Right stick — aim and fire/);
    expect(mobile).toMatch(/pause/);
    expect(mobile).not.toMatch(/WASD|ESC/);
  });

  it("explains the musical mechanics on both", () => {
    for (const mobile of [false, true]) {
      const t = text(mobile);
      expect(t).toMatch(/Time moves only when you act/);
      expect(t).toMatch(/tempo follows/);
      expect(t).toMatch(/enemy is an instrument and fires on the beat/);
      expect(t).toMatch(/note value/);
      expect(t).toMatch(/chain.*harmony/);
      expect(t).toMatch(/slow motion a drone/);
    }
  });
});
