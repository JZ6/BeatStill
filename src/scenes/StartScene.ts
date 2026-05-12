import Phaser from "phaser";
import { GAME_W, GAME_H, isMobile } from "../systems/GameConfig";
import { createOptionsOverlay } from "../ui/OptionsOverlay";
import { createCollectionOverlay } from "../ui/CollectionOverlay";
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
  shape: "diamond" | "dot" | "ring";
}

export class StartScene extends Phaser.Scene {
  private optionsOverlay: HTMLDivElement | null = null;
  private collectionOverlay: HTMLDivElement | null = null;
  private howToOverlay: HTMLDivElement | null = null;
  private audioManager: AudioManager | null = null;
  private audioStarted = false;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private particles: FloatingParticle[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private titleGlow!: Phaser.GameObjects.Text;

  constructor() {
    super("StartScene");
  }

  create() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);

    this.initParticles();

    this.titleGlow = this.add
      .text(cx, cy - 140, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setAlpha(0.15)
      .setDepth(0);

    this.titleText = this.add
      .text(cx, cy - 140, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#e8d5b0",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.tweens.add({
      targets: this.titleGlow,
      alpha: { from: 0.08, to: 0.25 },
      scaleX: { from: 1.0, to: 1.03 },
      scaleY: { from: 1.0, to: 1.03 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const menuItems = [
      { label: "CAMPAIGN", action: () => this.startCampaign() },
      { label: "ENDLESS", action: () => this.startGame() },
      { label: "HOW TO PLAY", action: () => this.showHowToOverlay() },
      { label: "COLLECTION", action: () => this.showCollectionOverlay() },
      { label: "OPTIONS", action: () => this.showOptionsOverlay() },
    ];

    const startY = cy + 10;
    const spacing = 40;

    const buttons: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const btn = this.add
        .text(cx, startY + i * spacing, item.label, {
          fontFamily: "monospace",
          fontSize: "22px",
          color: "#887766",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (!this.hasOverlay()) btn.setColor("#ffaa44");
        })
        .on("pointerout", () => btn.setColor("#887766"))
        .on("pointerdown", () => {
          if (!this.hasOverlay()) {
            this.ensureAudio();
            item.action();
          }
        });
      buttons.push(btn);
    }

    buttons[0].setColor("#ffaa44").setFontSize(24);

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      btn.setAlpha(0);
      this.tweens.add({
        targets: btn,
        alpha: 1,
        y: btn.y,
        duration: 400,
        delay: 200 + i * 80,
        ease: "Power2",
      });
    }

    this.input.once("pointerdown", () => this.ensureAudio());

    this.events.once("shutdown", () => {
      this.optionsOverlay?.remove();
      this.optionsOverlay = null;
      this.collectionOverlay?.remove();
      this.collectionOverlay = null;
      this.howToOverlay?.remove();
      this.howToOverlay = null;
      this.audioManager?.dispose();
      this.audioManager = null;
      this.audioStarted = false;
    });
  }

  update(_time: number, delta: number) {
    this.updateParticles(delta);
    this.drawBackground();
  }

  private initParticles() {
    const colors = [0xffaa44, 0xff6644, 0xff44aa, 0xaa44ff, 0x44ffff, 0xe8d5b0];
    const shapes: FloatingParticle["shape"][] = ["diamond", "dot", "ring"];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 15 - 5,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.1 + Math.random() * 0.25,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }
  }

  private updateParticles(delta: number) {
    const dt = delta / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -20) p.x = GAME_W + 20;
      if (p.x > GAME_W + 20) p.x = -20;
      if (p.y < -20) p.y = GAME_H + 20;
      if (p.y > GAME_H + 20) p.y = -20;
    }
  }

  private drawBackground() {
    const g = this.bgGraphics;
    g.clear();

    g.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    g.lineStyle(1, 0x1a1612, 0.15);
    for (let x = 0; x <= GAME_W; x += 64) g.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) g.lineBetween(0, y, GAME_W, y);

    for (const p of this.particles) {
      if (p.shape === "diamond") {
        g.fillStyle(p.color, p.alpha);
        g.fillPoint(p.x, p.y - p.size, 1);
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
      } else {
        g.lineStyle(1, p.color, p.alpha);
        g.strokeCircle(p.x, p.y, p.size);
      }
    }
  }

  private hasOverlay(): boolean {
    return !!(this.optionsOverlay || this.collectionOverlay || this.howToOverlay);
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
    const mobile = isMobile();

    const overlay = document.createElement("div");
    overlay.className = "options-overlay";

    const title = document.createElement("div");
    title.className = "options-title";
    title.textContent = "HOW TO PLAY";
    overlay.appendChild(title);

    const content = document.createElement("div");
    content.style.cssText = "font-family:monospace;font-size:15px;color:#998877;text-align:center;line-height:2.2;max-width:500px;";
    content.innerHTML = mobile
      ? [
          "Left stick — move",
          "Right stick — aim & shoot",
          "",
          "Move to speed up time",
          "Release to freeze time",
        ].join("<br>")
      : [
          "WASD — move",
          "Mouse — aim",
          "Click — shoot",
          "ESC — pause",
          "",
          "Move to speed up time",
          "Stop to freeze time",
        ].join("<br>");
    overlay.appendChild(content);

    const closeBtn = document.createElement("button");
    closeBtn.className = "options-close-btn";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.remove();
      this.howToOverlay = null;
    });
    overlay.appendChild(closeBtn);

    for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
      overlay.addEventListener(evt, (e) => e.stopPropagation());
    }

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
}
