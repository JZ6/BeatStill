import type { LevelDef } from "../systems/Levels";

export const level57: LevelDef = {
  id: 57,
  name: "The Squeeze",
  description: "The walls are closing in",
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.3, ry: 0.3 },
        { type: "basic", rx: 0.7, ry: 0.3 },
        { type: "basic", rx: 0.3, ry: 0.7 },
        { type: "basic", rx: 0.7, ry: 0.7 },
        { type: "tracker", rx: 0.5, ry: 0.2 },
        { type: "tracker", rx: 0.5, ry: 0.8 },
      ],
      walls: [
        { rx: 0, ry: 0, rw: 0.08, rh: 1, type: "solid" },
        { rx: 0.92, ry: 0, rw: 0.08, rh: 1, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.3, ry: 0.2 },
        { type: "sniper", rx: 0.7, ry: 0.2 },
        { type: "spiral", rx: 0.5, ry: 0.5 },
        { type: "tracker", rx: 0.4, ry: 0.7 },
        { type: "tracker", rx: 0.6, ry: 0.7 },
      ],
      walls: [
        { rx: 0.15, ry: 0, rw: 0.08, rh: 1, type: "solid" },
        { rx: 0.77, ry: 0, rw: 0.08, rh: 1, type: "solid" },
        { rx: 0.23, ry: 0, rw: 0.54, rh: 0.08, type: "solid" },
        { rx: 0.23, ry: 0.92, rw: 0.54, rh: 0.08, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.4, ry: 0.35 },
        { type: "tank", rx: 0.6, ry: 0.65 },
        { type: "spiral", rx: 0.5, ry: 0.5 },
        { type: "sniper", rx: 0.35, ry: 0.5 },
        { type: "sniper", rx: 0.65, ry: 0.5 },
        { type: "tracker", rx: 0.5, ry: 0.35 },
        { type: "tracker", rx: 0.5, ry: 0.65 },
      ],
      walls: [
        { rx: 0.25, ry: 0.15, rw: 0.08, rh: 0.7, type: "solid" },
        { rx: 0.67, ry: 0.15, rw: 0.08, rh: 0.7, type: "solid" },
      ],
    },
  ],
};
