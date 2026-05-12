import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level29: LevelDef = {
  id: 29,
  name: "Sniper Nest",
  description: "Break the floor to reach them",
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.1, ry: 0.1 },
      { type: "sniper", rx: 0.9, ry: 0.1 },
      { type: "sniper", rx: 0.1, ry: 0.9 },
      { type: "sniper", rx: 0.9, ry: 0.9 },
      ...Array.from({ length: 6 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.3 + (i % 3) * 0.2,
        ry: 0.4 + Math.floor(i / 3) * 0.2,
      })),
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.2, rh: 0.02, type: "solid" },
      { rx: 0, ry: 0, rw: 0.02, rh: 0.2, type: "solid" },
      { rx: 0, ry: 0.18, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.18, ry: 0, rw: 0.02, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0.8, ry: 0, rw: 0.2, rh: 0.02, type: "solid" },
      { rx: 0.98, ry: 0, rw: 0.02, rh: 0.2, type: "solid" },
      { rx: 0.8, ry: 0.18, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.8, ry: 0, rw: 0.02, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0, ry: 0.8, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0, ry: 0.98, rw: 0.2, rh: 0.02, type: "solid" },
      { rx: 0, ry: 0.8, rw: 0.02, rh: 0.2, type: "solid" },
      { rx: 0.18, ry: 0.8, rw: 0.02, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0.8, ry: 0.8, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.8, ry: 0.98, rw: 0.2, rh: 0.02, type: "solid" },
      { rx: 0.98, ry: 0.8, rw: 0.02, rh: 0.2, type: "solid" },
      { rx: 0.8, ry: 0.8, rw: 0.02, rh: 0.2, type: "glass", hp: 3 },
    ],
  }],
};
