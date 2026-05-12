import Phaser from "phaser";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { ALL_LEVELS, isLevelUnlocked, isLevelCompleted } from "../systems/Levels";

const COLS = 4;
const CARD_W = 140;
const CARD_H = 100;
const GAP = 16;

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super("LevelSelectScene");
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0806, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);
    bg.setDepth(-1);

    this.add
      .text(GAME_W / 2, 50, "CAMPAIGN", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#e8d5b0",
      })
      .setOrigin(0.5);

    const totalW = COLS * CARD_W + (COLS - 1) * GAP;
    const rows = Math.ceil(ALL_LEVELS.length / COLS);
    const totalH = rows * CARD_H + (rows - 1) * GAP;
    const startX = (GAME_W - totalW) / 2;
    const startY = (GAME_H - totalH) / 2;

    for (let i = 0; i < ALL_LEVELS.length; i++) {
      const level = ALL_LEVELS[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = startY + row * (CARD_H + GAP);

      const unlocked = isLevelUnlocked(level.id);
      const completed = isLevelCompleted(level.id);

      const card = this.add.graphics();
      card.fillStyle(unlocked ? 0x111111 : 0x0a0a0a, 1);
      card.lineStyle(2, completed ? 0xffaa44 : unlocked ? 0x444444 : 0x222222, 1);
      card.fillRect(x, y, CARD_W, CARD_H);
      card.strokeRect(x, y, CARD_W, CARD_H);

      const cx = x + CARD_W / 2;

      this.add
        .text(cx, y + 18, `${level.id}`, {
          fontFamily: "monospace",
          fontSize: "24px",
          color: unlocked ? (completed ? "#ffaa44" : "#e8d5b0") : "#333",
        })
        .setOrigin(0.5);

      this.add
        .text(cx, y + 48, level.name, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: unlocked ? "#998877" : "#333",
        })
        .setOrigin(0.5);

      if (completed) {
        this.add
          .text(cx, y + 72, "✓", {
            fontFamily: "monospace",
            fontSize: "18px",
            color: "#ffaa44",
          })
          .setOrigin(0.5);
      } else if (!unlocked) {
        this.add
          .text(cx, y + 72, "🔒", {
            fontSize: "16px",
          })
          .setOrigin(0.5);
      }

      if (unlocked) {
        const hitZone = this.add
          .zone(cx, y + CARD_H / 2, CARD_W, CARD_H)
          .setInteractive({ useHandCursor: true })
          .on("pointerover", () => {
            card.clear();
            card.fillStyle(0x1a1510, 1);
            card.lineStyle(2, 0xffaa44, 1);
            card.fillRect(x, y, CARD_W, CARD_H);
            card.strokeRect(x, y, CARD_W, CARD_H);
          })
          .on("pointerout", () => {
            card.clear();
            card.fillStyle(0x111111, 1);
            card.lineStyle(2, completed ? 0xffaa44 : 0x444444, 1);
            card.fillRect(x, y, CARD_W, CARD_H);
            card.strokeRect(x, y, CARD_W, CARD_H);
          })
          .on("pointerdown", () => {
            this.scene.start("GameScene", { mode: "level", levelDef: level });
          });
      }
    }

    const backBtn = this.add
      .text(GAME_W / 2, GAME_H - 50, "BACK", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#887766",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => backBtn.setColor("#e8d5b0"))
      .on("pointerout", () => backBtn.setColor("#887766"))
      .on("pointerdown", () => this.scene.start("StartScene"));
  }
}
