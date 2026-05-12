import type { LevelDef } from "../systems/Levels";

export const level17: LevelDef = {
  id: 17,
  name: "Sentinel",
  description: "Your first boss fight",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "tracker", rx: 0.2, ry: 0.2 },
        { type: "tracker", rx: 0.8, ry: 0.2 },
        { type: "tracker", rx: 0.3, ry: 0.5 },
        { type: "tracker", rx: 0.7, ry: 0.5 },
        { type: "sniper", rx: 0.15, ry: 0.35 },
        { type: "sniper", rx: 0.85, ry: 0.35 },
      ],
      walls: [
        { rx: 0.1, ry: 0.08, rw: 0.3, rh: 0.02, type: "bounce" },
        { rx: 0.6, ry: 0.08, rw: 0.3, rh: 0.02, type: "bounce" },
        { rx: 0.08, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
        { rx: 0.9, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
