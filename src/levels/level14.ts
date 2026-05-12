import type { LevelDef } from "../systems/Levels";

export const level14: LevelDef = {
  id: 14,
  name: "Mirror Match",
  description: "Symmetrical arena, bounce divider",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "tracker", rx: 0.15, ry: 0.25 },
        { type: "tracker", rx: 0.2, ry: 0.6 },
        { type: "sniper", rx: 0.25, ry: 0.4 },
        { type: "tracker", rx: 0.85, ry: 0.25 },
        { type: "tracker", rx: 0.8, ry: 0.6 },
        { type: "spiral", rx: 0.75, ry: 0.4 },
      ],
      walls: [
        { rx: 0.49, ry: 0.05, rw: 0.02, rh: 0.35, type: "bounce" },
        { rx: 0.49, ry: 0.6, rw: 0.02, rh: 0.35, type: "bounce" },
        { rx: 0.49, ry: 0.4, rw: 0.02, rh: 0.2, type: "glass", hp: 2 },
      ],
    },
  ],
};
