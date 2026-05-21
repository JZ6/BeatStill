import Phaser from "phaser";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";
import { createOptionsOverlay } from "../ui/OptionsOverlay";
import { createCollectionOverlay } from "../ui/CollectionOverlay";
import { createHowToOverlay } from "../ui/HowToOverlay";
import { createShopOverlay } from "../ui/ShopOverlay";
import { AudioManager } from "../systems/AudioManager";
import { theremin } from "../sounds";
import { options, saveOptions } from "../systems/GameOptions";
import { ALL_WEAPONS } from "../systems/Weapons";

interface EnemySilhouette {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  alpha: number;
  sides: number;
  rotation: number;
  rotSpeed: number;
}

interface BulletParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
}

interface PulseRing {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  maxRadius: number;
}

interface MenuButton {
  text: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  hovered: boolean;
  primary: boolean;
  action: () => void;
  baseColor: string;
}

export class StartScene extends Phaser.Scene {
  private optionsOverlay: HTMLDivElement | null = null;
  private collectionOverlay: HTMLDivElement | null = null;
  private howToOverlay: HTMLDivElement | null = null;
  private shopOverlay: HTMLDivElement | null = null;
  private audioManager: AudioManager | null = null;
  private audioStarted = false;

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private ekgGraphics!: Phaser.GameObjects.Graphics;
  private btnGraphics!: Phaser.GameObjects.Graphics;

  private enemies: EnemySilhouette[] = [];
  private bullets: BulletParticle[] = [];
  private pulseRings: PulseRing[] = [];

  private titleText!: Phaser.GameObjects.Text;
  private titleGlow!: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private titleBaseY = 0;
  private titleDriftAngle = 0;
  private timeScale = 0.1;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private ekgPoints: number[] = [];
  private ekgTimer = 0;
  private ekgAccum = 0;
  private ekgBeatInterval = 2000;
  private ekgPhase = 0;

  private heartbeatTimer = 0;
  private titlePulse = 0;

