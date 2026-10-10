# Beat Still — Music Overhaul Plan

- **Created:** 2026-10-09
- **Branch:** `overhaul/music-core`
- **Status:** Phases 0–3 complete. Phase 4 (enemies as instruments) in progress.

## 1. Vision

Gameplay *is* the music. The sounds of bullets (player and enemy), impacts and enemies combine into a coherent piece. Time dilation is the other pillar: the world moves only when the player acts, and the music moves with it.

## 2. Confirmed decisions

| Topic | Decision |
|---|---|
| Approach | Rebuild the core in place on a branch. Keep Phaser 3 + Tone.js. Port the peripheral features onto the new core. |
| Features kept | All of them: endless roguelite (relics, upgrades, evolutions, mutators, bosses), meta-progression (shop, unlocks, achievements, collection), 30 campaign levels, level editor, multiple sound themes, touch controls, tutorial. |
| Slow-mo sound | Tempo follows time: one clock for world and music. A real-time drone and a closing low-pass filter hold the atmosphere when time nearly stops. |
| Player shots | Fire snaps to the grid: each weapon has a note subdivision. A small late-grace window lets a press just after a step fire immediately. |

## 3. Current state: why it doesn't feel like music

Research was done 2026-10-09 by reading every source file individually.

1. **Two separate clocks.**
   - The world runs on `TimeManager.scale` (0.03–1.0).
   - Music runs on the Tone Transport at `theme.bpm × max(scale, 0.3)` (`AudioManager.ts:352`).
   - At full slow-mo the world runs at 3% speed while the music runs at 30%.
   - No accumulated game clock exists.
2. **Nothing is on the beat.**
   - Every event sound plays at `Tone.now()`, which is about 100 ms late because of the default `lookAhead`.
   - Enemy fire cooldowns, chain windows and wave timers are raw milliseconds.
   - Enemy fire starts at a random phase (`Enemy.ts:32`).
3. **Nothing is in the chord.**
   - Event pitches come from a scale-walking counter or `Math.random` (`AudioManager.ts:189,248,256`). No chord state is tracked.
   - Several themes' scales clash with their own chords:
     - Theremin: C pentatonic over Em/D.
     - Synth: Eb over Bb/Gm.
     - Piano: F over C7.
     - Ethereal: mixes Aeolian and Dorian.
     - Guitar: B3 outside its scale.
   - Shots are hard-coded to `"C2"` in every key (`AudioManager.ts:165,176`).
4. **Enemies are mute.**
   - Enemy firing has never produced a sound in any commit.
   - `onEnemyKill()` takes no arguments, so all 11 enemy types sound identical.
   - Collision audio calls pass no data: no type, position or weapon.
5. **Dense moments collapse.**
   - Simultaneous triggers on mono synths throw Tone's "start time must be strictly greater" error, which `safe()` deliberately swallows (`AudioManager.ts:153`). Notes vanish exactly when it should be loudest.
   - There is no compressor or limiter.
6. **The background pad is probably arpeggiated by accident.** `theme.chords` (`string[][]`) is passed to `Tone.Sequence`, which treats sub-arrays as subdivisions (`AudioManager.ts:130-136`).

### Quantization history

- Commit `88e8702` added a hand-rolled `quantize()`. It rounded `Tone.now()` up to 16ths of the *base* BPM. It was not locked to the Transport and it ignored the ramped tempo.
- Commit `908817f` removed it from hits and kills, citing "drifted seconds ahead".
- Commit `53a6c32` removed it from shots and asteroids.
- That code actually capped lag at 2 grid steps (~0.3 s). The real silent-sounds bug was the guitar theme returning the shared delay node, which `loadTheme` then disposed. That was fixed in the same commit.
- **Conclusion:** beat-snapping is viable. The implementation was the problem.

### Time dilation input bugs

- **Mouse aim rotation adds ~0 to time speed.** `Ship.ts:159` computes `aimDelta` before the aim angle is updated from the pointer.
- **Any WASD press saturates `inputMag` to 1.** `Ship.ts:152` uses the pre-normalisation magnitude, so time is effectively binary for keyboard players.
- **Spin wrap is incomplete and can go negative.** `Ship.ts:141-143` and `Ship.ts:159-161` fold the angle only once.
- **Spin is frame-rate dependent.** It uses per-frame delta without dividing by dt.
- **`TimeManager` uses linear lerp.** The `min(k·dt, 1)` form is mildly frame-rate dependent.

