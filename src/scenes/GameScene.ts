import Phaser from "phaser";
import { Ship } from "../objects/Ship";
import { Enemy } from "../objects/Enemy";
import { Asteroid } from "../objects/Asteroid";
import { Bullet } from "../objects/Bullet";
import { TimeManager } from "../systems/TimeManager";
import { AudioManager } from "../systems/AudioManager";
import { ParticleSystem } from "../systems/Particles";
import { theremin, allThemes } from "../sounds";
import { defaultStats, rollUpgrades, type PlayerStats, type UpgradeDef } from "../systems/Upgrades";
import { options } from "../systems/GameOptions";
import { getWeapon } from "../systems/Weapons";
import { TutorialManager, isTutorialDone } from "../systems/Tutorial";
import { GAME_W, GAME_H, isMobile } from "../systems/GameConfig";
import { TouchControls } from "../systems/TouchControls";
import { Shard } from "../objects/Shard";
import { addShards, checkNewUnlocks, updateHighScore, updateHighWave, getState, type UnlockDef } from "../systems/Unlocks";
import { markLevelComplete, ALL_LEVELS, isLevelUnlocked, type LevelDef } from "../systems/Levels";
import { createUpgradeOverlay } from "../ui/UpgradeOverlay";
import { Wall } from "../objects/Wall";
import type { EnemyType } from "../objects/Enemy";

