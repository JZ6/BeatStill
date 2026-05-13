import type { GameScene } from "../scenes/GameScene";
import { UpgradePickup } from "../objects/Shard";
import { addWeaponKill } from "./Unlocks";
import { addKill } from "./Achievements";
import { getLuckyStarBonus } from "./Shop";

export const CHAIN_WINDOW = 800;
export const CHAIN_RADIUS = 120;

export const CHAIN_TIERS = [
  { min: 0,  name: "",          color: 0xffffff, textColor: "#ffffff", mult: 1 },
  { min: 2,  name: "BEAT",      color: 0xffaa44, textColor: "#ffaa44", mult: 1.5 },
  { min: 5,  name: "RHYTHM",    color: 0xff6644, textColor: "#ff6644", mult: 2 },
  { min: 10, name: "MELODY",    color: 0xff44aa, textColor: "#ff44aa", mult: 3 },
  { min: 15, name: "HARMONY",   color: 0xaa44ff, textColor: "#aa44ff", mult: 4 },
  { min: 25, name: "CRESCENDO", color: 0x44ffff, textColor: "#44ffff", mult: 6 },
];

export const DROP_RATES = [0.12, 0.16, 0.22, 0.28, 0.35, 0.45];
export const MAGNET_SPEEDS = [0, 0, 80, 120, 160, 200];

export function getChainTier(count: number): number {
  for (let i = CHAIN_TIERS.length - 1; i >= 0; i--) {
    if (count >= CHAIN_TIERS[i].min) return i;
  }
  return 0;
}

export class ChainSystem {
  chainTimer = 0;
  chainCount = 0;
  chainTier = 0;
  bestChain = 0;
  lastKillX = 0;
  lastKillY = 0;
  private graceTimer = 0;
  private graceTier = 0;
  private arcGraphics!: Phaser.GameObjects.Graphics;
  private scorePopups: { text: Phaser.GameObjects.Text; timer: number }[] = [];

  constructor(private scene: GameScene) {}

  init() {
    this.arcGraphics = this.scene.add.graphics();
    this.arcGraphics.setDepth(95);

    this.scorePopups = [];
    for (let i = 0; i < 8; i++) {
      const t = this.scene.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(100)
        .setAlpha(0);
      this.scorePopups.push({ text: t, timer: 0 });
    }
  }

  reset() {
    this.chainTimer = 0;
    this.chainCount = 0;
    this.chainTier = 0;
    this.bestChain = 0;
    this.lastKillX = 0;
    this.lastKillY = 0;
    this.graceTimer = 0;
    this.graceTier = 0;
  }

  registerKill(x: number, y: number, isBoss = false) {
    const s = this.scene;
    const dx = x - this.lastKillX;
    const dy = y - this.lastKillY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hasMetronome = s.relics.hasRelic("metronome");
    const effectiveRadius = (CHAIN_RADIUS + s.stats.chainRadius) * (hasMetronome ? 0.5 : 1);
    const effectiveWindow = (CHAIN_WINDOW + s.stats.chainWindow) * (hasMetronome ? 1.5 : 1);

    const prevTier = this.chainTier;

    if (this.chainTimer > 0 && dist < effectiveRadius) {
      this.chainCount++;
    } else if (this.graceTimer > 0 && dist < effectiveRadius) {
      this.chainCount = CHAIN_TIERS[this.graceTier].min;
      this.graceTimer = 0;
    } else {
      this.chainCount = 1;
    }

    if (this.chainCount > this.bestChain) this.bestChain = this.chainCount;
    this.chainTier = getChainTier(this.chainCount);
    const tier = CHAIN_TIERS[this.chainTier];

    const basePoints = isBoss ? 500 : 100;
    const points = Math.floor(basePoints * tier.mult);
    s.score += points;
    s.scoreText.setText(`SCORE: ${s.score}`);

    if (this.chainTier > 0) {
      s.audioManager.onChainKill(this.chainCount, this.chainTier);
      s.chainText.setText(`${tier.name} x${this.chainCount}`);
      s.chainText.setColor(tier.textColor);
      s.chainText.setAlpha(1);
      this.spawnPopup(x, y, `+${points}`, tier.textColor);

      if (this.chainTier > prevTier && tier.name) {
        this.spawnPopup(x, y - 20, tier.name, tier.textColor, 24);
        s.tweens.add({
          targets: s.chainText,
          scaleX: { from: 1.4, to: 1 },
          scaleY: { from: 1.4, to: 1 },
          duration: 200,
          ease: "Back.easeOut",
        });
      }

      const shakeIntensity = [0, 0.003, 0.005, 0.008, 0.012, 0.012][this.chainTier];
      const shakeDuration = [0, 80, 100, 120, 150, 150][this.chainTier];
      if (shakeIntensity > 0) s.cameras.main.shake(shakeDuration, shakeIntensity);
    } else {
      s.audioManager.onEnemyKill();
    }

    this.chainTimer = effectiveWindow;
    this.lastKillX = x;
    this.lastKillY = y;

    if (s.stats.weaponId !== "standard") {
      addWeaponKill(s.stats.weaponId);
    }

    s.runKills++;
    addKill();

    const dropRate = (DROP_RATES[this.chainTier] ?? 0.12) + getLuckyStarBonus();
    if (Math.random() < dropRate) {
      const upgrade = s.rollDrop();
      if (upgrade) {
        const pickup = new UpgradePickup(s, x, y, upgrade);
        s.shards.add(pickup);
      }
    }

    s.processAchievements(false, false);
  }

