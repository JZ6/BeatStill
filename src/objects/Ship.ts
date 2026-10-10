import Phaser from "phaser";
import { Bullet } from "./Bullet";
import type { GameScene } from "../scenes/GameScene";
import { fireRateLevel, type PlayerStats } from "../systems/Upgrades";
import { getWeapon } from "../systems/Weapons";
import { shotProfile } from "../systems/weaponMath";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";
import { options } from "../systems/GameOptions";
import type { TouchControls } from "../systems/TouchControls";
import { AngularSpeedTracker, type DilationInput } from "../core/TimeDilation";
import { TICKS_PER_BEAT, type TickEvent } from "../core/Conductor";
import { keyboardVector } from "../core/InputMath";
import { BASE_FIRE_GRACE, FireClock, type FireShot } from "../game/FireClock";
import { PulseEnvelope } from "../game/PulseEnvelope";
import { fireIntervalTicks } from "../music/noteValues";

const INVINCIBLE_DURATION = 1500;
const INVINCIBLE_FLASH_MS = 80;
const HEALTHBAR_WIDTH = 40;
const HEALTHBAR_HEIGHT = 4;
/** On-beat shot ring: radius (px at 1× UI scale), peak alpha, growth while it fades, decay per real second. */
const BEAT_RING_RADIUS = 24;
const BEAT_RING_ALPHA = 0.4;
const BEAT_RING_GROWTH = 0.3;
const BEAT_RING_DECAY = 10;

/** Where this frame's aim angle came from: mouse/last pointer, the touch aim stick, or held (move stick only). */
type AimSource = "pointer" | "touch" | "hold";

/** Input sampled once per frame by readInput() and consumed by update(). */
interface FrameInput {
  vx: number;
  vy: number;
  aimAngle: number;
  firing: boolean;
}

