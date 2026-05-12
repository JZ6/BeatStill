import type { LevelDef } from "../systems/Levels";

export const level11: LevelDef = {
  id: 11,
  name: "Glass House",
  description: "Break free or die trying",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.1, ry: 0.15 },
        { type: "sniper", rx: 0.9, ry: 0.15 },
        { type: "sniper", rx: 0.1, ry: 0.85 },
        { type: "sniper", rx: 0.9, ry: 0.85 },
        { type: "tank", rx: 0.5, ry: 0.05 },
        { type: "tank", rx: 0.5, ry: 0.95 },
      ],
      walls: [
        { rx: 0.35, ry: 0.35, rw: 0.3, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.35, ry: 0.63, rw: 0.3, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.35, ry: 0.35, rw: 0.02, rh: 0.3, type: "glass", hp: 3 },
        { rx: 0.63, ry: 0.35, rw: 0.02, rh: 0.3, type: "glass", hp: 3 },
      ],
    },
  ],
};
