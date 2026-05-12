import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level32: LevelDef = {
  id: 32,
  name: "Siege",
  description: "Hold the line",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 8 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.15 + (i % 4) * 0.23,
        ry: -0.04,
      })),
      walls: [
        { rx: 0.15, ry: 0.7, rw: 0.7, rh: 0.03, type: "glass", hp: 4 },
        { rx: 0.15, ry: 0.7, rw: 0.03, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.82, ry: 0.7, rw: 0.03, rh: 0.15, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.3, ry: -0.04 },
        { type: "tracker", rx: 0.5, ry: -0.04 },
        { type: "tracker", rx: 0.7, ry: -0.04 },
        { type: "basic", rx: 0.2, ry: 0.1 },
        { type: "basic", rx: 0.8, ry: 0.1 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.2, ry: 0.1 },
        { type: "sniper", rx: 0.8, ry: 0.1 },
        { type: "tank", rx: 0.5, ry: 0.05 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.05 },
        { type: "tank", rx: 0.7, ry: 0.05 },
        { type: "spiral", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
