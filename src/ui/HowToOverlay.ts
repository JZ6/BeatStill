import { isMobile } from "../systems/GameConfig";

interface HowToSection {
  heading: string;
  lines: string[];
}

/** The how-to-play text: controls first, then how the music works. */
export function howToSections(mobile: boolean): HowToSection[] {
  const controls = mobile
    ? ["Left stick — move", "Right stick — aim and fire", "❚❚ (top right) — pause"]
    : ["WASD — move", "Mouse — aim", "Hold the mouse button — fire", "ESC — pause"];
  return [
    { heading: "CONTROLS", lines: controls },
    {
      heading: "TIME IS THE TEMPO",
      lines: [
        "Time moves only when you act: moving, aiming and firing speed it up.",
        "Stand still and the world nearly stops. The music's tempo follows time.",
      ],
    },
    {
      heading: "THE BAND",
      lines: [
        "Every enemy is an instrument and fires on the beat: tanks play bass, snipers the snare.",
        "Your weapon plays its note value: an ⅛ note weapon fires on every ⅛.",
        "Kills close together chain, and each chain tier stacks the notes into harmony.",
        "In slow motion a drone holds the chord and the heartbeat slows.",
      ],
    },
  ];
}

export function createHowToOverlay(onClose: () => void): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "options-overlay";

  const title = document.createElement("div");
  title.className = "options-title";
  title.textContent = "HOW TO PLAY";
  overlay.appendChild(title);

  const content = document.createElement("div");
  content.style.cssText =
    "font-family:monospace;font-size:14px;color:#998877;text-align:center;line-height:1.7;max-width:560px;width:90vw;max-height:70vh;overflow-y:auto;display:flex;flex-direction:column;gap:18px;";

  for (const section of howToSections(isMobile())) {
    const block = document.createElement("div");
    const heading = document.createElement("div");
    heading.textContent = section.heading;
    heading.style.cssText = "font-size:11px;letter-spacing:3px;color:#ffaa44;margin-bottom:6px;";
    block.appendChild(heading);
    for (const line of section.lines) {
      const p = document.createElement("div");
      p.textContent = line;
      block.appendChild(p);
    }
    content.appendChild(block);
  }

  overlay.appendChild(content);

  const closeBtn = document.createElement("button");
  closeBtn.className = "options-close-btn";
  closeBtn.textContent = "CLOSE";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.remove();
    onClose();
  });
  overlay.appendChild(closeBtn);

  for (const evt of ["pointerdown", "pointerup", "pointermove", "click", "keydown"] as const) {
    overlay.addEventListener(evt, (e) => e.stopPropagation());
  }

  return overlay;
}
