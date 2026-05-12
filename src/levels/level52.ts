import type { LevelDef } from "../systems/Levels";

export const level52: LevelDef = {
  id: 52,
  name: "Shield Wall",
  description: "Shields up, then they flank",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.05 },
        { type: "sniper", rx: 0.3, ry: 0.1 },
        { type: "sniper", rx: 0.7, ry: 0.1 },
      ],
      walls: [
        { rx: 0.25, ry: 0.35, rw: 0.5, rh: 0.02, type: "solid", oneWay: "down" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.05, ry: 0.4 },
        { type: "tracker", rx: 0.95, ry: 0.4 },
        { type: "tracker", rx: 0.05, ry: 0.7 },
        { type: "tracker", rx: 0.95, ry: 0.7 },
        { type: "sniper", rx: 0.5, ry: 0.05 },
      ],
      walls: [
        { rx: 0.25, ry: 0.35, rw: 0.02, rh: 0.3, type: "solid", oneWay: "right" },
        { rx: 0.73, ry: 0.35, rw: 0.02, rh: 0.3, type: "solid", oneWay: "left" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.95 },
        { type: "spiral", rx: 0.2, ry: 0.2 },
        { type: "spiral", rx: 0.8, ry: 0.2 },
        { type: "tracker", rx: 0.3, ry: 0.9 },
        { type: "tracker", rx: 0.7, ry: 0.9 },
      ],
    },
  ],
};
