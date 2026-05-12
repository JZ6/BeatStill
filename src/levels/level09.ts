import type { LevelDef } from "../systems/Levels";

export const level09: LevelDef = {
  id: 9,
  name: "One Way In",
  description: "Bullets rain in, find the exit",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.15 },
        { type: "sniper", rx: 0.85, ry: 0.15 },
        { type: "sniper", rx: 0.15, ry: 0.85 },
        { type: "tank", rx: 0.5, ry: 0.08 },
      ],
      walls: [
        { rx: 0.3, ry: 0.3, rw: 0.4, rh: 0.02, type: "solid", oneWay: "down" },
        { rx: 0.3, ry: 0.68, rw: 0.4, rh: 0.02, type: "solid", oneWay: "up" },
        { rx: 0.3, ry: 0.3, rw: 0.02, rh: 0.4, type: "solid", oneWay: "right" },
        { rx: 0.68, ry: 0.3, rw: 0.02, rh: 0.18, type: "solid", oneWay: "left" },
        { rx: 0.68, ry: 0.55, rw: 0.02, rh: 0.15, type: "solid", oneWay: "left" },
        { rx: 0.68, ry: 0.48, rw: 0.02, rh: 0.07, type: "glass", hp: 2 },
      ],
    },
  ],
};
