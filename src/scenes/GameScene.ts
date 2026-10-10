import Phaser from "phaser";
import { Ship } from "../objects/Ship";
import type { Enemy } from "../objects/enemies";
import type { Asteroid } from "../objects/Asteroid";
import type { Bullet } from "../objects/Bullet";
import { Conductor, type TickEvent } from "../core/Conductor";
import { createGameEvents, type GameEvents } from "../core/GameEvents";
import { TimeDilation } from "../core/TimeDilation";
import { getPalette } from "../music/palettes";
import { ParticleSystem } from "../systems/Particles";
import { defaultStats, type PlayerStats } from "../systems/Upgrades";
import { options } from "../systems/GameOptions";
import { TutorialManager, isTutorialDone } from "../systems/Tutorial";
import { GAME_W, GAME_H, isMobile, px } from "../systems/GameConfig";
import { TouchControls } from "../systems/TouchControls";
import type { LevelDef } from "../systems/Levels";
import { recordThemeUsed } from "../systems/Achievements";
import { ChainSystem } from "../systems/ChainSystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { LevelRunner } from "../systems/LevelRunner";
import { PauseMenu } from "../systems/PauseMenu";
import { RelicSystem } from "../systems/Relics";
import { MutatorSystem } from "../systems/WaveMutators";
import { Backdrop } from "../game/Backdrop";
import { GameOverFlow } from "../game/GameOverFlow";
import { Hud } from "../game/Hud";
import { MusicSystem } from "../game/MusicSystem";
import { PickupSystem } from "../game/PickupSystem";
import { RelicFlow } from "../game/RelicFlow";
import { RunProgression } from "../game/RunProgression";
import { FREEZE_THRESHOLD } from "../game/RunStats";
import { TickDispatcher, type StepHandler } from "../game/TickDispatcher";
import { ToastQueue } from "../game/ToastQueue";
import { WaveDirector } from "../game/WaveDirector";

/** Longer frames (tab switch, GC hitch) are clamped so entities and the clock never jump. */
const MAX_FRAME_MS = 100;

/**
 * The in-run scene. Owns the clock (Conductor + TimeDilation), the entity groups and the
 * per-frame update order, and orchestrates the focused modules in src/game/.
 */
export class GameScene extends Phaser.Scene {
  ship!: Ship;
  /** The single musical game clock. Recreated each run. */
  conductor!: Conductor;
  /** Player activity → time scale. Recreated each run. */
  dilation!: TimeDilation;
  /** Gameplay occurrences (shots, hits, kills, walls, bosses…) for audio and other listeners. Recreated each run. */
  gameEvents!: GameEvents;
  /** GameEvents + conductor ticks → MusicDirector → AudioEngine. Recreated each run. */
  music!: MusicSystem;
  particles!: ParticleSystem;

  playerBullets!: Phaser.GameObjects.Group;
  enemyBullets!: Phaser.GameObjects.Group;
  enemies!: Phaser.GameObjects.Group;
  asteroids!: Phaser.GameObjects.Group;
  walls!: Phaser.GameObjects.Group;
  shards!: Phaser.GameObjects.Group;

  chain!: ChainSystem;
  pauseMenu!: PauseMenu;
  level: LevelRunner | null = null;
  relics!: RelicSystem;
  mutators!: MutatorSystem;
  touchControls: TouchControls | null = null;

  hud!: Hud;
  toasts!: ToastQueue;
  pickups!: PickupSystem;
  progression!: RunProgression;
  waves!: WaveDirector;
  relicFlow!: RelicFlow;
  gameOverFlow!: GameOverFlow;

  stats!: PlayerStats;
  score = 0;
  wave = 0;
  gameOver = false;
  godMode = false;

  private collisions!: CollisionSystem;
  private backdrop!: Backdrop;
  private tutorial: TutorialManager | null = null;
  private frozen = false;
  private readonly tickDispatcher = new TickDispatcher();

  constructor() {
    super("GameScene");
  }

  /** Current world time scale (0.03–1), driven by player activity. */
  get timeScale(): number {
    return this.dilation?.scale ?? 0;
  }

  /**
   * Subscribes to every Conductor tick (24 per beat) for the rest of this run. Returns an
   * unsubscribe function; all subscriptions are dropped when the scene shuts down.
   */
  onTick(handler: (t: TickEvent) => void): () => void {
    return this.tickDispatcher.subscribe(handler);
  }

  /** Like onTick, but only for 16th-note steps; `step` = tick / TICKS_PER_STEP. */
  onStep(handler: StepHandler): () => void {
    return this.tickDispatcher.subscribeSteps(handler);
  }

