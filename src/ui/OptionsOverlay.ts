import { options, saveOptions, applyFps } from "../systems/GameOptions";

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

export function createOptionsOverlay(onClose: () => void): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "options-overlay";

  overlay.innerHTML = `<div class="options-title">OPTIONS</div>`;

  const body = document.createElement("div");
  body.className = "options-body";
  overlay.appendChild(body);

  body.appendChild(makeSegmentRow(
    "Target FPS",
    FPS_OPTIONS,
    (o) => o.value === options.targetFps,
    (o) => {
      applyFps(o.value);
      saveOptions(options);
    },
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

  const controlsHint = document.createElement("div");
  controlsHint.textContent = "Reload required to apply";
  controlsHint.style.cssText = "font-size:11px;color:#887766;text-align:center;display:none;";
  body.appendChild(controlsHint);

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

  body.appendChild(makeSliderRow(
    "Master Volume",
    options.masterVolume,
    (v) => {
      options.masterVolume = v;
      saveOptions(options);
      const slider = document.getElementById("volume-slider") as HTMLInputElement;
      if (slider) slider.value = String(v);
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

  const resHint = document.createElement("div");
  resHint.textContent = "Reload required to apply";
  resHint.style.cssText = "font-size:11px;color:#887766;text-align:center;display:none;";
  body.appendChild(resHint);

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

function makeSliderRow(
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
