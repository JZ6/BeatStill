import type { LevelDef } from "../systems/Levels";

export const level13: LevelDef = {
  id: 13,
  name: "The Fortress",
  description: "Break into the glass compound",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "tank", rx: 0.4, ry: 0.35 },
        { type: "tank", rx: 0.6, ry: 0.35 },
        { type: "spiral", rx: 0.5, ry: 0.45 },
        { type: "sniper", rx: 0.35, ry: 0.5 },
        { type: "sniper", rx: 0.65, ry: 0.5 },
      ],
      walls: [
        { rx: 0.3, ry: 0.2, rw: 0.4, rh: 0.02, type: "glass", hp: 4 },
        { rx: 0.3, ry: 0.58, rw: 0.4, rh: 0.02, type: "glass", hp: 4 },
        { rx: 0.3, ry: 0.2, rw: 0.02, rh: 0.4, type: "glass", hp: 4 },
        { rx: 0.68, ry: 0.2, rw: 0.02, rh: 0.4, type: "glass", hp: 4 },
      ],
    },
  ],
};
