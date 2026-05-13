import type { GameScene } from "../scenes/GameScene";
import type { Enemy } from "../objects/enemies";
import type { Bullet } from "../objects/Bullet";
import type { Asteroid } from "../objects/Asteroid";
import type { UpgradePickup } from "../objects/Shard";

export interface EntitySnapshot {
  x: number;
  y: number;
  radius: number;
  color: number;
  type: number;
}

const T_PLAYER = 0;
const T_ENEMY = 1;
const T_PLAYER_BULLET = 2;
const T_ENEMY_BULLET = 3;
const T_ASTEROID = 4;
const T_SHARD = 5;

export { T_PLAYER, T_ENEMY, T_PLAYER_BULLET, T_ENEMY_BULLET, T_ASTEROID, T_SHARD };

export interface FrameSnapshot {
  entities: EntitySnapshot[];
}

export class ReplayRecorder {
  private buffer: FrameSnapshot[] = [];
  private head = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity = 600) {
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      this.buffer.push({ entities: [] });
    }
  }

  record(scene: GameScene) {
    const entities: EntitySnapshot[] = [];

    entities.push({
      x: scene.ship.x,
      y: scene.ship.y,
      radius: 16,
      color: (scene.ship as any).shipColor ?? 0x00ffff,
      type: T_PLAYER,
    });

    for (const e of scene.enemies.getChildren() as Enemy[]) {
      if (!e.active) continue;
      entities.push({
        x: e.x, y: e.y,
        radius: e.radius,
        color: (e as any).color ?? 0xff4444,
        type: T_ENEMY,
      });
    }

    for (const b of scene.playerBullets.getChildren() as Bullet[]) {
      if (!b.alive) continue;
      entities.push({
        x: b.x, y: b.y,
        radius: b.radius,
        color: b.bulletColor,
        type: T_PLAYER_BULLET,
      });
    }

    for (const b of scene.enemyBullets.getChildren() as Bullet[]) {
      if (!b.alive) continue;
      entities.push({
        x: b.x, y: b.y,
        radius: b.radius,
        color: b.bulletColor,
        type: T_ENEMY_BULLET,
      });
    }

    for (const a of scene.asteroids.getChildren() as Asteroid[]) {
      if (!a.active) continue;
      entities.push({
        x: a.x, y: a.y,
        radius: (a as any).radius ?? 20,
        color: 0xcc8866,
        type: T_ASTEROID,
      });
    }

    for (const p of scene.shards.getChildren() as UpgradePickup[]) {
      if (!(p as any).alive) continue;
      entities.push({
        x: p.x, y: p.y,
        radius: 6,
        color: (p as any).pickupColor ?? 0xffaa44,
        type: T_SHARD,
      });
    }

    this.buffer[this.head] = { entities };
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getReplayFrames(maxFrames?: number): FrameSnapshot[] {
    const total = maxFrames ? Math.min(maxFrames, this.count) : this.count;
    const start = (this.head - total + this.capacity) % this.capacity;
    const frames: FrameSnapshot[] = [];
    for (let i = 0; i < total; i++) {
      frames.push(this.buffer[(start + i) % this.capacity]);
    }
    return frames;
  }

  reset() {
    this.head = 0;
    this.count = 0;
  }
}
