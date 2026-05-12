import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level49: LevelDef = {
  id: 49,
  name: "Tidal Wave",
  description: "Survive the flood",
  waves: [{
    enemies: Array.from({ length: 40 }, (_, i) => ({
      type: "swarm" as EnemyType,
      rx: 0.1 + (i % 8) * 0.115,
      ry: -0.04 - Math.floor(i / 8) * 0.06,
    })),
    walls: [
      { rx: 0.2, ry: 0.3, rw: 0.02, rh: 0.4, type: "solid" },
      { rx: 0.4, ry: 0.2, rw: 0.02, rh: 0.4, type: "solid" },
      { rx: 0.6, ry: 0.3, rw: 0.02, rh: 0.4, type: "solid" },
      { rx: 0.8, ry: 0.2, rw: 0.02, rh: 0.4, type: "solid" },
      { rx: 0.3, ry: 0.6, rw: 0.15, rh: 0.02, type: "solid" },
      { rx: 0.55, ry: 0.5, rw: 0.15, rh: 0.02, type: "solid" },
    ],
  }],
};
