import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level27: LevelDef = {
  id: 27,
  name: "The Pit",
  description: "They drop in, you can't get out",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: Array.from({ length: 10 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.1 + (i % 5) * 0.2,
        ry: i < 5 ? -0.04 : 1.04,
      })),
      walls: [
        { rx: 0.2, ry: 0.2, rw: 0.6, rh: 0.02, type: "solid", oneWay: "down" },
        { rx: 0.2, ry: 0.78, rw: 0.6, rh: 0.02, type: "solid", oneWay: "up" },
        { rx: 0.2, ry: 0.2, rw: 0.02, rh: 0.6, type: "solid", oneWay: "right" },
        { rx: 0.78, ry: 0.2, rw: 0.02, rh: 0.6, type: "solid", oneWay: "left" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.1, ry: 0.1 },
        { type: "tracker", rx: 0.9, ry: 0.1 },
        { type: "tracker", rx: 0.1, ry: 0.9 },
        { type: "tracker", rx: 0.9, ry: 0.9 },
      ],
    },
    {
      enemies: [
        { type: "spiral", rx: 0.5, ry: -0.04 },
        { type: "spiral", rx: -0.04, ry: 0.5 },
        { type: "spiral", rx: 1.04, ry: 0.5 },
      ],
    },
  ],
};
