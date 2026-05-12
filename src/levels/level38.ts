import type { LevelDef } from "../systems/Levels";

export const level38: LevelDef = {
  id: 38,
  name: "Breakout",
  description: "Shatter the cage",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.1, ry: 0.1 },
        { type: "sniper", rx: 0.9, ry: 0.1 },
        { type: "sniper", rx: 0.1, ry: 0.9 },
        { type: "sniper", rx: 0.9, ry: 0.9 },
      ],
      walls: [
        { rx: 0.3, ry: 0.3, rw: 0.4, rh: 0.02, type: "glass", hp: 2 },
        { rx: 0.3, ry: 0.68, rw: 0.4, rh: 0.02, type: "glass", hp: 2 },
        { rx: 0.3, ry: 0.3, rw: 0.02, rh: 0.4, type: "glass", hp: 2 },
        { rx: 0.68, ry: 0.3, rw: 0.02, rh: 0.4, type: "glass", hp: 2 },
        { rx: 0.35, ry: 0.35, rw: 0.3, rh: 0.02, type: "glass", hp: 2 },
        { rx: 0.35, ry: 0.63, rw: 0.3, rh: 0.02, type: "glass", hp: 2 },
        { rx: 0.35, ry: 0.35, rw: 0.02, rh: 0.3, type: "glass", hp: 2 },
        { rx: 0.63, ry: 0.35, rw: 0.02, rh: 0.3, type: "glass", hp: 2 },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.2, ry: 0.3 },
        { type: "tracker", rx: 0.8, ry: 0.3 },
        { type: "tracker", rx: 0.2, ry: 0.7 },
        { type: "tracker", rx: 0.8, ry: 0.7 },
        { type: "spiral", rx: 0.5, ry: 0.1 },
        { type: "spiral", rx: 0.5, ry: 0.9 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.2 },
        { type: "tank", rx: 0.7, ry: 0.2 },
        { type: "tank", rx: 0.3, ry: 0.8 },
        { type: "tank", rx: 0.7, ry: 0.8 },
      ],
    },
  ],
};
