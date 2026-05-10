import Phaser from "phaser";
import { GAME_W, GAME_H, isMobile } from "../systems/GameConfig";
import { createOptionsOverlay } from "../ui/OptionsOverlay";
import { createCollectionOverlay } from "../ui/CollectionOverlay";

export class StartScene extends Phaser.Scene {
  private optionsOverlay: HTMLDivElement | null = null;
  private collectionOverlay: HTMLDivElement | null = null;

  constructor() {
    super("StartScene");
  }

  create() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const mobile = isMobile();

    this.add
      .text(cx, cy - 140, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#e8d5b0",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 60, "bullet hell  x  time control  x  music", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#887766",
      })
      .setOrigin(0.5);

    const lines = mobile
      ? [
          "Left stick — move      Right stick — aim & shoot",
          "Move to speed up time  Release to freeze time",
        ]
      : [
          "WASD — move            Move to speed up time",
          "Mouse — aim            Stop to freeze time",
          "Click — shoot",
          "ESC — pause",
        ];

    this.add
      .text(cx, cy + 30, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#998877",
        align: "center",
        lineSpacing: 10,
        fixedWidth: 600,
      })
      .setOrigin(0.5);

    const endlessBtn = this.add
      .text(cx - 100, cy + 150, "▶  ENDLESS", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => endlessBtn.setColor("#ffcc88"))
      .on("pointerout", () => endlessBtn.setColor("#ffaa44"))
      .on("pointerdown", () => this.startGame());

    const levelsBtn = this.add
      .text(cx + 100, cy + 150, "▶  LEVELS", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => levelsBtn.setColor("#ffcc88"))
      .on("pointerout", () => levelsBtn.setColor("#ffaa44"))
      .on("pointerdown", () => {
        if (!this.optionsOverlay && !this.collectionOverlay) {
          this.scene.start("LevelSelectScene");
        }
      });

    this.tweens.add({
      targets: [endlessBtn, levelsBtn],
      alpha: 0.5,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // DOM buttons
    const colBtn = document.createElement("button");
    colBtn.id = "start-collection-btn";
    colBtn.textContent = "COLLECTION";
    document.body.appendChild(colBtn);

    colBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showCollectionOverlay();
    });

    const optBtn = document.createElement("button");
    optBtn.id = "start-options-btn";
    optBtn.textContent = "OPTIONS";
    document.body.appendChild(optBtn);

    optBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showOptionsOverlay();
    });

    this.events.once("shutdown", () => {
      colBtn.remove();
      optBtn.remove();
      this.optionsOverlay?.remove();
      this.optionsOverlay = null;
      this.collectionOverlay?.remove();
      this.collectionOverlay = null;
    });
  }

  private startGame() {
    if (this.optionsOverlay || this.collectionOverlay) return;
    this.scene.start("GameScene");
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
