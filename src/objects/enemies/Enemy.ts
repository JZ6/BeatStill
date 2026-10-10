import Phaser from "phaser";
import { Bullet } from "../Bullet";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import type { TickEvent } from "../../core/Conductor";
import { gameEventsOf, type GameEventMap } from "../../core/GameEvents";
import { GAME_W, GAME_H, px } from "../../systems/GameConfig";
import { enemyDef, rhythmHits, type EnemyDef, type EnemyType } from "./registry";
import { EnemyRhythm, densityDoublings, pickOffset } from "./rhythm";

export type { EnemyType } from "./registry";

const HIT_FLASH_MS = 80;
const HIT_FLASH_COLOR = 0xffffff;

/**
 * Base enemy. Stats, visuals and rhythm come from the enemy registry. Movement runs every frame
 * on (real delta, time scale); firing happens only on the conductor's 16th-note steps (onStep),
 * when the instance's rhythm pattern hits, so every volley is a note on the grid.
 */
export abstract class Enemy extends Phaser.GameObjects.Graphics {
  readonly enemyType: EnemyType;
  /** This type's registry entry (stats, visuals, role, rhythm). */
  readonly def: EnemyDef;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  targetX!: number;
  targetY!: number;
  protected color: number;
  isElite = false;
  /** When this instance fires: the type's pattern at a random phase offset. */
  protected readonly rhythm: EnemyRhythm;
  /** Remaining hit-flash time in real ms (not time-scaled). */
  private flashTimer = 0;
  /** Volleys fired so far (enemyFired.index). */
  private volleys = 0;

