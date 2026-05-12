import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level25: LevelDef = {
  id: 25,
  name: "Gauntlet II",
  description: "Five waves. No mercy.",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 15 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.1 + (i % 5) * 0.2,
        ry: -0.04,
      })),
      walls: [
        { rx: 0, ry: 0, rw: 0.25, rh: 1, type: "solid" },
        { rx: 0.75, ry: 0, rw: 0.25, rh: 1, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "spiral", rx: 0.2, ry: 0.3 },
        { type: "spiral", rx: 0.8, ry: 0.3 },
        { type: "circler", rx: 0.5, ry: 0.2 },
        { type: "circler", rx: 0.5, ry: 0.6 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.1, ry: 0.2 },
        { type: "sniper", rx: 0.9, ry: 0.2 },
        { type: "sniper", rx: 0.1, ry: 0.8 },
        { type: "sniper", rx: 0.9, ry: 0.8 },
        { type: "tracker", rx: 0.3, ry: 0.5 },
        { type: "tracker", rx: 0.7, ry: 0.5 },
      ],
      walls: [
        { rx: 0.2, ry: 0.4, rw: 0.25, rh: 0.02, type: "bounce" },
        { rx: 0.55, ry: 0.6, rw: 0.25, rh: 0.02, type: "bounce" },
        { rx: 0.4, ry: 0.2, rw: 0.02, rh: 0.2, type: "bounce" },
        { rx: 0.6, ry: 0.6, rw: 0.02, rh: 0.2, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.1 },
        { type: "tank", rx: 0.7, ry: 0.1 },
        { type: "snake", rx: 0.2, ry: 0.5 },
        { type: "snake", rx: 0.8, ry: 0.5 },
        { type: "snake", rx: 0.5, ry: 0.3 },
      ],
      walls: [
        { rx: 0.15, ry: 0.3, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.3, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.3, ry: 0.6, rw: 0.4, rh: 0.02, type: "solid" },
        { rx: 0.4, ry: 0.3, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.6, ry: 0.3, rw: 0.02, rh: 0.3, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