  update(delta: number, ts: number) {
    if (this.chainTimer > 0) {
      this.chainTimer -= delta * ts;
      if (this.chainTimer <= 0) {
        const prevTier = this.chainTier;
        if (prevTier >= 2) {
          this.graceTimer = 400;
          this.graceTier = prevTier - 1;
        }
        this.scene.audioManager.onChainBreak(prevTier);
        if (prevTier >= 2) {
          const tier = CHAIN_TIERS[prevTier];
          this.scene.particles.burst(this.lastKillX, this.lastKillY, tier.color, 15, 60, 2);
        }
        this.chainCount = 0;
        this.chainTier = 0;
        this.scene.tweens.add({ targets: this.scene.chainText, alpha: 0, duration: 300 });
      }
    }

    if (this.graceTimer > 0) {
      this.graceTimer -= delta * ts;
    }

    this.updateArc(ts);
    this.updatePopups(delta, ts);
  }

  spawnPopup(x: number, y: number, text: string, color: string, size = 16) {
    let oldest = this.scorePopups[0];
    for (const p of this.scorePopups) {
      if (p.timer <= 0) { oldest = p; break; }
      if (p.timer < oldest.timer) oldest = p;
    }
    oldest.text.setText(text).setPosition(x, y).setAlpha(1).setColor(color)
      .setFontSize(size).setScale(1);
    oldest.timer = 600;
    if (size > 16) {
      this.scene.tweens.add({
        targets: oldest.text,
        scaleX: { from: 0, to: 1.3 },
        scaleY: { from: 0, to: 1.3 },
        duration: 150,
        yoyo: true,
        hold: 50,
      });
    }
  }

  private updateArc(ts: number) {
    this.arcGraphics.clear();
    if (this.chainTimer <= 0) return;
    const tier = CHAIN_TIERS[this.chainTier] ?? CHAIN_TIERS[0];
    const effectiveWindow = CHAIN_WINDOW + this.scene.stats.chainWindow;
    const progress = this.chainTimer / effectiveWindow;
    const arcAngle = progress * Math.PI * 2;
    let alpha = 0.6;
    if (ts < 0.1) alpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
    this.arcGraphics.lineStyle(2, tier.color, alpha);
    this.arcGraphics.beginPath();
    this.arcGraphics.arc(this.lastKillX, this.lastKillY, 25, -Math.PI / 2, -Math.PI / 2 + arcAngle, false);
    this.arcGraphics.strokePath();
  }

  private updatePopups(delta: number, ts: number) {
    for (const p of this.scorePopups) {
      if (p.timer <= 0) continue;
      p.timer -= delta * Math.max(ts, 0.3);
      p.text.y -= 40 * (delta / 600) * Math.max(ts, 0.3);
      p.text.setAlpha(Math.max(p.timer / 600, 0));
      if (p.timer <= 0) p.text.setAlpha(0);
    }
  }
}