  /** Stats come from the enemy registry entry for `type`. */
  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(5);
    this.enemyType = type;
    this.def = enemyDef(type);
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.speed = this.def.speed;
    this.color = this.def.color;
    this.radius = px(this.def.radius);
    // A random phase within the pattern, so a crowd of one type doesn't fire in unison.
    const hits = rhythmHits(type);
    const offset = pickOffset(hits.length, this.def.rhythm.offsetStep, (n) => Phaser.Math.Between(0, n - 1));
    this.rhythm = new EnemyRhythm(hits, offset);
    this.pickNewTarget();
  }

  /** Multiplies how often the pattern hits (1 = as written, 2 = double density: bullet_storm). */
  setRhythmDensity(factor: number) {
    this.rhythm.setDensity(densityDoublings(factor));
  }

  protected pickNewTarget() {
    this.targetX = Phaser.Math.Between(100, GAME_W - 100);
    this.targetY = Phaser.Math.Between(80, GAME_H - 120);
  }

  draw(color: number) {
    this.clear();
    if (this.isElite) {
      this.lineStyle(px(4), 0xffdd44, 0.3);
      this.strokeCircle(0, 0, this.radius + px(6));
    }
    this.drawShape(color);
    this.drawCracks(color);
  }

  private drawCracks(color: number) {
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg <= 0) return;
    const r = this.radius;
    const crackCount = Math.min(Math.ceil(dmg * 5), 4);
    this.lineStyle(px(1), color, 0.4 + dmg * 0.4);
    for (let c = 0; c < crackCount; c++) {
      const seed = c * 31 + 7;
      const startAngle = ((seed * 137) % 360) * (Math.PI / 180);
      const len = r * (0.4 + dmg * 0.4);
      const segments = 3;
      let cx = Math.cos(startAngle) * r * 0.15;
      let cy = Math.sin(startAngle) * r * 0.15;
      this.beginPath();
      this.moveTo(cx, cy);
      for (let s = 0; s < segments; s++) {
        const segSeed = seed * 13 + s * 7;
        const jitter = ((segSeed % 11) / 11 - 0.5) * 0.8;
        const segAngle = startAngle + jitter;
        const segLen = len / segments;
        cx += Math.cos(segAngle) * segLen;
        cy += Math.sin(segAngle) * segLen;
        this.lineTo(cx, cy);
      }
      this.strokePath();
    }
  }

  makeElite() {
    this.isElite = true;
    this.hp *= 3;
    this.maxHp *= 3;
    this.draw(this.color);
  }

  /** Draws the registry shape (polygon or circle); classes with a special body override this. */
  protected drawShape(color: number): void {
    const shape = this.def.shape;
    if (shape.kind === "polygon") this.drawPolygon(color, shape.sides);
    else this.drawCircleShape(color);
  }

  protected drawPolygon(color: number, sides: number) {
    const r = this.radius;
    const dmg = 1 - this.hp / this.maxHp;
    const drawPoly = (rad: number) => {
      this.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const dent = dmg * 0.35 * (((i * 7 + 3) % sides) / Math.max(sides - 1, 1));
        const vr = rad * (1 - dent);
        const vx = Math.cos(a) * vr;
        const vy = Math.sin(a) * vr;
        if (i === 0) this.moveTo(vx, vy); else this.lineTo(vx, vy);
      }
      this.closePath();
    };
    this.lineStyle(px(3), color, 0.3 * (1 - dmg * 0.6));
    drawPoly(r + px(4));
    this.strokePath();
    this.lineStyle(px(1.5), color, 1);
    drawPoly(r);
    this.strokePath();
    this.fillStyle(color, 0.15 * (1 - dmg * 0.5));
    drawPoly(r);
    this.fillPath();
  }

  protected drawCircleShape(color: number) {
    const r = this.radius;
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg > 0) {
      const n = 16;
      const drawWobble = (rad: number) => {
        this.beginPath();
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n;
          const jitter = dmg * 0.25 * (((i * 7 + 3) % n) / (n - 1));
          const vr = rad * (1 - jitter);
          const vx = Math.cos(a) * vr;
          const vy = Math.sin(a) * vr;
          if (i === 0) this.moveTo(vx, vy); else this.lineTo(vx, vy);
        }
        this.closePath();
      };
      this.lineStyle(px(3), color, 0.3 * (1 - dmg * 0.6));
      drawWobble(r + px(4));
      this.strokePath();
      this.lineStyle(px(1.5), color, 1);
      drawWobble(r);
      this.strokePath();
      this.fillStyle(color, 0.15 * (1 - dmg * 0.5));
      drawWobble(r);
      this.fillPath();
    } else {
      this.lineStyle(px(3), color, 0.3);
      this.strokeCircle(0, 0, r + px(4));
      this.lineStyle(px(1.5), color, 1);
      this.strokeCircle(0, 0, r);
      this.fillStyle(color, 0.15);
      this.fillCircle(0, 0, r);
    }
  }

  /** Per live frame: hit flash and movement (real delta in ms, scaled by the world's time scale). */
  update(delta: number, timeScale: number, gameScene: GameScene) {
    this.updateFlash(delta);
    this.updateMovement(delta, timeScale, gameScene);
  }

  /**
   * On every 16th-note step of the conductor (`step` = tick / TICKS_PER_STEP), in order: fires when
   * the rhythm hits (after the spawn grace). Subclasses that act on beats or bar lines override this
   * and call super.onStep().
   */
  onStep(step: number, tick: TickEvent, gameScene: GameScene) {
    if (!this.active) return;
    if (this.rhythm.onStep(step, this.canFire())) this.fire(gameScene, tick);
  }

  /** Override to temporarily block firing (e.g. mid-teleport). A due volley is held and fires on the next step this returns true. */
  protected canFire(): boolean {
    return true;
  }

  /** Body color to draw with: white while the hit flash is active. Subclasses that redraw every frame must use this. */
  protected currentColor(): number {
    return this.flashTimer > 0 ? HIT_FLASH_COLOR : this.color;
  }

  protected startFlash() {
    this.flashTimer = HIT_FLASH_MS;
    this.draw(HIT_FLASH_COLOR);
  }

  private updateFlash(delta: number) {
    if (this.flashTimer <= 0) return;
    this.flashTimer -= delta;
    // Restore the normal look for enemies that only draw on demand.
    if (this.flashTimer <= 0) this.draw(this.currentColor());
  }

  protected abstract updateMovement(delta: number, timeScale: number, gameScene: GameScene): void;
  /** Bullet geometry of one volley; `at` is the step it fires on (absent for off-grid calls). */
  protected abstract getFirePattern(angleToPlayer: number, gameScene: GameScene, at?: TickEvent): BulletConfig[];

  /** Fires the type's volley at the ship. `at` is the step it fires on (its note is scheduled at that exact time). */
  fire(gameScene: GameScene, at?: TickEvent) {
    const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, gameScene.ship.x, gameScene.ship.y);
    const configs = this.getFirePattern(angleToPlayer, gameScene, at);
    this.spawnVolley(gameScene, configs, this.x, this.y, at);
  }

  /**
   * Spawns enemy bullets from (x, y) and announces the volley (enemyFired). With `at`, the event
   * carries that tick and its lateBy so the music plays the note at the step's exact time.
   */
  protected spawnVolley(gameScene: GameScene, configs: readonly BulletConfig[], x: number, y: number, at?: TickEvent) {
    if (configs.length === 0) return;
    for (const cfg of configs) {
      const bullet = new Bullet(this.scene, x, y, cfg.angle, cfg.speed, "enemy");
      bullet.sourceEnemy = this;
      gameScene.enemyBullets.add(bullet);
    }
    const pitchHint = this.pitchHint(at);
    gameScene.gameEvents.emit("enemyFired", {
      enemyType: this.enemyType,
      x,
      y,
      bulletCount: configs.length,
      elite: this.isElite,
      index: this.volleys++,
      ...(at ? { tick: at.tick, lateBy: at.lateBy } : {}),
      ...(pitchHint !== undefined ? { pitchHint } : {}),
    });
  }

  /** 0..1 pitch suggestion for a volley fired on `at` (enemyFired.pitchHint); none by default. */
  protected pitchHint(_at?: TickEvent): number | undefined {
    return undefined;
  }

  /** Emits on the scene's GameEvents bus (for code paths that only have the Phaser scene). */
  protected emitGameEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) {
    // Phaser clears `scene` when a game object is destroyed.
    const scene: Phaser.Scene | undefined = this.scene;
    if (scene) gameEventsOf(scene)?.emit(type, payload);
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    this.startFlash();
    return false;
  }

  protected moveTowardTarget(dt: number, timeScale: number, minDist = 5): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > minDist) {
      this.x += (dx / dist) * this.speed * timeScale * dt;
      this.y += (dy / dist) * this.speed * timeScale * dt;
      return false;
    }
    return true;
  }
}
