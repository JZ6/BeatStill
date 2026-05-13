import Phaser from "phaser";
import { Ship } from "../objects/Ship";
import { Enemy, createEnemy } from "../objects/enemies";
import { Asteroid } from "../objects/Asteroid";
import { Bullet } from "../objects/Bullet";
import { TimeManager } from "../systems/TimeManager";
import { AudioManager } from "../systems/AudioManager";
import { ParticleSystem } from "../systems/Particles";
import { theremin, allThemes } from "../sounds";
import { defaultStats, ALL_UPGRADES, type PlayerStats, type UpgradeDef } from "../systems/Upgrades";
import { options } from "../systems/GameOptions";
import { getWeapon } from "../systems/Weapons";
import { TutorialManager, isTutorialDone } from "../systems/Tutorial";
import { GAME_W, GAME_H, isMobile } from "../systems/GameConfig";
import { TouchControls } from "../systems/TouchControls";
import { UpgradePickup } from "../objects/Shard";
import { addShards, checkNewUnlocks, updateHighScore, updateHighWave, updateBestChain, addWeaponPickup, addWeaponKill, getState } from "../systems/Unlocks";
import { type LevelDef } from "../systems/Levels";
import { Wall } from "../objects/Wall";
import { checkAchievements, addBossDefeat, recordWeaponUsed, recordThemeUsed, type AchievementContext } from "../systems/Achievements";
import type { EnemyType } from "../objects/enemies";
import { EndlessMode } from "../systems/EndlessMode";
import { ChainSystem, MAGNET_SPEEDS } from "../systems/ChainSystem";
import { checkEvolution } from "../systems/Evolutions";
import { recordEvolution } from "../systems/Unlocks";
import { CollisionSystem } from "../systems/CollisionSystem";
import { LevelRunner } from "../systems/LevelRunner";
import { PauseMenu } from "../systems/PauseMenu";
import { RelicSystem, type RelicDef } from "../systems/Relics";
import { createRelicSelectOverlay } from "../ui/RelicSelectOverlay";
import { MutatorSystem } from "../systems/WaveMutators";
import { ReplayRecorder } from "../systems/ReplayRecorder";
import { ReplayRenderer } from "../systems/ReplayRenderer";

export class GameScene extends Phaser.Scene {
  ship!: Ship;
  timeManager!: TimeManager;
  audioManager!: AudioManager;
  particles!: ParticleSystem;

  playerBullets!: Phaser.GameObjects.Group;
  enemyBullets!: Phaser.GameObjects.Group;
  enemies!: Phaser.GameObjects.Group;
  asteroids!: Phaser.GameObjects.Group;
  walls!: Phaser.GameObjects.Group;
  shards!: Phaser.GameObjects.Group;

  chain!: ChainSystem;
  private collisions!: CollisionSystem;
  private endlessMode!: EndlessMode;
  pauseMenu!: PauseMenu;
  level: LevelRunner | null = null;
  relics!: RelicSystem;
  mutators!: MutatorSystem;

  stats!: PlayerStats;
  score = 0;
  wave = 0;
  waveTimer = 0;
  waveDelay = 1500;
  gameOver = false;
  godMode = false;
  bossActive = false;
  runKills = 0;

  scoreText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;
  chainText!: Phaser.GameObjects.Text;
  gameOverText!: Phaser.GameObjects.Text;
  shardText!: Phaser.GameObjects.Text;
  weaponText!: Phaser.GameObjects.Text;
  fpsText!: Phaser.GameObjects.Text;
  bgGraphics!: Phaser.GameObjects.Graphics;

  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private restartKey: Phaser.Input.Keyboard.Key | null = null;
  audioStarted = false;
  private tutorial: TutorialManager | null = null;
  private touchControls: TouchControls | null = null;
  private pauseBtn: Phaser.GameObjects.Text | null = null;
  private menuBtn: Phaser.GameObjects.Text | null = null;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: string[] = [];
  private toastActive = false;
  private relicOverlay: HTMLDivElement | null = null;
  relicSelectActive = false;
  private relicHudText!: Phaser.GameObjects.Text;
  private runDamageTaken = 0;
  bossFightDamageTaken = 0;
  private freezeTime = 0;
  private fpsTimer = 0;
  private recorder!: ReplayRecorder;
  private replayRenderer: ReplayRenderer | null = null;