  create(data?: { mode?: string; levelDef?: LevelDef }) {
    // Any mode other than "level" (including "endless" or no data) runs endless mode.
    const isLevel = data?.mode === "level" && !!data.levelDef;
    this.level = isLevel ? new LevelRunner(this, data!.levelDef!) : null;

    // Phaser reuses this instance on restart, so reset every per-run field; the modules
    // below are recreated. The audio engine is a module singleton that outlives scenes.
    this.score = 0;
    this.wave = 0;
    this.gameOver = false;
    this.godMode = false;
    this.tutorial = null;
    this.relics = new RelicSystem();
    this.mutators = new MutatorSystem();
    // Scene Clock.paused is not reset by Phaser on shutdown/start (tweens and physics are).
    this.frozen = false;
    this.time.paused = false;
    this.tickDispatcher.clear();
    this.gameEvents = createGameEvents();

    const palette = getPalette(options.themeId);
    recordThemeUsed(palette.id);
    this.conductor = new Conductor({ bpm: palette.bpm });
    this.dilation = new TimeDilation();
    this.conductor.timeScale = this.dilation.scale;

    this.backdrop = new Backdrop(this);
    this.onTick((t) => this.backdrop.onTick(t));
    // Song structure first: a wave (or key change) on a bar line is in place before the music and
    // the enemies hear that tick. `this.waves` is read at dispatch time (created below).
    this.onTick((t) => this.waves.onTick(t));
    // Before anything can emit (waves spawn at the end of create()).
    this.music = new MusicSystem(this, palette);

    this.chain = new ChainSystem(this);
    this.chain.init();
    this.collisions = new CollisionSystem(this);

    this.playerBullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.asteroids = this.add.group();
    this.shards = this.add.group();
    this.walls = this.add.group();
    // Enemies fire on the grid: every step reaches every live enemy, in order.
    this.onStep((step, t) => this.stepEnemies(step, t));

    this.progression = new RunProgression(this);
    this.pickups = new PickupSystem(this);
    this.waves = new WaveDirector(this);
    this.relicFlow = new RelicFlow(this);

    const shipX = this.level?.levelDef.shipRx != null ? GAME_W * this.level.levelDef.shipRx : GAME_W / 2;
    const shipY = this.level?.levelDef.shipRy != null ? GAME_H * this.level.levelDef.shipRy : GAME_H / 2;

    this.stats = defaultStats();
    this.stats.weaponId = options.starterWeapon;
    this.particles = new ParticleSystem(this);
    this.ship = new Ship(this, shipX, shipY);
    this.ship.stats = this.stats;
    // The player fires on the grid too: every tick reaches the ship's fire clock.
    this.onTick((t) => this.ship.onTick(t));
    this.ship.hp = this.stats.maxHp;
    this.ship.maxHp = this.stats.maxHp;

    if (isMobile()) {
      this.touchControls?.destroy();
      this.touchControls = new TouchControls(this);
      this.ship.touchControls = this.touchControls;
    }

    this.hud = new Hud(this);
    this.toasts = new ToastQueue(this);

    this.pauseMenu = new PauseMenu(this, () => this.gameOverFlow.goToMenu(), {
      onOpen: () => this.syncFrozen(),
      onClose: () => {
        this.syncFrozen();
        this.ship.suppressFireUntilRelease();
      },
    });
    this.pauseMenu.create();
    this.gameOverFlow = new GameOverFlow(this);

    this.bindPauseControls();

    this.events.once("shutdown", () => {
      this.music.destroy();
      this.tickDispatcher.clear();
      this.gameEvents.clear();
      this.toasts.clear();
      this.pauseMenu.cleanup();
      this.relicFlow.cleanup();
      this.gameOverFlow.cleanup();
      this.frozen = false;
      this.time.paused = false;
    });

    if (this.level) {
      this.hud.setWaveLabel(this.level.levelDef.name.toUpperCase());
      // The first wave spawns on the first bar line (the conductor's first tick).
      this.level.start();
    } else if (!isTutorialDone()) {
      this.tutorial = new TutorialManager(this);
    } else {
      this.waves.spawnEndlessWave();
    }
  }

