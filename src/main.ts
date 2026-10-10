import Phaser from "phaser";
import { StartScene } from "./scenes/StartScene";
import { GameScene } from "./scenes/GameScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { LevelDesignerScene } from "./scenes/LevelDesignerScene";
import { createDevPanel } from "./systems/DevPanel";
import { initCrashReporter } from "./systems/CrashReporter";
import { options, registerGame, saveOptions } from "./systems/GameOptions";
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
    // `limit` is the real frame cap (0 = uncapped); GameOptions.applyFps changes it at runtime.
    // `target` is left at Phaser's default (60): it doesn't cap anything, and a huge value
    // (the old 9999 for "uncapped") makes TimeStep clamp deltas to ~0.1ms after focus changes.
    limit: options.targetFps,
  },
  input: {
    touch: true,
  },
  // All audio goes through Tone.js; stop Phaser from creating a second AudioContext.
  audio: {
    noAudio: true,
  },
});

registerGame(game);

// Debug/test hook: used by scripts/smoke.mjs and for manual console inspection.
(window as unknown as { __BEATSTILL__?: { game: Phaser.Game } }).__BEATSTILL__ = { game };

const canvas = game.canvas;
if (canvas) {
  canvas.style.touchAction = "none";
}

const slider = document.getElementById("volume-slider") as HTMLInputElement;
slider.value = String(options.masterVolume);
// Also fired programmatically by OptionsOverlay's volume slider.
slider.addEventListener("input", () => {
  options.masterVolume = parseInt(slider.value);
  const scene = game.scene.getScene("GameScene") as GameScene;
  if (scene?.audioManager) {
    scene.audioManager.setVolume(options.masterVolume / 100);
  }
  (game.scene.getScene("StartScene") as StartScene | null)?.applyMasterVolume();
});
// Persist once the drag ends rather than on every input tick.
slider.addEventListener("change", () => saveOptions(options));

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
