import { clamp, damp } from "./util";

type Point = { x: number; y: number; t: number };

/**
 * Thermochromic ink.
 * The cursor is a heat source: it warms the sheet, developing the carbon-copy
 * layer printed under the visible ink. Move away and the paper cools.
 */
export class Thermal {
  private cursor = document.getElementById("cursor") as HTMLElement;
  private read = document.getElementById("cursorRead") as HTMLElement;
  private glow = document.createElement("div");
  private points: Point[] = [];
  private panel: HTMLElement | null = null;
  private latent: HTMLElement | null = null;
  private enabled = true;
  private x = 0;
  private y = 0;
  private still = 999;
  private speed = 0;
  private temp = 21;
  private lastFrame = 0;
  private lastMask = 0;
  private lastRead = 0;
  private visible = false;
  private mouseIn = false;

  constructor() {
    this.glow.className = "thermal-glow";
    document.body.appendChild(this.glow);
    this.bind();
    requestAnimationFrame(this.loop);
  }

  setActive(panel: HTMLElement) {
    if (this.panel === panel) return;
    this.clearMask();
    this.panel = panel;
    this.latent = panel.querySelector<HTMLElement>(".latent");
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    document.body.classList.toggle("no-heat", !on);
    if (!on) this.clearMask();
  }

  private bind() {
    window.addEventListener(
      "pointermove",
      (e) => {
        this.mouseIn = true;
        this.x = e.clientX;
        this.y = e.clientY;
        if (!this.visible) {
          this.visible = true;
          this.cursor.classList.add("is-on");
          // start the cursor where it already is; no swoop in from nowhere
          this.cursor.style.setProperty("--cx", `${this.x}px`);
          this.cursor.style.setProperty("--cy", `${this.y}px`);
        }
        const t = performance.now();
        const last = this.points[this.points.length - 1];
        if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > 5 || t - last.t > 45) {
          this.points.push({ x: e.clientX, y: e.clientY, t });
          if (this.points.length > 60) this.points.shift();
        }
        this.still = 0;
        this.speed = Math.min(1, this.speed + 0.15);
      },
      { passive: true }
    );

    window.addEventListener("pointerdown", () => this.cursor.classList.add("is-down"), { passive: true });
    window.addEventListener("pointerup", () => this.cursor.classList.remove("is-down"), { passive: true });
    window.addEventListener("pointerleave", () => {
      this.visible = false;
      this.mouseIn = false;
      this.cursor.classList.remove("is-on");
      this.clearMask();
    });

    window.addEventListener(
      "pointerover",
      (e) => {
        const t = e.target as HTMLElement;
        this.cursor.classList.toggle("is-link", !!t.closest("a, button, label, .cube, .iris"));
      },
      { passive: true }
    );
  }

  private clearMask() {
    if (this.latent) {
      this.latent.style.maskImage = "radial-gradient(circle 0px at 50% 50%, transparent 0, transparent 100%)";
      this.latent.style.webkitMaskImage = "radial-gradient(circle 0px at 50% 50%, transparent 0, transparent 100%)";
    }
  }

  private makeMask(now: number) {
    if (!this.enabled || !this.mouseIn || !this.panel || !this.latent) return;
    const rect = this.panel.getBoundingClientRect();
    const inside =
      this.x > rect.left - 30 &&
      this.x < rect.right + 30 &&
      this.y > rect.top - 30 &&
      this.y < rect.bottom + 30;
    if (!inside || this.still > 50) {
      this.clearMask();
      return;
    }
    const w = this.panel.offsetWidth;
    const h = this.panel.offsetHeight;
    const toLocal = (x: number, y: number) => [
      ((x - rect.left) / rect.width) * w,
      ((y - rect.top) / rect.height) * h,
    ];
    const fresh: Point[] = this.points.filter((p) => now - p.t < 1900);
    fresh.push({ x: this.x, y: this.y, t: now });
    const use = fresh.slice(-9);
    const layers = use.map((p, i) => {
      const age = clamp((now - p.t) / 1900, 0, 1);
      const [x, y] = toLocal(p.x, p.y);
      const r = 64 + age * 96 + (i === use.length - 1 ? 26 : 0);
      return `radial-gradient(circle ${r.toFixed(0)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 0%, #000 ${(r * 0.55).toFixed(0)}px, transparent ${r.toFixed(0)}px)`;
    });
    const value = layers.join(", ");
    this.latent.style.maskImage = value;
    this.latent.style.webkitMaskImage = value;
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.still += dt;
    this.speed = damp(this.speed, 0, 2.4, dt);
    this.temp = damp(this.temp, 21.4 + this.speed * 11 + Math.sin(now / 2200) * 0.6, 3, dt);

    // brass-registration cursor
    const cx = this.cursor.style.getPropertyValue("--cx");
    const targetX = this.x;
    const targetY = this.y;
    if (this.visible) {
      const px = cx ? parseFloat(cx) : targetX;
      const py = parseFloat(this.cursor.style.getPropertyValue("--cy") || `${targetY}`);
      const nx = px + (targetX - px) * 0.35;
      const ny = py + (targetY - py) * 0.35;
      this.cursor.style.setProperty("--cx", `${nx}px`);
      this.cursor.style.setProperty("--cy", `${ny}px`);
      document.documentElement.style.setProperty("--cx", `${this.x}px`);
      document.documentElement.style.setProperty("--cy", `${this.y}px`);
    }

    if (now - this.lastRead > 80 && this.panel) {
      this.lastRead = now;
      const rect = this.panel.getBoundingClientRect();
      const lx = Math.round(((this.x - rect.left) / rect.width) * this.panel.offsetWidth);
      const ly = Math.round(((this.y - rect.top) / rect.height) * this.panel.offsetHeight);
      const idx = String(Number(this.panel.dataset.index) + 1).padStart(2, "0");
      this.read.textContent = `P.${idx} · ${String(clamp(lx, 0, 9999)).padStart(4, "0")},${String(
        clamp(ly, 0, 9999)
      ).padStart(4, "0")} · ${this.temp.toFixed(1)}°C`;
    }

    if (now - this.lastMask > 33) {
      this.lastMask = now;
      this.makeMask(now);
    }
    requestAnimationFrame(this.loop);
  };
}