  update(_time: number, rawDelta: number) {
    if (!this.scene.isActive()) return;
    // Entities get this clamped real delta plus the time scale (they scale it themselves);
    // the conductor gets the same real delta, so world and music share one clock.
    const delta = Math.min(rawDelta, MAX_FRAME_MS);
    const realDt = delta / 1000;
    this.backdrop.update(realDt);
    if (this.gameOver) {
      this.gameOverFlow.update(delta);
      this.particles.update(delta, 0.3);
      this.music.updateGameOver(realDt);
      return;
    }

    if (this.pauseMenu.isActive || this.relicFlow.active) return;

    this.touchControls?.update();

    const input = this.ship.readInput(realDt);
    const ts = this.dilation.update(input, realDt);
    this.conductor.timeScale = ts;
    const advanced = this.conductor.advance(realDt);
    // This frame's fire input and interval, before the ticks that may fire on the grid.
    this.ship.beginFireFrame(advanced.realDt, this);
    this.tickDispatcher.dispatch(advanced.ticks);
    this.progression.trackFreeze(ts, realDt);

    this.ship.update(delta, ts, this);

    if (this.tutorial?.isActive) this.tutorial.update(delta);

    // Copy: enemies can be destroyed or spawned (splits, decoys, summons) while iterating.
    for (const enemy of [...this.enemies.getChildren()] as Enemy[]) {
      if (enemy.active) enemy.update(delta, ts, this);
    }

    for (const a of [...this.asteroids.getChildren()] as Asteroid[]) a.update(delta, ts);

    this.updateBullets(delta, ts, [...this.enemies.getChildren()] as Enemy[]);

    this.collisions.checkAll();
    this.pickups.collect();
    this.pickups.update(delta, ts);
    this.particles.update(delta, ts);
    this.chain.update(delta, ts);
    this.waves.update(delta, ts);

    // Last, so this frame's ticks and gameplay events are all in the director's queue.
    this.music.update(ts);

    this.hud.update(rawDelta, this.stats.weaponId);
  }

  /** A snapshot: enemies spawned during the step (summons, decoys) start on the next one. */
  private stepEnemies(step: number, t: TickEvent) {
    for (const enemy of [...this.enemies.getChildren()] as Enemy[]) {
      if (enemy.active) enemy.onStep(step, t, this);
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
        if (closest) b.steerToward(closest.x, closest.y, 0.08, delta * ts / 1000);
      }
      b.update(delta, ts);
    }

    const enemyTs = (this.relics.hasRelic("timewarp") && ts < FREEZE_THRESHOLD) ? ts * 0.1 : ts;
    for (const b of [...this.enemyBullets.getChildren()] as Bullet[]) b.update(delta, enemyTs);
  }

  addScore(points: number) {
    this.score += points;
    this.hud.setScore(this.score);
  }

  /** Opens or closes the pause menu: ESC, the mobile pause button and the smoke test use this. */
  togglePause() {
    if (!this.gameOver && !this.relicFlow.active) this.pauseMenu.toggle();
  }

  /** Freezes or resumes the conductor, scene tweens, timers and arcade physics. */
  setFrozen(frozen: boolean) {
    if (this.frozen === frozen) return;
    this.frozen = frozen;
    if (frozen) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = frozen;
    const world = this.physics?.world;
    if (world) {
      if (frozen) world.pause();
      else world.resume();
    }
    this.syncConductor();
    this.music.setFrozen(frozen);
    // Aim moved while frozen (e.g. to a menu button) must not register as spinning.
    if (!frozen) this.ship?.resetAimTracking();
  }

  /** The scene stays frozen while either the pause menu or the relic picker is open. */
  syncFrozen() {
    this.setFrozen(this.pauseMenu.isActive || this.relicFlow.active);
  }

  /** The musical clock runs only while the run is live: not frozen and not over. */
  private syncConductor() {
    if (this.frozen || this.gameOver) this.conductor.pause();
    else this.conductor.resume();
  }

  private bindPauseControls() {
    const kb = this.input.keyboard;
    if (kb) {
      const escKey = kb.addKey("ESC");
      const onEsc = () => this.togglePause();
      escKey.on("down", onEsc);
      // KeyboardPlugin destroys its Keys on shutdown in Phaser 3.90; remove explicitly anyway
      // so a restart can never stack a second ESC listener.
      this.events.once("shutdown", () => escKey.off("down", onEsc));
    }

    if (isMobile()) {
      this.add
        .text(GAME_W - px(16), px(16), "❚❚", { fontFamily: "monospace", fontSize: `${px(24)}px`, color: "#887766" })
        .setOrigin(1, 0)
        // Above the pause dim overlay (depth 200) so it can still be tapped to resume.
        .setDepth(202)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.togglePause();
        });
    }

    // Auto-pause when the tab is hidden.
    const onHidden = () => {
      if (this.gameOver || this.pauseMenu.isActive || this.relicFlow.active || this.level?.isComplete) return;
      this.pauseMenu.open();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once("shutdown", () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));
  }
}
