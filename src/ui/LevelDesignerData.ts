import type { WallType } from "../objects/Wall";
import type { PlaceableEnemyType } from "../systems/LevelValidation";
import { ENEMY_DEFS, ENEMY_REGISTRY, type EnemyShape } from "../objects/enemies/registry";

/** Every type a level may place, in registry order (the Phantom's decoys are spawned by the boss). */
export const ENEMY_TYPES: PlaceableEnemyType[] = ENEMY_DEFS.flatMap((d) => (d.type !== "phantom_decoy" ? [d.type] : []));
export const WALL_TYPE_LIST: WallType[] = ["solid", "bounce", "glass"];
export const ASTEROID_SIZES = ["large", "medium", "small"] as const;

export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

export interface EnemyVis {
  color: number;
  shape: EnemyShape;
  /** Base pixels, as in the registry. */
  radius: number;
}

/** Editor visuals, straight from the enemy registry. */
export const ENEMY_VIS: Readonly<Record<PlaceableEnemyType, EnemyVis>> = Object.freeze(
  Object.fromEntries(
    ENEMY_TYPES.map((t) => {
      const d = ENEMY_REGISTRY[t];
      return [t, Object.freeze({ color: d.color, shape: d.shape, radius: d.radius })];
    }),
  ) as Record<PlaceableEnemyType, EnemyVis>,
);

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
