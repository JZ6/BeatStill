import Phaser from "phaser";
import type { UpgradeDef } from "../systems/Upgrades";
import { UPGRADE_COLORS } from "../systems/Upgrades";
import { getWeapon } from "../systems/Weapons";

const LIFETIME = 10000;
const FADE_START = 7000;
const SIZE = 8;

export class UpgradePickup extends Phaser.GameObjects.Graphics {
  elapsed = 0;
  alive = true;
  magnetTarget: { x: number; y: number } | null = null;
  magnetSpeed = 0;
  readonly upgrade: UpgradeDef;
  readonly pickupColor: number;
  private startY: number;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, upgrade: UpgradeDef) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(7);
    this.startY = y;
    this.upgrade = upgrade;

    if (upgrade.isWeapon) {
      const wId = upgrade.id.replace("weapon_", "");
      this.pickupColor = getWeapon(wId).bulletColor;
    } else {
      this.pickupColor = UPGRADE_COLORS[upgrade.id] ?? 0xffaa44;
    }

    this.label = scene.add.text(x, y - SIZE - 8, upgrade.icon, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: `#${this.pickupColor.toString(16).padStart(6, "0")}`,
      align: "center",
    }).setOrigin(0.5).setDepth(7);

    this.draw(1);
  }

  private draw(alpha: number) {
    this.clear();
    const c = this.pickupColor;

    this.fillStyle(c, alpha * 0.15);
    this.fillCircle(0, 0, SIZE * 2.5);

    this.fillStyle(c, alpha * 0.7);
    this.beginPath();
    this.moveTo(0, -SIZE);
    this.lineTo(SIZE * 0.6, 0);
    this.lineTo(0, SIZE);
    this.lineTo(-SIZE * 0.6, 0);
    this.closePath();
    this.fillPath();

    this.lineStyle(1, c, alpha);
    this.beginPath();
    this.moveTo(0, -SIZE);
    this.lineTo(SIZE * 0.6, 0);
    this.lineTo(0, SIZE);
    this.lineTo(-SIZE * 0.6, 0);
    this.closePath();
    this.strokePath();

    if (this.upgrade.isWeapon) {
      this.lineStyle(1, c, alpha * 0.4);
      this.strokeCircle(0, 0, SIZE + 3);
    }
  }

  update(delta: number, timeScale: number) {
    if (!this.alive) return;
    this.elapsed += delta * timeScale;

    if (this.magnetTarget && this.magnetSpeed > 0) {
      const dx = this.magnetTarget.x - this.x;
      const dy = this.magnetTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const step = this.magnetSpeed * timeScale * (delta / 1000);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.startY = this.y;
      }
    } else {
      this.y = this.startY + Math.sin(this.elapsed * 0.003) * 4;
    }
    this.rotation += 1.2 * timeScale * (delta / 1000);

    this.label.setPosition(this.x, this.y - SIZE - 8);
    this.label.rotation = this.rotation;

    if (this.elapsed > FADE_START) {
      const fade = 1 - (this.elapsed - FADE_START) / (LIFETIME - FADE_START);
      const a = Math.max(fade, 0);
      this.draw(a);
      this.label.setAlpha(a);
    }

    if (this.elapsed >= LIFETIME) {
      this.kill();
    }
  }

  kill() {
    this.alive = false;
    this.label.destroy();
    this.destroy();
  }
}
