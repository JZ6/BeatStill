import type { LevelDef } from "../systems/Levels";

export const level08: LevelDef = {
  id: 8,
  name: "Sniper Alley",
  description: "Snipers line the walls, bullets ricochet",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.1, ry: 0.2 },
        { type: "sniper", rx: 0.1, ry: 0.5 },
        { type: "sniper", rx: 0.1, ry: 0.8 },
        { type: "sniper", rx: 0.9, ry: 0.2 },
        { type: "sniper", rx: 0.9, ry: 0.5 },
        { type: "sniper", rx: 0.9, ry: 0.8 },
      ],
      walls: [
        { rx: 0.3, ry: 0.0, rw: 0.02, rh: 1.0, type: "bounce" },
        { rx: 0.7, ry: 0.0, rw: 0.02, rh: 1.0, type: "bounce" },
        { rx: 0.44, ry: 0.3, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
        { rx: 0.44, ry: 0.6, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
      ],
    },
  ],
};