## 4. Target architecture

```
real time (AudioContext clock) ─► TimeDilation (input → timeScale 0.03–1)
                                        │
      Conductor: beat += realDt × bpm/60 × timeScale   ← the ONE game clock
        │ gameDt                        │ step events (16ths), bar events
        ▼                               ▼
  movement / physics          EnemyRhythm · PlayerFire · SpawnDirector (act ON steps)
        └──────── GameEvents bus (fired, hit, killed, clash, bounce, crack, shatter…) + data
                                        ▼
  MusicEngine: Harmony (key, mode, progression, chord @ beat)
               Instruments (per enemy type / weapon / impact class)
               VoicePool (per-step aggregation, per-instrument caps) → Compressor → Limiter
               Drone (real time; gain ↑ and filter ↓ as timeScale ↓)
```

### Components

- **Conductor**
  - Owns musical position (`beat`, `step`, `bar`), `bpm` and `timeScale`.
  - Reads real time from the AudioContext clock instead of Phaser's `delta`, so game and audio cannot drift. It falls back to `performance.now()` until audio is unlocked.
  - Emits every crossed step in order, even when one frame crosses several.
  - Exposes `gameDt` (seconds of game time this frame).
  - The core math is pure TypeScript with no Phaser or Tone imports, so it is unit-testable.
- **Scheduling (fixed latency, jitter-free)**
  - A step crossed mid-frame is scheduled at its exact fractional real time plus a constant latency `L` (~30–40 ms, calibratable).
  - The result is sample-accurate rhythm rather than frame-quantized rhythm.
  - Visuals happen at the frame crossing.
  - The Tone Transport is **not** used for timing, because it misbehaves near zero tempo. Synths are triggered at absolute audio times.
- **TimeDilation**
  - Replaces `TimeManager`.
  - Inputs: analog move magnitude, aim angular velocity in rad/s measured in **real** time, and fire intent.
  - Smoothing: exponential (`1 − exp(−k·dt)`).
  - Clamped to 0.03–1.0. Weights are tunable.
- **GameEvents**
  - A typed event bus.
  - Gameplay code (collisions, enemies, ship, walls, pickups) emits events with data and never calls audio directly.
- **MusicEngine**
  - Subscribes to GameEvents and Conductor steps.
  - Picks pitches from Harmony by musical role.
  - Triggers instruments through the VoicePool.
- **Harmony**
  - Key, mode and chord progression (chords per bar).
  - Provides `chordAt(beat)`, chord tones, the chord-scale, and `pickNote(role, register, degreeHint)`.
- **Instruments / themes**
  - Data-driven palettes: each theme defines tempo, key/mode, progression, and an instrument per role.
  - The 6 existing themes (theremin, guitar, bell, synth, ethereal, piano) are ported as palettes, keeping their ids.
- **VoicePool**
  - At most one trigger per instrument per step; velocity scales with the number of sources (e.g. `v0 + k·log2(N)`).
  - Per-instrument voice caps, voice stealing, and a master compressor and limiter.
  - Replaces `safe()`'s silent swallowing.
- **Drone**
  - Runs in real time, independent of the conductor.
  - Plays the root and fifth of the current chord.
  - Crossfades in as `timeScale` drops, with a low-pass filter that closes as time slows.
- **Pause**
  - Freezes the conductor.
  - Ramps master gain down over 50–100 ms and fades the drone.
  - Pauses Phaser tweens and timers, and physics.
  - The relic picker and options overlay use the same path.
  - So does tab visibility loss (Phaser pauses its loop, but audio does not).

### Things that must stay on real time (not conductor time)

- Tutorial minimum step time.
- UI tweens and overlays.
- Death animation.
- Touch/mouse angular velocity.
- `freezeTime` accumulation (the `time_lord` achievement).
- Phantom charge (it punishes slow-mo).
- The drone.
- Invincibility frames: decide during Phase 2. They are currently real time, which wastes i-frames when the player stands still.

### Testing strategy

