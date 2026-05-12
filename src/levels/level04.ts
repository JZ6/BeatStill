import type { LevelDef } from "../systems/Levels";

export const level04: LevelDef = {
  id: 4,
  name: "Bounce House",
  description: "Trackers in a ricochet arena",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "tracker", rx: 0.25, ry: 0.25 },
        { type: "tracker", rx: 0.75, ry: 0.25 },
        { type: "tracker", rx: 0.25, ry: 0.65 },
        { type: "tracker", rx: 0.75, ry: 0.65 },
      ],
      walls: [
        { rx: 0.3, ry: 0.1, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.55, ry: 0.1, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.12, ry: 0.25, rw: 0.02, rh: 0.15, type: "bounce" },
        { rx: 0.12, ry: 0.55, rw: 0.02, rh: 0.15, type: "bounce" },
        { rx: 0.86, ry: 0.25, rw: 0.02, rh: 0.15, type: "bounce" },
        { rx: 0.86, ry: 0.55, rw: 0.02, rh: 0.15, type: "bounce" },
        { rx: 0.3, ry: 0.82, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.55, ry: 0.82, rw: 0.15, rh: 0.02, type: "bounce" },
      ],
    },
  ],
};
