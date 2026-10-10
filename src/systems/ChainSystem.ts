import type { GameScene } from "../scenes/GameScene";
import { addWeaponKill } from "./Unlocks";
import { addKill } from "./Achievements";
import { getLuckyStarBonus } from "./Shop";
import { px } from "./GameConfig";
import { shakeCamera } from "./feedback";
import {
  CHAIN_GRACE_BEATS,
  METRONOME_CHAIN_BONUS,
  METRONOME_SCORE_MULT,
  chainWindowBeats,
  isOnBeat,
} from "./chainRules";

export const CHAIN_RADIUS = 120;
/** Popup color for a Metronome on-beat kill. */
const ON_BEAT_COLOR = "#ffdd88";

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

/**
 * Kill chains. The chain and grace timers are in beats of conductor time: they count down by
 * gameDt × bpm / 60, so they dilate with time like the music.
 */
export class ChainSystem {
  /** Beats left before the chain breaks. */
  chainTimer = 0;
  chainCount = 0;
  chainTier = 0;
  bestChain = 0;
  lastKillX = 0;
  lastKillY = 0;
  /** Beats left in which a kill resumes a broken chain one tier lower. */
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
        .text(0, 0, "", { fontFamily: "monospace", fontSize: `${px(16)}px`, color: "#ffffff" })
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
    const effectiveRadius = CHAIN_RADIUS + s.stats.chainRadius;
    const effectiveWindow = this.windowBeats();
    // Metronome relic: a kill within ±1/8 beat of a beat counts one extra and scores ×1.5.
    const onBeat = s.relics.hasRelic("metronome") && isOnBeat(s.conductor.beat);

    const prevTier = this.chainTier;

    if (this.chainTimer > 0 && dist < effectiveRadius) {
      this.chainCount++;
    } else if (this.graceTimer > 0 && dist < effectiveRadius) {
      this.chainCount = CHAIN_TIERS[this.graceTier].min;
      this.graceTimer = 0;
    } else {
      this.chainCount = 1;
    }
    if (onBeat) this.chainCount += METRONOME_CHAIN_BONUS;

    if (this.chainCount > this.bestChain) this.bestChain = this.chainCount;
    this.chainTier = getChainTier(this.chainCount);
    const tier = CHAIN_TIERS[this.chainTier];

    const basePoints = isBoss ? 500 : 100;
    const points = Math.floor(basePoints * tier.mult * (onBeat ? METRONOME_SCORE_MULT : 1));
    s.addScore(points);
    if (onBeat) this.spawnPopup(x, y + px(18), "ON BEAT", ON_BEAT_COLOR);

    // The kill's sound comes from the enemyKilled event (CollisionSystem), which carries the chain state.
    if (this.chainTier > 0) {
      const chainText = s.hud.chainText;
      chainText.setText(`${tier.name} x${this.chainCount}`);
      chainText.setColor(tier.textColor);
      chainText.setAlpha(1);
      this.spawnPopup(x, y, `+${points}`, tier.textColor);

      if (this.chainTier > prevTier && tier.name) {
        this.spawnPopup(x, y - px(20), tier.name, tier.textColor, px(24));
        s.tweens.add({
          targets: chainText,
          scaleX: { from: 1.4, to: 1 },
          scaleY: { from: 1.4, to: 1 },
          duration: 200,
          ease: "Back.easeOut",
        });
      }

      const shakeIntensity = [0, 0.003, 0.005, 0.008, 0.012, 0.012][this.chainTier];
      const shakeDuration = [0, 80, 100, 120, 150, 150][this.chainTier];
      if (shakeIntensity > 0) shakeCamera(s.cameras.main, shakeDuration, shakeIntensity);
    }

    this.chainTimer = effectiveWindow;
    this.lastKillX = x;
    this.lastKillY = y;

    if (s.stats.weaponId !== "standard") {
      addWeaponKill(s.stats.weaponId);
    }

    s.progression.recordKill();
    addKill();

    const dropRate = (DROP_RATES[this.chainTier] ?? 0.12) + getLuckyStarBonus();
    if (Math.random() < dropRate) s.pickups.spawnDrop(x, y);

    s.progression.processAchievements(false, false);
  }

  /** The chain window in beats (base + Chain Sustain + Chain Link). */
  windowBeats(): number {
    return chainWindowBeats(this.scene.stats.chainWindow);
  }

  /** Per live frame: `delta` real ms and the time scale, i.e. delta × ts game ms of conductor time. */
  update(delta: number, ts: number) {
    const beats = this.scene.conductor.gameSecondsToBeats((delta / 1000) * ts);
    if (this.chainTimer > 0) {
      this.chainTimer -= beats;
      if (this.chainTimer <= 0) {
        const prevTier = this.chainTier;
        if (prevTier >= 2) {
          this.graceTimer = CHAIN_GRACE_BEATS;
          this.graceTier = prevTier - 1;
        }
        this.scene.gameEvents.emit("chainBreak", { tier: prevTier, x: this.lastKillX, y: this.lastKillY });
        if (prevTier >= 2) {
          const tier = CHAIN_TIERS[prevTier];
          this.scene.particles.burst(this.lastKillX, this.lastKillY, tier.color, 15, 60, 2);
        }
        this.chainCount = 0;
        this.chainTier = 0;
        this.scene.tweens.add({ targets: this.scene.hud.chainText, alpha: 0, duration: 300 });
      }
    }

    if (this.graceTimer > 0) {
      this.graceTimer -= beats;
    }

    this.updateArc(ts);
    this.updatePopups(delta, ts);
  }

  spawnPopup(x: number, y: number, text: string, color: string, size = px(16)) {
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
    const progress = Math.min(1, this.chainTimer / this.windowBeats());
    const arcAngle = progress * Math.PI * 2;
    let alpha = 0.6;
    if (ts < 0.1) alpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
    this.arcGraphics.lineStyle(2, tier.color, alpha);
    this.arcGraphics.beginPath();
    this.arcGraphics.arc(this.lastKillX, this.lastKillY, px(25), -Math.PI / 2, -Math.PI / 2 + arcAngle, false);
    this.arcGraphics.strokePath();
  }

  private updatePopups(delta: number, ts: number) {
    for (const p of this.scorePopups) {
      if (p.timer <= 0) continue;
      p.timer -= delta * Math.max(ts, 0.3);
      p.text.y -= px(40) * (delta / 600) * Math.max(ts, 0.3);
      p.text.setAlpha(Math.max(p.timer / 600, 0));
      if (p.timer <= 0) p.text.setAlpha(0);
    }
  }
}