  private menuButtons: MenuButton[] = [];
  private secondaryTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("StartScene");
  }

  create() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.bgGraphics = this.add.graphics().setDepth(-1);
    this.fxGraphics = this.add.graphics().setDepth(0);
    this.ekgGraphics = this.add.graphics().setDepth(1);
    this.btnGraphics = this.add.graphics().setDepth(2);

    this.initEnemies();
    this.initBullets();
    this.initEkg();

    const titleY = cy - px(120);
    this.titleBaseY = titleY;
    this.titleDriftAngle = 0;
    this.timeScale = 0.1;
    this.lastPointerX = cx;
    this.lastPointerY = cy;
    this.heartbeatTimer = 0;
    this.titlePulse = 0;

    this.titleGlow = this.add
      .text(cx, titleY, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: `${px(80)}px`,
        color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setAlpha(0.12)
      .setDepth(3);

    this.titleText = this.add
      .text(cx, titleY, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: `${px(80)}px`,
        color: "#e8d5b0",
      })
      .setOrigin(0.5)
      .setDepth(4);

    this.taglineText = this.add
      .text(cx, titleY + px(52), "TIME  BENDS  TO  YOUR  WILL", {
        fontFamily: "monospace",
        fontSize: `${px(14)}px`,
        color: "#665544",
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setAlpha(0);

    this.tweens.add({
      targets: this.taglineText,
      alpha: 0.9,
      duration: 1500,
      delay: 800,
      ease: "Power2",
    });

    this.createMenuButtons();

    this.hintText = this.add
      .text(cx, GAME_H - px(30), "— move to flow time —", {
        fontFamily: "monospace",
        fontSize: `${px(11)}px`,
        color: "#332b22",
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setAlpha(0);

    this.tweens.add({
      targets: this.hintText,
      alpha: 1,
      duration: 2000,
      delay: 2500,
    });

    this.input.once("pointerdown", () => this.ensureAudio());

    this.events.once("shutdown", () => {
      this.optionsOverlay?.remove();
      this.optionsOverlay = null;
      this.collectionOverlay?.remove();
      this.collectionOverlay = null;
      this.howToOverlay?.remove();
      this.howToOverlay = null;
      this.shopOverlay?.remove();
      this.shopOverlay = null;
      this.audioManager?.dispose();
      this.audioManager = null;
      this.audioStarted = false;
    });
  }

  private createMenuButtons() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const btnW = px(180);
    const btnH = px(50);
    const gap = px(20);
    const primaryY = cy + px(20);

    const primaries = [
      { label: "CAMPAIGN", action: () => this.startCampaign() },
      { label: "ENDLESS", action: () => this.startGame() },
    ];

    for (let i = 0; i < primaries.length; i++) {
      const item = primaries[i];
      const bx = cx + (i === 0 ? -(btnW + gap / 2) : gap / 2);
      const by = primaryY;

      const bg = this.add.graphics().setDepth(5);
      const text = this.add
        .text(bx + btnW / 2, by + btnH / 2, item.label, {
          fontFamily: "monospace",
          fontSize: `${px(22)}px`,
          color: "#ffaa44",
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setAlpha(0);

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 500,
        delay: 400 + i * 150,
        ease: "Power2",
      });

      this.menuButtons.push({
        text,
        bg,
        x: bx,
        y: by,
        w: btnW,
        h: btnH,
        hovered: false,
        primary: true,
        action: item.action,
        baseColor: "#ffaa44",
      });
    }

    const weaponY = primaryY + btnH + px(32);
    const baseWeapons = ALL_WEAPONS.filter((w) => !w.isEvolution);
    const weaponLabel = this.add
      .text(cx, weaponY, "WEAPON", {
        fontFamily: "monospace",
        fontSize: `${px(10)}px`,
        color: "#443322",
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0);

    this.tweens.add({ targets: weaponLabel, alpha: 0.8, duration: 400, delay: 600 });

    const weaponBtnY = weaponY + px(16);
    const weaponTexts: Phaser.GameObjects.Text[] = [];

    for (const weapon of baseWeapons) {
      const selected = options.starterWeapon === weapon.id;
      const t = this.add
        .text(0, weaponBtnY, weapon.icon, {
          fontFamily: "monospace",
          fontSize: `${px(14)}px`,
          color: selected ? "#ffaa44" : "#554444",
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setAlpha(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (!this.hasOverlay()) t.setColor("#ffcc88");
        })
        .on("pointerout", () => {
          t.setColor(options.starterWeapon === weapon.id ? "#ffaa44" : "#554444");
        })
        .on("pointerdown", () => {
          if (this.hasOverlay()) return;
          options.starterWeapon = weapon.id;
          saveOptions(options);
          for (const wt of weaponTexts) {
            const wid = baseWeapons[weaponTexts.indexOf(wt)]?.id;
            wt.setColor(wid === weapon.id ? "#ffaa44" : "#554444");
          }
        });
      weaponTexts.push(t);
    }

    const wSpacing = px(24);
    let wTotalW = 0;
    for (let i = 0; i < weaponTexts.length; i++) {
      wTotalW += weaponTexts[i].width;
      if (i < weaponTexts.length - 1) wTotalW += wSpacing;
    }
    let wCurX = cx - wTotalW / 2;
    for (let i = 0; i < weaponTexts.length; i++) {
      const t = weaponTexts[i];
      t.setX(wCurX + t.width / 2);
      wCurX += t.width + wSpacing;
      this.tweens.add({ targets: t, alpha: 1, duration: 400, delay: 600 + i * 60 });
    }

    const secondaryItems = [
      { label: "HOW TO PLAY", action: () => this.showHowToOverlay() },
      { label: "COLLECTION", action: () => this.showCollectionOverlay() },
      { label: "SHOP", action: () => this.showShopOverlay() },
      { label: "DESIGNER", action: () => this.scene.start("LevelDesignerScene") },
      { label: "OPTIONS", action: () => this.showOptionsOverlay() },
    ];

    const secY = primaryY + btnH + px(72);
    const secSpacing = px(16);
    const secTexts: Phaser.GameObjects.Text[] = [];

    for (const item of secondaryItems) {
      const t = this.add
        .text(0, secY, item.label, {
          fontFamily: "monospace",
          fontSize: `${px(13)}px`,
          color: "#554444",
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setAlpha(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (!this.hasOverlay()) t.setColor("#ffaa44");
        })
        .on("pointerout", () => t.setColor("#554444"))
        .on("pointerdown", () => {
          if (!this.hasOverlay()) {
            this.ensureAudio();
            item.action();
          }
        });
      secTexts.push(t);
    }

    let totalW = 0;
    for (let i = 0; i < secTexts.length; i++) {
      totalW += secTexts[i].width;
      if (i < secTexts.length - 1) totalW += secSpacing;
    }

    let curX = cx - totalW / 2;
    for (let i = 0; i < secTexts.length; i++) {
      const t = secTexts[i];
      t.setX(curX + t.width / 2);
      t.setOrigin(0.5);
      curX += t.width + secSpacing;

      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: 400,
        delay: 700 + i * 80,
        ease: "Power2",
      });
    }

    this.secondaryTexts = secTexts;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.hasOverlay()) return;
      this.ensureAudio();
      for (const btn of this.menuButtons) {
        if (
          pointer.x >= btn.x && pointer.x <= btn.x + btn.w &&
          pointer.y >= btn.y && pointer.y <= btn.y + btn.h
        ) {
          btn.action();
          return;
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      for (const btn of this.menuButtons) {
        btn.hovered =
          pointer.x >= btn.x && pointer.x <= btn.x + btn.w &&
          pointer.y >= btn.y && pointer.y <= btn.y + btn.h;
      }
    });
  }

  update(_time: number, delta: number) {
    if (!this.scene.isActive()) return;
    const pointer = this.input.activePointer;
    const dx = pointer.x - this.lastPointerX;
    const dy = pointer.y - this.lastPointerY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;

    const targetScale = Math.min(speed / 8, 1);
    this.timeScale += (targetScale - this.timeScale) * 0.08;
    const ts = Math.max(this.timeScale, 0.05);

    this.updateHeartbeat(delta);
    this.updateEkg(delta, ts);
    this.updateTitleDrift(delta, ts);
    this.updateEnemiesAndBullets(delta, ts);
    this.updatePulseRings(delta);

    this.drawBackground(ts);
    this.drawEkg();
    this.drawFx();
    this.drawButtons();
  }

  // ── Heartbeat System ─────────────────────────────────────────

  private updateHeartbeat(delta: number) {
    this.heartbeatTimer += delta;
    if (this.heartbeatTimer >= this.ekgBeatInterval) {
      this.heartbeatTimer -= this.ekgBeatInterval;
      this.triggerHeartbeat();
    }

    this.titlePulse *= 0.92;
  }

  private triggerHeartbeat() {
    this.titlePulse = 1;
    this.ekgPhase = 1;

    this.pulseRings.push({
      x: GAME_W / 2,
      y: this.titleBaseY,
      radius: px(40),
      alpha: 0.3,
      maxRadius: px(250),
    });

    this.tweens.add({
      targets: this.titleGlow,
      alpha: { from: 0.35, to: 0.1 },
      duration: 600,
      ease: "Power2",
    });
  }

  // ── EKG Line ─────────────────────────────────────────────────

  private initEkg() {
    const count = 300;
    this.ekgPoints = new Array(count).fill(0);
    this.ekgTimer = 0;
    this.ekgAccum = 0;
    this.ekgPhase = 0;
  }

  private updateEkg(delta: number, ts: number) {
    this.ekgTimer += delta * (0.3 + ts * 0.7);

    this.ekgAccum += delta * 0.06;
    while (this.ekgAccum >= 1) {
      this.ekgAccum -= 1;
      this.ekgPoints.shift();
      this.ekgPoints.push(this.getEkgValue());
    }
  }

  private getEkgValue(): number {
    if (this.ekgPhase > 0) {
      const p = this.ekgPhase;
      this.ekgPhase += 0.12;
      if (this.ekgPhase > 8) {
        this.ekgPhase = 0;
        return 0;
      }
      if (p < 1) return -px(8) * p;
      if (p < 2) return px(40) * (2 - p) - px(8);
      if (p < 3) return -px(20) * (3 - p);
      if (p < 4.5) return px(12) * Math.sin((p - 3) * Math.PI / 1.5);
      return 0;
    }
    return Math.sin(this.ekgTimer * 0.002) * px(1.5);
  }

  private drawEkg() {
    const g = this.ekgGraphics;
    g.clear();

    const baseY = GAME_H * 0.72;
    const startX = -20;
    const step = (GAME_W + 40) / this.ekgPoints.length;

    for (let i = 1; i < this.ekgPoints.length; i++) {
      const progress = i / this.ekgPoints.length;
      const alpha = progress * 0.6;
      const x1 = startX + (i - 1) * step;
      const x2 = startX + i * step;
      const y1 = baseY + this.ekgPoints[i - 1];
      const y2 = baseY + this.ekgPoints[i];

      g.lineStyle(px(2), 0xffaa44, alpha);
      g.lineBetween(x1, y1, x2, y2);

      if (Math.abs(this.ekgPoints[i]) > px(10)) {
        g.lineStyle(px(4), 0xffaa44, alpha * 0.3);
        g.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  // ── Title ────────────────────────────────────────────────────

  private updateTitleDrift(delta: number, ts: number) {
    this.titleDriftAngle += delta * 0.0008 * ts;
    const driftY = Math.sin(this.titleDriftAngle) * 5;
    const driftX = Math.cos(this.titleDriftAngle * 0.7) * 3;

    const scale = 1 + this.titlePulse * 0.04;
    this.titleText.setPosition(GAME_W / 2 + driftX, this.titleBaseY + driftY);
    this.titleText.setScale(scale);
    this.titleGlow.setPosition(GAME_W / 2 + driftX, this.titleBaseY + driftY);
    this.titleGlow.setScale(scale * 1.02);
    this.taglineText.setPosition(GAME_W / 2 + driftX * 0.5, this.titleBaseY + px(52) + driftY * 0.5);
  }

  // ── Enemy Silhouettes ─────────────────────────────────────────

  private static readonly ENEMY_DEFS = [
    { color: 0x44ff44, sides: 0, radius: 16 },
    { color: 0xff8800, sides: 4, radius: 14 },
    { color: 0xff2266, sides: 5, radius: 12 },
    { color: 0xaa44ff, sides: 7, radius: 18 },
    { color: 0xff4444, sides: 8, radius: 22 },
    { color: 0xffff44, sides: 3, radius: 10 },
    { color: 0x44ddff, sides: 2, radius: 14 },
    { color: 0x44ff88, sides: 6, radius: 16 },
    { color: 0xffaa22, sides: 12, radius: 28 },
    { color: 0x4488ff, sides: 4, radius: 24 },
  ];

  private initEnemies() {
    const defs = StartScene.ENEMY_DEFS;
    for (let i = 0; i < 25; i++) {
      const def = defs[i % defs.length];
      const scale = 0.8 + Math.random() * 0.6;
      this.enemies.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 40,
        radius: px(def.radius * scale),
        color: def.color,
        alpha: 0.06 + Math.random() * 0.12,
        sides: def.sides,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.5,
      });
    }
  }

  private initBullets() {
    const colors = [0xff6644, 0xff4444, 0xffaa44, 0xaa44ff, 0x44ffff];
    for (let i = 0; i < 30; i++) {
      this.bullets.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        vx: (Math.random() * 80 + 30) * (Math.random() > 0.5 ? 1 : -1),
        vy: (Math.random() - 0.5) * 40,
        size: px(3) + Math.random() * px(3),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.1 + Math.random() * 0.2,
      });
    }
  }

  private updateEnemiesAndBullets(delta: number, ts: number) {
    const dt = (delta / 1000) * Math.max(ts, 0.15);
    for (const e of this.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rotation += e.rotSpeed * dt;
      if (e.x < -50) e.x = GAME_W + 50;
      if (e.x > GAME_W + 50) e.x = -50;
      if (e.y < -50) e.y = GAME_H + 50;
      if (e.y > GAME_H + 50) e.y = -50;
    }
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20) b.x = GAME_W + 20;
      if (b.x > GAME_W + 20) b.x = -20;
      if (b.y < -20) b.y = GAME_H + 20;
      if (b.y > GAME_H + 20) b.y = -20;
    }
  }

  // ── Pulse Rings ──────────────────────────────────────────────

  private updatePulseRings(delta: number) {
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const r = this.pulseRings[i];
      r.radius += delta * 0.15;
      r.alpha *= 0.985;
      if (r.alpha < 0.01 || r.radius > r.maxRadius) {
        this.pulseRings.splice(i, 1);
      }
    }
  }

  // ── Drawing ──────────────────────────────────────────────────

  private drawBackground(ts: number) {
    const g = this.bgGraphics;
    g.clear();

    g.fillStyle(0x080604, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    const cx = GAME_W / 2;
    const cy = GAME_H * 0.4;
    const maxR = Math.max(GAME_W, GAME_H) * 0.8;
    const steps = 12;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const r = maxR * t;
      const brightness = Math.floor(14 - t * 10);
      const color = (brightness << 16) | (brightness << 8) | Math.floor(brightness * 0.7);
      g.fillStyle(color, 0.4);
      g.fillCircle(cx, cy, r);
    }

    const gridAlpha = 0.05 + ts * 0.15;
    g.lineStyle(1, 0x1a1612, gridAlpha);
    for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);

    for (const e of this.enemies) {
      if (e.sides === 0) {
        g.lineStyle(1.5, e.color, e.alpha);
        g.strokeCircle(e.x, e.y, e.radius);
        g.fillStyle(e.color, e.alpha * 0.3);
        g.fillCircle(e.x, e.y, e.radius);
      } else {
        const n = e.sides;
        const r = e.radius;
        g.lineStyle(1.5, e.color, e.alpha);
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = e.rotation + (i * Math.PI * 2) / n;
          const ex = e.x + Math.cos(a) * r;
          const ey = e.y + Math.sin(a) * r;
          if (i === 0) g.moveTo(ex, ey);
          else g.lineTo(ex, ey);
        }
        g.closePath();
        g.strokePath();
        g.fillStyle(e.color, e.alpha * 0.2);
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = e.rotation + (i * Math.PI * 2) / n;
          const ex = e.x + Math.cos(a) * r;
          const ey = e.y + Math.sin(a) * r;
          if (i === 0) g.moveTo(ex, ey);
          else g.lineTo(ex, ey);
        }
        g.closePath();
        g.fillPath();
      }
    }

    for (const b of this.bullets) {
      g.fillStyle(b.color, b.alpha);
      g.fillCircle(b.x, b.y, b.size);
      const a = Math.atan2(b.vy, b.vx);
      g.lineStyle(1, b.color, b.alpha * 0.4);
      g.lineBetween(b.x - Math.cos(a) * b.size * 3, b.y - Math.sin(a) * b.size * 3, b.x, b.y);
    }

    const vignetteSteps = 8;
    for (let i = 0; i < vignetteSteps; i++) {
      const t = i / vignetteSteps;
      const inset = t * px(80);
      g.lineStyle(px(12), 0x000000, (1 - t) * 0.4);
      g.strokeRect(inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
    }
  }

  private drawFx() {
    const g = this.fxGraphics;
    g.clear();

    for (const ring of this.pulseRings) {
      g.lineStyle(px(2), 0xffaa44, ring.alpha);
      g.strokeCircle(ring.x, ring.y, ring.radius);
      g.lineStyle(px(1), 0xffaa44, ring.alpha * 0.4);
      g.strokeCircle(ring.x, ring.y, ring.radius * 0.95);
    }

    if (this.titlePulse > 0.1) {
      const glowR = px(100) + this.titlePulse * px(60);
      const glowAlpha = this.titlePulse * 0.08;
      g.fillStyle(0xffaa44, glowAlpha);
      g.fillCircle(GAME_W / 2, this.titleBaseY, glowR);
    }
  }

  private drawButtons() {
    const g = this.btnGraphics;
    g.clear();

    for (const btn of this.menuButtons) {
      const hover = btn.hovered && !this.hasOverlay();
      const borderColor = hover ? 0xffcc88 : 0x665533;
      const fillAlpha = hover ? 0.08 : 0.03;

      g.fillStyle(0xffaa44, fillAlpha);
      g.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);

      g.lineStyle(hover ? 2 : 1, borderColor, hover ? 0.9 : 0.5);
      g.strokeRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);

      if (hover) {
        g.lineStyle(1, 0xffaa44, 0.15);
        g.strokeRoundedRect(btn.x - 2, btn.y - 2, btn.w + 4, btn.h + 4, 6);
      }

      if (btn.text.scene) btn.text.setColor(hover ? "#ffcc88" : "#ffaa44");
    }

    if (this.menuButtons.length > 0) {
      const btn0 = this.menuButtons[0];
      const sepY = btn0.y + btn0.h + px(18);
      const sepW = px(80);
      g.lineStyle(1, 0x332b22, 0.5);
      g.lineBetween(GAME_W / 2 - sepW, sepY, GAME_W / 2 + sepW, sepY);
      g.fillStyle(0xffaa44, 0.4);
      g.fillCircle(GAME_W / 2, sepY, 2);
    }
  }

  // ── Overlay Management ───────────────────────────────────────

  private hasOverlay(): boolean {
    return !!(this.optionsOverlay || this.collectionOverlay || this.howToOverlay || this.shopOverlay);
  }

  private ensureAudio() {
    if (this.audioStarted) return;
    this.audioStarted = true;
    this.audioManager = new AudioManager();
    this.audioManager.start().then(() => {
      if (!this.audioManager) return;
      this.audioManager.loadTheme(theremin);
      this.audioManager.setVolume((options.masterVolume / 100) * 0.5);
    }).catch(() => {
      this.audioStarted = false;
    });
  }

  private startGame() {
    this.scene.start("GameScene");
  }

  private startCampaign() {
    this.scene.start("LevelSelectScene");
  }

  private showOptionsOverlay() {
    if (this.optionsOverlay) return;
    const overlay = createOptionsOverlay(() => {
      overlay.remove();
      this.optionsOverlay = null;
    });
    this.optionsOverlay = overlay;
    document.body.appendChild(overlay);
  }

  private showHowToOverlay() {
    if (this.howToOverlay) return;
    const overlay = createHowToOverlay(() => {
      this.howToOverlay = null;
    });
    this.howToOverlay = overlay;
    document.body.appendChild(overlay);
  }

  private showCollectionOverlay() {
    if (this.collectionOverlay) return;
    const overlay = createCollectionOverlay(() => {
      overlay.remove();
      this.collectionOverlay = null;
    });
    this.collectionOverlay = overlay;
    document.body.appendChild(overlay);
  }

  private showShopOverlay() {
    if (this.shopOverlay) return;
    const overlay = createShopOverlay(() => {
      this.shopOverlay = null;
    });
    this.shopOverlay = overlay;
    document.body.appendChild(overlay);
  }
}