export class Ship extends Phaser.GameObjects.Container {
  keys: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key } | null = null;
  graphics: Phaser.GameObjects.Graphics;
  healthBar: Phaser.GameObjects.Graphics;
  /** A faint ring that flashes when a shot lands exactly on a beat (stronger on a downbeat). */
  private readonly beatRing: Phaser.GameObjects.Graphics;
  private readonly beatPulse = new PulseEnvelope(BEAT_RING_DECAY);
  hp = 5;
  maxHp = 5;
  /** Remaining i-frames in ms of the player's own time (see update()). */
  invincibleTimer = 0;
  stats!: PlayerStats;
  touchControls?: TouchControls;
  shipColor: number;
  damageMultiplier = 1;
  private pointerFireSuppressed = false;
  private readonly aimTracker = new AngularSpeedTracker();
  private aimSource: AimSource = "pointer";
  private frameInput: FrameInput = { vx: 0, vy: 0, aimAngle: -Math.PI / 2, firing: false };
  /** Real ms since i-frames started; drives the blink so it doesn't slow down in slow motion. */
  private invincibleFlashElapsed = 0;
  /** When the weapon fires: on the conductor grid at the weapon's note value (see FireClock). */
  private readonly fireClock = new FireClock();
  /** Shots that came due on this frame's ticks; fired in update() after moving and aiming. */
  private dueShots: FireShot[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(10);

    this.shipColor = options.shipColor;
    this.graphics = new Phaser.GameObjects.Graphics(scene);
    this.healthBar = new Phaser.GameObjects.Graphics(scene);
    this.beatRing = new Phaser.GameObjects.Graphics(scene);
    this.add(this.beatRing);
    this.add(this.graphics);
    this.add(this.healthBar);
    this.drawBeatRing();
    this.drawShip();
    this.drawHealthBar();

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = {
        w: kb.addKey("W"),
        a: kb.addKey("A"),
        s: kb.addKey("S"),
        d: kb.addKey("D"),
      };
    }
  }

  drawShip() {
    this.graphics.clear();
    const c = this.shipColor;
    const s = px(1);
    this.graphics.lineStyle(3 * s, c, 0.3);
    this.graphics.beginPath();
    this.graphics.moveTo(0, -18 * s);
    this.graphics.lineTo(-12 * s, 14 * s);
    this.graphics.lineTo(12 * s, 14 * s);
    this.graphics.closePath();
    this.graphics.strokePath();

    this.graphics.lineStyle(1.5 * s, c, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(0, -18 * s);
    this.graphics.lineTo(-12 * s, 14 * s);
    this.graphics.lineTo(12 * s, 14 * s);
    this.graphics.closePath();
    this.graphics.strokePath();

    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(0, 0, 3 * s);
  }

  private drawBeatRing() {
    this.beatRing.clear();
    this.beatRing.lineStyle(px(1.5), this.shipColor, 1);
    this.beatRing.strokeCircle(0, 0, px(BEAT_RING_RADIUS));
    this.applyBeatRing();
  }

  /** Ring alpha follows the pulse; it widens a little as it fades. Hidden while dark. */
  private applyBeatRing() {
    const level = this.beatPulse.level;
    this.beatRing.setVisible(level > 0);
    if (level > 0) this.beatRing.setAlpha(level * BEAT_RING_ALPHA).setScale(1 + BEAT_RING_GROWTH * (1 - level));
  }

  getHitVertices(): [number, number, number, number, number, number] {
    const s = px(1);
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rotate = (lx: number, ly: number): [number, number] => [
      this.x + cos * lx - sin * ly,
      this.y + sin * lx + cos * ly,
    ];
    const [ax, ay] = rotate(0, -18 * s);
    const [bx, by] = rotate(-12 * s, 14 * s);
    const [cx, cy] = rotate(12 * s, 14 * s);
    return [ax, ay, bx, by, cx, cy];
  }

  drawHealthBar() {
    this.healthBar.clear();
    const w = px(HEALTHBAR_WIDTH);
    const h = px(HEALTHBAR_HEIGHT);
    const x = -w / 2;
    const y = px(22);

    this.healthBar.fillStyle(0x333333, 0.6);
    this.healthBar.fillRect(x, y, w, h);

    const pct = this.hp / this.maxHp;
    const color = pct > 0.5 ? 0x00ff88 : pct > 0.25 ? 0xffaa00 : 0xff2222;
    this.healthBar.fillStyle(color, 0.9);
    this.healthBar.fillRect(x, y, w * pct, h);
  }

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0) return false;
    this.hp -= amount;
    this.drawHealthBar();
    if (this.hp <= 0) return true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    this.invincibleFlashElapsed = 0;
    return false;
  }

  isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  /**
   * Ignore pointer-held firing until the pointer is released. Used after closing the pause menu
   * or relic overlay, where the click that dismissed it is usually still held down.
   */
  suppressFireUntilRelease() {
    this.pointerFireSuppressed = true;
  }

  /**
   * Forget the last aim angle, so the next readInput() re-seeds the spin tracker instead of
   * counting aim changes made while the game was frozen (e.g. moving to the RESUME button).
   */
  resetAimTracking() {
    this.aimTracker.reset();
  }

  /**
   * Samples keyboard, pointer and touch input. Call once per frame, before update().
   * Caches movement, aim and fire state for update() and returns what time dilation needs.
   * The aim speed is measured from this frame's aim angle, in real seconds.
   */
  readInput(realDt: number): DilationInput {
    const pointer = this.scene.input.activePointer;
    if (this.pointerFireSuppressed && !pointer.isDown) this.pointerFireSuppressed = false;

    let vx = 0;
    let vy = 0;
    let move = 0;
    let aimAngle = this.rotation - Math.PI / 2;
    let firing = false;
    let aimSource: AimSource = "pointer";

    const tc = this.touchControls;
    if (tc && (tc.aimActive || tc.moveActive)) {
      vx = tc.moveVector.x;
      vy = tc.moveVector.y;
      move = Math.min(Math.sqrt(vx * vx + vy * vy), 1);
      aimSource = "hold";
      if (tc.aimActive) {
        aimAngle = tc.aimAngle;
        firing = true;
        aimSource = "touch";
      }
    } else {
      const k = this.keys;
      const kb = keyboardVector(!!k?.a.isDown, !!k?.d.isDown, !!k?.w.isDown, !!k?.s.isDown);
      vx = kb.x;
      vy = kb.y;
      move = kb.magnitude;
      aimAngle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
      firing = pointer.isDown && !this.pointerFireSuppressed;
    }

    // Switching aim source (the aim stick arming, all touches lifting) jumps the angle; that isn't spin.
    if (aimSource !== this.aimSource) {
      this.aimSource = aimSource;
      this.aimTracker.reset();
    }
    const aimSpeed = this.aimTracker.update(aimAngle, realDt);
    this.frameInput = { vx, vy, aimAngle, firing };
    return { move, aimSpeed, firing };
  }

  /** Ticks between shots this frame (the interval the fire clock uses). */
  get fireInterval(): number {
    return this.fireClock.intervalTicks;
  }

  /** The weapon's note value after Rapid Fire (rungs up TICK_LADDER) and the Overclock relic. */
  computeFireInterval(gameScene: GameScene): number {
    const weapon = getWeapon(this.stats.weaponId);
    return fireIntervalTicks(weapon.noteTicks, fireRateLevel(this.stats), gameScene.relics.hasRelic("overclock"));
  }

  /**
   * Starts this frame for the fire clock. Call once per live frame after readInput() and before
   * the frame's conductor ticks are dispatched, with the conductor's real delta (seconds).
   */
  beginFireFrame(realDt: number, gameScene: GameScene) {
    this.dueShots = [];
    this.fireClock.beginFrame(this.frameInput.firing, this.computeFireInterval(gameScene), realDt);
  }

  /** Every conductor tick, in order (GameScene.onTick): queues a shot that comes due on it. */
  onTick(t: TickEvent) {
    const shot = this.fireClock.onTick(t);
    if (shot) this.dueShots.push(shot);
  }

  update(delta: number, timeScale: number, gameScene: GameScene) {
    const { vx, vy, aimAngle } = this.frameInput;

    // The player runs at half speed when time is frozen, so it can still act.
    const playerTimeScale = timeScale * 0.5 + 0.5;
    const moveSpeed = this.stats.moveSpeed * playerTimeScale * (delta / 1000);
    this.x += vx * moveSpeed;
    this.y += vy * moveSpeed;

    this.x = Phaser.Math.Clamp(this.x, px(16), GAME_W - px(16));
    this.y = Phaser.Math.Clamp(this.y, px(16), GAME_H - px(16));

    this.rotation = aimAngle + Math.PI / 2;
    this.healthBar.setRotation(-this.rotation);

    if (this.invincibleTimer > 0) {
      // I-frames run on the player's own clock, so standing still in frozen time doesn't
      // waste them. The blink stays real-time.
      this.invincibleTimer -= delta * playerTimeScale;
      this.invincibleFlashElapsed += delta;
      const flash = Math.floor(this.invincibleFlashElapsed / INVINCIBLE_FLASH_MS) % 2 === 0;
      this.graphics.setAlpha(flash ? 0.3 : 1);
    } else {
      this.graphics.setAlpha(1);
    }

    // The on-beat ring fades in real time, like the backdrop's beat pulse.
    if (this.beatPulse.level > 0) {
      this.beatPulse.update(delta / 1000);
      this.applyBeatRing();
    }

    // After moving and aiming, so shots leave from this frame's position along this frame's aim.
    const grace = BASE_FIRE_GRACE + (Number.isFinite(this.stats.fireGrace) ? Math.max(0, this.stats.fireGrace) : 0);
    const first = this.fireClock.endFrame(gameScene.conductor, grace);
    const shots = first ? [...this.dueShots, first] : this.dueShots;
    this.dueShots = [];
    for (const shot of shots) this.fire(aimAngle, gameScene, shot);
  }

  /**
   * Spawns one shot's bullets around `angle` and announces it (playerFired). A shot timed on a
   * conductor tick carries that tick and its lateBy, so its note sounds at the exact grid time.
   */
  fire(angle: number, gameScene: GameScene, shot: FireShot = { kind: "immediate", first: true }) {
    const weapon = getWeapon(this.stats.weaponId);

    const { count, spread, speed, damage: dmg, pierce: prc } = shotProfile(weapon, this.stats, this.damageMultiplier);

    const startAngle = count > 1 ? angle - spread / 2 : angle;
    const step = count > 1 ? spread / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const a = startAngle + step * i;
      const hasOverclock = gameScene.relics.hasRelic("overclock");
      const lt = hasOverclock && weapon.lifetime > 0 ? weapon.lifetime / 2 : weapon.lifetime;
      const bullet = new Bullet(
        this.scene,
        this.x + Math.cos(a) * px(20),
        this.y + Math.sin(a) * px(20),
        a,
        speed,
        "player",
        dmg,
        prc,
        {
          color: weapon.bulletColor,
          radius: weapon.bulletRadius,
          lifetime: lt,
          homing: weapon.homing,
          canRicochet: gameScene.relics.hasRelic("ricochet"),
        },
      );
      gameScene.playerBullets.add(bullet);
    }
    // The on-beat ring is a beat flash: off with Options → Reduce Flashing.
    if (shot.tick !== undefined && shot.tick % TICKS_PER_BEAT === 0 && !options.reduceFlashing) {
      this.beatPulse.trigger(shot.tick % gameScene.conductor.ticksPerBar === 0 ? 1 : 0.7);
      this.applyBeatRing();
    }
    gameScene.gameEvents.emit("playerFired", {
      weaponId: weapon.id,
      x: this.x,
      y: this.y,
      angle,
      bulletCount: count,
      first: shot.first,
      ...(shot.tick !== undefined ? { tick: shot.tick, lateBy: shot.lateBy ?? 0 } : {}),
    });
  }

}
