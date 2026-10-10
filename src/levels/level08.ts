import type { LevelDef } from "../systems/Levels";

export const level08: LevelDef = {
  id: 8,
  name: "Sniper Alley",
  description: "Snipers line the walls, bullets ricochet",
  music: { bpm: 101, key: "G" },
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
        // Windows at y 0.30-0.38 and 0.60-0.68 (behind the glass panes) keep the snipers reachable.
        { rx: 0.3, ry: 0.0, rw: 0.02, rh: 0.3, type: "bounce" },
        { rx: 0.3, ry: 0.38, rw: 0.02, rh: 0.22, type: "bounce" },
        { rx: 0.3, ry: 0.68, rw: 0.02, rh: 0.32, type: "bounce" },
        { rx: 0.68, ry: 0.0, rw: 0.02, rh: 0.3, type: "bounce" },
        { rx: 0.68, ry: 0.38, rw: 0.02, rh: 0.22, type: "bounce" },
        { rx: 0.68, ry: 0.68, rw: 0.02, rh: 0.32, type: "bounce" },
        { rx: 0.44, ry: 0.3, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
        { rx: 0.44, ry: 0.6, rw: 0.12, rh: 0.08, type: "glass", hp: 3 },
      ],
    },
  ],
};
