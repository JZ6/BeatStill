import type { LevelDef } from "../systems/Levels";

export const level45: LevelDef = {
  id: 45,
  name: "The Phantom's Domain",
  description: "Its territory, its rules",
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.2 },
        { type: "sniper", rx: 0.85, ry: 0.2 },
        { type: "sniper", rx: 0.15, ry: 0.6 },
        { type: "sniper", rx: 0.85, ry: 0.6 },
        { type: "tracker", rx: 0.4, ry: 0.4 },
        { type: "tracker", rx: 0.6, ry: 0.4 },
        { type: "tracker", rx: 0.5, ry: 0.7 },
      ],
      walls: [
        { rx: 0.25, ry: 0.15, rw: 0.02, rh: 0.35, type: "bounce" },
        { rx: 0.73, ry: 0.15, rw: 0.02, rh: 0.35, type: "bounce" },
        { rx: 0.25, ry: 0.55, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.73, ry: 0.55, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.4, ry: 0.3, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.35, ry: 0.55, rw: 0.3, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
