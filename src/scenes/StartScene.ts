import Phaser from "phaser";
import { GAME_W, GAME_H, isMobile } from "../systems/GameConfig";
import { createOptionsOverlay } from "../ui/OptionsOverlay";
import { createCollectionOverlay } from "../ui/CollectionOverlay";
import { createHowToOverlay } from "../ui/HowToOverlay";
import { createShopOverlay } from "../ui/ShopOverlay";
import { AudioManager } from "../systems/AudioManager";
import { theremin } from "../sounds";
import { options } from "../systems/GameOptions";

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
  shape: "diamond" | "dot" | "ring" | "line";
  angle: number;
}

export class StartScene extends Phaser.Scene {
  private optionsOverlay: HTMLDivElement | null = null;
  private collectionOverlay: HTMLDivElement | null = null;
  private howToOverlay: HTMLDivElement | null = null;
  private shopOverlay: HTMLDivElement | null = null;
  private audioManager: AudioManager | null = null;
  private audioStarted = false;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private particles: FloatingParticle[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private titleGlow!: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private separatorGraphics!: Phaser.GameObjects.Graphics;
  private titleBaseY = 0;
  private titleDriftAngle = 0;
  private timeScale = 0.1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private elapsedTime = 0;

  constructor() {
    super("StartScene");
  }

  create() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);

    this.separatorGraphics = this.add.graphics();
    this.separatorGraphics.setDepth(2);

    this.initParticles();

    const titleY = cy - 110;
    this.titleBaseY = titleY;
    this.titleDriftAngle = 0;
    this.timeScale = 0.1;
    this.lastPointerX = cx;
    this.lastPointerY = cy;
    this.elapsedTime = 0;

    this.titleGlow = this.add
      .text(cx, titleY, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setAlpha(0.15)
      .setDepth(0);

    this.titleText = this.add
      .text(cx, titleY, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#e8d5b0",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.tweens.add({
      targets: this.titleGlow,
      alpha: { from: 0.08, to: 0.25 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.taglineText = this.add
      .text(cx, titleY + 48, "TIME BENDS TO YOUR WILL", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#554433",
        letterSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(1)
      .setAlpha(0);

    this.tweens.add({
      targets: this.taglineText,
      alpha: 0.8,
      duration: 1200,
      delay: 600,
      ease: "Power2",
    });

    const menuItems = [
      { label: "CAMPAIGN", action: () => this.startCampaign(), primary: true },
      { label: "ENDLESS", action: () => this.startGame(), primary: true },
      { label: "HOW TO PLAY", action: () => this.showHowToOverlay(), primary: false },
      { label: "COLLECTION", action: () => this.showCollectionOverlay(), primary: false },
      { label: "SHOP", action: () => this.showShopOverlay(), primary: false },
      { label: "OPTIONS", action: () => this.showOptionsOverlay(), primary: false },
    ];

    const startY = cy + 20;
    const spacing = 36;

    const buttons: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const baseColor = item.primary ? "#887766" : "#554444";
      const hoverColor = "#ffaa44";
      const btn = this.add
        .text(cx, startY + i * spacing, item.label, {
          fontFamily: "monospace",
          fontSize: item.primary ? "22px" : "16px",
          color: baseColor,
        })
        .setOrigin(0.5)
        .setDepth(3)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (!this.hasOverlay()) btn.setColor(hoverColor);
        })
        .on("pointerout", () => btn.setColor(baseColor))
        .on("pointerdown", () => {
          if (!this.hasOverlay()) {
            this.ensureAudio();
            item.action();
          }
        });
      buttons.push(btn);
    }

    buttons[0].setColor("#ffaa44");

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      btn.setAlpha(0);
      this.tweens.add({
        targets: btn,
        alpha: 1,
        duration: 400,
        delay: 400 + i * 100,
        ease: "Power2",
      });
    }

