import Phaser from "phaser";
import { StartScene } from "./scenes/StartScene";
import { GameScene } from "./scenes/GameScene";
import { createDevPanel } from "./systems/DevPanel";
import { initCrashReporter } from "./systems/CrashReporter";
import { options, registerGame } from "./systems/GameOptions";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#0a0806",
  parent: document.body,
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [StartScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: options.targetFps === 0 ? 9999 : options.targetFps,
  },
});

registerGame(game);

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
