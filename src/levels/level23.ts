import type { LevelDef } from "../systems/Levels";

export const level23: LevelDef = {
  id: 23,
  name: "The Squeeze",
  description: "The arena shrinks each wave",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.3, ry: 0.2 },
        { type: "basic", rx: 0.7, ry: 0.2 },
        { type: "basic", rx: 0.5, ry: 0.3 },
        { type: "basic", rx: 0.4, ry: 0.6 },
        { type: "tracker", rx: 0.6, ry: 0.15 },
        { type: "tracker", rx: 0.5, ry: 0.7 },
      ],
      walls: [
        { rx: 0.0, ry: 0.0, rw: 0.08, rh: 1.0, type: "solid" },
        { rx: 0.92, ry: 0.0, rw: 0.08, rh: 1.0, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.3, ry: 0.15 },
        { type: "sniper", rx: 0.7, ry: 0.15 },
        { type: "spiral", rx: 0.5, ry: 0.3 },
        { type: "tracker", rx: 0.4, ry: 0.5 },
        { type: "tracker", rx: 0.6, ry: 0.5 },
      ],
      walls: [
        { rx: 0.08, ry: 0.0, rw: 0.07, rh: 1.0, type: "solid" },
        { rx: 0.85, ry: 0.0, rw: 0.07, rh: 1.0, type: "solid" },
        { rx: 0.15, ry: 0.0, rw: 0.7, rh: 0.08, type: "solid" },
        { rx: 0.15, ry: 0.92, rw: 0.7, rh: 0.08, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.4, ry: 0.2 },
        { type: "tank", rx: 0.6, ry: 0.2 },
        { type: "tracker", rx: 0.5, ry: 0.4 },
        { type: "tracker", rx: 0.35, ry: 0.55 },
        { type: "sniper", rx: 0.65, ry: 0.55 },
      ],
      walls: [
        { rx: 0.15, ry: 0.08, rw: 0.1, rh: 0.84, type: "solid" },
        { rx: 0.75, ry: 0.08, rw: 0.1, rh: 0.84, type: "solid" },
        { rx: 0.25, ry: 0.08, rw: 0.5, rh: 0.1, type: "solid" },
        { rx: 0.25, ry: 0.82, rw: 0.5, rh: 0.1, type: "solid" },
      ],
    },
  ],
};
