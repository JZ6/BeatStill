import Phaser from "phaser";
import { Bullet } from "./Bullet";
import type { GameScene } from "../scenes/GameScene";
import { defaultStats, type PlayerStats } from "../systems/Upgrades";
import { getWeapon } from "../systems/Weapons";

const BASE = defaultStats();

const INVINCIBLE_DURATION = 1500;
const HEALTHBAR_WIDTH = 40;
const HEALTHBAR_HEIGHT = 4;

export class Ship extends Phaser.GameObjects.Container {
  keys!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  fireCooldown = 0;
  graphics: Phaser.GameObjects.Graphics;
  healthBar: Phaser.GameObjects.Graphics;
  hp = 5;
  maxHp = 5;
  invincibleTimer = 0;
  stats!: PlayerStats;
  private inputMag = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(10);

    this.graphics = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(11);
    this.drawShip();
    this.drawHealthBar();

    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey("W"),
      a: kb.addKey("A"),
      s: kb.addKey("S"),
      d: kb.addKey("D"),
    };
  }

  drawShip() {
    this.graphics.clear();
    this.graphics.lineStyle(3, 0x00ffff, 0.3);
    this.graphics.beginPath();
    this.graphics.moveTo(0, -18);
    this.graphics.lineTo(-12, 14);
    this.graphics.lineTo(12, 14);
    this.graphics.closePath();
    this.graphics.strokePath();

    this.graphics.lineStyle(1.5, 0x00ffff, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(0, -18);
    this.graphics.lineTo(-12, 14);
    this.graphics.lineTo(12, 14);
    this.graphics.closePath();
    this.graphics.strokePath();

    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(0, 0, 3);
  }

  drawHealthBar() {
    this.healthBar.clear();
    const x = -HEALTHBAR_WIDTH / 2;
    const y = 22;

    this.healthBar.fillStyle(0x333333, 0.6);
    this.healthBar.fillRect(x, y, HEALTHBAR_WIDTH, HEALTHBAR_HEIGHT);

    const pct = this.hp / this.maxHp;
    const color = pct > 0.5 ? 0x00ff88 : pct > 0.25 ? 0xffaa00 : 0xff2222;
    this.healthBar.fillStyle(color, 0.9);
    this.healthBar.fillRect(x, y, HEALTHBAR_WIDTH * pct, HEALTHBAR_HEIGHT);
  }

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0) return false;
    this.hp -= amount;
    this.drawHealthBar();
    if (this.hp <= 0) return true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    return false;
  }

  isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  getInputMagnitude(): number {
    return this.inputMag;
  }

  update(delta: number, timeScale: number, gameScene: GameScene) {
    let vx = 0;
    let vy = 0;
    if (this.keys.a.isDown) vx -= 1;
    if (this.keys.d.isDown) vx += 1;
    if (this.keys.w.isDown) vy -= 1;
    if (this.keys.s.isDown) vy += 1;

    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag > 0) {
      vx /= mag;
      vy /= mag;
    }

    const pointer = this.scene.input.activePointer;
    const mouseDx = Math.abs(pointer.velocity.x) + Math.abs(pointer.velocity.y);
    const mouseMag = Math.min(mouseDx / 500, 1);

    const shootMag = pointer.isDown ? 0.5 : 0;
    this.inputMag = Math.max(mag, mouseMag, shootMag);

    const playerTimeScale = timeScale * 0.5 + 0.5;
    const moveSpeed = this.stats.moveSpeed * playerTimeScale * (delta / 1000);
    this.x += vx * moveSpeed;
    this.y += vy * moveSpeed;

    this.x = Phaser.Math.Clamp(this.x, 16, 1264);
    this.y = Phaser.Math.Clamp(this.y, 16, 704);

    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      pointer.worldX, pointer.worldY,
    );
    this.rotation = angle + Math.PI / 2;

    this.graphics.setPosition(this.x, this.y);
    this.graphics.setRotation(this.rotation);

    this.healthBar.setPosition(this.x, this.y);

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      const flash = Math.floor(this.invincibleTimer / 80) % 2 === 0;
      this.graphics.setAlpha(flash ? 0.3 : 1);
    } else {
      this.graphics.setAlpha(1);
    }

    this.fireCooldown -= delta * timeScale;
    if (pointer.isDown && this.fireCooldown <= 0) {
      this.fire(angle, gameScene);
      const weapon = getWeapon(this.stats.weaponId);
      const cooldownReduction = BASE.fireCooldown - this.stats.fireCooldown;
      this.fireCooldown = Math.max(weapon.baseCooldown - cooldownReduction, 30);
    }
  }

  fire(angle: number, gameScene: GameScene) {
    const weapon = getWeapon(this.stats.weaponId);

    const count = weapon.baseBulletCount + (this.stats.bulletCount - BASE.bulletCount);
    const spread = weapon.baseBulletSpread + (this.stats.bulletSpread - BASE.bulletSpread);
    const speed = weapon.baseBulletSpeed + (this.stats.bulletSpeed - BASE.bulletSpeed);
    const dmg = Math.max(1, Math.round(weapon.damageMultiplier * this.stats.damage));
    const prc = weapon.basePierce + this.stats.pierce;

    const startAngle = count > 1 ? angle - spread / 2 : angle;
    const step = count > 1 ? spread / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const a = startAngle + step * i;
      const bullet = new Bullet(
        this.scene,
        this.x + Math.cos(a) * 20,
        this.y + Math.sin(a) * 20,
        a,
        speed,
        "player",
        dmg,
        prc,
        {
          color: weapon.bulletColor,
          radius: weapon.bulletRadius,
          lifetime: weapon.lifetime,
          homing: weapon.homing,
        },
      );
      gameScene.playerBullets.add(bullet);
    }
    gameScene.audioManager.onShoot(weapon.shotSound);
  }

  destroy() {
    this.graphics.destroy();
    this.healthBar.destroy();
    super.destroy();
  }
}
