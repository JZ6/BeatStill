import type { LevelDef } from "../systems/Levels";

export const level35: LevelDef = {
  id: 35,
  name: "Ambush",
  description: "The walls close in",
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.2, ry: 0.2 },
        { type: "basic", rx: 0.8, ry: 0.2 },
        { type: "basic", rx: 0.2, ry: 0.8 },
        { type: "basic", rx: 0.8, ry: 0.8 },
        { type: "basic", rx: 0.5, ry: 0.3 },
        { type: "basic", rx: 0.3, ry: 0.5 },
        { type: "basic", rx: 0.7, ry: 0.5 },
        { type: "basic", rx: 0.5, ry: 0.7 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.05, ry: 0.3 },
        { type: "sniper", rx: 0.95, ry: 0.3 },
        { type: "sniper", rx: 0.05, ry: 0.7 },
        { type: "sniper", rx: 0.95, ry: 0.7 },
      ],
      walls: [
        { rx: 0.1, ry: 0, rw: 0.02, rh: 1, type: "solid" },
        { rx: 0.88, ry: 0, rw: 0.02, rh: 1, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.15 },
        { type: "tank", rx: 0.7, ry: 0.15 },
        { type: "tracker", rx: 0.5, ry: 0.85 },
        { type: "tracker", rx: 0.3, ry: 0.85 },
        { type: "tracker", rx: 0.7, ry: 0.85 },
      ],
      walls: [
        { rx: 0.2, ry: 0.25, rw: 0.6, rh: 0.02, type: "solid" },
        { rx: 0.2, ry: 0.75, rw: 0.6, rh: 0.02, type: "solid" },
      ],
    },
  ],
};
