import Phaser from "phaser";
import { GAME_W, GAME_H, px } from "./GameConfig";
import {
  type FrameSnapshot,
  T_PLAYER, T_ENEMY, T_PLAYER_BULLET, T_ENEMY_BULLET, T_ASTEROID, T_SHARD,
} from "./ReplayRecorder";

export class ReplayRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private frames: FrameSnapshot[];
  private frameIndex = 0;
  private elapsed = 0;
  private readonly FPS = 60;
  private onComplete: () => void;
  isPlaying = false;

  constructor(scene: Phaser.Scene, frames: FrameSnapshot[], onComplete: () => void) {
    this.frames = frames;
    this.onComplete = onComplete;

    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x0a0806, 0.7);
    this.overlay.fillRect(0, 0, GAME_W, GAME_H);
    this.overlay.setDepth(500);

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(501);

    this.label = scene.add
      .text(GAME_W / 2, px(24), "KILLCAM", {
        fontFamily: "monospace",
        fontSize: `${px(18)}px`,
        color: "#ff4444",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(502)
      .setAlpha(0.8);

    this.isPlaying = true;
  }

  update(delta: number) {
    if (!this.isPlaying) return;
    this.elapsed += delta;
    const frameTime = 1000 / this.FPS;

    while (this.elapsed >= frameTime && this.frameIndex < this.frames.length) {
      this.elapsed -= frameTime;
      this.renderFrame(this.frames[this.frameIndex]);
      this.frameIndex++;
    }

    if (this.frameIndex >= this.frames.length) {
      this.cleanup();
      this.onComplete();
    }
  }

  private renderFrame(frame: FrameSnapshot) {
    const g = this.graphics;
    g.clear();

    for (const e of frame.entities) {
      switch (e.type) {
        case T_PLAYER:
          g.lineStyle(2, e.color, 0.9);
          g.strokeCircle(e.x, e.y, e.radius * 0.7);
          g.fillStyle(e.color, 0.15);
          g.fillCircle(e.x, e.y, e.radius * 0.7);
          break;

        case T_ENEMY:
          g.fillStyle(e.color, 0.5);
          g.fillCircle(e.x, e.y, e.radius);
          g.lineStyle(1, e.color, 0.8);
          g.strokeCircle(e.x, e.y, e.radius);
          break;

        case T_PLAYER_BULLET:
          g.fillStyle(e.color, 0.9);
          g.fillCircle(e.x, e.y, e.radius);
          break;

        case T_ENEMY_BULLET:
          g.fillStyle(e.color, 0.7);
          g.fillCircle(e.x, e.y, e.radius);
          break;

        case T_ASTEROID:
          g.lineStyle(1, e.color, 0.6);
          g.strokeCircle(e.x, e.y, e.radius);
          break;

        case T_SHARD:
          g.fillStyle(e.color, 0.8);
          g.fillRect(e.x - 3, e.y - 3, 6, 6);
          break;
      }
    }
  }

  stop() {
    if (!this.isPlaying) return;
    this.cleanup();
  }

  private cleanup() {
    this.isPlaying = false;
    this.graphics.destroy();
    this.overlay.destroy();
    this.label.destroy();
  }
}
