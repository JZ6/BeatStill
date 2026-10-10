import Phaser from "phaser";
import { options } from "../systems/GameOptions";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";

export type BulletOwner = "player" | "enemy";

export interface BulletOpts {
  color?: number;
  radius?: number;
  lifetime?: number;
  homing?: boolean;
  canRicochet?: boolean;
  canDestroyBullets?: boolean;
}

export class Bullet extends Phaser.GameObjects.Graphics {
  vx: number;
  vy: number;
  owner: BulletOwner;
  damage: number;
  pierce: number;
  radius: number;
  lifetime: number;
  homing: boolean;
  bulletColor: number;
  alive = true;
  sourceEnemy: Phaser.GameObjects.GameObject | null = null;
  canDestroyBullets: boolean;
  private canRicochet: boolean;
  private bounced = false;
  private readonly hitTargets = new Set<object>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    speed: number,
    owner: BulletOwner,
    damage = 1,
    pierce = 0,
    opts?: BulletOpts,
  ) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(5);

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.owner = owner;
    this.damage = damage;
    this.pierce = pierce;
    this.radius = px(opts?.radius ?? 3);
    this.lifetime = opts?.lifetime ?? 0;
    this.homing = opts?.homing ?? false;

    this.canDestroyBullets = opts?.canDestroyBullets ?? false;
    this.canRicochet = opts?.canRicochet ?? false;
    this.bulletColor = opts?.color ?? (owner === "player" ? 0xffff00 : 0xff4488);
    const glowAlpha = owner === "player" ? 0.3 : 0.25;

    if (options.bulletGlow) {
      this.fillStyle(this.bulletColor, glowAlpha);
      this.fillCircle(0, 0, this.radius * 2);
    }
    this.fillStyle(this.bulletColor, 1);
    this.fillCircle(0, 0, this.radius);
  }

  update(delta: number, timeScale: number) {
    if (!this.alive) return;
    const dt = delta / 1000;

    if (this.lifetime > 0) {
      this.lifetime -= delta * timeScale;
      if (this.lifetime <= 0) {
        this.kill();
        return;
      }
    }

    this.x += this.vx * timeScale * dt;
    this.y += this.vy * timeScale * dt;

    if (this.canRicochet && !this.bounced) this.edgeBounce();

    const oob = this.x < -20 || this.x > GAME_W + 20 || this.y < -20 || this.y > GAME_H + 20;
    if (oob) this.kill();
  }

  /** Single bounce off the screen edges: reflect when the bullet's edge crosses one while moving outward. */
  private edgeBounce() {
    const r = this.radius;
    let bounced = false;
    if (this.x - r < 0 && this.vx < 0) {
      this.x = r;
      this.vx = -this.vx;
      bounced = true;
    } else if (this.x + r > GAME_W && this.vx > 0) {
      this.x = GAME_W - r;
      this.vx = -this.vx;
      bounced = true;
    }
    if (this.y - r < 0 && this.vy < 0) {
      this.y = r;
      this.vy = -this.vy;
      bounced = true;
    } else if (this.y + r > GAME_H && this.vy > 0) {
      this.y = GAME_H - r;
      this.vy = -this.vy;
      bounced = true;
    }
    if (bounced) this.bounced = true;
  }

  /** True if this bullet already damaged `target` (piercing bullets hit each target at most once). */
  hasHit(target: object): boolean {
    return this.hitTargets.has(target);
  }

  markHit(target: object) {
    this.hitTargets.add(target);
  }

  steerToward(tx: number, ty: number, strength: number, dt: number) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const desiredVx = (dx / dist) * speed;
    const desiredVy = (dy / dist) * speed;

    const factor = 1 - Math.pow(1 - strength, dt * 60);
    this.vx += (desiredVx - this.vx) * factor;
    this.vy += (desiredVy - this.vy) * factor;

    const newSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (newSpeed > 0) {
      this.vx = (this.vx / newSpeed) * speed;
      this.vy = (this.vy / newSpeed) * speed;
    }
  }

  hit(): boolean {
    if (!this.alive) return false;
    if (this.pierce > 0) {
      this.pierce--;
      return false;
    }
    this.kill();
    return true;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.sourceEnemy = null;
    this.hitTargets.clear();
    this.destroy();
  }
}
