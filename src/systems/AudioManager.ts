import * as Tone from "tone";
import type { SoundTheme } from "../sounds/SoundTheme";
import { theremin } from "../sounds";

export type ShotSound = "kick" | "soft" | "tap" | "808" | "bubble" | "pulse";

export class AudioManager {
  private shotSynths!: Record<ShotSound, Tone.MonoSynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth>;
  activeShotSound: ShotSound = "soft";

  private leadSynth!: Tone.PolySynth;
  private leadEffects!: Tone.InputNode;
  private padSynth!: Tone.PolySynth;
  private bassPulse!: Tone.MonoSynth;
  private bassSynth!: Tone.MonoSynth;
  private deathSynth!: Tone.MonoSynth;
  private clashSynth!: Tone.MonoSynth;
  private hitSynth!: Tone.NoiseSynth;

  private warmReverb!: Tone.Reverb;
  private delay!: Tone.FeedbackDelay;
  private master!: Tone.Volume;
  private bgSequence!: Tone.Sequence;
  private bassSequence!: Tone.Sequence;

  private theme!: SoundTheme;
  private noteIndex = 0;
  private started = false;
  private lastQuantized = 0;
  private lastRampedBpm = 0;
  private lastRampedReverb = 0;
  private lastRampedDelay = 0;
  private lastRampMs = 0;

  get currentTheme() {
    return this.theme;
  }

  get isStarted() {
    return this.started;
  }

