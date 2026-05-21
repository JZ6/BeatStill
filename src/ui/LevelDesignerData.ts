import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";

export const ENEMY_TYPES: EnemyType[] = ["basic", "tracker", "sniper", "spiral", "tank", "swarm", "snake", "circler", "sentinel", "phantom"];
export const WALL_TYPE_LIST: WallType[] = ["solid", "bounce", "glass"];
export const ASTEROID_SIZES = ["large", "medium", "small"] as const;

export const ENEMY_VIS: Record<string, { color: number; sides: number; radius: number }> = {
  basic:    { color: 0x44ff44, sides: 4, radius: 16 },
  tracker:  { color: 0xff8800, sides: 3, radius: 14 },
  sniper:   { color: 0xff2266, sides: 5, radius: 12 },
  spiral:   { color: 0xaa44ff, sides: 7, radius: 18 },
  tank:     { color: 0xff4444, sides: 8, radius: 22 },
  swarm:    { color: 0xffff44, sides: 0, radius: 10 },
  snake:    { color: 0x44ddff, sides: -1, radius: 14 },
  circler:  { color: 0x44ff88, sides: 6, radius: 16 },
  sentinel: { color: 0xffaa22, sides: 12, radius: 28 },
  phantom:  { color: 0x4488ff, sides: -1, radius: 24 },
};

export const WALL_COLORS: Record<WallType, number> = { solid: 0x887766, bounce: 0x4488ff, glass: 0xff6644 };
export const ASTEROID_RADII: Record<string, number> = { large: 40, medium: 24, small: 12 };

export type Tool = "select" | "enemy" | "wall" | "asteroid" | "erase";

export interface Selection {
  kind: "enemy" | "wall" | "asteroid" | "ship";
  index: number;
}
