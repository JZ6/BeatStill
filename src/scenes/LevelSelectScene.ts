import Phaser from "phaser";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";
import { ALL_LEVELS, isLevelUnlocked, isLevelCompleted } from "../systems/Levels";

const COLS = 4;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;

export class LevelSelectScene extends Phaser.Scene {
  private page = 0;
  private totalPages = 0;
  private pageContainer!: Phaser.GameObjects.Container;
  private pageText!: Phaser.GameObjects.Text;
  private leftArrow!: Phaser.GameObjects.Text;
  private rightArrow!: Phaser.GameObjects.Text;
  private transitioning = false;

  constructor() {
    super("LevelSelectScene");
  }

  create() {
    this.transitioning = false;
    this.totalPages = Math.ceil(ALL_LEVELS.length / PER_PAGE);

    const firstIncomplete = ALL_LEVELS.findIndex((l) => !isLevelCompleted(l.id));
    this.page = firstIncomplete >= 0 ? Math.floor(firstIncomplete / PER_PAGE) : 0;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0806, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);
    bg.setDepth(-1);

    this.add
      .text(GAME_W / 2, px(45), "CAMPAIGN", {
        fontFamily: "monospace",
        fontSize: `${px(36)}px`,
        color: "#e8d5b0",
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.pageContainer = this.add.container(0, 0);

    this.buildPage(this.page);

    this.leftArrow = this.add
      .text(px(40), GAME_H / 2, "◀", {
        fontFamily: "monospace",
        fontSize: `${px(32)}px`,
        color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.leftArrow.setColor("#ffaa44"))
      .on("pointerout", () => this.leftArrow.setColor("#887766"))
      .on("pointerdown", () => this.changePage(-1));

    this.rightArrow = this.add
      .text(GAME_W - px(40), GAME_H / 2, "▶", {
        fontFamily: "monospace",
        fontSize: `${px(32)}px`,
        color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.rightArrow.setColor("#ffaa44"))
      .on("pointerout", () => this.rightArrow.setColor("#887766"))
      .on("pointerdown", () => this.changePage(1));

    this.pageText = this.add
      .text(GAME_W / 2, GAME_H - px(70), "", {
        fontFamily: "monospace",
        fontSize: `${px(14)}px`,
        color: "#666",
      })
      .setOrigin(0.5)
      .setDepth(10);

    const backBtn = this.add
      .text(GAME_W / 2, GAME_H - px(35), "BACK", {
        fontFamily: "monospace",
        fontSize: `${px(20)}px`,
        color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => backBtn.setColor("#e8d5b0"))
      .on("pointerout", () => backBtn.setColor("#887766"))
      .on("pointerdown", () => this.scene.start("StartScene"));

    this.updateArrows();

    const kb = this.input.keyboard;
    if (kb) {
      kb.on("keydown-LEFT", () => this.changePage(-1));
      kb.on("keydown-RIGHT", () => this.changePage(1));
    }
  }

  private buildPage(page: number) {
    this.pageContainer.removeAll(true);

    const cardW = px(140);
    const cardH = px(100);
    const gap = px(16);

    const start = page * PER_PAGE;
    const end = Math.min(start + PER_PAGE, ALL_LEVELS.length);
    const count = end - start;
    const rowsOnPage = Math.ceil(count / COLS);

    const totalW = COLS * cardW + (COLS - 1) * gap;
    const totalH = rowsOnPage * cardH + (rowsOnPage - 1) * gap;
    const startX = (GAME_W - totalW) / 2;
    const startY = (GAME_H - totalH) / 2;

    for (let i = 0; i < count; i++) {
      const level = ALL_LEVELS[start + i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const unlocked = isLevelUnlocked(level.id);
      const completed = isLevelCompleted(level.id);

      const card = this.add.graphics();
      card.fillStyle(unlocked ? 0x111111 : 0x0a0a0a, 1);
      card.lineStyle(2, completed ? 0xffaa44 : unlocked ? 0x444444 : 0x222222, 1);
      card.fillRect(x, y, cardW, cardH);
      card.strokeRect(x, y, cardW, cardH);
      this.pageContainer.add(card);

      const cx = x + cardW / 2;

      this.pageContainer.add(
        this.add
          .text(cx, y + px(18), `${level.id}`, {
            fontFamily: "monospace",
            fontSize: `${px(24)}px`,
            color: unlocked ? (completed ? "#ffaa44" : "#e8d5b0") : "#333",
          })
          .setOrigin(0.5),
      );

      this.pageContainer.add(
        this.add
          .text(cx, y + px(48), level.name, {
            fontFamily: "monospace",
            fontSize: `${px(11)}px`,
            color: unlocked ? "#998877" : "#333",
          })
          .setOrigin(0.5),
      );

      if (completed) {
        this.pageContainer.add(
          this.add
            .text(cx, y + px(72), "✓", {
              fontFamily: "monospace",
              fontSize: `${px(18)}px`,
              color: "#ffaa44",
            })
            .setOrigin(0.5),
        );
      } else if (!unlocked) {
        this.pageContainer.add(
          this.add
            .text(cx, y + px(72), "🔒", { fontSize: `${px(16)}px` })
            .setOrigin(0.5),
        );
      }

      if (unlocked) {
        const hitZone = this.add
          .zone(cx, y + cardH / 2, cardW, cardH)
          .setInteractive({ useHandCursor: true })
          .on("pointerover", () => {
            card.clear();
            card.fillStyle(0x1a1510, 1);
            card.lineStyle(2, 0xffaa44, 1);
            card.fillRect(x, y, cardW, cardH);
            card.strokeRect(x, y, cardW, cardH);
          })
          .on("pointerout", () => {
            card.clear();
            card.fillStyle(0x111111, 1);
            card.lineStyle(2, completed ? 0xffaa44 : 0x444444, 1);
            card.fillRect(x, y, cardW, cardH);
            card.strokeRect(x, y, cardW, cardH);
          })
          .on("pointerdown", () => {
            this.scene.start("GameScene", { mode: "level", levelDef: level });
          });
        this.pageContainer.add(hitZone);
      }
    }
  }

  private changePage(dir: number) {
    const next = this.page + dir;
    if (next < 0 || next >= this.totalPages || this.transitioning) return;

    this.transitioning = true;
    const slideOut = dir > 0 ? -GAME_W : GAME_W;

    this.tweens.add({
      targets: this.pageContainer,
      x: slideOut,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        this.page = next;
        this.buildPage(this.page);
        this.pageContainer.x = -slideOut * 0.3;
        this.pageContainer.alpha = 0;
        this.tweens.add({
          targets: this.pageContainer,
          x: 0,
          alpha: 1,
          duration: 200,
          ease: "Power2",
          onComplete: () => {
            this.transitioning = false;
          },
        });
        this.updateArrows();
      },
    });
  }

  private updateArrows() {
    this.leftArrow.setVisible(this.page > 0);
    this.rightArrow.setVisible(this.page < this.totalPages - 1);
    this.pageText.setText(`${this.page + 1} / ${this.totalPages}`);
  }
}
