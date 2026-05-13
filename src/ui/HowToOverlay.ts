import { isMobile } from "../systems/GameConfig";

export function createHowToOverlay(onClose: () => void): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "options-overlay";

  const title = document.createElement("div");
  title.className = "options-title";
  title.textContent = "HOW TO PLAY";
  overlay.appendChild(title);

  const content = document.createElement("div");
  content.style.cssText =
    "font-family:monospace;font-size:15px;color:#998877;text-align:center;line-height:2.2;max-width:500px;";

  content.innerHTML = isMobile()
    ? [
        "Left stick — move",
        "Right stick — aim & shoot",
        "",
        "Move to speed up time",
        "Release to freeze time",
      ].join("<br>")
    : [
        "WASD — move",
        "Mouse — aim",
        "Click — shoot",
        "ESC — pause",
        "",
        "Move to speed up time",
        "Stop to freeze time",
      ].join("<br>");

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
