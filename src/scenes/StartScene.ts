import Phaser from "phaser";
import { options, saveOptions, applyFps } from "../systems/GameOptions";

const FPS_OPTIONS = [
  { label: "30",      value: 30 },
  { label: "60",      value: 60 },
  { label: "120",     value: 120 },
  { label: "240",     value: 240 },
  { label: "Uncapped", value: 0 },
];

const PARTICLE_OPTIONS = [
  { label: "Off",   value: 0 },
  { label: "Low",   value: 150 },
  { label: "Medium", value: 300 },
  { label: "High",  value: 500 },
  { label: "Ultra", value: 800 },
];

export class StartScene extends Phaser.Scene {
  private optionsOverlay: HTMLDivElement | null = null;

  constructor() {
    super("StartScene");
  }

  create() {
    const cx = 640;
    const cy = 360;

    this.add
      .text(cx, cy - 140, "BEAT STILL", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#e8d5b0",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 60, "bullet hell  x  time control  x  music", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#887766",
      })
      .setOrigin(0.5);

    const lines = [
      "WASD — move            Move to speed up time",
      "Mouse — aim            Stop to freeze time",
      "Click — shoot",
      "ESC — pause",
    ];

    this.add
      .text(cx, cy + 30, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#998877",
        align: "center",
        lineSpacing: 10,
        fixedWidth: 600,
      })
      .setOrigin(0.5);

    const startText = this.add
      .text(cx, cy + 180, "[ CLICK TO START ]", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffaa44",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // OPTIONS button (DOM)
    const optBtn = document.createElement("button");
    optBtn.id = "start-options-btn";
    optBtn.textContent = "OPTIONS";
    document.body.appendChild(optBtn);

    optBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showOptionsOverlay();
    });

    this.input.on("pointerdown", () => {
      this.startGame();
    });

    this.input.keyboard?.on("keydown", () => {
      this.startGame();
    });

    // clean up DOM button when scene shuts down
    this.events.once("shutdown", () => {
      optBtn.remove();
      this.optionsOverlay?.remove();
      this.optionsOverlay = null;
    });
  }

  private startGame() {
    if (this.optionsOverlay) return;
    this.scene.start("GameScene");
  }

  private showOptionsOverlay() {
    if (this.optionsOverlay) return;

    const overlay = document.createElement("div");
    overlay.className = "options-overlay";
    this.optionsOverlay = overlay;

    overlay.innerHTML = `<div class="options-title">OPTIONS</div>`;

    const body = document.createElement("div");
    body.className = "options-body";
    overlay.appendChild(body);

    // FPS
    body.appendChild(this.makeSegmentRow(
      "Target FPS",
      FPS_OPTIONS,
      (o) => o.value === options.targetFps,
      (o) => {
        applyFps(o.value);
        saveOptions(options);
      },
    ));

    // Particles
    body.appendChild(this.makeSegmentRow(
      "Particles",
      PARTICLE_OPTIONS,
      (o) => o.value === options.particleQuality,
      (o) => {
        options.particleQuality = o.value;
        saveOptions(options);
      },
    ));

    // Bullet Glow
    body.appendChild(this.makeToggleRow(
      "Bullet Glow",
      () => options.bulletGlow,
      (v) => { options.bulletGlow = v; saveOptions(options); },
    ));

    // Show FPS
    body.appendChild(this.makeToggleRow(
      "Show FPS Counter",
      () => options.showFps,
      (v) => { options.showFps = v; saveOptions(options); },
    ));

    // Volume
    body.appendChild(this.makeSliderRow(
      "Master Volume",
      options.masterVolume,
      (v) => {
        options.masterVolume = v;
        saveOptions(options);
        const slider = document.getElementById("volume-slider") as HTMLInputElement;
        if (slider) slider.value = String(v);
      },
    ));

    const closeBtn = document.createElement("button");
    closeBtn.className = "options-close-btn";
    closeBtn.textContent = "CLOSE";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.remove();
      this.optionsOverlay = null;
    });
    overlay.appendChild(closeBtn);

    for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
      overlay.addEventListener(evt, (e) => e.stopPropagation());
    }

    document.body.appendChild(overlay);
  }

  private makeSegmentRow(
    label: string,
    opts: { label: string; value: number }[],
    isActive: (o: { label: string; value: number }) => boolean,
    onChange: (o: { label: string; value: number }) => void,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "options-row";

    const lbl = document.createElement("div");
    lbl.className = "options-row-label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const seg = document.createElement("div");
    seg.className = "options-segment";

    const btns: HTMLButtonElement[] = [];
    for (const opt of opts) {
      const btn = document.createElement("button");
      btn.className = "options-seg-btn" + (isActive(opt) ? " active" : "");
      btn.textContent = opt.label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onChange(opt);
        btns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      btns.push(btn);
      seg.appendChild(btn);
    }

    row.appendChild(seg);
    return row;
  }

  private makeToggleRow(
    label: string,
    getValue: () => boolean,
    onChange: (v: boolean) => void,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "options-row";

    const lbl = document.createElement("div");
    lbl.className = "options-row-label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const btn = document.createElement("button");
    btn.className = "options-toggle" + (getValue() ? " active" : "");
    btn.textContent = getValue() ? "ON" : "OFF";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = !getValue();
      onChange(next);
      btn.textContent = next ? "ON" : "OFF";
      btn.classList.toggle("active", next);
    });
    row.appendChild(btn);
    return row;
  }

  private makeSliderRow(
    label: string,
    initial: number,
    onChange: (v: number) => void,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "options-row";

    const lbl = document.createElement("div");
    lbl.className = "options-row-label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.value = String(initial);
    input.className = "options-slider";

    const val = document.createElement("span");
    val.className = "options-slider-val";
    val.textContent = String(initial);

    input.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = parseInt(input.value);
      val.textContent = String(v);
      onChange(v);
    });

    right.appendChild(input);
    right.appendChild(val);
    row.appendChild(right);
    return row;
  }
}
