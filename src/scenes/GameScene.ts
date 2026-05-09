import Phaser from "phaser";
import { Ship } from "../objects/Ship";
import { Enemy } from "../objects/Enemy";
import { Asteroid } from "../objects/Asteroid";
import { Bullet } from "../objects/Bullet";
import { TimeManager } from "../systems/TimeManager";
import { AudioManager } from "../systems/AudioManager";
import { ParticleSystem } from "../systems/Particles";
import { theremin } from "../sounds";
import { defaultStats, rollUpgrades, type PlayerStats, type UpgradeDef } from "../systems/Upgrades";
import { options } from "../systems/GameOptions";
import { getWeapon } from "../systems/Weapons";
import { TutorialManager, isTutorialDone } from "../systems/Tutorial";
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
  escKey!: Phaser.Input.Keyboard.Key;
  restartKey!: Phaser.Input.Keyboard.Key;
  audioStarted = false;
  weaponText!: Phaser.GameObjects.Text;
  fpsText!: Phaser.GameObjects.Text;
  private fpsTimer = 0;
  private tutorial: TutorialManager | null = null;

  constructor() {
    super("GameScene");
  }

  create() {
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);
    this.drawBackground();

    this.playerBullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.asteroids = this.add.group();

    this.stats = defaultStats();
    this.particles = new ParticleSystem(this);
    this.ship = new Ship(this, 640, 360);
    this.ship.stats = this.stats;
    this.ship.hp = this.stats.maxHp;
    this.ship.maxHp = this.stats.maxHp;
    this.timeManager = new TimeManager();
    if (!this.audioManager) {
      this.audioManager = new AudioManager();
    } else {
      this.audioManager.loadTheme(theremin);
    }

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
      .text(1264, 16, "WAVE 0", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#e8d5b0",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.chainText = this.add
      .text(640, 80, "", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffaa44",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.gameOverText = this.add
      .text(640, 360, "", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#ff6644",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.pauseOverlay = this.add.graphics();
    this.pauseOverlay.fillStyle(0x0a0806, 0.8);
    this.pauseOverlay.fillRect(0, 0, 1280, 720);
    this.pauseOverlay.setDepth(200);
    this.pauseOverlay.setVisible(false);

    this.pauseText = this.add
      .text(640, 320, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#e8d5b0",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false);

    this.fpsText = this.add
      .text(1264, 40, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#666",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.restartKey = this.input.keyboard!.addKey("R");
    this.escKey = this.input.keyboard!.addKey("ESC");
    this.escKey.on("down", () => {
      if (this.gameOver) return;
      this.paused = !this.paused;
      this.pauseOverlay.setVisible(this.paused);
      this.pauseText.setVisible(this.paused);
    });

    this.input.on("pointerdown", () => {
      if (!this.audioStarted) {
        this.audioManager.start();
        this.audioManager.setVolume(options.masterVolume / 100);
        this.audioStarted = true;
      }
    });

    this.waveTimer = 0;
    if (!isTutorialDone()) {
      this.tutorial = new TutorialManager(this);
    } else {
      this.spawnWave();
    }
  }

  drawBackground() {
    this.bgGraphics.clear();
    this.bgGraphics.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    this.bgGraphics.fillRect(0, 0, 1280, 720);

    this.bgGraphics.lineStyle(1, 0x1a1612, 0.3);
    for (let x = 0; x <= 1280; x += 64) {
      this.bgGraphics.lineBetween(x, 0, x, 720);
    }
    for (let y = 0; y <= 720; y += 64) {
      this.bgGraphics.lineBetween(0, y, 1280, y);
    }
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      if (this.restartKey.isDown) this.restartGame();
      this.particles.update(delta, 0.3);
      return;
    }

    if (this.paused) return;

    const inputMagnitude = this.ship.getInputMagnitude();
    this.timeManager.update(inputMagnitude, delta);
    const ts = this.timeManager.scale;

    this.ship.update(delta, ts, this);

    if (this.tutorial?.isActive) this.tutorial.update();

    const enemyArr = this.enemies.getChildren() as Enemy[];
    for (const enemy of enemyArr) enemy.update(delta, ts, this);

    const asteroidArr = this.asteroids.getChildren() as Asteroid[];
    for (const a of asteroidArr) a.update(delta, ts);

    const playerBulletArr = this.playerBullets.getChildren() as Bullet[];
    for (const b of playerBulletArr) {
      if (b.alive && b.homing && enemyArr.length > 0) {
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

    const enemyBulletArr = this.enemyBullets.getChildren() as Bullet[];
    for (const b of enemyBulletArr) b.update(delta, ts);

    this.checkCollisions();
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
    if (enemyArr.length === 0 && this.waveTimer > this.waveDelay && !this.upgradePending) {
      if (this.wave > 0) {
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
  }

  checkCollisions() {
    const playerBullets = [...this.playerBullets.getChildren()] as Bullet[];
    const enemyBullets = [...this.enemyBullets.getChildren()] as Bullet[];
    const enemyArr = [...this.enemies.getChildren()] as Enemy[];
    const asteroidArr = [...this.asteroids.getChildren()] as Asteroid[];

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

    if (!this.ship.isInvincible() && !this.godMode) {
      for (const b of enemyBullets) {
        if (this.circleOverlap(b.x, b.y, b.radius, this.ship.x, this.ship.y, 4)) {
          b.kill();
          this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 15, 80, 3);
          if (this.ship.takeDamage(1)) {
            this.triggerGameOver();
            return;
          }
          this.audioManager.onPlayerHit();
          break;
        }
      }

      for (const a of asteroidArr) {
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

  spawnWave() {
    this.wave++;
    this.waveTimer = 0;
    this.waveText.setText(`WAVE ${this.wave}`);

    const enemyCount = 8 + this.wave * 3;
    const pool = this.buildEnemyPool(this.wave);

    for (let i = 0; i < enemyCount; i++) {
      const edge = Phaser.Math.Between(0, 3);
      let x: number, y: number;
      if (edge === 0) { x = Phaser.Math.Between(0, 1280); y = -30; }
      else if (edge === 1) { x = 1310; y = Phaser.Math.Between(0, 720); }
      else if (edge === 2) { x = Phaser.Math.Between(0, 1280); y = 750; }
      else { x = -30; y = Phaser.Math.Between(0, 720); }

      const type = pool[Math.floor(Math.random() * pool.length)];
      const enemy = new Enemy(this, x, y, type);
      this.enemies.add(enemy);
    }

    const asteroidCount = 1 + Math.floor(this.wave / 2);
    for (let i = 0; i < asteroidCount; i++) {
      const ax = Math.random() < 0.5 ? -40 : 1320;
      const ay = Phaser.Math.Between(80, 640);
      const asteroid = new Asteroid(this, ax, ay, "large");
      this.asteroids.add(asteroid);
    }
  }

  buildEnemyPool(wave: number): EnemyType[] {
    const pool: EnemyType[] = ["basic", "tracker"];
    if (wave >= 2) pool.push("sniper");
    if (wave >= 3) pool.push("swarm", "swarm");
    if (wave >= 4) pool.push("spiral");
    if (wave >= 6) pool.push("tank");
    return pool;
  }

  clearEnemies() {
    ([...this.enemies.getChildren()] as Enemy[]).forEach((e) => e.destroy());
    ([...this.enemyBullets.getChildren()] as Bullet[]).forEach((b) => b.kill());
    ([...this.asteroids.getChildren()] as Asteroid[]).forEach((a) => a.destroy());
  }

  devSpawnEnemies(count: number) {
    const pool = this.buildEnemyPool(this.wave);
    for (let i = 0; i < count; i++) {
      const edge = Phaser.Math.Between(0, 3);
      let x: number, y: number;
      if (edge === 0) { x = Phaser.Math.Between(0, 1280); y = -30; }
      else if (edge === 1) { x = 1310; y = Phaser.Math.Between(0, 720); }
      else if (edge === 2) { x = Phaser.Math.Between(0, 1280); y = 750; }
      else { x = -30; y = Phaser.Math.Between(0, 720); }
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.add(new Enemy(this, x, y, type));
    }
  }

  devSpawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      const ax = Math.random() < 0.5 ? -40 : 1320;
      const ay = Phaser.Math.Between(80, 640);
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

    const overlay = document.createElement("div");
    overlay.className = "upgrade-overlay";
    this.upgradeOverlay = overlay;

    const title = document.createElement("div");
    title.className = "upgrade-title";
    title.textContent = "CHOOSE AN UPGRADE";
    overlay.appendChild(title);

    const cardRow = document.createElement("div");
    cardRow.className = "upgrade-cards";

    for (const upg of upgrades) {
      const card = document.createElement("div");
      card.className = upg.isWeapon ? "upgrade-card weapon-card" : "upgrade-card";

      const lvl = upg.level(this.stats);
      const weaponTag = upg.isWeapon ? `<div class="upgrade-weapon-tag">WEAPON</div>` : "";
      const levelBar = upg.isWeapon
        ? ""
        : `<div class="upgrade-level">${"■".repeat(lvl + 1)}${"□".repeat(upg.maxLevel - lvl - 1)}</div>`;
      card.innerHTML = `
        ${weaponTag}
        <div class="upgrade-icon">${upg.icon}</div>
        <div class="upgrade-name">${upg.name}</div>
        <div class="upgrade-desc">${upg.description}</div>
        ${levelBar}
      `;

      card.addEventListener("click", () => {
        this.applyUpgrade(upg);
        overlay.remove();
        this.upgradeOverlay = null;
        this.upgradePending = false;
        this.spawnWave();
      });

      cardRow.appendChild(card);
    }

    overlay.appendChild(cardRow);
    document.body.appendChild(overlay);

    for (const evt of ["pointerdown", "pointerup", "pointermove", "keydown"] as const) {
      overlay.addEventListener(evt, (e) => e.stopPropagation());
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
  }

  triggerGameOver() {
    this.gameOver = true;
    this.particles.burst(this.ship.x, this.ship.y, 0xff4422, 40, 150, 4);
    this.particles.burst(this.ship.x, this.ship.y, 0xffcc66, 20, 100, 3);
    this.gameOverText.setText(
      `GAME OVER\n\nSCORE: ${this.score}  |  WAVE: ${this.wave}\n\nR — restart   ESC — menu`,
    );
    this.audioManager.onPlayerDeath();

    this.escKey.once("down", () => {
      if (this.gameOver) {
        if (this.upgradeOverlay) {
          this.upgradeOverlay.remove();
          this.upgradeOverlay = null;
        }
        this.scene.start("StartScene");
      }
    });
  }

  restartGame() {
    this.score = 0;
    this.wave = 0;
    this.gameOver = false;
    this.paused = false;
    this.upgradePending = false;
    this.chainCount = 0;
    this.chainTimer = 0;
    this.gameOverText.setText("");
    if (this.upgradeOverlay) {
      this.upgradeOverlay.remove();
      this.upgradeOverlay = null;
    }
    if (this.tutorial?.isActive) {
      this.tutorial.skip();
    }
    this.tutorial = null;
    this.scene.restart();
  }
}
