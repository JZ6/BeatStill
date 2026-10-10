import Phaser from "phaser";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";
import { options } from "../systems/GameOptions";
import { getWeapon } from "../systems/Weapons";
import { getState } from "../systems/Unlocks";
import { FpsMeter } from "./FpsMeter";

export interface AnnounceStyle {
  /** Base font size at 720p (scaled with px()). */
  fontSize: number;
  color: string;
  /** Fade-in (and fade-out) duration, ms. */
  duration: number;
  /** Time fully visible, ms. */
  hold: number;
}

/** In-run HUD texts: score, weapon, wave, chain, game over, FPS, shards and relics. */
export class Hud {
  readonly scoreText: Phaser.GameObjects.Text;
  readonly weaponText: Phaser.GameObjects.Text;
  readonly waveText: Phaser.GameObjects.Text;
  readonly chainText: Phaser.GameObjects.Text;
  readonly gameOverText: Phaser.GameObjects.Text;
  readonly fpsText: Phaser.GameObjects.Text;
  readonly shardText: Phaser.GameObjects.Text;
  readonly relicText: Phaser.GameObjects.Text;
  private readonly fps = new FpsMeter();

  constructor(private readonly scene: Phaser.Scene) {
    this.scoreText = scene.add
      .text(px(16), px(16), "SCORE: 0", { fontFamily: "monospace", fontSize: `${px(20)}px`, color: "#e8d5b0" })
      .setDepth(100);

    this.weaponText = scene.add
      .text(px(16), px(42), "STANDARD", { fontFamily: "monospace", fontSize: `${px(13)}px`, color: "#666" })
      .setDepth(100);

    this.waveText = scene.add
      .text(GAME_W - px(16), px(16), "WAVE 0", {
        fontFamily: "monospace", fontSize: `${px(20)}px`, color: "#e8d5b0", align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.chainText = scene.add
      .text(px(16), px(78), "", { fontFamily: "monospace", fontSize: `${px(18)}px`, color: "#ffaa44" })
      .setDepth(100)
      .setAlpha(0);

    this.gameOverText = scene.add
      .text(GAME_W / 2, GAME_H / 2, "", {
        fontFamily: "monospace", fontSize: `${px(48)}px`, color: "#ff6644", align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.fpsText = scene.add
      .text(GAME_W - px(16), px(40), "", { fontFamily: "monospace", fontSize: `${px(14)}px`, color: "#666" })
      .setOrigin(1, 0)
      .setDepth(100);

    this.shardText = scene.add
      .text(px(16), px(60), "", { fontFamily: "monospace", fontSize: `${px(13)}px`, color: "#ffaa44" })
      .setDepth(100);

    this.relicText = scene.add
      .text(px(16), GAME_H - px(20), "", {
        fontFamily: "monospace", fontSize: `${px(12)}px`, color: "#887766",
      })
      .setDepth(100);
  }

  setScore(score: number) {
    this.scoreText.setText(`SCORE: ${score}`);
  }

  setWaveLabel(label: string) {
    this.waveText.setText(label);
  }

  /** Shows the saved shard balance. */
  refreshShards() {
    this.shardText.setText(`◆ ${getState().shards}`);
  }

  setRelicIcons(icons: string) {
    this.relicText.setText(icons);
  }

  /** Per live frame: refreshes the FPS readout and weapon name every 500 ms. `deltaMs` is the unclamped frame time. */
  update(deltaMs: number, weaponId: string) {
    const fps = this.fps.sample(deltaMs);
    if (fps === null) return;
    if (options.showFps) {
      this.fpsText.setText(`FPS: ${Math.round(fps)}`);
      this.fpsText.setVisible(true);
    } else {
      this.fpsText.setVisible(false);
    }
    this.weaponText.setText(getWeapon(weaponId).name.toUpperCase());
  }

  /** A centred banner that fades in, holds, fades out and destroys itself. */
  announce(message: string, style: AnnounceStyle) {
    const text = this.scene.add
      .text(GAME_W / 2, GAME_H / 2, message, {
        fontFamily: "monospace", fontSize: `${px(style.fontSize)}px`, color: style.color, align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: style.duration,
      yoyo: true,
      hold: style.hold,
      onComplete: () => text.destroy(),
    });
  }
}
