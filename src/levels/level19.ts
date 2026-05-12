import type { LevelDef } from "../systems/Levels";

export const level19: LevelDef = {
  id: 19,
  name: "One Way Out",
  description: "Bullets come in, yours don't go back",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.1, ry: 0.2 },
      { type: "sniper", rx: 0.9, ry: 0.2 },
      { type: "sniper", rx: 0.1, ry: 0.8 },
      { type: "sniper", rx: 0.9, ry: 0.8 },
      { type: "tank", rx: 0.5, ry: 0.05 },
      { type: "spiral", rx: 0.5, ry: 0.95 },
    ],
    walls: [
      { rx: 0.2, ry: 0.15, rw: 0.6, rh: 0.02, type: "solid", oneWay: "down" },
      { rx: 0.2, ry: 0.83, rw: 0.6, rh: 0.02, type: "solid", oneWay: "up" },
      { rx: 0.2, ry: 0.15, rw: 0.02, rh: 0.68, type: "solid", oneWay: "right" },
      { rx: 0.78, ry: 0.15, rw: 0.02, rh: 0.68, type: "solid", oneWay: "left" },
      { rx: 0.78, ry: 0.45, rw: 0.02, rh: 0.12, type: "glass", hp: 2 },
    ],
  }],
};