- **vitest** covers the pure modules: conductor math, step crossing, harmony and note picking, rhythm patterns, time-dilation formula, save normalisation and migration, and the level-def normaliser.
- **Browser smoke test** (`npm run smoke`, `scripts/smoke.mjs`), per the README TODO. It is dependency-free: it serves `dist/` with `vite preview` and drives local headless Chrome over the DevTools protocol, reaching game state through the `window.__BEATSTILL__` debug hook.
  - It plays two endless runs, with a menu round-trip between them.
  - It fails on uncaught exceptions, console errors, failed resource loads, the crash overlay, audio not starting, no wave or enemies, time not speeding up while shooting, or time not slowing when idle.
  - It saves screenshots to `smoke-artifacts/`.
  - The `cli-chrome` skill was not usable: no paired browser.
  - Add assertions as the core changes (e.g. the conductor advances, enemy fire is audible).
- **Manual playtest checklist** for each phase.

## 5. Musical mapping (initial sketch — tune in playtests)

### Enemies (current stats → proposed role)

| Type | hp | speed | fire (ms) | Current pattern | Proposed role / rhythm |
|---|---|---|---|---|---|
| basic ("Drone" in bestiary) | 2 | 40 | 2400 | radial ring 4→10 by wave @160, wanders | Chord pad / stab, once per bar |
| tracker | 1 | 60 | 2000 | aimed 3, spread 0.4 @220; hovers 150 px above player | Staccato lead stab, syncopated (e.g. beat 3 or off-beat) |
| sniper | 1 | 20 | 1600 | aimed 2, spread 0.15 @350; wanders | Backbeat snare/rim (2 & 4) or a lead dyad |
| spiral | 3 | 25 | 300 | spiral 4 arms @130, rotating 2 rad/s | Arpeggiator on 8ths; rotation advances per step (≈3π/16 per 8th keeps the look) |
| tank | 6 | 15 | 2800 | radial 8 @120 + aimed 4 spread 0.5 @180 | Bass on downbeats (root) |
| swarm | 1 | 90 | 3200 | aimed 2 spread 0.25 @170; chases | Hi-hat / shaker, aggregated per step |
| snake | 2 | 50 | 2400 | aimed 3 spread 0.3 @200; weaving chase | Melodic line whose pitch follows the weave phase (beat-locked) |
| circler | 3 | 20 | 2200 | radial 16 @110; straight drift | Bell / chord bloom once per bar |
| sentinel (boss) | 30 | 8 | 2000/1500/800 | phases at hp ≤20, ≤10; minions | Boss "movement": phases = song sections, changing on bar lines |
| phantom (boss) | 40 | 40 | 2500/2000/1500 | phases at hp ≤27, ≤13; teleports 4000/3000/2000; decoys in P3; real-time charge | Movement with teleport = pickup → downbeat; decoys hold tension tones |
| phantom_decoy | 1 | 0 | – | none | Tension voice; dies → resolves |

- Each instance gets a phase offset within its pattern so a crowd of one type doesn't fire in unison.
- The random 500–1500 ms initial cooldown is replaced by step offsets.
- Bullet geometry (`getFirePattern`) stays.

### Weapons (base cooldown → proposed note value at 120 BPM; tentative)

At 120 BPM: ¼ = 500 ms, ⅛ = 250 ms, ⅛T ≈ 167 ms, 1/16 = 125 ms, 1/32 ≈ 62.5 ms.

| Weapon | baseCooldown | Proposed |
|---|---|---|
| standard | 220 | ⅛ |
| shotgun | 450 | ¼ |
| laser | 130 | 1/16 |
| cannon | 600 | ¼ or ½ |
| homing | 280 | ⅛ |
| nova (evo shotgun) | 550 | ¼ |
| railgun (evo laser) | 180 | ⅛T |
| nuke (evo cannon) | 1200 | ½ |
| swarm (evo homing) | 320 | ⅛ or dotted ⅛ |
| minigun (evo standard) | 70 | 1/32 |

- Weapon bullets trace a melody in the current chord-scale.
- `bulletCount` could map to chord voicing (root, 3rd, 5th, 7th, 9th).

### Impacts (GameEvents → sound)

