import type { LevelDef } from "../systems/Levels";

export const level18: LevelDef = {
  id: 18,
  name: "Claustrophobia",
  description: "Tight quarters, no room to breathe",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "tracker", rx: 0.4, ry: 0.35 },
        { type: "tracker", rx: 0.6, ry: 0.35 },
        { type: "tracker", rx: 0.5, ry: 0.6 },
        { type: "basic", rx: 0.35, ry: 0.5 },
        { type: "basic", rx: 0.65, ry: 0.5 },
        { type: "spiral", rx: 0.5, ry: 0.4 },
        { type: "sniper", rx: 0.45, ry: 0.65 },
      ],
      walls: [
        { rx: 0.0, ry: 0.0, rw: 0.3, rh: 1.0, type: "solid" },
        { rx: 0.7, ry: 0.0, rw: 0.3, rh: 1.0, type: "solid" },
        { rx: 0.3, ry: 0.0, rw: 0.4, rh: 0.25, type: "solid" },
        { rx: 0.3, ry: 0.75, rw: 0.4, rh: 0.25, type: "solid" },
      ],
    },
  ],
};
