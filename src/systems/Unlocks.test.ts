import { describe, expect, it } from "vitest";
import { ALL_PALETTES, DEFAULT_PALETTE_ID } from "../music/palettes";
import { ALL_UNLOCKS, requirementText } from "./Unlocks";

describe("theme unlocks", () => {
  it("every palette but the default has a theme_<id> unlock, so all themes (Virtuoso) are reachable", () => {
    for (const palette of ALL_PALETTES) {
      if (palette.id === DEFAULT_PALETTE_ID) continue;
      const unlock = ALL_UNLOCKS.find((u) => u.id === `theme_${palette.id}`);
      expect(unlock, palette.id).toBeDefined();
      expect(unlock?.category).toBe("theme");
      expect(unlock?.name).toBe(palette.name);
    }
  });

  it("every theme unlock names an existing palette, has unique ids and costs shards", () => {
    const themes = ALL_UNLOCKS.filter((u) => u.category === "theme");
    for (const u of themes) {
      expect(ALL_PALETTES.some((p) => `theme_${p.id}` === u.id), u.id).toBe(true);
      expect(u.requirement.shards, u.id).toBeGreaterThan(0);
    }
    expect(new Set(ALL_UNLOCKS.map((u) => u.id)).size).toBe(ALL_UNLOCKS.length);
  });

  it("piano follows the theme ladder: shards plus a run goal", () => {
    const piano = ALL_UNLOCKS.find((u) => u.id === "theme_piano");
    expect(piano?.requirement).toEqual({ shards: 75, highScore: 40000 });
    expect(requirementText(piano!.requirement)).toBe("75 ◆ + 40k score");
  });
});