  constructor() {
    super("GameScene");
  }

  create(data?: { mode?: string; levelDef?: LevelDef }) {
    const isLevel = data?.mode === "level" && !!data.levelDef;
    this.level = isLevel ? new LevelRunner(this, data!.levelDef!) : null;
    this.score = 0;
    this.wave = 0;
    this.gameOver = false;
    this.toastQueue = [];
    this.toastActive = false;
    this.fpsTimer = 0;
    this.tutorial = null;
    this.runKills = 0;
    this.runDamageTaken = 0;
    this.bossFightDamageTaken = 0;
    this.freezeTime = 0;
    this.relics = new RelicSystem();
    this.mutators = new MutatorSystem();
    this.relicSelectActive = false;
    this.recorder = new ReplayRecorder();
    this.replayRenderer = null;

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);
    this.drawBackground();

    this.chain = new ChainSystem(this);
    this.chain.init();
    this.collisions = new CollisionSystem(this);

    this.playerBullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.asteroids = this.add.group();
    this.shards = this.add.group();
    this.walls = this.add.group();
    this.endlessMode = new EndlessMode(this);

    const shipX = this.level?.levelDef.shipRx != null ? GAME_W * this.level.levelDef.shipRx : GAME_W / 2;
    const shipY = this.level?.levelDef.shipRy != null ? GAME_H * this.level.levelDef.shipRy : GAME_H / 2;

    this.stats = defaultStats();
    this.stats.weaponId = options.starterWeapon;
    this.particles = new ParticleSystem(this);
    this.ship = new Ship(this, shipX, shipY);
    this.ship.stats = this.stats;
    this.ship.hp = this.stats.maxHp;
    this.ship.maxHp = this.stats.maxHp;
    this.timeManager = new TimeManager();

    const selectedTheme = allThemes.find((t) => t.name.toLowerCase() === options.themeId) ?? theremin;
    recordThemeUsed(selectedTheme.name.toLowerCase());
    if (!this.audioManager) {
      this.audioManager = new AudioManager();
    } else {
      this.audioManager.loadTheme(selectedTheme);
    }

    if (isMobile()) {
      this.touchControls?.destroy();
      this.touchControls = new TouchControls(this);
      this.ship.touchControls = this.touchControls;
    }

    this.createHUD();

    this.pauseMenu = new PauseMenu(this, () => this.goToMenu());
    this.pauseMenu.create();

    const kb = this.input.keyboard;
    if (kb) {
      this.restartKey = kb.addKey("R");
      this.escKey = kb.addKey("ESC");
      this.escKey.on("down", () => {
        if (!this.gameOver) this.pauseMenu.toggle();
      });
    }

