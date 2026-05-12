import type { LevelDef } from "../systems/Levels";

export const level10: LevelDef = {
  id: 10,
  name: "The Sentinel",
  description: "Face the fortress",
  waves: [
    {
      enemies: [
        { type: "swarm", rx: 0.2, ry: -0.04 },
        { type: "swarm", rx: 0.5, ry: -0.04 },
        { type: "swarm", rx: 0.8, ry: -0.04 },
        { type: "tracker", rx: 0.3, ry: -0.04 },
        { type: "tracker", rx: 0.7, ry: -0.04 },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
