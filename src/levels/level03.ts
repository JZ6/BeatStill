import type { LevelDef } from "../systems/Levels";

export const level03: LevelDef = {
  id: 3,
  name: "Crossfire",
  description: "Snipers on all sides, glass cover in the center",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.5, ry: 0.08 },
        { type: "sniper", rx: 0.92, ry: 0.5 },
        { type: "sniper", rx: 0.5, ry: 0.92 },
        { type: "sniper", rx: 0.08, ry: 0.5 },
      ],
      walls: [
        { rx: 0.42, ry: 0.44, rw: 0.16, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.42, ry: 0.54, rw: 0.16, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.44, ry: 0.41, rw: 0.02, rh: 0.18, type: "glass", hp: 3 },
        { rx: 0.54, ry: 0.41, rw: 0.02, rh: 0.18, type: "glass", hp: 3 },
      ],
    },
  ],
};