| Event | Sound idea |
|---|---|
| enemy hit (non-lethal) | Short pitched tick, chord tone, panned by x |
| enemy killed | The enemy's instrument plays a resolving chord tone. Chain tier raises the register / adds voices. |
| bullet clash (cannon/nuke) | Metallic hit, upper chord tone |
| wall bounce | Percussive ping; the axis or face picks the degree |
| solid absorb | Muted ghost note (rate-limited) |
| glass crack | Bell; remaining hp selects a descending degree |
| glass shatter | Crash + falling arpeggio (phrase accent) |
| asteroid break | Size → register (large = root/sub, medium = 3rd/5th, small = high); a chain plays as a rising arpeggio |
| pickup collected | Chime on a chord tone; a weapon pickup plays a motif on that weapon's instrument |
| player hit / death | Dissonant hit; death → ritardando / drone collapse in real time |
| level complete | Cadence to tonic, UI on next downbeat |

### Systems that change meaning

| System | Current | Musical version |
|---|---|---|
| Upgrade `fireCooldown` (Rapid Fire) | −15 ms/level (150 → 60), 6 levels | Subdivision ladder or Euclidean density steps; replace with an integer level |
| Upgrade `chainWindow` | +200 ms/level (max 600) | +N steps/level (beats, conductor time) |
| Shop `quick_draw` | −10 ms (floor 60) | Subdivision tier |
| Shop `chain_link` | +100 ms | +¼ beat per level |
| Relic `metronome` | chain radius ×0.5, window ×1.5 | Actual on-beat kill bonus |
| Relic `overclock` | cooldown /2, lifetime /2 | Doubles subdivision; lifetime in beats |
| Relic `timewarp` | enemy bullets ×0.1 when ts < 0.15 | Re-tune against the new curve and drone |
| Mutator `double_time` | enemy speed ×1.5 | Literal double-time (subdivision ×2) or rename |
| Mutator `bullet_storm` | fire period ×0.5 | Denser pattern variant |
| Mutators (general) | multipliers | Add musical fields: key change, swing, half-time, mode; activate on phrase boundaries |
| Evolution standard → minigun | requires max `fireCooldown` | Update the id when the stat is renamed (`Evolutions.ts:16` fails silently otherwise) |
| Chain tiers | BEAT/RHYTHM/MELODY/HARMONY/CRESCENDO (count-based) | Keep the names; add on-beat / harmonic bonuses |

## 6. Constraints

### Save compatibility (must not break existing players)

| Key | Shape |
|---|---|
| `beatstill_options` | flat `GameOptions` (add only flat fields; the load merge is shallow) |
| `beatstill_unlocks` | Unlocks state incl. `shards`, `shopPurchases` |
| `beatstill_achievements` | `{ unlockedIds, totalKills, bossesDefeated, weaponsUsed, themesUsed }` |
| `beatstill_levels` | `{ completedIds: number[] }` |
| `beatstill_custom_levels` | `LevelDef[]` |
| `beatstill_editor` | `LevelDef` |
| `beatstill_tutorial_done` | `"1"` |

- **Keep these ids unchanged:**
  - weapon ids (`standard, shotgun, laser, cannon, homing, nova, railgun, nuke, swarm, minigun`)
  - all 16 achievement ids
  - theme ids (lowercase theme name)
  - `theme_*` unlock ids
  - shop item ids
  - level ids (the unlock chain uses `id − 1`)
- Add `normalize*()` / migration on every load: validate types and fill defaults.
- New `LevelDef` fields (e.g. `music?: { bpm?, key?, mode?, progression?, theme? }`, per-wave `bars?`) are **optional**.

### Tech

- Resolved versions (lockfile): **phaser 3.90.0**, **tone 15.1.22**, typescript 5.9.3, vite 6.4.2.
- Use Tone v15 accessors (`getContext()`, `getTransport()`, `getDraw()`, `getDestination()`).
- Vite `base: "/BeatStill/"`, so build any asset URLs with `import.meta.env.BASE_URL`.
- Build target ES2020: no top-level await, and the default lib has no `Array.prototype.at`. Add `lib: ["ES2022","DOM","DOM.Iterable"]` if needed. **Do not** bump `target` past ES2021 without setting `useDefineForClassFields`, because class-field semantics would change in the enemy hierarchy.
- Disable Phaser audio (`audio: { noAudio: true }`) so there is only one AudioContext.
- `tsconfig` `include: ["src"]`: put tests under `src/**/*.test.ts` or extend `include`.
- CI (`.github/workflows/deploy.yml`):
  - Deploys to Pages on push to `main`.
  - No PR checks.
  - Node 20 (EOL).
  - `cancel-in-progress: true`.

