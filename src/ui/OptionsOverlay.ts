import { getAudioEngine } from "../audio/AudioEngine";
import { hapticsSupported } from "../systems/feedback";
import {
  LATENCY_MAX_MS,
  LATENCY_MIN_MS,
  applyFps,
  droneGainFor,
  options,
  saveOptions,
} from "../systems/GameOptions";

const FPS_OPTIONS = [
  { label: "30",      value: 30 },
  { label: "60",      value: 60 },
  { label: "120",     value: 120 },
  { label: "240",     value: 240 },
  { label: "Uncapped", value: 0 },
];

const RES_OPTIONS = [
  { label: "480p",  value: 0 },
  { label: "720p",  value: 1 },
  { label: "1080p", value: 2 },
  { label: "1440p", value: 3 },
];

const CONTROLS_OPTIONS = [
  { label: "Auto",     value: 0 },
  { label: "KB+Mouse", value: 1 },
  { label: "Touch",    value: 2 },
];

const PARTICLE_OPTIONS = [
  { label: "Off",   value: 0 },
  { label: "Low",   value: 150 },
  { label: "Medium", value: 300 },
  { label: "High",  value: 500 },
  { label: "Ultra", value: 800 },
];

const HINT_STYLE = "font-size:11px;color:#887766;text-align:center;";

/**
 * The options screen (menu and pause menu). Every change is saved; audio and accessibility options
 * apply live (the music reads latency and heartbeat every frame, the visual and haptic feedback
 * read their flags when they fire); controls and resolution need a reload.
 */
