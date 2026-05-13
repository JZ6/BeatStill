import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import { createEnemy } from "../objects/enemies";
import { GAME_W, GAME_H, isMobile, px } from "./GameConfig";

const STORAGE_KEY = "beatstill_tutorial_done";

export function isTutorialDone(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

function markTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

interface TutorialStep {
  message: string;
  hint?: string;
  condition: (scene: GameScene, t: TutorialManager) => boolean;
  onEnter?: (scene: GameScene) => void;
}

function buildSteps(): TutorialStep[] {
  const mobile = isMobile();
  return [
    {
      message: mobile ? "Left stick — move your ship" : "WASD — move your ship",
      condition: (scene, t) => {
        const dx = scene.ship.x - t.startX;
        const dy = scene.ship.y - t.startY;
        return dx * dx + dy * dy > 100 * 100;
      },
    },
    {
      message: mobile ? "Right stick — aim" : "Move your mouse to aim",
      condition: (scene, t) => Math.abs(scene.ship.rotation - t.startRotation) > 0.8,
    },
    {
      message: mobile ? "Hold right stick to shoot" : "Click to shoot",
      condition: (scene) => scene.playerBullets.getChildren().length > 0,
    },
    {
      message: mobile ? "Release sticks — time freezes" : "Stop moving — time freezes",
      hint: "stand still and watch the world slow down",
      condition: (scene) => scene.timeManager.scale < 0.08,
    },
    {
      message: "Move or shoot to speed time up",
      condition: (scene) => scene.timeManager.scale > 0.5,
    },
    {
      message: "Kill enemies — every hit plays a note",
      onEnter: (scene) => {
        const spacing = GAME_W / 4;
        for (let i = 0; i < 3; i++) {
          const x = spacing + i * spacing;
          const enemy = createEnemy(scene, x, -30, "basic");
          scene.enemies.add(enemy);
        }
      },
      condition: (scene, t) => scene.score > t.scoreAtStep,
    },
    {
      message: "Kill enemies close together for a chain bonus",
      hint: "CHAIN x2 = extra score + ascending notes",
      onEnter: (scene) => {
        const cx = GAME_W / 2 - 60;
        for (let i = 0; i < 3; i++) {
          const enemy = createEnemy(scene, cx + i * 60, 200, "basic");
          scene.enemies.add(enemy);
        }
      },
      condition: (scene) => scene.chain.chainCount >= 2,
    },
  ];
}

const MIN_STEP_MS = 3000;

export class TutorialManager {
  private scene: GameScene;
  private steps: TutorialStep[];
  private step = 0;
  private done = false;
  private transitioning = false;
  private stepElapsed = 0;

  startX: number;
  startY: number;
  startRotation: number;
  scoreAtStep = 0;

  private msgText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private skipText: Phaser.GameObjects.Text;
  private stepDots: Phaser.GameObjects.Text;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.steps = buildSteps();
    this.startX = scene.ship.x;
    this.startY = scene.ship.y;
    this.startRotation = scene.ship.rotation;

    const cx = GAME_W / 2;

    this.msgText = scene.add
      .text(cx, GAME_H - px(90), "", {
        fontFamily: "monospace",
        fontSize: `${px(24)}px`,
        color: "#ffaa44",
        align: "center",
        stroke: "#0a0806",
        strokeThickness: px(4),
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.hintText = scene.add
      .text(cx, GAME_H - px(58), "", {
        fontFamily: "monospace",
        fontSize: `${px(13)}px`,
        color: "#887766",
        align: "center",
        stroke: "#0a0806",
        strokeThickness: px(3),
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.stepDots = scene.add
      .text(cx, GAME_H - px(25), "", {
        fontFamily: "monospace",
        fontSize: `${px(12)}px`,
        color: "#554433",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.skipText = scene.add
      .text(GAME_W - px(32), GAME_H - px(20), "SKIP TUTORIAL", {
        fontFamily: "monospace",
        fontSize: `${px(13)}px`,
        color: "#554433",
      })
      .setOrigin(1, 1)
      .setDepth(300)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.skipText.setColor("#887766"))
      .on("pointerout", () => this.skipText.setColor("#554433"))
      .on("pointerdown", () => this.skip());

    this.showStep(0);
  }

  private showStep(index: number) {
    if (index >= this.steps.length) { this.finish(); return; }
    const step = this.steps[index];

    this.stepElapsed = 0;
    this.scoreAtStep = this.scene.score;
    if (step.onEnter) step.onEnter(this.scene);

    const dots = this.steps.map((_, i) => i === index ? "●" : "○").join(" ");
    this.stepDots.setText(dots);

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }

    this.msgText.setAlpha(0).setText(step.message);
    this.hintText.setAlpha(0).setText(step.hint ?? "");
    this.stepDots.setAlpha(0);

    this.scene.tweens.add({
      targets: [this.msgText, this.stepDots],
      alpha: 1,
      duration: 300,
      ease: "Sine.easeOut",
    });

    if (step.hint) {
      this.scene.tweens.add({
        targets: this.hintText,
        alpha: 0.8,
        duration: 400,
        delay: 150,
      });
    }

    this.pulseTween = this.scene.tweens.add({
      targets: this.msgText,
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private advance() {
    if (this.transitioning || this.done) return;
    this.transitioning = true;

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }

    this.scene.tweens.add({
      targets: [this.msgText, this.hintText, this.stepDots],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (this.done) return;
        this.step++;
        this.transitioning = false;
        this.showStep(this.step);
      },
    });
  }

  skip() {
    if (this.done) return;
    this.finish();
  }

  private finish() {
    this.done = true;
    markTutorialDone();

    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }

    this.scene.tweens.add({
      targets: [this.msgText, this.hintText, this.stepDots, this.skipText],
      alpha: 0,
      duration: 400,
      onComplete: () => this.destroy(),
    });

    this.scene.spawnWave();
  }

  update(delta: number) {
    if (this.done || this.transitioning) return;
    if (this.step >= this.steps.length) return;

    this.stepElapsed += delta;
    if (this.stepElapsed < MIN_STEP_MS) return;

    if (this.steps[this.step].condition(this.scene, this)) {
      this.advance();
    }
  }

  destroy() {
    this.msgText.destroy();
    this.hintText.destroy();
    this.stepDots.destroy();
    this.skipText.destroy();
  }

  get isActive(): boolean { return !this.done; }
}
