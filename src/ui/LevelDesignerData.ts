import type { WallType } from "../objects/Wall";
import type { PlaceableEnemyType } from "../systems/LevelValidation";

export const ENEMY_TYPES: PlaceableEnemyType[] = ["basic", "tracker", "sniper", "spiral", "tank", "swarm", "snake", "circler", "sentinel", "phantom"];
export const WALL_TYPE_LIST: WallType[] = ["solid", "bounce", "glass"];
export const ASTEROID_SIZES = ["large", "medium", "small"] as const;

export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

export interface EnemyVis {
  color: number;
  sides: number;
  radius: number;
}

export const ENEMY_VIS: Record<PlaceableEnemyType, EnemyVis> = {
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

/** Visuals for an enemy type, or undefined for types the editor can't place. */
export function getEnemyVis(type: string): EnemyVis | undefined {
  return Object.prototype.hasOwnProperty.call(ENEMY_VIS, type) ? ENEMY_VIS[type as PlaceableEnemyType] : undefined;
}

export const WALL_COLORS: Record<WallType, number> = { solid: 0x887766, bounce: 0x4488ff, glass: 0xff6644 };
export const DEFAULT_WALL_COLOR = WALL_COLORS.solid;
export const ASTEROID_RADII: Record<AsteroidSize, number> = { large: 40, medium: 24, small: 12 };

export type Tool = "select" | "enemy" | "wall" | "asteroid" | "erase";

export interface Selection {
  kind: "enemy" | "wall" | "asteroid" | "ship";
  index: number;
}
