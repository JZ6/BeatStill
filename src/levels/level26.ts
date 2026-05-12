import type { LevelDef } from "../systems/Levels";

export const level26: LevelDef = {
  id: 26,
  name: "Funnel",
  description: "Funneled into the killzone",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.35, ry: 0.1 },
      { type: "sniper", rx: 0.5, ry: 0.08 },
      { type: "sniper", rx: 0.65, ry: 0.1 },
      { type: "sniper", rx: 0.5, ry: 0.18 },
      { type: "tracker", rx: 0.4, ry: 0.3 },
      { type: "tracker", rx: 0.6, ry: 0.3 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.2, rh: 0.5, type: "solid" },
      { rx: 0.8, ry: 0, rw: 0.2, rh: 0.5, type: "solid" },
      { rx: 0.2, ry: 0.5, rw: 0.15, rh: 0.02, type: "solid" },
      { rx: 0.65, ry: 0.5, rw: 0.15, rh: 0.02, type: "solid" },
      { rx: 0.1, ry: 0.7, rw: 0.15, rh: 0.02, type: "solid" },
      { rx: 0.75, ry: 0.7, rw: 0.15, rh: 0.02, type: "solid" },
    ],
  }],
};
