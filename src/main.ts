import { installGrain } from "./paper";
import { Sheet } from "./sheet";
import { Thermal } from "./thermal";
import { Sfx } from "./sound";
import { Ribbon } from "./ribbon";
import { Iris } from "./iris";
import { Rack } from "./rack";
import { UI } from "./extras";

installGrain();

const deepLink = window.location.hash.match(/^#p([1-9])$/);

let ui: UI | null = null;

const sheet = new Sheet({
  onIndex: (i) => ui?.setIndex(i),
  onMove: (pos) => ui?.setPos(pos),
  onFirstMove: () => ui?.hideHint(),
});

const thermal = new Thermal();
const sfx = new Sfx();

const ribbon = new Ribbon(document.getElementById("ribbon") as HTMLCanvasElement);

const iris = new Iris(
  document.getElementById("iris") as HTMLElement,
  document.getElementById("irisBlades") as unknown as SVGSVGElement,
  document.getElementById("irisPhoto") as HTMLCanvasElement,
  document.getElementById("irisPct") as HTMLElement,
  document.querySelector(".iris-hole-ring") as HTMLElement
);

new Rack(document.getElementById("rack") as HTMLElement);

ui = new UI(sheet, thermal, iris, ribbon, sfx);
ui.setIndex(sheet.index);

if (deepLink) {
  const idx = Number(deepLink[1]) - 1;
  if (idx >= 0 && idx < sheet.panels.length) window.setTimeout(() => sheet.goTo(idx, false), 60);
}

// Keep the sheet's measured width honest after fonts and first paint.
window.setTimeout(() => sheet.measure(), 500);
document.addEventListener("visibilitychange", () => {
  ribbon.setActive(!document.hidden && sheet.index <= 1);
});

// dev handle for the press operator
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__ws = { sheet, ui, thermal, iris, ribbon };
}
