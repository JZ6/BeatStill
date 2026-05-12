import type { LevelDef } from "../systems/Levels";

export const level15: LevelDef = {
  id: 15,
  name: "Killbox",
  description: "Caught in a narrow corridor",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.05 },
        { type: "tank", rx: 0.5, ry: 0.95 },
        { type: "sniper", rx: 0.35, ry: 0.35 },
        { type: "sniper", rx: 0.65, ry: 0.35 },
        { type: "sniper", rx: 0.35, ry: 0.65 },
        { type: "sniper", rx: 0.65, ry: 0.65 },
      ],
      walls: [
        { rx: 0.0, ry: 0.0, rw: 0.25, rh: 1.0, type: "solid" },
        { rx: 0.75, ry: 0.0, rw: 0.25, rh: 1.0, type: "solid" },
        { rx: 0.25, ry: 0.2, rw: 0.02, rh: 0.25, type: "glass", hp: 3 },
        { rx: 0.25, ry: 0.55, rw: 0.02, rh: 0.25, type: "glass", hp: 3 },
        { rx: 0.73, ry: 0.2, rw: 0.02, rh: 0.25, type: "glass", hp: 3 },
        { rx: 0.73, ry: 0.55, rw: 0.02, rh: 0.25, type: "glass", hp: 3 },
      ],
    },
  ],
};
