import { describe, expect, it } from "vitest";
import { ALL_RELICS } from "./Relics";
import { ALL_SHOP_ITEMS } from "./Shop";
import { ALL_UNLOCKS } from "./Unlocks";
import { ALL_UPGRADES } from "./Upgrades";
import { ALL_WEAPONS } from "./Weapons";

/** Every player-facing name/description of weapons, upgrades, shop items, relics and unlocks. */
const TEXTS: [string, string][] = [
  ...ALL_WEAPONS.map((w): [string, string] => [`weapon ${w.id}`, `${w.name} ${w.description}`]),
  ...ALL_UPGRADES.map((u): [string, string] => [`upgrade ${u.id}`, `${u.name} ${u.description}`]),
  ...ALL_SHOP_ITEMS.map((i): [string, string] => [`shop ${i.id}`, `${i.name} ${i.description}`]),
  ...ALL_RELICS.map((r): [string, string] => [`relic ${r.id}`, `${r.name} ${r.description}`]),
  ...ALL_UNLOCKS.map((u): [string, string] => [`unlock ${u.id}`, `${u.name} ${u.description}`]),
];

describe("player-facing text", () => {
  it("has no stale cooldown or millisecond wording", () => {
    for (const [where, text] of TEXTS) {
      expect(text, where).not.toMatch(/cooldown/i);
      // The only real-time window left is Quick Draw's first-shot timing window.
      if (where !== "shop quick_draw") expect(text, where).not.toMatch(/\d\s*ms\b/);
    }
  });

  it("describes the musical semantics", () => {
    const text = (where: string) => TEXTS.find(([w]) => w === where)?.[1] ?? "";
    expect(text("shop quick_draw")).toContain("+40 ms first-shot timing window");
    expect(text("shop chain_link")).toContain("+0.25 beat chain window");
    expect(text("upgrade chainWindow")).toContain("beat");
    expect(text("upgrade fireCooldown")).toContain("note value");
    expect(text("relic overclock")).toContain("note value");
    expect(text("relic metronome")).toMatch(/on the beat/i);
  });
});
