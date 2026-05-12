import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level20: LevelDef = {
  id: 20,
  name: "The Bunker",
  description: "Room by room",
  shipRx: 0.15, shipRy: 0.5,
  waves: [
    {
      enemies: Array.from({ length: 8 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.05 + Math.random() * 0.25,
        ry: 0.15 + (i / 8) * 0.7,
      })),
      walls: [
        { rx: 0.33, ry: 0, rw: 0.02, rh: 0.4, type: "glass", hp: 3 },
        { rx: 0.33, ry: 0.6, rw: 0.02, rh: 0.4, type: "glass", hp: 3 },
        { rx: 0.65, ry: 0, rw: 0.02, rh: 0.35, type: "glass", hp: 4 },
        { rx: 0.65, ry: 0.55, rw: 0.02, rh: 0.45, type: "glass", hp: 4 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.42, ry: 0.2 },
        { type: "sniper", rx: 0.42, ry: 0.5 },
        { type: "sniper", rx: 0.55, ry: 0.8 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.8, ry: 0.3 },
        { type: "tank", rx: 0.8, ry: 0.7 },
        { type: "spiral", rx: 0.85, ry: 0.5 },
      ],
    },
  ],
};
