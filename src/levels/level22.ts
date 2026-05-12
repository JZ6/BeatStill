import type { LevelDef } from "../systems/Levels";

export const level22: LevelDef = {
  id: 22,
  name: "Claustrophobia",
  description: "Nowhere to run",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "tracker", rx: 0.35, ry: 0.35 },
      { type: "tracker", rx: 0.65, ry: 0.35 },
      { type: "tracker", rx: 0.35, ry: 0.65 },
      { type: "tracker", rx: 0.65, ry: 0.65 },
      { type: "basic", rx: 0.5, ry: 0.33 },
      { type: "basic", rx: 0.5, ry: 0.67 },
      { type: "spiral", rx: 0.4, ry: 0.5 },
      { type: "spiral", rx: 0.6, ry: 0.5 },
      { type: "sniper", rx: 0.5, ry: 0.35 },
      { type: "sniper", rx: 0.5, ry: 0.65 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.28, rh: 1, type: "solid" },
      { rx: 0.72, ry: 0, rw: 0.28, rh: 1, type: "solid" },
      { rx: 0.28, ry: 0, rw: 0.44, rh: 0.25, type: "solid" },
      { rx: 0.28, ry: 0.75, rw: 0.44, rh: 0.25, type: "solid" },
    ],
  }],
};
