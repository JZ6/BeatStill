import type { EnemyType } from "../objects/enemies/registry";
import { EventBus } from "./EventBus";

export type BulletOwner = "player" | "enemy";
export type AsteroidSize = "large" | "medium" | "small";

/**
 * Every gameplay occurrence that can make a sound or drive the music.
 * Gameplay code emits these; it never calls the audio layer directly.
 * Positions are in game pixels at the moment of the event.
 */
export interface GameEventMap {
  playerFired: { weaponId: string; x: number; y: number; angle: number; bulletCount: number };
  enemyFired: {
    enemyType: EnemyType;
    x: number;
    y: number;
    bulletCount: number;
    elite: boolean;
    /** Absolute conductor tick of the step the volley fired on (sent together with lateBy). */
    tick?: number;
    /** Real seconds between that tick and the end of the frame that emitted the event (TickEvent.lateBy). */
    lateBy?: number;
    /** Per-instance volley counter (0, 1, 2, …), e.g. to walk an arpeggio. */
    index?: number;
    /** 0..1 pitch suggestion from the enemy's motion (the snake's weave). */
    pitchHint?: number;
  };
  enemyHit: { enemyType: EnemyType; x: number; y: number; damage: number; hpLeft: number; maxHp: number };
  enemyKilled: {
    enemyType: EnemyType;
    x: number;
    y: number;
    isBoss: boolean;
    elite: boolean;
    chainCount: number;
    chainTier: number;
  };
  chainBreak: { tier: number; x: number; y: number };
  bulletClash: { x: number; y: number };
  asteroidBreak: { size: AsteroidSize; x: number; y: number };
  wallBounce: { x: number; y: number; axis: "x" | "y"; owner: BulletOwner };
  wallAbsorb: { x: number; y: number; owner: BulletOwner };
  glassCrack: { x: number; y: number; hp: number; maxHp: number };
  glassShatter: { x: number; y: number };
  playerHit: { x: number; y: number; hpLeft: number; maxHp: number };
  playerDied: { x: number; y: number };
  pickupCollected: { x: number; y: number; upgradeId: string; isWeapon: boolean };
  bossWarning: { bossType: EnemyType };
  bossPhaseChanged: { bossType: EnemyType; phase: number };
  bossDefeated: { bossType: EnemyType; x: number; y: number };
  waveStarted: { wave: number; mode: "endless" | "level" };
  levelCompleted: { levelId: number };
}

export type GameEvents = EventBus<GameEventMap>;
export type GameEventType = keyof GameEventMap;

// The mapped type makes the compiler reject a missing or unknown event name.
const EVENT_TYPE_SET: { readonly [K in GameEventType]: true } = {
  playerFired: true,
  enemyFired: true,
  enemyHit: true,
  enemyKilled: true,
  chainBreak: true,
  bulletClash: true,
  asteroidBreak: true,
  wallBounce: true,
  wallAbsorb: true,
  glassCrack: true,
  glassShatter: true,
  playerHit: true,
  playerDied: true,
  pickupCollected: true,
  bossWarning: true,
  bossPhaseChanged: true,
  bossDefeated: true,
  waveStarted: true,
  levelCompleted: true,
};

/** Every event name, for subscribers that forward all of them (e.g. the music). */
export const GAME_EVENT_TYPES: readonly GameEventType[] = Object.freeze(Object.keys(EVENT_TYPE_SET) as GameEventType[]);

export function createGameEvents(): GameEvents {
  return new EventBus<GameEventMap>();
}

/**
 * The bus a host (a scene) exposes as `gameEvents`, or null if it has none. Lets objects that only
 * know their Phaser scene (e.g. enemies) emit without importing GameScene.
 */
export function gameEventsOf(host: object): GameEvents | null {
  if (!("gameEvents" in host)) return null;
  const bus = host.gameEvents;
  return bus instanceof EventBus ? bus : null;
}
