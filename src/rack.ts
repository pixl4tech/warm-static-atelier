import { clamp } from "./util";

type CubeDef = { glyphs: string[]; serif?: boolean; accent?: number };

const DEFS: CubeDef[] = [
  { glyphs: ["W", "a", "r", "m", "4", "&"], serif: true, accent: 2 },
  { glyphs: ["A", "t", "t", "e", "n", "§"], serif: true, accent: 5 },
  { glyphs: ["R", "o", "t", "a", "t", "e"], accent: 2 },
  { glyphs: ["M", "a", "k", "e", "2", "7"], accent: 3 },
  { glyphs: ["&", "¶", "†", "×", "Ø", "%"], accent: 0 },
];

class Cube {
  el: HTMLDivElement;
  private rx: number;
  private ry: number;
  private vx = 0;
  private vy = 0;
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private raf = 0;

  constructor(wrap: HTMLElement, def: CubeDef, idx: number) {
    this.el = document.createElement("div");
    this.el.className = "cube";
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "button");
    this.el.setAttribute("aria-label", `Letterpress block ${idx + 1}. Drag or use arrow keys to turn it.`);
    const faces = ["front", "back", "right", "left", "top", "bottom"];
    def.glyphs.forEach((g, i) => {
      const f = document.createElement("div");
      f.className = `face face--${faces[i]}`;
      if (i === def.accent) f.classList.add(i % 2 ? "face--verm" : "face--cob");
      f.textContent = g;
      this.el.appendChild(f);
    });
    if (def.serif) this.el.classList.add("cube--serif");
    wrap.appendChild(this.el);

    this.rx = -14 - idx * 1.5;
    this.ry = -12 + idx * 6;
    this.apply();

    this.bind();
  }

  private apply() {
    this.el.style.transform = `rotateX(${this.rx.toFixed(2)}deg) rotateY(${this.ry.toFixed(2)}deg)`;
  }

  private spin(dx: number, dy: number) {
    this.ry += dx;
    this.rx = clamp(this.rx - dy, -85, 85);
    this.apply();
  }

  private inertia() {
    if (this.raf) return;
    const step = () => {
      this.vx *= 0.94;
      this.vy *= 0.94;
      this.ry += this.vx;
      this.rx = clamp(this.rx + this.vy, -88, 88);
      this.apply();
      if (Math.abs(this.vx) + Math.abs(this.vy) > 0.05) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = 0;
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  private bind() {
    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.moved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.vx = this.vy = 0;
      this.el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
      this.spin(dx * 0.7, dy * 0.7);
      this.vx = dx * 0.35;
      this.vy = dy * 0.35;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.moved) {
        this.vx = 0;
        this.vy = 0;
        this.ry += 90;
        this.rx = clamp(this.rx - 8, -85, 85);
        this.apply();
      } else {
        this.inertia();
      }
    };
    this.el.addEventListener("pointerup", up);
    this.el.addEventListener("pointercancel", up);
    this.el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.ry -= 16;
        this.apply();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        this.ry += 16;
        this.apply();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.rx = clamp(this.rx + 14, -85, 85);
        this.apply();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.rx = clamp(this.rx - 14, -85, 85);
        this.apply();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.ry += 90;
        this.apply();
      }
    });
  }
}

export class Rack {
  private cubes: Cube[] = [];
  constructor(root: HTMLElement) {
    DEFS.forEach((def, i) => {
      const wrap = document.createElement("div");
      wrap.className = "cube-wrap";
      wrap.dataset.k = String(i);
      root.appendChild(wrap);
      this.cubes.push(new Cube(wrap, def, i));
    });
  }
}