export function createOptionsOverlay(onClose: () => void): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "options-overlay";

  overlay.innerHTML = `<div class="options-title">OPTIONS</div>`;

  const body = document.createElement("div");
  body.className = "options-body";
  // Many rows: scroll on short screens instead of pushing CLOSE off-screen.
  body.style.maxHeight = "70vh";
  body.style.overflowY = "auto";
  body.style.paddingRight = "6px";
  overlay.appendChild(body);

  // ── Video ──
  body.appendChild(makeSectionLabel("VIDEO"));

  body.appendChild(makeSegmentRow(
    "Target FPS",
    FPS_OPTIONS,
    (o) => o.value === options.targetFps,
    (o) => {
      applyFps(o.value);
      saveOptions(options);
    },
  ));

  const resRow = makeSegmentRow(
    "Resolution",
    RES_OPTIONS,
    (o) => o.value === options.resolution,
    (o) => {
      options.resolution = o.value;
      saveOptions(options);
      resHint.style.display = "block";
    },
  );
  body.appendChild(resRow);

  const resHint = makeHint("Reload required to apply");
  resHint.style.display = "none";
  body.appendChild(resHint);

  body.appendChild(makeSegmentRow(
    "Particles",
    PARTICLE_OPTIONS,
    (o) => o.value === options.particleQuality,
    (o) => {
      options.particleQuality = o.value;
      saveOptions(options);
    },
  ));

  body.appendChild(makeToggleRow(
    "Bullet Glow",
    () => options.bulletGlow,
    (v) => { options.bulletGlow = v; saveOptions(options); },
  ));

  body.appendChild(makeToggleRow(
    "Show FPS Counter",
    () => options.showFps,
    (v) => { options.showFps = v; saveOptions(options); },
  ));

  const controlsRow = makeSegmentRow(
    "Controls",
    CONTROLS_OPTIONS,
    (o) => o.value === options.controls,
    (o) => {
      options.controls = o.value;
      saveOptions(options);
      controlsHint.style.display = "block";
    },
  );
  body.appendChild(controlsRow);

  const controlsHint = makeHint("Reload required to apply");
  controlsHint.style.display = "none";
  body.appendChild(controlsHint);

  // ── Audio ──
  body.appendChild(makeSectionLabel("AUDIO"));

  body.appendChild(makeSliderRow(
    "Master Volume",
    options.masterVolume,
    (v) => {
      options.masterVolume = v;
      const slider = document.getElementById("volume-slider") as HTMLInputElement | null;
      if (slider) {
        slider.value = String(v);
        // Setting .value doesn't fire listeners; main.ts applies the volume to audio on "input".
        slider.dispatchEvent(new Event("input"));
      }
    },
    () => saveOptions(options),
  ));

  body.appendChild(makeSliderRow(
    "Drone Volume",
    options.droneVolume,
    (v) => {
      options.droneVolume = v;
      getAudioEngine().setDroneGain(droneGainFor(v));
    },
    () => saveOptions(options),
  ));

  body.appendChild(makeToggleRow(
    "Heartbeat",
    () => options.heartbeat,
    (v) => { options.heartbeat = v; saveOptions(options); },
  ));

  body.appendChild(makeSliderRow(
    "Audio Latency",
    options.audioLatencyMs,
    (v) => { options.audioLatencyMs = v; },
    () => saveOptions(options),
    { min: LATENCY_MIN_MS, max: LATENCY_MAX_MS, step: 5, format: (v) => `${v} ms` },
  ));
  body.appendChild(makeHint("How far ahead notes are scheduled. Raise it if notes crackle or drop out."));

  // ── Accessibility ──
  body.appendChild(makeSectionLabel("ACCESSIBILITY"));

  body.appendChild(makeToggleRow(
    "Beat Visualizer",
    () => options.beatVisualizer,
    (v) => { options.beatVisualizer = v; saveOptions(options); },
  ));
  body.appendChild(makeHint("A subtle pulse around the screen edge on every beat."));

  body.appendChild(makeToggleRow(
    "Reduce Flashing",
    () => options.reduceFlashing,
    (v) => { options.reduceFlashing = v; saveOptions(options); },
  ));
  body.appendChild(makeHint("No beat flashes or grid pulse; gentler camera shake."));

  body.appendChild(makeToggleRow(
    "Haptics",
    () => options.haptics,
    (v) => { options.haptics = v; saveOptions(options); },
  ));
  body.appendChild(makeHint(hapticsSupported()
    ? "Short vibrations on hits and bar downbeats."
    : "Vibration isn't supported on this device."));

  const closeBtn = document.createElement("button");
  closeBtn.className = "options-close-btn";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  overlay.appendChild(closeBtn);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}

function makeSectionLabel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "font-size:11px;color:#554433;letter-spacing:3px;text-align:center;margin-top:4px;";
  return el;
}

function makeHint(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = HINT_STYLE;
  return el;
}

function makeSegmentRow(
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

function makeToggleRow(
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

interface SliderConfig {
  min?: number;
  max?: number;
  step?: number;
  /** Text shown next to the slider (default: the number). */
  format?: (v: number) => string;
}

function makeSliderRow(
  label: string,
  initial: number,
  onChange: (v: number) => void,
  onCommit?: (v: number) => void,
  config: SliderConfig = {},
): HTMLDivElement {
  const { min = 0, max = 100, step = 1, format = (v: number) => String(v) } = config;
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
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initial);
  input.className = "options-slider";

  const val = document.createElement("span");
  val.className = "options-slider-val";
  val.textContent = format(initial);
  // Room for the widest label (e.g. "200 ms"), so the slider doesn't shift while dragging.
  if (config.format) val.style.minWidth = "56px";

  const read = (): number => {
    const v = Number(input.value);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : initial;
  };

  input.addEventListener("input", (e) => {
    e.stopPropagation();
    const v = read();
    val.textContent = format(v);
    onChange(v);
  });

  // "change" fires once the drag ends (or per keyboard step), so expensive work like saving goes here.
  input.addEventListener("change", (e) => {
    e.stopPropagation();
    onCommit?.(read());
  });

  right.appendChild(input);
  right.appendChild(val);
  row.appendChild(right);
  return row;
}
