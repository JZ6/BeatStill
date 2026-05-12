import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level25: LevelDef = {
  id: 25,
  name: "Gauntlet",
  description: "Five waves, one shot",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 12 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.15 + (i % 4) * 0.22,
        ry: -0.04,
      })),
      walls: [
        { rx: 0.0, ry: 0.0, rw: 0.25, rh: 1.0, type: "solid" },
        { rx: 0.75, ry: 0.0, rw: 0.25, rh: 1.0, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "spiral", rx: 0.35, ry: 0.2 },
        { type: "spiral", rx: 0.65, ry: 0.2 },
        { type: "circler", rx: 0.5, ry: 0.4 },
        { type: "circler", rx: 0.4, ry: 0.6 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.3, ry: 0.15 },
        { type: "sniper", rx: 0.7, ry: 0.15 },
        { type: "sniper", rx: 0.5, ry: 0.3 },
        { type: "tracker", rx: 0.35, ry: 0.45 },
        { type: "tracker", rx: 0.65, ry: 0.45 },
        { type: "tracker", rx: 0.5, ry: 0.55 },
      ],
      walls: [
        { rx: 0.25, ry: 0.1, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.6, ry: 0.1, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.25, ry: 0.85, rw: 0.15, rh: 0.02, type: "bounce" },
        { rx: 0.6, ry: 0.85, rw: 0.15, rh: 0.02, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.35, ry: 0.15 },
        { type: "tank", rx: 0.65, ry: 0.15 },
        { type: "snake", rx: 0.3, ry: 0.4 },
        { type: "snake", rx: 0.5, ry: 0.35 },
        { type: "snake", rx: 0.7, ry: 0.4 },
      ],
      walls: [
        { rx: 0.3, ry: 0.25, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.5, ry: 0.2, rw: 0.02, rh: 0.25, type: "solid" },
        { rx: 0.68, ry: 0.25, rw: 0.02, rh: 0.3, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
