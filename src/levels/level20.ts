import type { LevelDef } from "../systems/Levels";

export const level20: LevelDef = {
  id: 20,
  name: "Shield Wall",
  description: "One-way walls close in",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.3, ry: 0.1 },
        { type: "sniper", rx: 0.7, ry: 0.1 },
        { type: "tank", rx: 0.5, ry: 0.05 },
      ],
      walls: [
        { rx: 0.1, ry: 0.3, rw: 0.8, rh: 0.02, type: "solid", oneWay: "down" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.1, ry: 0.4 },
        { type: "tracker", rx: 0.9, ry: 0.4 },
        { type: "sniper", rx: 0.5, ry: 0.15 },
      ],
      walls: [
        { rx: 0.15, ry: 0.35, rw: 0.02, rh: 0.5, type: "solid", oneWay: "right" },
        { rx: 0.83, ry: 0.35, rw: 0.02, rh: 0.5, type: "solid", oneWay: "left" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.2 },
        { type: "tank", rx: 0.7, ry: 0.2 },
        { type: "spiral", rx: 0.5, ry: 0.35 },
        { type: "tracker", rx: 0.4, ry: 0.5 },
        { type: "tracker", rx: 0.6, ry: 0.5 },
      ],
    },
  ],
};