## 7. Known bugs (fix in Phase 1 unless tied to a later phase)

"(u)" = unverified, confirm when fixing.

### Engine / scenes

- **StartScene leaks on every return to the menu.** `enemies`, `bullets`, `pulseRings` and `menuButtons` are never reset in `create()` (`StartScene.ts:69-71,93`). The `72f95e7` fix (`:729`) only masks the crash.
- **StartScene ENDLESS** calls `scene.start("GameScene")` without data and may reuse the previous run's data (`:763`) (u).
- **GameScene fields not reset on restart:** `bossActive`, `waveDelay`, `godMode`, `audioStarted` (`GameScene.ts:59-62,76`).
- **ESC handler likely stacks** on each restart (`GameScene.ts:171`).
- **`enemyArr` is the live group array** iterated while enemies may be destroyed or spawned (`GameScene.ts:249`).
- **`onPlayerDeath()` has no `audioStarted` guard** (`GameScene.ts:623`).
- **Volume is not re-applied on restart** (`GameScene.ts:153`).
- **Pause doesn't freeze anything:** tweens, timers, physics and audio keep running (`PauseMenu.ts:87-103`). Button `stopPropagation` targets the native event, so the resume tap leaks into scene handlers.
- **Particles use frame-based damping** (`Particles.ts:75-76`). Particles live ~33× longer in slow-mo, saturate the cap and drop new bursts.
- **Phaser `fps.target` doesn't cap the frame rate** (`main.ts`, `GameOptions.ts:65`).
- **Phaser creates a second AudioContext.**
- **CrashReporter:**
  - The snapshot has no try/catch.
  - The crash count is capped at 20 (`CrashReporter.ts:100,193`).
- **DevPanel's 500 ms interval** is never cleared.

### Gameplay objects

- **Asteroid double-split.** There's no `active` guard in `split()` (`Asteroid.ts:86-97`) and no `a.active` check in `CollisionSystem.ts:129`.
- **Possible double damage in one frame:** ship vs bullets, then ship vs asteroids (`CollisionSystem.ts:65-67`).
- **Bullet ricochet** happens 20 px off-screen, then the bullet jumps (`Bullet.ts:84,90-91`). `hit()` has no `alive` guard.
- **Wall:**
  - One-way uses position, not velocity (`Wall.ts:142-148`).
  - Ricochet has no direction check, causing double bounces (`:189-202`).
  - Inside-wall `pushOut` uses the wrong axis (`:226-235`).
  - The crack seed misbehaves at some coordinates (`:110-113`).
- **Bosses:**
  - The hit flash is overwritten the next frame (Sentinel `:109`, Phantom `:129,150`).
  - Phase thresholds are hard-coded HP values.
  - A large hit can skip a phase only partially.
  - Volleys due during a teleport or phase transition are lost.
  - Phantom `decoyCount` can leak, and decoys outlive the boss.
- **Snake:** `drawPolygon(color, 2)` is degenerate, and the weave is only ±1.9 px (invisible).
- **Circler:** re-aims every frame while outside the margin, so the path jitters.
- **TouchControls:**
  - Radii are not UI-scaled (unusable at 1440p).
  - No move dead zone.
  - Stale aim angle on touch-down.
  - No `pointerupoutside` handling.
- **GameConfig:** portrait `UI_SCALE` uses the long side (`GameConfig.ts:30`).

### Progression / data

- **Shop writes `beatstill_unlocks` directly**, bypassing Unlocks (`Shop.ts:71`).
- **`collector` achievement** checks the current shard balance, not pickups.
- **`totalKills` can be lost** on tab close (no flush hook).
- **Fragile mutator** sets HP mult to 0 instead of clamping to 1 (`WaveMutators.ts:34`) (u: check the consumer).
- **`rollMutator` returns null** from wave 31.
- **Relic picker** softlocks if choices are empty.
- **Glass relic "damage ×3"** may be unimplemented (u).
- **EndlessMode** spawns `32 + wave·10` enemies in one frame without bound. The circler effectively first appears at wave 6.
- **LevelRunner:**
  - `triggerComplete` is not idempotent.
  - Custom levels get marked complete in campaign progress.
  - The "CAMPAIGN" button always goes to level select.
