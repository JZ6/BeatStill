import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level28: LevelDef = {
  id: 28,
  name: "Endgame",
  description: "Four waves in an evolving maze",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: "swarm" as EnemyType,
          rx: 0.15 + (i % 4) * 0.22,
          ry: -0.04,
        })),
        { type: "tracker" as EnemyType, rx: 0.3, ry: 0.15 },
        { type: "tracker" as EnemyType, rx: 0.7, ry: 0.15 },
      ],
      walls: [
        { rx: 0.25, ry: 0.25, rw: 0.02, rh: 0.25, type: "solid" },
        { rx: 0.5, ry: 0.15, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.73, ry: 0.25, rw: 0.02, rh: 0.25, type: "solid" },
        { rx: 0.2, ry: 0.55, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.5, rw: 0.25, rh: 0.02, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.1 },
        { type: "sniper", rx: 0.85, ry: 0.1 },
        { type: "sniper", rx: 0.5, ry: 0.3 },
        { type: "sniper", rx: 0.3, ry: 0.45 },
      ],
      walls: [
        { rx: 0.15, ry: 0.35, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.8, ry: 0.35, rw: 0.06, rh: 0.06, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.35, ry: 0.1 },
        { type: "tank", rx: 0.65, ry: 0.1 },
        { type: "spiral", rx: 0.3, ry: 0.35 },
        { type: "spiral", rx: 0.7, ry: 0.35 },
        { type: "circler", rx: 0.5, ry: 0.25 },
      ],
      walls: [
        { rx: 0.4, ry: 0.6, rw: 0.08, rh: 0.06, type: "glass", hp: 3 },
        { rx: 0.55, ry: 0.6, rw: 0.08, rh: 0.06, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "basic", rx: 0.5, ry: 0.1 },
        { type: "tracker", rx: 0.2, ry: 0.2 },
        { type: "tracker", rx: 0.8, ry: 0.2 },
        { type: "sniper", rx: 0.15, ry: 0.4 },
        { type: "sniper", rx: 0.85, ry: 0.4 },
        { type: "spiral", rx: 0.5, ry: 0.3 },
        { type: "tank", rx: 0.4, ry: 0.15 },
        { type: "snake", rx: 0.3, ry: 0.5 },
        { type: "snake", rx: 0.7, ry: 0.5 },
      ],
    },
  ],
};