    if (isMobile()) {
      this.pauseBtn = this.add
        .text(GAME_W - 16, 16, "❚❚", { fontFamily: "monospace", fontSize: "24px", color: "#887766" })
        .setOrigin(1, 0)
        .setDepth(150)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          if (!this.gameOver) this.pauseMenu.toggle();
        });
    }

    this.input.on("pointerdown", () => {
      if (!this.audioStarted) {
        this.audioStarted = true;
        this.audioManager
          .start()
          .then(() => {
            this.audioManager.loadTheme(selectedTheme);
            this.audioManager.setVolume(options.masterVolume / 100);
          })
          .catch(() => {
            this.audioStarted = false;
          });
      }
    });

    this.events.once("shutdown", () => {
      this.toastQueue.length = 0;
      this.toastActive = false;
      this.pauseMenu.cleanup();
      this.relicOverlay?.remove();
      this.relicOverlay = null;
    });

    this.waveTimer = 0;
    if (this.level) {
      this.waveText.setText(this.level.levelDef.name.toUpperCase());
      this.level.spawnWave(0);
    } else if (!isTutorialDone()) {
      this.tutorial = new TutorialManager(this);
    } else {
      this.spawnWave();
    }
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      if (this.replayRenderer?.isPlaying) {
        this.replayRenderer.update(delta);
        return;
      }
      if (this.restartKey?.isDown) this.restartGame();
      this.particles.update(delta, 0.3);
      return;
    }

    if (this.pauseMenu.isActive || this.relicSelectActive) return;

    this.touchControls?.update();

    const inputMagnitude = this.ship.getInputMagnitude();
    this.timeManager.update(inputMagnitude, delta);
    const ts = this.timeManager.scale;
    if (ts < 0.15) this.freezeTime += delta / 1000;

    this.ship.update(delta, ts, this);

    if (this.tutorial?.isActive) this.tutorial.update(delta);

    const enemyArr = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemyArr) enemy.update(delta, ts, this);

    for (const a of [...this.asteroids.getChildren()] as Asteroid[]) a.update(delta, ts);

    this.updateBullets(delta, ts, enemyArr);

    this.collisions.checkAll();
    this.collectPickups();
    this.updatePickupMagnets(delta, ts);
    this.particles.update(delta, ts);
    this.chain.update(delta, ts);

    this.waveTimer += delta * ts;
    if (enemyArr.length === 0 && this.waveTimer > this.waveDelay && !this.level?.isComplete) {
      if (this.level) {
        this.level.advance();
      } else {
        this.spawnWave();
      }
    }

    if (this.audioStarted) this.audioManager.updateTimeScale(ts);
    this.recorder.record(this);

    this.fpsTimer += delta;
    if (this.fpsTimer > 500) {
      this.fpsTimer = 0;
      if (options.showFps) {
        this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
        this.fpsText.setVisible(true);
      } else {
        this.fpsText.setVisible(false);
      }
      this.weaponText.setText(getWeapon(this.stats.weaponId).name.toUpperCase());
    }
  }

  private updateBullets(delta: number, ts: number, enemyArr: Enemy[]) {
    for (const b of [...this.playerBullets.getChildren()] as Bullet[]) {
      if (!b.alive) continue;
      if (b.homing && enemyArr.length > 0) {
        let closest: Enemy | null = null;
        let closestDist = Infinity;
        for (const e of enemyArr) {
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const d = dx * dx + dy * dy;
          if (d < closestDist) { closestDist = d; closest = e; }
        }
        if (closest) b.steerToward(closest.x, closest.y, 0.08);
      }
      b.update(delta, ts);
    }

    const enemyTs = (this.relics.hasRelic("timewarp") && ts < 0.15) ? ts * 0.1 : ts;
    for (const b of [...this.enemyBullets.getChildren()] as Bullet[]) b.update(delta, enemyTs);
  }

  private updatePickupMagnets(delta: number, ts: number) {
    const hasMagnetism = this.relics.hasRelic("magnetism");
    const magnetSpd = hasMagnetism ? MAGNET_SPEEDS[5] : (MAGNET_SPEEDS[this.chain.chainTier] ?? 0);
    for (const p of [...this.shards.getChildren()] as UpgradePickup[]) {
      if (!p.alive) continue;
      if (hasMagnetism || (magnetSpd > 0 && this.chain.chainTimer > 0)) {
        p.magnetTarget = this.ship;
        p.magnetSpeed = magnetSpd;
      } else {
        p.magnetTarget = null;
        p.magnetSpeed = 0;
      }
      p.update(delta, ts);
    }
  }

  private createHUD() {
    this.scoreText = this.add
      .text(16, 16, "SCORE: 0", { fontFamily: "monospace", fontSize: "20px", color: "#e8d5b0" })
      .setDepth(100);

    this.weaponText = this.add
      .text(16, 42, "STANDARD", { fontFamily: "monospace", fontSize: "13px", color: "#666" })
      .setDepth(100);

    this.waveText = this.add
      .text(GAME_W - 16, 16, "WAVE 0", {
        fontFamily: "monospace", fontSize: "20px", color: "#e8d5b0", align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.chainText = this.add
      .text(16, 78, "", { fontFamily: "monospace", fontSize: "18px", color: "#ffaa44" })
      .setDepth(100)
      .setAlpha(0);

    this.gameOverText = this.add
      .text(GAME_W / 2, GAME_H / 2, "", {
        fontFamily: "monospace", fontSize: "48px", color: "#ff6644", align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.fpsText = this.add
      .text(GAME_W - 16, 40, "", { fontFamily: "monospace", fontSize: "14px", color: "#666" })
      .setOrigin(1, 0)
      .setDepth(100);

    this.shardText = this.add
      .text(16, 60, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffaa44" })
      .setDepth(100);

    this.toastText = this.add
      .text(GAME_W / 2, 50, "", {
        fontFamily: "monospace", fontSize: "22px", color: "#ffaa44",
        align: "center", stroke: "#0a0806", strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);

    this.relicHudText = this.add
      .text(16, GAME_H - 20, "", {
        fontFamily: "monospace", fontSize: "12px", color: "#887766",
      })
      .setDepth(100);
  }

  drawBackground() {
    this.bgGraphics.clear();
    this.bgGraphics.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    this.bgGraphics.fillRect(0, 0, GAME_W, GAME_H);
    this.bgGraphics.lineStyle(1, 0x1a1612, 0.3);
    for (let x = 0; x <= GAME_W; x += 64) this.bgGraphics.lineBetween(x, 0, x, GAME_H);
    for (let y = 0; y <= GAME_H; y += 64) this.bgGraphics.lineBetween(0, y, GAME_W, y);
  }

  // --- Wave Spawning ---

  spawnWave() {
    this.wave++;
    this.waveTimer = 0;
    this.waveText.setText(`WAVE ${this.wave}`);
    updateHighWave(this.wave);
    this.processUnlocks();
    this.processAchievements(false, false);

    if (this.wave === 6 || (this.wave > 6 && (this.wave - 1) % 5 === 0)) {
      const mutator = this.mutators.rollMutator();
      if (mutator) {
        this.mutators.addMutator(mutator);
        const mutText = this.add
          .text(GAME_W / 2, GAME_H / 2, mutator.name.toUpperCase(), {
            fontFamily: "monospace", fontSize: "28px", color: "#ff6644", align: "center",
          })
          .setOrigin(0.5)
          .setDepth(100)
          .setAlpha(0);
        this.tweens.add({
          targets: mutText,
          alpha: { from: 0, to: 1 },
          duration: 400,
          yoyo: true,
          hold: 1200,
          onComplete: () => mutText.destroy(),
        });
      }
    }

    this.endlessMode.spawnWave();
  }

  // --- Boss ---

  onBossKill(x: number, y: number) {
    this.bossActive = false;
    addBossDefeat();
    this.processAchievements(true, false);

    this.particles.burst(x, y, 0xffaa22, 40, 150, 5);
    this.particles.burst(x, y, 0xffcc66, 40, 120, 4);
    this.particles.burst(x, y, 0xffffff, 30, 100, 3);
    this.cameras.main.shake(300, 0.02);

    if (this.audioStarted) this.audioManager.onBossDeath();
    this.offerRelicChoice();

    ([...this.enemies.getChildren()] as Enemy[]).forEach((e) => {
      if (e.enemyType === "phantom_decoy") e.destroy();
    });

    for (let i = 0; i < 4; i++) {
      const upgrade = this.rollDrop();
      if (upgrade) {
        const pickup = new UpgradePickup(this, x + (i - 1.5) * 40, y - 20 + Math.random() * 40, upgrade);
        this.shards.add(pickup);
      }
    }

    const defeatedText = this.add
      .text(GAME_W / 2, GAME_H / 2, "BOSS DEFEATED", {
        fontFamily: "monospace", fontSize: "32px", color: "#ffaa44", align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({
      targets: defeatedText,
      alpha: { from: 0, to: 1 },
      duration: 500,
      yoyo: true,
      hold: 1500,
      onComplete: () => defeatedText.destroy(),
    });
  }

  // --- Relics ---

  offerRelicChoice() {
    const choices = this.relics.pickChoices(3);
    if (choices.length === 0) return;
    this.relicSelectActive = true;
    const overlay = createRelicSelectOverlay(choices, (relic) => {
      this.relicOverlay = null;
      this.relicSelectActive = false;
      this.applyRelic(relic);
    });
    this.relicOverlay = overlay;
    document.body.appendChild(overlay);
  }

  private applyRelic(relic: RelicDef) {
    this.relics.addRelic(relic.id);
    this.toastQueue.push(`RELIC: ${relic.name}`);
    if (!this.toastActive) this.showNextToast();
    this.updateRelicHud();

    if (relic.id === "glass") {
      this.ship.maxHp = 1;
      this.ship.hp = 1;
      this.ship.drawHealthBar();
      this.stats.damage *= 3;
    }
  }

  private updateRelicHud() {
    const icons = this.relics.getActive().map((r) => r.icon).join(" ");
    this.relicHudText.setText(icons);
  }

  // --- Pickups ---

  private collectPickups() {
    for (const p of [...this.shards.getChildren()] as UpgradePickup[]) {
      if (!p.alive) continue;
      const dx = p.x - this.ship.x;
      const dy = p.y - this.ship.y;
      if (dx * dx + dy * dy < 40 * 40) {
        this.applyUpgrade(p.upgrade);
        if (p.upgrade.isWeapon) {
          const wId = p.upgrade.id.replace("weapon_", "");
          addWeaponPickup(wId);
          recordWeaponUsed(wId);
        }
        addShards(1);
        this.particles.burst(p.x, p.y, p.pickupColor, 10, 50, 2);
        p.kill();
        this.shardText.setText(`◆ ${getState().shards}`);
        this.chain.spawnPopup(p.x, p.y, p.upgrade.name, `#${p.pickupColor.toString(16).padStart(6, "0")}`);
        this.processUnlocks();
      }
    }
  }

  applyUpgrade(upg: UpgradeDef) {
    const wasMaxHp = this.stats.maxHp;
    upg.apply(this.stats);
    if (this.stats.maxHp > wasMaxHp) {
      this.ship.maxHp = this.stats.maxHp;
      this.ship.hp = Math.min(this.ship.hp + 1, this.ship.maxHp);
      this.ship.drawHealthBar();
    }

    const evo = checkEvolution(this.stats);
    if (evo) {
      this.stats.weaponId = evo.evolvedWeaponId;
      recordEvolution(evo.evolvedWeaponId);
      this.particles.burst(this.ship.x, this.ship.y, 0xffaa22, 50, 200, 6);
      this.particles.burst(this.ship.x, this.ship.y, 0xffffff, 30, 150, 4);
      this.cameras.main.shake(400, 0.03);
      this.toastQueue.push(`EVOLVED: ${getWeapon(evo.evolvedWeaponId).name.toUpperCase()}`);
      if (!this.toastActive) this.showNextToast();
      if (this.audioStarted) this.audioManager.onBossDeath();
    }
  }

  rollDrop(): UpgradeDef | null {
    const isWeaponDrop = Math.random() < 0.2;
    if (isWeaponDrop) {
      const weapons = ALL_UPGRADES.filter((u) => u.isWeapon && u.id !== "weapon_standard");
      if (weapons.length > 0) return weapons[Math.floor(Math.random() * weapons.length)];
    }
    const eligible = ALL_UPGRADES.filter((u) => !u.isWeapon && u.level(this.stats) < u.maxLevel);
    if (eligible.length === 0) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  // --- Unlocks & Achievements ---

  processUnlocks() {
    const newUnlocks = checkNewUnlocks();
    for (const u of newUnlocks) this.toastQueue.push(`UNLOCKED: ${u.name}`);
    if (!this.toastActive && this.toastQueue.length > 0) this.showNextToast();
  }

  processAchievements(bossJustKilled: boolean, levelJustCompleted: boolean) {
    const ctx: AchievementContext = {
      runKills: this.runKills,
      wave: this.wave,
      score: this.score,
      bestChain: this.chain.bestChain,
      hp: this.ship.hp,
      maxHp: this.ship.maxHp,
      freezeTime: this.freezeTime,
      bossFightDamageTaken: this.bossFightDamageTaken,
      levelDamageTaken: this.level?.damageTaken ?? 0,
      bossJustKilled,
      levelJustCompleted,
    };
    const newAchievements = checkAchievements(ctx);
    for (const a of newAchievements) this.toastQueue.push(`★ ${a.name} (+${a.reward}◆)`);
    if (newAchievements.length > 0) this.shardText.setText(`◆ ${getState().shards}`);
    if (!this.toastActive && this.toastQueue.length > 0) this.showNextToast();
  }

  private showNextToast() {
    if (this.toastQueue.length === 0 || !this.toastText?.active) { this.toastActive = false; return; }
    this.toastActive = true;
    const msg = this.toastQueue.shift()!;
    this.toastText.setText(msg);
    this.tweens.add({
      targets: this.toastText,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 2000,
      onComplete: () => this.showNextToast(),
    });
  }

  // --- Damage ---

  recordDamage() {
    this.runDamageTaken++;
    this.bossFightDamageTaken++;
    if (this.level) this.level.damageTaken++;
  }

  // --- Game Over ---

  triggerGameOver() {
    this.gameOver = true;
    this.touchControls?.disable();
    this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 40, 150, 4);
    this.particles.burst(this.ship.x, this.ship.y, 0xffcc66, 20, 100, 3);

    updateHighScore(this.score);
    updateHighWave(this.wave);
    updateBestChain(this.chain.bestChain);
    this.processUnlocks();
    this.processAchievements(false, false);
    this.audioManager.onPlayerDeath();

    const frames = this.recorder.getReplayFrames(300);
    if (frames.length > 30) {
      this.replayRenderer = new ReplayRenderer(this, frames, () => {
        this.replayRenderer = null;
        this.showGameOverScreen();
      });
    } else {
      this.showGameOverScreen();
    }
  }

  private showGameOverScreen() {
    const mobile = isMobile();
    const isLevel = !!this.level;
    let controls: string;
    if (isLevel) {
      controls = mobile ? "TAP TO RETRY" : "R — retry   ESC — campaign";
    } else {
      controls = mobile ? "TAP TO RESTART" : "R — restart   ESC — menu";
    }

    const scoreLine = isLevel ? "" : `\nSCORE: ${this.score}  |  WAVE: ${this.wave}\n`;
    this.gameOverText.setText(`GAME OVER\n${scoreLine}\n${controls}`);

    if (mobile) this.createMobileGameOverUI(isLevel);

    this.escKey?.once("down", () => {
      if (this.gameOver) this.goToMenu();
    });
  }

  private createMobileGameOverUI(isLevel: boolean) {
    this.menuBtn = this.add
      .text(GAME_W / 2, GAME_H / 2 + 120, isLevel ? "CAMPAIGN" : "MENU", {
        fontFamily: "monospace", fontSize: "20px", color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.goToMenu();
      });

    this.time.delayedCall(200, () => {
      this.input.once("pointerdown", (_p: Phaser.Input.Pointer, targets: Phaser.GameObjects.GameObject[]) => {
        if (this.gameOver && !targets.includes(this.menuBtn!)) this.restartGame();
      });
    });
  }

  private goToMenu() {
    if (this.level) {
      this.scene.start("LevelSelectScene");
    } else {
      this.scene.start("StartScene");
    }
  }

  restartGame() {
    if (this.level) {
      this.scene.restart({ mode: "level", levelDef: this.level.levelDef });
    } else {
      this.scene.restart();
    }
  }

  // --- Dev Helpers ---

  clearEnemies() {
    ([...this.enemies.getChildren()] as Enemy[]).forEach((e) => e.destroy());
    ([...this.enemyBullets.getChildren()] as Bullet[]).forEach((b) => b.kill());
    ([...this.asteroids.getChildren()] as Asteroid[]).forEach((a) => a.destroy());
    ([...this.walls.getChildren()] as Wall[]).forEach((w) => w.destroy());
  }

  buildEnemyPool(wave: number): EnemyType[] {
    return this.endlessMode.buildEnemyPool(wave);
  }

  devSpawnEnemies(count: number) {
    const pool = this.buildEnemyPool(this.wave);
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.add(createEnemy(this, x, y, type));
    }
  }

  devSpawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      this.asteroids.add(new Asteroid(this, ax, ay, "large"));
    }
  }

  private randomEdgePosition(margin = 30): { x: number; y: number } {
    const edge = Phaser.Math.Between(0, 3);
    if (edge === 0) return { x: Phaser.Math.Between(0, GAME_W), y: -margin };
    if (edge === 1) return { x: GAME_W + margin, y: Phaser.Math.Between(0, GAME_H) };
    if (edge === 2) return { x: Phaser.Math.Between(0, GAME_W), y: GAME_H + margin };
    return { x: -margin, y: Phaser.Math.Between(0, GAME_H) };
  }
}