- **CustomLevels:** ids can be reused after a delete.
- **LevelDesigner:**
  - A shallow copy mutates the source level (`LevelDesignerScene.ts:89-94`).
  - Four copy points drop unknown fields (`:84-118,191-201`).
  - The id is unstable while unsaved (`:111`).
  - The description is lost.
  - Backspace while typing the name deletes the selection (u).
- **LevelDesignerUI:**
  - `innerHTML` injection in the load modal (`LevelDesignerUI.ts:327`).
  - Import validation is weak, and `waves: []` crashes the renderer.
- **Tutorial:**
  - Step 2 is auto-satisfied (`startRotation` is captured in the constructor).
  - Step 3 is a transient check.
  - Step 7 can softlock.
  - `finish()` double-spawns a wave.
- **CollectionOverlay** uses `innerHTML` from save data (`CollectionOverlay.ts:121-129,195`).
- **Bestiary data is duplicated** from the enemy classes (`InfoTab.ts:18-29`).

### Level data

| Level | Issue |
|---|---|
| 3 Crossfire | The glass box around the ship is off-centre (interior centred at 0.51,0.51) |
| 5 The Swarm | All 20 swarms spawn off-screen; the closed top/bottom of the box may trap homing swarms |
| 8 Sniper Alley | Full-height bounce walls may seal off the snipers, making it unwinnable (u) |
| 9 One Way In | Depends on the one-way semantics; corners overlap with conflicting directions |
| 14 Mirror Match | **Ship spawns inside a bounce wall** |
| 15 Killbox | Glass panels are flush against solid walls and do nothing |
| 17 Sentinel | 0.02 corner holes in the arena |
| 19 Bullet Rain | Float drift drops the x=0.92 column (77 bullets instead of 84) |
| 21, 25, 28, 30 | Duplicate stacked swarm spawns |
| 25 Gauntlet | Snakes overlap walls; swarms spawn over side walls |
| 27 Storm | Description says "every enemy" but sentinel and phantom are missing; the circler spawns 0.05 from the ship |
| 28 Endgame | Enemies spawn inside persisting walls |
| 29 Bullet Cathedral | Tanks spawn on bullets |

### Audio (fixed by the Phase 3 rewrite)

- **Event sounds ignore the beat and the chord.**
  - No quantization.
  - No harmonic state.
  - Theme scale/chord clashes (§3).
  - Shots fixed at C2.
- **Synth handling:**
  - `Tone.Sequence` subdivides the chord arrays.
  - `safe()` swallows dropped notes.
  - No limiter.
- **Lifecycle:**
  - The delay time is fixed at creation.
  - Themes set before `start()` are lost.
  - Concurrent `start()` calls leak nodes.
  - `dispose()` doesn't stop the Transport.
- **Dead code:** the six `shotSynths` are reachable only from a `previewShot()` with no callers; `onBossPhaseChange` has no callers.
- **Muffled sounds (u):** MonoSynth default filters likely muffle short blips; Bell and Ethereal are all-sine and hard to tell apart.

## 8. Roadmap

Each phase ends playable and committed. Nothing is pushed without an explicit instruction.

