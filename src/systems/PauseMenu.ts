import Phaser from "phaser";
import { GAME_W, GAME_H, px } from "./GameConfig";
import { createOptionsOverlay } from "../ui/OptionsOverlay";

export class PauseMenu {
  isActive = false;
  private confirmVisible = false;

  private overlay!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private resumeBtn!: Phaser.GameObjects.Text;
  private optionsBtn!: Phaser.GameObjects.Text;
  private menuBtn!: Phaser.GameObjects.Text;

  private confirmOverlay!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;
  private confirmYes!: Phaser.GameObjects.Text;
  private confirmNo!: Phaser.GameObjects.Text;

  private optionsOverlay: HTMLDivElement | null = null;

  constructor(private scene: Phaser.Scene, private onQuit: () => void) {}

  create() {
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x0a0806, 0.8);
    this.overlay.fillRect(0, 0, GAME_W, GAME_H);
    this.overlay.setDepth(200);
    this.overlay.setVisible(false);

    this.text = this.scene.add
      .text(GAME_W / 2, GAME_H / 2 - px(60), "PAUSED", {
        fontFamily: "monospace", fontSize: `${px(64)}px`, color: "#e8d5b0", align: "center",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false);

    this.resumeBtn = this.scene.add
      .text(GAME_W / 2, GAME_H / 2 + px(20), "RESUME", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.resumeBtn.setColor("#ffcc88"))
      .on("pointerout", () => this.resumeBtn.setColor("#ffaa44"))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.toggle();
      });

    this.optionsBtn = this.scene.add
      .text(GAME_W / 2, GAME_H / 2 + px(60), "OPTIONS", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.optionsBtn.setColor("#e8d5b0"))
      .on("pointerout", () => this.optionsBtn.setColor("#887766"))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.showOptions();
      });

    this.menuBtn = this.scene.add
      .text(GAME_W / 2, GAME_H / 2 + px(100), "MAIN MENU", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.menuBtn.setColor("#e8d5b0"))
      .on("pointerout", () => this.menuBtn.setColor("#887766"))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.showConfirm();
      });

    this.createConfirmDialog();
  }

  toggle() {
    if (this.optionsOverlay) {
      this.optionsOverlay.remove();
      this.optionsOverlay = null;
      return;
    }
    if (this.confirmVisible) {
      this.hideConfirm();
      return;
    }
    this.isActive = !this.isActive;
    this.overlay.setVisible(this.isActive);
    this.text.setVisible(this.isActive);
    this.resumeBtn.setVisible(this.isActive);
    this.optionsBtn.setVisible(this.isActive);
    this.menuBtn.setVisible(this.isActive);
  }

  cleanup() {
    this.optionsOverlay?.remove();
    this.optionsOverlay = null;
  }

  private showOptions() {
    if (this.optionsOverlay) return;
    const overlay = createOptionsOverlay(() => {
      overlay.remove();
      this.optionsOverlay = null;
    });
    this.optionsOverlay = overlay;
    document.body.appendChild(overlay);
  }

  private showConfirm() {
    this.confirmVisible = true;
    this.confirmOverlay.setVisible(true);
    this.confirmText.setVisible(true);
    this.confirmYes.setVisible(true);
    this.confirmNo.setVisible(true);
  }

  private hideConfirm() {
    this.confirmVisible = false;
    this.confirmOverlay.setVisible(false);
    this.confirmText.setVisible(false);
    this.confirmYes.setVisible(false);
    this.confirmNo.setVisible(false);
  }

  private createConfirmDialog() {
    this.confirmOverlay = this.scene.add.graphics();
    this.confirmOverlay.fillStyle(0x000000, 0.7);
    this.confirmOverlay.fillRect(0, 0, GAME_W, GAME_H);
    this.confirmOverlay.setDepth(300);
    this.confirmOverlay.setVisible(false);
    this.confirmOverlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_W, GAME_H),
      Phaser.Geom.Rectangle.Contains,
    );

    this.confirmText = this.scene.add
      .text(GAME_W / 2, GAME_H / 2 - px(30), "QUIT TO MENU?\nProgress will be lost.", {
        fontFamily: "monospace", fontSize: `${px(20)}px`, color: "#e8d5b0", align: "center",
      })
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false);

    this.confirmYes = this.scene.add
      .text(GAME_W / 2 - px(60), GAME_H / 2 + px(30), "YES", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#ff6644",
      })
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.confirmYes.setColor("#ff9977"))
      .on("pointerout", () => this.confirmYes.setColor("#ff6644"))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.onQuit();
      });

    this.confirmNo = this.scene.add
      .text(GAME_W / 2 + px(60), GAME_H / 2 + px(30), "NO", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#ffaa44",
      })
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.confirmNo.setColor("#ffcc88"))
      .on("pointerout", () => this.confirmNo.setColor("#ffaa44"))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.hideConfirm();
      });
  }
}