const CHAIN_WINDOW = 800;
const CHAIN_RADIUS = 120;

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

  stats!: PlayerStats;
  score = 0;
  wave = 0;
  waveTimer = 0;
  waveDelay = 1500;
  gameOver = false;
  paused = false;
  godMode = false;
  upgradePending = false;
  private upgradeOverlay: HTMLDivElement | null = null;

  chainTimer = 0;
  chainCount = 0;
  lastKillX = 0;
  lastKillY = 0;

  scoreText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;
  chainText!: Phaser.GameObjects.Text;
  gameOverText!: Phaser.GameObjects.Text;
  pauseOverlay!: Phaser.GameObjects.Graphics;
  pauseText!: Phaser.GameObjects.Text;
  bgGraphics!: Phaser.GameObjects.Graphics;
  escKey: Phaser.Input.Keyboard.Key | null = null;
  restartKey: Phaser.Input.Keyboard.Key | null = null;
  audioStarted = false;
  weaponText!: Phaser.GameObjects.Text;
  fpsText!: Phaser.GameObjects.Text;
  private fpsTimer = 0;
  private tutorial: TutorialManager | null = null;
  private touchControls: TouchControls | null = null;
  private pauseBtn: Phaser.GameObjects.Text | null = null;
  private menuBtn: Phaser.GameObjects.Text | null = null;
  shards!: Phaser.GameObjects.Group;
  private shardText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: UnlockDef[] = [];
  private toastActive = false;
  private levelDef: LevelDef | null = null;
  private levelWaveIndex = 0;
  private levelComplete = false;

  constructor() {
    super("GameScene");
  }

  create(data?: { mode?: string; levelDef?: LevelDef }) {
    const isLevel = data?.mode === "level" && !!data.levelDef;
    this.levelDef = isLevel ? data!.levelDef! : null;
    this.levelWaveIndex = 0;
    this.levelComplete = false;
    this.score = 0;
    this.wave = 0;
    this.gameOver = false;
    this.paused = false;
    this.upgradePending = false;
    this.chainCount = 0;
    this.chainTimer = 0;
    this.toastQueue = [];
    this.toastActive = false;
    this.fpsTimer = 0;
    this.tutorial = null;

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);
    this.drawBackground();

    this.playerBullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.asteroids = this.add.group();
    this.shards = this.add.group();
    this.walls = this.add.group();

    const shipX = this.levelDef?.shipRx != null ? GAME_W * this.levelDef.shipRx : GAME_W / 2;
    const shipY = this.levelDef?.shipRy != null ? GAME_H * this.levelDef.shipRy : GAME_H / 2;

    this.stats = defaultStats();
    this.particles = new ParticleSystem(this);
    this.ship = new Ship(this, shipX, shipY);
    this.ship.stats = this.stats;
    this.ship.hp = this.stats.maxHp;
    this.ship.maxHp = this.stats.maxHp;
    this.timeManager = new TimeManager();
    const selectedTheme = allThemes.find((t) => t.name.toLowerCase() === options.themeId) ?? theremin;
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

    const kb = this.input.keyboard;
    if (kb) {
      this.restartKey = kb.addKey("R");
      this.escKey = kb.addKey("ESC");
      this.escKey.on("down", () => {
        if (this.gameOver) return;
        this.togglePause();
      });
    }

    if (isMobile()) {
      this.pauseBtn = this.add
        .text(GAME_W - 16, 16, "❚❚", {
          fontFamily: "monospace",
          fontSize: "24px",
          color: "#887766",
        })
        .setOrigin(1, 0)
        .setDepth(150)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          if (!this.gameOver) this.togglePause();
        });
    }

    this.input.on("pointerdown", () => {
      if (!this.audioStarted) {
        this.audioStarted = true;
        this.audioManager.start().then(() => {
          this.audioManager.loadTheme(selectedTheme);
          this.audioManager.setVolume(options.masterVolume / 100);
        }).catch(() => {
          this.audioStarted = false;
        });
      }
    });

    this.events.once("shutdown", () => {
      this.upgradeOverlay?.remove();
      this.upgradeOverlay = null;
      this.toastQueue.length = 0;
      this.toastActive = false;
    });

    this.waveTimer = 0;
    if (this.levelDef) {
      this.waveText.setText(this.levelDef.name.toUpperCase());
      this.spawnLevelWave(0);
    } else if (!isTutorialDone()) {
      this.tutorial = new TutorialManager(this);
    } else {
      this.spawnWave();
    }
  }

  private togglePause() {
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseText.setVisible(this.paused);
  }

  private createHUD() {
    this.scoreText = this.add
      .text(16, 16, "SCORE: 0", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#e8d5b0",
      })
      .setDepth(100);

    this.weaponText = this.add
      .text(16, 42, "STANDARD", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#666",
      })
      .setDepth(100);

    this.waveText = this.add
      .text(GAME_W - 16, 16, "WAVE 0", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#e8d5b0",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.chainText = this.add
      .text(GAME_W / 2, 80, "", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffaa44",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.gameOverText = this.add
      .text(GAME_W / 2, GAME_H / 2, "", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#ff6644",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.pauseOverlay = this.add.graphics();
    this.pauseOverlay.fillStyle(0x0a0806, 0.8);
    this.pauseOverlay.fillRect(0, 0, GAME_W, GAME_H);
    this.pauseOverlay.setDepth(200);
    this.pauseOverlay.setVisible(false);

    this.pauseText = this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#e8d5b0",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false);

    this.fpsText = this.add
      .text(GAME_W - 16, 40, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#666",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.shardText = this.add
      .text(16, 60, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffaa44",
      })
      .setDepth(100);

    this.toastText = this.add
      .text(GAME_W / 2, 50, "", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffaa44",
        align: "center",
        stroke: "#0a0806",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
  }

  drawBackground() {
    this.bgGraphics.clear();
    this.bgGraphics.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    this.bgGraphics.fillRect(0, 0, GAME_W, GAME_H);

    this.bgGraphics.lineStyle(1, 0x1a1612, 0.3);
    for (let x = 0; x <= GAME_W; x += 64) {
      this.bgGraphics.lineBetween(x, 0, x, GAME_H);
    }
    for (let y = 0; y <= GAME_H; y += 64) {
      this.bgGraphics.lineBetween(0, y, GAME_W, y);
    }
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      if (this.restartKey?.isDown) this.restartGame();
      this.particles.update(delta, 0.3);
      return;
    }

    if (this.paused) return;

    this.touchControls?.update();

    const inputMagnitude = this.ship.getInputMagnitude();
    this.timeManager.update(inputMagnitude, delta);
    const ts = this.timeManager.scale;

    this.ship.update(delta, ts, this);

    if (this.tutorial?.isActive) this.tutorial.update(delta);

    const enemyArr = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemyArr) enemy.update(delta, ts, this);

    for (const a of [...this.asteroids.getChildren()] as Asteroid[]) a.update(delta, ts);

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

    for (const b of [...this.enemyBullets.getChildren()] as Bullet[]) b.update(delta, ts);

    this.checkCollisions();
    this.collectShards();

    const shardArr = [...this.shards.getChildren()] as Shard[];
    for (const s of shardArr) {
      if (s.alive) s.update(delta, ts);
    }

    this.particles.update(delta, ts);

    if (this.chainTimer > 0) {
      this.chainTimer -= delta * ts;
      if (this.chainTimer <= 0) {
        this.chainCount = 0;
        this.tweens.add({
          targets: this.chainText,
          alpha: 0,
          duration: 300,
        });
      }
    }

    this.waveTimer += delta * ts;
    if (enemyArr.length === 0 && this.waveTimer > this.waveDelay && !this.upgradePending && !this.levelComplete) {
      if (this.levelDef) {
        this.advanceLevelWave();
      } else if (this.wave > 0) {
        this.upgradePending = true;
        this.showUpgradeSelection();
      } else {
        this.spawnWave();
      }
    }

    if (this.audioStarted) {
      this.audioManager.updateTimeScale(ts);
    }

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

  registerKill(x: number, y: number) {
    const dx = x - this.lastKillX;
    const dy = y - this.lastKillY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.chainTimer > 0 && dist < CHAIN_RADIUS) {
      this.chainCount++;
      this.audioManager.onChainKill(this.chainCount);
      const bonus = this.chainCount * 50;
      this.score += bonus;
      this.chainText.setText(`CHAIN x${this.chainCount}  +${bonus}`);
      this.chainText.setAlpha(1);
    } else {
      this.chainCount = 1;
      this.audioManager.onEnemyKill();
    }

    this.chainTimer = CHAIN_WINDOW;
    this.lastKillX = x;
    this.lastKillY = y;

    if (Math.random() < 0.15) {
      const shard = new Shard(this, x, y);
      this.shards.add(shard);
    }
  }

  private collectShards() {
    const shardArr = [...this.shards.getChildren()] as Shard[];
    for (const s of shardArr) {
      if (!s.alive) continue;
      const dx = s.x - this.ship.x;
      const dy = s.y - this.ship.y;
      if (dx * dx + dy * dy < 40 * 40) {
        addShards(1);
        this.particles.burst(s.x, s.y, 0xffaa44, 8, 50, 2);
        s.kill();
        this.shardText.setText(`◆ ${getState().shards}`);
        this.processUnlocks();
      }
    }
  }

  private processUnlocks() {
    const newUnlocks = checkNewUnlocks();
    for (const u of newUnlocks) {
      this.toastQueue.push(u);
    }
    if (!this.toastActive && this.toastQueue.length > 0) {
      this.showNextToast();
    }
  }

  private showNextToast() {
    if (this.toastQueue.length === 0 || !this.toastText?.active) { this.toastActive = false; return; }
    this.toastActive = true;
    const u = this.toastQueue.shift()!;
    this.toastText.setText(`UNLOCKED: ${u.name}`);
    this.tweens.add({
      targets: this.toastText,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 2000,
      onComplete: () => this.showNextToast(),
    });
  }

  checkCollisions() {
    const playerBullets = [...this.playerBullets.getChildren()] as Bullet[];
    const enemyBullets = [...this.enemyBullets.getChildren()] as Bullet[];
    const enemyArr = [...this.enemies.getChildren()] as Enemy[];
    const asteroidArr = [...this.asteroids.getChildren()] as Asteroid[];
    const wallArr = [...this.walls.getChildren()] as Wall[];

    this.collideBulletsVsEnemies(playerBullets, enemyArr);
    this.collideBulletsVsAsteroids(playerBullets, asteroidArr);
    this.collideBulletVsBullet(playerBullets, enemyBullets);
    this.collideWalls(wallArr, playerBullets, enemyBullets, enemyArr);
    if (!this.ship.isInvincible() && !this.godMode && !this.levelComplete && !this.upgradePending) {
      if (this.collideShipVsBullets(enemyBullets)) return;
      this.collideShipVsAsteroids(asteroidArr);
    }
  }

  private collideBulletsVsEnemies(playerBullets: Bullet[], enemyArr: Enemy[]) {
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const e of enemyArr) {
        if (!e.active) continue;
        if (this.circleOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          const killed = e.takeDamage(b.damage);
          if (killed) {
            this.score += 100;
            this.scoreText.setText(`SCORE: ${this.score}`);
            this.particles.burst(e.x, e.y, b.bulletColor, 20, 100, 3);
            this.particles.burst(e.x, e.y, 0xffcc66, 10, 60, 2);
            this.registerKill(e.x, e.y);
          } else {
            this.particles.burst(b.x, b.y, b.bulletColor, 6, 40, 2);
            this.audioManager.onEnemyHit();
          }
          this.particles.trail(b.x, b.y, b.bulletColor, 3);
          b.hit();
          if (!b.alive) break;
        }
      }
    }
  }

  private collideBulletsVsAsteroids(playerBullets: Bullet[], asteroidArr: Asteroid[]) {
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const a of asteroidArr) {
        if (this.circleOverlap(b.x, b.y, b.radius, a.x, a.y, a.radius)) {
          this.score += 25;
          this.scoreText.setText(`SCORE: ${this.score}`);
          this.particles.burst(a.x, a.y, b.bulletColor, 8, 70, 2);
          this.particles.burst(a.x, a.y, 0xcc8866, 8, 50, 2);
          a.split(this);
          this.audioManager.onAsteroidBreak();
          b.hit();
          if (!b.alive) break;
        }
      }
    }
  }

  private collideBulletVsBullet(playerBullets: Bullet[], enemyBullets: Bullet[]) {
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const eb of enemyBullets) {
        if (!eb.alive) continue;
        if (this.circleOverlap(pb.x, pb.y, pb.radius, eb.x, eb.y, eb.radius)) {
          this.particles.burst(pb.x, pb.y, pb.bulletColor, 8, 50, 2);
          pb.kill();
          eb.kill();
          this.audioManager.onBulletClash();
          break;
        }
      }
    }
  }

  private collideShipVsBullets(enemyBullets: Bullet[]): boolean {
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      if (this.circleOverlap(b.x, b.y, b.radius, this.ship.x, this.ship.y, 4)) {
        b.kill();
        this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 15, 80, 3);
        if (this.ship.takeDamage(1)) {
          this.triggerGameOver();
          return true;
        }
        this.audioManager.onPlayerHit();
        break;
      }
    }
    return false;
  }

  private collideShipVsAsteroids(asteroidArr: Asteroid[]) {
    for (const a of asteroidArr) {
      if (!a.active) continue;
      if (this.circleOverlap(a.x, a.y, a.radius, this.ship.x, this.ship.y, 4)) {
        this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 15, 80, 3);
        if (this.ship.takeDamage(1)) {
          this.triggerGameOver();
          return;
        }
        this.audioManager.onPlayerHit();
        break;
      }
    }
  }

  private collideWalls(wallArr: Wall[], playerBullets: Bullet[], enemyBullets: Bullet[], enemyArr: Enemy[]) {
    for (const w of wallArr) {
      if (!w.active) continue;
      w.pushOut(this.ship, 16);
      for (const e of enemyArr) {
        if (e.active) w.pushOut(e, e.radius);
      }
      for (const b of playerBullets) {
        if (b.alive) w.handleBullet(b, this.particles);
      }
      for (const b of enemyBullets) {
        if (b.alive) w.handleBullet(b, this.particles);
      }
    }
  }

  circleOverlap(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number,
  ): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dist = dx * dx + dy * dy;
    const radii = r1 + r2;
    return dist < radii * radii;
  }

  private randomEdgePosition(margin = 30): { x: number; y: number } {
    const edge = Phaser.Math.Between(0, 3);
    if (edge === 0) return { x: Phaser.Math.Between(0, GAME_W), y: -margin };
    if (edge === 1) return { x: GAME_W + margin, y: Phaser.Math.Between(0, GAME_H) };
    if (edge === 2) return { x: Phaser.Math.Between(0, GAME_W), y: GAME_H + margin };
    return { x: -margin, y: Phaser.Math.Between(0, GAME_H) };
  }

  spawnWave() {
    this.wave++;
    this.waveTimer = 0;
    this.waveText.setText(`WAVE ${this.wave}`);
    updateHighWave(this.wave);
    this.processUnlocks();

    const enemyCount = 8 + this.wave * 3;
    const pool = this.buildEnemyPool(this.wave);

    for (let i = 0; i < enemyCount; i++) {
      const { x, y } = this.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.add(new Enemy(this, x, y, type));
    }

    const asteroidCount = 1 + Math.floor(this.wave / 2);
    for (let i = 0; i < asteroidCount; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      this.asteroids.add(new Asteroid(this, ax, ay, "large"));
    }
  }

  private spawnLevelWave(index: number) {
    if (!this.levelDef || index >= this.levelDef.waves.length) return;
    this.levelWaveIndex = index;
    this.waveTimer = 0;
    const wave = this.levelDef.waves[index];

    for (const e of wave.enemies) {
      const x = e.rx * GAME_W;
      const y = e.ry * GAME_H;
      const enemy = new Enemy(this, x, y, e.type);
      this.enemies.add(enemy);
    }

    if (wave.asteroids) {
      for (const a of wave.asteroids) {
        const asteroid = new Asteroid(this, a.rx * GAME_W, a.ry * GAME_H, a.size);
        this.asteroids.add(asteroid);
      }
    }

    if (wave.walls) {
      for (const w of wave.walls) {
        const wall = new Wall(this, w.rx * GAME_W, w.ry * GAME_H, w.rw * GAME_W, w.rh * GAME_H, w.type, w.hp, w.oneWay);
        this.walls.add(wall);
      }
    }

    if (wave.initialBullets) {
      for (const b of wave.initialBullets) {
        const bullet = new Bullet(this, b.rx * GAME_W, b.ry * GAME_H, b.angle, b.speed, "enemy");
        this.enemyBullets.add(bullet);
      }
    }
  }

  private advanceLevelWave() {
    if (!this.levelDef) return;
    const nextIndex = this.levelWaveIndex + 1;
    if (nextIndex < this.levelDef.waves.length) {
      this.spawnLevelWave(nextIndex);
    } else {
      this.triggerLevelComplete();
    }
  }

  private triggerLevelComplete() {
    this.levelComplete = true;
    markLevelComplete(this.levelDef!.id);

    for (const s of [...this.shards.getChildren()] as Shard[]) {
      if (s.alive) {
        addShards(1);
        this.particles.burst(s.x, s.y, 0xffaa44, 8, 50, 2);
        s.kill();
      }
    }
    this.shardText.setText(`◆ ${getState().shards}`);

    this.processUnlocks();

    this.gameOverText.setColor("#ffaa44");
    this.gameOverText.setText("LEVEL COMPLETE");

    const nextLevel = ALL_LEVELS.find((l) => l.id === this.levelDef!.id + 1);
    const hasNext = nextLevel && isLevelUnlocked(nextLevel.id);

    const btnY = GAME_H / 2 + 60;

    if (hasNext) {
      const nextBtn = this.add
        .text(GAME_W / 2, btnY, "NEXT LEVEL", {
          fontFamily: "monospace", fontSize: "22px", color: "#ffaa44",
        })
        .setOrigin(0.5)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => nextBtn.setColor("#ffcc88"))
        .on("pointerout", () => nextBtn.setColor("#ffaa44"))
        .on("pointerdown", () => {
          this.scene.start("GameScene", { mode: "level", levelDef: nextLevel });
        });
    }

    const levelsBtn = this.add
      .text(GAME_W / 2, btnY + 40, "LEVELS", {
        fontFamily: "monospace", fontSize: "18px", color: "#887766",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => levelsBtn.setColor("#e8d5b0"))
      .on("pointerout", () => levelsBtn.setColor("#887766"))
      .on("pointerdown", () => {
        this.scene.start("LevelSelectScene");
      });
  }

  buildEnemyPool(wave: number): EnemyType[] {
    const pool: EnemyType[] = ["basic", "tracker"];
    if (wave >= 2) pool.push("sniper");
    if (wave >= 3) pool.push("swarm", "swarm", "snake");
    if (wave >= 4) pool.push("spiral");
    if (wave >= 5) pool.push("circler");
    if (wave >= 6) pool.push("tank");
    return pool;
  }

  clearEnemies() {
    ([...this.enemies.getChildren()] as Enemy[]).forEach((e) => e.destroy());
    ([...this.enemyBullets.getChildren()] as Bullet[]).forEach((b) => b.kill());
    ([...this.asteroids.getChildren()] as Asteroid[]).forEach((a) => a.destroy());
    ([...this.walls.getChildren()] as Wall[]).forEach((w) => w.destroy());
  }

  devSpawnEnemies(count: number) {
    const pool = this.buildEnemyPool(this.wave);
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomEdgePosition();
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.add(new Enemy(this, x, y, type));
    }
  }

  devSpawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      const ax = Math.random() < 0.5 ? -40 : GAME_W + 40;
      const ay = Phaser.Math.Between(80, GAME_H - 80);
      this.asteroids.add(new Asteroid(this, ax, ay, "large"));
    }
  }

  showUpgradeSelection() {
    const upgrades = rollUpgrades(this.stats, 3);
    if (upgrades.length === 0) {
      this.upgradePending = false;
      this.spawnWave();
      return;
    }

    const overlay = createUpgradeOverlay(upgrades, this.stats, (upg) => {
      this.applyUpgrade(upg);
      overlay.remove();
      this.upgradeOverlay = null;
      this.upgradePending = false;
      this.spawnWave();
    });
    this.upgradeOverlay = overlay;
    document.body.appendChild(overlay);
  }

  applyUpgrade(upg: UpgradeDef) {
    const wasMaxHp = this.stats.maxHp;
    upg.apply(this.stats);
    if (this.stats.maxHp > wasMaxHp) {
      this.ship.maxHp = this.stats.maxHp;
      this.ship.hp = Math.min(this.ship.hp + 1, this.ship.maxHp);
      this.ship.drawHealthBar();
    }
  }

  triggerGameOver() {
    this.gameOver = true;
    this.touchControls?.disable();
    this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 40, 150, 4);
    this.particles.burst(this.ship.x, this.ship.y, 0xffcc66, 20, 100, 3);

    updateHighScore(this.score);
    updateHighWave(this.wave);
    this.processUnlocks();

    const mobile = isMobile();
    const isLevel = !!this.levelDef;

    let controls: string;
    if (isLevel) {
      controls = mobile ? "TAP TO RETRY" : "R — retry   ESC — levels";
    } else {
      controls = mobile ? "TAP TO RESTART" : "R — restart   ESC — menu";
    }

    const scoreLine = isLevel ? "" : `\nSCORE: ${this.score}  |  WAVE: ${this.wave}\n`;
    this.gameOverText.setText(`GAME OVER\n${scoreLine}\n${controls}`);
    this.audioManager.onPlayerDeath();

    if (mobile) this.createMobileGameOverUI(isLevel);

    this.escKey?.once("down", () => {
      if (this.gameOver) this.goToMenu();
    });
  }

  private createMobileGameOverUI(isLevel: boolean) {
    const menuLabel = isLevel ? "LEVELS" : "MENU";
    this.menuBtn = this.add
      .text(GAME_W / 2, GAME_H / 2 + 120, menuLabel, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#887766",
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
    if (this.upgradeOverlay) {
      this.upgradeOverlay.remove();
      this.upgradeOverlay = null;
    }
    if (this.levelDef) {
      this.scene.start("LevelSelectScene");
    } else {
      this.scene.start("StartScene");
    }
  }

  restartGame() {
    if (this.levelDef) {
      this.scene.restart({ mode: "level", levelDef: this.levelDef });
    } else {
      this.scene.restart();
    }
  }
}
