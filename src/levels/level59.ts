import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level59: LevelDef = {
  id: 59,
  name: "Endgame",
  description: "Every mechanic, every trick",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: "swarm" as EnemyType,
          rx: 0.15 + (i % 4) * 0.23,
          ry: -0.04,
        })),
        { type: "tracker" as EnemyType, rx: 0.3, ry: 0.3 },
        { type: "tracker" as EnemyType, rx: 0.7, ry: 0.3 },
      ],
      walls: [
        { rx: 0.2, ry: 0.2, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.2, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.35, ry: 0.4, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.4, ry: 0.2, rw: 0.02, rh: 0.2, type: "solid" },
        { rx: 0.6, ry: 0.2, rw: 0.02, rh: 0.2, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.2 },
        { type: "sniper", rx: 0.85, ry: 0.2 },
        { type: "sniper", rx: 0.15, ry: 0.6 },
        { type: "sniper", rx: 0.85, ry: 0.6 },
      ],
      walls: [
        { rx: 0.25, ry: 0.15, rw: 0.02, rh: 0.3, type: "bounce" },
        { rx: 0.73, ry: 0.15, rw: 0.02, rh: 0.3, type: "bounce" },
        { rx: 0.25, ry: 0.55, rw: 0.02, rh: 0.3, type: "bounce" },
        { rx: 0.73, ry: 0.55, rw: 0.02, rh: 0.3, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.15 },
        { type: "tank", rx: 0.7, ry: 0.15 },
        { type: "spiral", rx: 0.2, ry: 0.45 },
        { type: "spiral", rx: 0.8, ry: 0.45 },
        { type: "circler", rx: 0.5, ry: 0.3 },
      ],
      walls: [
        { rx: 0.35, ry: 0.35, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
        { rx: 0.53, ry: 0.5, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.08 },
        { type: "spiral", rx: 0.3, ry: 0.3 },
        { type: "spiral", rx: 0.7, ry: 0.3 },
        { type: "snake", rx: 0.2, ry: 0.6 },
        { type: "snake", rx: 0.8, ry: 0.6 },
        { type: "sniper", rx: 0.5, ry: 0.5 },
        { type: "tracker", rx: 0.4, ry: 0.8 },
        { type: "tracker", rx: 0.6, ry: 0.8 },
      ],
    },
  ],
};
