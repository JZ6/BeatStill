import Phaser from "phaser";
import { StartScene } from "./scenes/StartScene";
import { GameScene } from "./scenes/GameScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { LevelDesignerScene } from "./scenes/LevelDesignerScene";
import { createDevPanel } from "./systems/DevPanel";
import { initCrashReporter } from "./systems/CrashReporter";
import { options, registerGame } from "./systems/GameOptions";
import { initDimensions, GAME_W, GAME_H } from "./systems/GameConfig";

initDimensions(options.resolution);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#0a0806",
  parent: document.body,
  render: { roundPixels: true },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [StartScene, GameScene, LevelSelectScene, LevelDesignerScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: options.targetFps === 0 ? 9999 : options.targetFps,
  },
  input: {
    touch: true,
  },
});

registerGame(game);

const canvas = game.canvas;
if (canvas) {
  canvas.style.touchAction = "none";
}

const slider = document.getElementById("volume-slider") as HTMLInputElement;
slider.value = String(options.masterVolume);
slider.addEventListener("input", () => {
  options.masterVolume = parseInt(slider.value);
  const scene = game.scene.getScene("GameScene") as GameScene;
  if (scene?.audioManager) {
    scene.audioManager.setVolume(options.masterVolume / 100);
  }
});

const volumeControl = document.getElementById("volume-control")!;
for (const evt of ["pointerdown", "pointerup", "pointermove", "click"] as const) {
  volumeControl.addEventListener(evt, (e) => e.stopPropagation());
}

const getGameScene = () => game.scene.getScene("GameScene") as GameScene ?? null;

initCrashReporter(getGameScene);

createDevPanel(
  getGameScene,
  () => {
    const scene = game.scene.getScene("GameScene") as GameScene;
    return scene?.audioManager ?? null;
  },
);