### Phase 0 — Foundations
- [x] Branch `overhaul/music-core`
- [x] `npm install`; add `vitest` 5; scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`
- [x] CI: tests before build in deploy; new `ci.yml` for PRs and non-main pushes; Node 24; deploy `cancel-in-progress: false`
- [x] Typed `GameEvents` bus (`src/core/EventBus.ts`, `src/core/GameEvents.ts`) with tests (not yet wired into gameplay)
- [x] `main.ts`: Phaser `audio: { noAudio: true }`
- [x] Browser smoke test: `npm run smoke` (headless Chrome via CDP; see §4 Testing strategy). Verified it fails on an injected exception.
- [ ] Follow-up: run the smoke test in CI once headless audio on Linux runners is confirmed
- [ ] Follow-up: `npm audit` reports 4 high-severity issues in dev tooling (vite ≤6.4.2, postcss, nanoid, source-map-js); fix via `npm audit fix`

### Phase 1 — Bug sweep
- [x] Engine/scene bugs (§7): StartScene reset, GameScene field resets, ESC stacking, live-array iteration, pause freezing tweens/timers/physics, particle damping, FPS cap via `fps.limit`
  - ENDLESS now passes `{ mode: "endless" }`.
  - Auto-pause when the tab is hidden.
  - Fire is suppressed until the mouse is released after resuming.
  - Options are validated (`normalizeOptions`).
- [x] Gameplay object bugs: asteroid split guard, bullet ricochet and `hit()` guard, wall ricochet direction / inside push-out, boss hit flash, % HP thresholds, circler jitter, snake shape
  - `Wall.handleBullet` returns a `WallHitResult`.
  - Enemies get a `canFire()` hook, so no volleys are lost.
  - Decoys belong to an owner.
  - Piercing bullets hit each enemy only once.
- [x] Progression: route Shop through Unlocks, add a save normaliser, fix `collector`, flush kills on visibility change, Fragile clamp, relic empty-choice guard, LevelRunner idempotence
  - New modules: `storage.ts` and `saveSchemas.ts`.
  - `collector` now counts a new `totalPickups` field.
  - Custom levels no longer mark campaign progress.
  - Endless waves are capped at 150 enemies.
- [x] Editor: deep copy, a structured-clone round-trip that preserves unknown fields, stable id, description, `innerHTML` → `textContent`, import validation
  - Imports are checked by `LevelValidation.normalizeLevelDef`.
  - Custom-level ids are never reused (new key `beatstill_custom_next_id`).
  - Imported levels get a fresh id.
- [x] Level data fixes:
  - L8 was confirmed unwinnable; windows were cut into its bounce walls.
  - Also fixed: L3, L10, L14, L17, L19, L21, L23, L25, L27, L28, L29, L30.
  - A verification script checked all 30 levels with 0 failures.
- [ ] Follow-up: the snake weave frequency (2.4 Hz, ±22 px) may feel too twitchy. It gets beat-locked in Phase 4.

### Phase 2 — Clock + time dilation
- [x] `Conductor` (`src/core/Conductor.ts`): 24 ticks/beat, tick events with `lateBy`, multi-tick crossing, pause.
  - Decision: real dt comes from Phaser's frame delta (clamped to 100 ms).
  - Audio is anchored to `AudioContext.currentTime` every frame (time = now + L − lateBy), so there is no drift and no separate clock source to switch between.
- [x] `TimeDilation` (`src/core/TimeDilation.ts`): additive activity (move 0.7, fire 0.6, spin ≤ 0.35 at 8 rad/s); exponential smoothing (rise 10/s, fall 6/s); `AngularSpeedTracker`. `Ship.readInput()` fixes the spin bug and the WASD saturation.
- [x] Entities keep `update(delta, timeScale)` with the clamped real delta and the conductor's timeScale, so nothing is pre-scaled twice. `TimeManager` was removed.
- [x] Audited gameplay `delayedCall`/tweens: the remaining ones are UI and should stay real time. Ms-based enemy, chain and wave timers move to musical time in Phases 4–6.
- [x] Pause, the relic overlay, tab-hidden and game over all pause the conductor (`togglePause()`).
- [x] `GameScene` split from 819 to 364 lines. New `src/game/` modules: Hud, ToastQueue, PickupSystem, RunProgression, WaveDirector, RelicFlow, GameOverFlow, Backdrop (beat pulse), TickDispatcher. Also new: `src/core/InputMath.ts`.
- [x] I-frames run at the player's own time rate (`ts*0.5+0.5`), which answers open question 3. Touch controls got dead zones and `px()` scaling. Portrait `UI_SCALE` is fixed.
- [ ] Follow-up: a DevPanel theme switch doesn't update the conductor's BPM (resolved in Phase 3 when themes become palettes).

### Phase 3 — Music engine
- [x] `src/music/` modules: `theory.ts`, `Harmony.ts` (roman-numeral progressions, avoid-notes, `pickChordTone`), `patterns.ts` (Euclid, parse, densify)
- [x] `palettes.ts`: 6 palettes keep their ids, and every progression stays inside its key.
  - theremin: E aeolian, i VI VII iv
  - guitar: A aeolian, i III iv v
  - bell: D aeolian, i iv v III
  - synth: C aeolian, i VI VII v
  - ethereal: B dorian, i III VII IV
  - piano: F ionian, I vi IV V7
- [x] `src/audio/AudioEngine.ts`:
  - Its own voice accounting and pools, with merge and drop stats.
  - Master chain: compressor → limiter → volume.
  - Reverb/delay sends and a lowpass filter driven by timeScale.
  - Scheduling at `currentTime + when`, with latency built into the requests.
- [x] Drone (real time, follows the chord, louder in slow-mo) and a heartbeat (lub-dub on beats 1 and 3)
- [x] `MusicDirector` turns GameEvents and ticks into notes via `src/game/MusicSystem.ts`. All gameplay audio is routed through GameEvents. `AudioManager` and `src/sounds/` were removed. Audio unlocks on the first pointer or key press.
- [x] DevPanel audio tab rebuilt (palette switch, role previews, stats). The menu has its own conductor, heartbeat and drone, and the EKG follows the heartbeat.
- [ ] Follow-up (Phase 4): many notes are dropped (basic/tracker chords) while enemy fire still runs on ms timers.

### Phase 4 — Enemies as instruments
- [ ] Single enemy registry (stats, visuals, instrument, default pattern); constructors read from it
- [ ] Rhythm patterns (16-step / Euclidean) + per-instance phase offsets; enemies fire on steps
- [ ] Audible enemy fire, aggregated per type per step
- [ ] Spiral rotation per step; snake weave beat-locked
- [ ] Bosses: phases switch on bar lines as section changes; teleports land on downbeats; no lost volleys

### Phase 5 — Player as instrument
- [ ] Weapon note values; fire on grid with a late-grace window; aim computed at spawn time
- [ ] Rework upgrades, shop, relics and evolutions per §5; chain window in beats
- [ ] On-beat feedback (visual pulse; metronome relic bonus)

### Phase 6 — Song structure
- [ ] Waves spawn on bar lines; LevelRunner pending-spawn guard; wave timer in bars
- [ ] Endless: continuous bar-aligned spawning (README TODO); cap the simultaneous enemy count
- [ ] Mutators as section modifiers on phrase boundaries
- [ ] Optional `LevelDef.music` + per-wave fields; normaliser; editor UI to edit and audition them

### Phase 7 — Periphery
- [ ] Tutorial rewritten for the musical mechanics (latched counters; real-time step minimum)
- [ ] HowTo text; bestiary / weapon tabs from the registries (note values, instruments)
- [ ] Options: audio latency offset + calibration, drone volume, beat visualiser, reduce flashing, haptics
- [ ] StartScene heartbeat/EKG driven by the conductor; theme preview phrase in Customize
- [ ] Crash snapshot includes conductor and harmony state
- [ ] Menu heartbeat is too slow when idle (up to ~40 s at timeScale 0.03). Give the menu conductor a higher floor.
- [ ] Add a `theme_piano` unlock. Piano currently can't be selected, so the Virtuoso achievement (all 6 themes) is impossible.

### Phase 8 — Balance
- [ ] Playtest passes: tempo per theme, pattern density, enemy counts, weapon subdivisions, time-dilation weights
- [ ] README TODO items: player shot speed, enemy counts, diep.io-style penetration and bullet destruction

## 9. Open questions

1. **Tempo source.** Proposal: a per-theme default BPM, which levels may override. A single global tempo is simpler.
2. **Fixed latency `L` default.** Proposal: ~35 ms, with calibration in Options.
3. **Invincibility frames.** Should they run on real time (current) or game time?
4. **One-way walls.** Switch to velocity-based semantics, or keep position-based and fix the arrow direction?
5. **Spiral enemy.** Keep simultaneous 4-arm volleys (arpeggio across volleys), or make "each arm on successive 16ths" an elite variant?
6. **Naming.** Rename the enemy "Drone" (basic) in the UI to avoid confusion with the audio drone?
7. **Walls persisting across waves.** Several levels (16, 23) depend on it, so keep it.
