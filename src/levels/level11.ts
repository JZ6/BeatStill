import type { LevelDef } from "../systems/Levels";

export const level11: LevelDef = {
  id: 11,
  name: "The Phantom",
  description: "Hunt the time thief",
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.2, ry: 0.15 },
        { type: "sniper", rx: 0.8, ry: 0.15 },
        { type: "basic", rx: 0.4, ry: 0.2 },
        { type: "basic", rx: 0.6, ry: 0.2 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
