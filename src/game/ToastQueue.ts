import Phaser from "phaser";
import { GAME_W, px } from "../systems/GameConfig";

/** One-at-a-time toast messages (unlocks, achievements, relics, evolutions) at the top of the screen. */
export class ToastQueue {
  private readonly text: Phaser.GameObjects.Text;
  private readonly queue: string[] = [];
  private active = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = scene.add
      .text(GAME_W / 2, px(50), "", {
        fontFamily: "monospace", fontSize: `${px(22)}px`, color: "#ffaa44",
        align: "center", stroke: "#0a0806", strokeThickness: px(4),
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
  }

  /** Queues messages; starts showing them unless a toast is already on screen. */
  push(...messages: string[]) {
    if (messages.length === 0) return;
    this.queue.push(...messages);
    if (!this.active) this.showNext();
  }

  clear() {
    this.queue.length = 0;
    this.active = false;
  }

  private showNext() {
    if (this.queue.length === 0 || !this.text.active) {
      this.active = false;
      return;
    }
    this.active = true;
    const msg = this.queue.shift()!;
    this.text.setText(msg);
    this.scene.tweens.add({
      targets: this.text,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 2000,
      onComplete: () => this.showNext(),
    });
  }
}
