import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import { DeathAnimation } from "../systems/DeathAnimation";
import { GAME_W, GAME_H, isMobile, px } from "../systems/GameConfig";

/** Death, the game-over screen, and leaving the run (restart / back to the menu). */
export class GameOverFlow {
  private deathAnim: DeathAnimation | null = null;
  private overlay: Phaser.GameObjects.Graphics | null = null;
  /** Restart input is ignored until shortly after the game-over screen appears. */
  private ready = false;
  private readonly restartKey: Phaser.Input.Keyboard.Key | null;
  private readonly escKey: Phaser.Input.Keyboard.Key | null;

  constructor(private readonly scene: GameScene) {
    const kb = scene.input.keyboard;
    this.restartKey = kb ? kb.addKey("R") : null;
    // Same Key object the scene's pause handler uses (addKey returns the existing key).
    this.escKey = kb ? kb.addKey("ESC") : null;
  }

  trigger() {
    const s = this.scene;
    s.gameOver = true;
    s.conductor.pause();
    this.ready = false;
    s.touchControls?.disable();
    s.particles.burst(s.ship.x, s.ship.y, 0xff4422, 40, 150, 4);
    s.particles.burst(s.ship.x, s.ship.y, 0xffcc66, 20, 100, 3);
    s.ship.setVisible(false);

    s.progression.recordRunEnd();
    s.gameEvents.emit("playerDied", { x: s.ship.x, y: s.ship.y });

    this.deathAnim = new DeathAnimation(s, s.ship.x, s.ship.y, s.ship.shipColor, () => {
      this.showScreen();
    });
  }

  /** Per frame while the run is over (REAL ms). */
  update(delta: number) {
    if (this.deathAnim && this.deathAnim.update(delta)) this.deathAnim = null;
    if (this.ready && this.restartKey?.isDown) this.restart();
  }

  goToMenu() {
    const s = this.scene;
    if (s.level) {
      s.scene.start("LevelSelectScene");
    } else {
      s.scene.start("StartScene");
    }
  }

  restart() {
    const s = this.scene;
    if (s.level) {
      s.scene.restart({ mode: "level", levelDef: s.level.levelDef });
    } else {
      s.scene.restart({ mode: "endless" });
    }
  }

  /** Stops the death animation (scene shutdown). */
  cleanup() {
    this.deathAnim?.stop();
    this.deathAnim = null;
    this.overlay = null;
  }

  private showScreen() {
    const s = this.scene;
    if (!this.overlay) {
      this.overlay = s.add.graphics();
      this.overlay.fillStyle(0x0a0806, 0.75);
      this.overlay.fillRect(0, 0, GAME_W, GAME_H);
      this.overlay.setDepth(99);
    }

    const mobile = isMobile();
    const isLevel = !!s.level;
    let controls: string;
    if (isLevel) {
      controls = mobile ? "TAP TO RETRY" : "R — retry   ESC — campaign";
    } else {
      controls = mobile ? "TAP TO RESTART" : "R — restart   ESC — menu";
    }

    const scoreLine = isLevel ? "" : `\nSCORE: ${s.score}  |  WAVE: ${s.wave}\n`;
    s.hud.gameOverText.setText(`GAME OVER\n${scoreLine}\n${controls}`);

    s.time.delayedCall(300, () => { this.ready = true; });

    if (mobile) this.createMobileUI(isLevel);

    this.escKey?.once("down", () => {
      if (s.gameOver) this.goToMenu();
    });
  }

  private createMobileUI(isLevel: boolean) {
    const s = this.scene;
    const menuBtn = s.add
      .text(GAME_W / 2, GAME_H / 2 + px(120), isLevel ? "CAMPAIGN" : "MENU", {
        fontFamily: "monospace", fontSize: `${px(20)}px`, color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.goToMenu();
      });

    s.time.delayedCall(500, () => {
      s.input.once("pointerdown", (_p: Phaser.Input.Pointer, targets: Phaser.GameObjects.GameObject[]) => {
        if (s.gameOver && this.ready && !targets.includes(menuBtn)) this.restart();
      });
    });
  }
}
