import type { LevelDef } from "../systems/Levels";

export const level26: LevelDef = {
  id: 26,
  name: "Double Trouble",
  description: "Two arenas, one fight",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "tank", rx: 0.2, ry: 0.3 },
        { type: "tank", rx: 0.2, ry: 0.7 },
        { type: "tracker", rx: 0.15, ry: 0.4 },
        { type: "tracker", rx: 0.15, ry: 0.6 },
        { type: "spiral", rx: 0.8, ry: 0.3 },
        { type: "spiral", rx: 0.8, ry: 0.7 },
        { type: "sniper", rx: 0.85, ry: 0.4 },
        { type: "sniper", rx: 0.85, ry: 0.6 },
      ],
      walls: [
        { rx: 0.48, ry: 0.05, rw: 0.04, rh: 0.38, type: "glass", hp: 4 },
        { rx: 0.48, ry: 0.57, rw: 0.04, rh: 0.38, type: "glass", hp: 4 },
      ],
    },
  ],
};