  async start() {
    if (this.started) return;
    await Tone.start();
    this.started = true;

    this.master = new Tone.Volume(0).toDestination();
    this.warmReverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 }).connect(this.master);
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.2, wet: 0.15 }).connect(this.warmReverb);

    this.shotSynths = {
      kick: new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 4,
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
        volume: -14,
      }).connect(this.warmReverb),
      soft: new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
        volume: -16,
      }).connect(this.warmReverb),
      tap: new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
        volume: -16,
      }).connect(this.warmReverb),
      "808": new Tone.MembraneSynth({
        pitchDecay: 0.08, octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.1, release: 0.3 },
        volume: -12,
      }).connect(this.warmReverb),
      bubble: new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
        filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04, baseFrequency: 2000, octaves: -2 },
        volume: -14,
      }).connect(this.warmReverb),
      pulse: new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
        volume: -16,
      }).connect(this.warmReverb),
    };

    this.hitSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 },
      volume: -8,
    }).connect(this.warmReverb);

    this.loadTheme(theremin);

    Tone.getTransport().start();
  }

  loadTheme(theme: SoundTheme) {
    if (!this.started) return;
    if (this.bgSequence) { this.bgSequence.stop(); this.bgSequence.dispose(); }
    if (this.bassSequence) { this.bassSequence.stop(); this.bassSequence.dispose(); }
    if (this.leadSynth) this.leadSynth.dispose();
    if (this.leadEffects && this.leadEffects !== this.delay && "dispose" in this.leadEffects) {
      (this.leadEffects as Tone.ToneAudioNode).dispose();
    }
    if (this.padSynth) this.padSynth.dispose();
    if (this.bassPulse) this.bassPulse.dispose();
    if (this.bassSynth) this.bassSynth.dispose();
    if (this.deathSynth) this.deathSynth.dispose();
    if (this.clashSynth) this.clashSynth.dispose();

    this.theme = theme;
    this.activeShotSound = theme.shotSound;
    this.lastRampedBpm = 0;
    this.lastRampedReverb = 0;
    this.lastRampedDelay = 0;

    this.leadEffects = theme.createLeadEffects(this.delay);
    this.leadSynth = theme.createLeadSynth(this.leadEffects);
    this.padSynth = theme.createPadSynth(this.warmReverb);
    this.bassPulse = theme.createBassSynth(this.warmReverb);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.4 },
      volume: -12,
    }).connect(this.warmReverb);
    this.deathSynth = theme.createDeathSynth(this.warmReverb);
    this.clashSynth = theme.createClashSynth(this.delay);

    this.bgSequence = new Tone.Sequence(
      (time, chord) => {
        this.safe(() => this.padSynth.triggerAttackRelease(chord, "1n", time));
      },
      theme.chords,
      "1n",
    );

    this.bassSequence = new Tone.Sequence(
      (time, note) => {
        if (note) this.safe(() => this.bassPulse.triggerAttackRelease(note, "4n", time));
      },
      theme.bassPattern(theme.bassNotes),
      "8n",
    );

    Tone.getTransport().bpm.value = theme.bpm;
    this.bgSequence.start(0);
    this.bassSequence.start(0);
  }

  private quantize(): number {
    const now = Tone.now();
    const grid = (60 / (this.theme?.bpm ?? 100)) / 4;
    const quantized = Math.ceil(now / grid) * grid;
    if (quantized <= this.lastQuantized) return this.lastQuantized + grid;
    this.lastQuantized = quantized;
    return quantized;
  }

  private safe(fn: () => void) {
    try { fn(); } catch (e) {
      if (e instanceof Error && !e.message.includes("start")) {
        console.warn("[AudioManager]", e.message);
      }
    }
  }

  private triggerShot(type: ShotSound, time: number) {
    const synth = this.shotSynths[type];
    if (synth instanceof Tone.NoiseSynth) {
      synth.triggerAttackRelease("32n", time);
    } else {
      (synth as Tone.MembraneSynth | Tone.MonoSynth | Tone.MetalSynth)
        .triggerAttackRelease("C2", "32n", time);
    }
  }

  onShoot(soundOverride?: ShotSound) {
    if (!this.started) return;
    const time = this.quantize();
    this.safe(() => this.triggerShot(soundOverride ?? this.activeShotSound, time));
  }

  previewShot(type: ShotSound) {
    if (!this.started) return;
    this.safe(() => this.triggerShot(type, Tone.now()));
  }

  onEnemyHit() {
    if (!this.started) return;
    const scale = this.theme.scale;
    const note = scale[this.noteIndex % scale.length];
    this.noteIndex++;
    const now = Tone.now();
    this.safe(() => this.leadSynth.triggerAttackRelease(note, "8n", now));
  }

  onEnemyKill() {
    if (!this.started) return;
    const scale = this.theme.scale;
    const i = this.noteIndex % scale.length;
    const note1 = scale[i];
    const note2 = scale[(i + 2) % scale.length];
    this.noteIndex++;
    const now = Tone.now();
    this.safe(() => this.leadSynth.triggerAttackRelease([note1, note2], "4n", now));
  }

  onChainKill(chainLength: number, tier: number) {
    if (!this.started) return;
    const scale = this.theme.scale;
    const baseIdx = this.noteIndex % scale.length;
    const scaleIdx = Math.min(baseIdx + chainLength, scale.length - 1);
    this.noteIndex++;
    const now = Tone.now();

    if (tier <= 1) {
      const note = scale[scaleIdx];
      this.safe(() => this.leadSynth.triggerAttackRelease(note, "4n", now));
    } else if (tier === 2) {
      const n1 = scale[scaleIdx];
      const n2 = scale[Math.min(scaleIdx + 2, scale.length - 1)];
      this.safe(() => this.leadSynth.triggerAttackRelease([n1, n2], "4n", now));
    } else if (tier === 3) {
      const n1 = scale[scaleIdx];
      const n2 = scale[Math.min(scaleIdx + 2, scale.length - 1)];
      const n3 = scale[Math.min(scaleIdx + 4, scale.length - 1)];
      this.safe(() => this.leadSynth.triggerAttackRelease([n1, n2, n3], "4n", now));
    } else {
      const n1 = scale[scaleIdx];
      const n2 = scale[Math.min(scaleIdx + 2, scale.length - 1)];
      const n3 = scale[Math.min(scaleIdx + 4, scale.length - 1)];
      this.safe(() => this.leadSynth.triggerAttackRelease([n1, n2, n3], "2n", now));
      const bass = this.theme.bassNotes;
      const bassNote = bass[Math.min(scaleIdx % bass.length, bass.length - 1)];
      this.safe(() => this.bassSynth.triggerAttackRelease(bassNote, "4n", now));
    }
  }

  onChainBreak(tier: number) {
    if (!this.started || tier < 2) return;
    const scale = this.theme.scale;
    const idx = this.noteIndex % scale.length;
    const dissonant = scale[Math.min(idx + 1, scale.length - 1)];
    this.safe(() => this.clashSynth.triggerAttackRelease(dissonant, "16n", Tone.now()));
  }

  onAsteroidBreak() {
    if (!this.started) return;
    const bass = this.theme.bassNotes;
    const note = bass[Math.floor(Math.random() * bass.length)];
    const time = this.quantize();
    this.safe(() => this.bassSynth.triggerAttackRelease(note, "8n", time));
  }

  onBulletClash() {
    if (!this.started) return;
    const scale = this.theme.scale;
    const upper = Math.floor(scale.length / 2);
    const note = scale[upper + Math.floor(Math.random() * (scale.length - upper))];
    this.safe(() => this.clashSynth.triggerAttackRelease(note, "32n", Tone.now()));
  }

  onPlayerHit() {
    if (!this.started) return;
    this.safe(() => this.hitSynth.triggerAttackRelease("8n", Tone.now()));
  }

  onPlayerDeath() {
    if (!this.started) return;
    const now = Tone.now();
    this.theme.deathNotes.forEach((note, i) => {
      this.safe(() => this.deathSynth.triggerAttackRelease(note, "8n", now + i * 0.15));
    });
  }

  onBossWarning() {
    if (!this.started) return;
    const now = Tone.now();
    const bass = this.theme.bassNotes;
    this.safe(() => this.bassPulse.triggerAttackRelease(bass[0], "8n", now));
    const deathNotes = [...this.theme.deathNotes].reverse();
    deathNotes.slice(0, 3).forEach((note, i) => {
      this.safe(() => this.deathSynth.triggerAttackRelease(note, "8n", now + 0.3 + i * 0.2));
    });
  }

  onBossPhaseChange() {
    if (!this.started) return;
    const scale = this.theme.scale;
    const idx = this.noteIndex % scale.length;
    const n1 = scale[idx];
    const n2 = scale[Math.min(idx + 2, scale.length - 1)];
    const n3 = scale[Math.min(idx + 4, scale.length - 1)];
    const now = Tone.now();
    this.safe(() => this.padSynth.triggerAttackRelease([n1, n2, n3], "1n", now));
    const bass = this.theme.bassNotes;
    this.safe(() => this.bassSynth.triggerAttackRelease(bass[0], "4n", now));
  }

  onBossDeath() {
    if (!this.started) return;
    const scale = this.theme.scale;
    const now = Tone.now();
    for (let i = 0; i < 5; i++) {
      const note = scale[Math.min(i * 2, scale.length - 1)];
      this.safe(() => this.leadSynth.triggerAttackRelease(note, "8n", now + i * 0.12));
    }
    this.safe(() => this.padSynth.triggerAttackRelease(scale.slice(0, 3), "2n", now + 0.1));
    const bass = this.theme.bassNotes;
    this.safe(() => this.bassSynth.triggerAttackRelease(bass[0], "2n", now + 0.6));
  }

  setVolume(fraction: number) {
    if (!this.master) return;
    if (fraction <= 0) {
      this.master.volume.value = -Infinity;
    } else {
      this.master.volume.value = Tone.gainToDb(fraction);
    }
  }

  dispose() {
    if (!this.started) return;
    this.bgSequence?.stop();
    this.bgSequence?.dispose();
    this.bassSequence?.stop();
    this.bassSequence?.dispose();
    this.leadSynth?.dispose();
    if (this.leadEffects && this.leadEffects !== this.delay && "dispose" in this.leadEffects) {
      (this.leadEffects as Tone.ToneAudioNode).dispose();
    }
    this.padSynth?.dispose();
    this.bassPulse?.dispose();
    this.bassSynth?.dispose();
    this.deathSynth?.dispose();
    this.clashSynth?.dispose();
    this.hitSynth?.dispose();
    for (const synth of Object.values(this.shotSynths ?? {})) {
      synth.dispose();
    }
    this.delay?.dispose();
    this.warmReverb?.dispose();
    this.master?.dispose();
    this.started = false;
  }

  updateTimeScale(scale: number) {
    if (!this.started) return;

    const now = Date.now();
    if (now - this.lastRampMs < 80) return;
    this.lastRampMs = now;

    const targetBpm = (this.theme?.bpm ?? 100) * Math.max(scale, 0.3);
    const targetReverb = 0.2 + (1 - scale) * 0.5;
    const targetDelay = 0.1 + (1 - scale) * 0.3;

    if (Math.abs(targetBpm - this.lastRampedBpm) > 0.5) {
      this.safe(() => Tone.getTransport().bpm.rampTo(targetBpm, 0.3));
      this.lastRampedBpm = targetBpm;
    }
    if (Math.abs(targetReverb - this.lastRampedReverb) > 0.01) {
      this.safe(() => this.warmReverb.wet.rampTo(targetReverb, 0.3));
      this.lastRampedReverb = targetReverb;
    }
    if (Math.abs(targetDelay - this.lastRampedDelay) > 0.01) {
      this.safe(() => this.delay.wet.rampTo(targetDelay, 0.3));
      this.lastRampedDelay = targetDelay;
    }
  }
}