    this.hintText = this.add
      .text(cx, GAME_H - 40, "— move mouse to flow time —", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#333",
      })
      .setOrigin(0.5)
      .setDepth(1)
      .setAlpha(0);

    this.tweens.add({
      targets: this.hintText,
      alpha: 1,
      duration: 2000,
      delay: 2000,
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

  update(_time: number, delta: number) {
    this.elapsedTime += delta;

    const pointer = this.input.activePointer;
    const dx = pointer.x - this.lastPointerX;
    const dy = pointer.y - this.lastPointerY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;

    const targetScale = Math.min(speed / 8, 1);
    this.timeScale += (targetScale - this.timeScale) * 0.08;
    const ts = Math.max(this.timeScale, 0.05);

    this.titleDriftAngle += delta * 0.0008 * ts;
    const driftY = Math.sin(this.titleDriftAngle) * 6;
    const driftX = Math.cos(this.titleDriftAngle * 0.7) * 4;
    this.titleText.setPosition(GAME_W / 2 + driftX, this.titleBaseY + driftY);
    this.titleGlow.setPosition(GAME_W / 2 + driftX, this.titleBaseY + driftY);
    this.taglineText.setPosition(GAME_W / 2 + driftX * 0.5, this.titleBaseY + 48 + driftY * 0.5);

    this.updateParticles(delta, ts);
    this.drawBackground(ts);
  }

  private initParticles() {
    const colors = [0xffaa44, 0xff6644, 0xff44aa, 0xaa44ff, 0x44ffff, 0xe8d5b0];
    const shapes: FloatingParticle["shape"][] = ["diamond", "dot", "ring", "line"];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 15 - 8,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.08 + Math.random() * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateParticles(delta: number, ts: number) {
    const dt = (delta / 1000) * ts;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += dt * 0.5;
      if (p.x < -30) p.x = GAME_W + 30;
      if (p.x > GAME_W + 30) p.x = -30;
      if (p.y < -30) p.y = GAME_H + 30;
      if (p.y > GAME_H + 30) p.y = -30;
    }
  }

  private drawBackground(ts: number) {
    const g = this.bgGraphics;
    g.clear();

    g.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    const gridAlpha = 0.08 + ts * 0.12;
    g.lineStyle(1, 0x1a1612, gridAlpha);
    for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);

    for (const p of this.particles) {
      if (p.shape === "diamond") {
        g.fillStyle(p.color, p.alpha);
        g.fillTriangle(
          p.x, p.y - p.size,
          p.x + p.size * 0.6, p.y,
          p.x - p.size * 0.6, p.y,
        );
        g.fillTriangle(
          p.x, p.y + p.size,
          p.x + p.size * 0.6, p.y,
          p.x - p.size * 0.6, p.y,
        );
      } else if (p.shape === "dot") {
        g.fillStyle(p.color, p.alpha);
        g.fillCircle(p.x, p.y, p.size * 0.5);
      } else if (p.shape === "ring") {
        g.lineStyle(1, p.color, p.alpha);
        g.strokeCircle(p.x, p.y, p.size);
      } else {
        g.lineStyle(1, p.color, p.alpha * 0.6);
        const lx = Math.cos(p.angle) * p.size * 2;
        const ly = Math.sin(p.angle) * p.size * 2;
        g.lineBetween(p.x - lx, p.y - ly, p.x + lx, p.y + ly);
      }
    }

    const sep = this.separatorGraphics;
    sep.clear();
    const sepY = this.titleBaseY + 70;
    const sepW = 120;
    const sepAlpha = 0.2 + ts * 0.15;
    sep.lineStyle(1, 0xffaa44, sepAlpha);
    sep.lineBetween(GAME_W / 2 - sepW, sepY, GAME_W / 2 + sepW, sepY);
    sep.fillStyle(0xffaa44, sepAlpha + 0.1);
    sep.fillCircle(GAME_W / 2, sepY, 2);
  }

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
