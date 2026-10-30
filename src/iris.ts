import { clamp, damp, polar, reduced } from "./util";

const NS = "http://www.w3.org/2000/svg";
const R = 197;

function bladePath(i: number, open: number) {
  const r = 2 + open * 164;
  const twist = open * 15;
  const a0 = i * 45;
  const a1 = a0 + 45;
  const [ox0, oy0] = polar(R, a0);
  const [ox1, oy1] = polar(R, a1);
  const [ix1, iy1] = polar(r, a1 + twist);
  const [ix0, iy0] = polar(r, a0 + twist);
  return `M ${(200 + ox0).toFixed(2)} ${(200 + oy0).toFixed(2)} A ${R} ${R} 0 0 1 ${(200 + ox1).toFixed(
    2
  )} ${(200 + oy1).toFixed(2)} L ${(200 + ix1).toFixed(2)} ${(200 + iy1).toFixed(2)} L ${(200 + ix0).toFixed(
    2
  )} ${(200 + iy0).toFixed(2)} Z`;
}

export class Iris {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private blades: SVGPathElement[] = [];
  private canvas: HTMLCanvasElement;
  private pct: HTMLElement;
  private holeRing: HTMLElement;
  private open = 0;
  private target = 0;
  private dragging = false;
  private downY = 0;
  private startOpen = 0;
  private moved = false;
  private raf = 0;
  private seen = false;
  private last = 0;
  private rendered = -1;

  constructor(root: HTMLElement, svg: SVGSVGElement, canvas: HTMLCanvasElement, pct: HTMLElement, ring: HTMLElement) {
    this.root = root;
    this.svg = svg;
    this.canvas = canvas;
    this.pct = pct;
    this.holeRing = ring;

    this.buildBlades();
    this.drawPhoto();
    this.bind();
    this.render(0);
    window.addEventListener("resize", this.redraw);
    window.setTimeout(() => this.drawPhoto(), 400);
  }

  private buildBlades() {
    this.svg.innerHTML = "";
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `
      <radialGradient id="bladeg" cx="50%" cy="50%" r="50%">
        <stop offset="42%" stop-color="#efe8d9"/>
        <stop offset="78%" stop-color="#e0d7c5"/>
        <stop offset="100%" stop-color="#c3b8a3"/>
      </radialGradient>
      <radialGradient id="vig" cx="50%" cy="50%" r="50%">
        <stop offset="55%" stop-color="rgba(23,18,14,0)"/>
        <stop offset="100%" stop-color="rgba(23,18,14,0.45)"/>
      </radialGradient>`;
    this.svg.appendChild(defs);

    const bg = document.createElementNS(NS, "g");
    for (let i = 0; i < 8; i++) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("fill", "url(#bladeg)");
      p.setAttribute("stroke", "rgba(23,18,14,0.55)");
      p.setAttribute("stroke-width", "1.15");
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("data-blade", String(i));
      bg.appendChild(p);
      this.blades.push(p);
    }
    this.svg.appendChild(bg);

    const shade = document.createElementNS(NS, "circle");
    shade.setAttribute("cx", "200");
    shade.setAttribute("cy", "200");
    shade.setAttribute("r", String(R));
    shade.setAttribute("fill", "url(#vig)");
    shade.setAttribute("pointer-events", "none");
    this.svg.appendChild(shade);

    const ticks = document.createElementNS(NS, "g");
    ticks.setAttribute("stroke", "rgba(23,18,14,0.28)");
    ticks.setAttribute("stroke-width", "1");
    for (let i = 0; i < 72; i++) {
      const a = i * 5;
      const [x1, y1] = polar(R - 1, a);
      const [x2, y2] = polar(R - (i % 6 === 0 ? 11 : 5), a);
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", String(200 + x1));
      l.setAttribute("y1", String(200 + y1));
      l.setAttribute("x2", String(200 + x2));
      l.setAttribute("y2", String(200 + y2));
      if (i % 6 === 0) l.setAttribute("stroke", "rgba(23,18,14,0.52)");
      ticks.appendChild(l);
    }
    this.svg.appendChild(ticks);

    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", "200");
    ring.setAttribute("cy", "200");
    ring.setAttribute("r", String(R));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "rgba(23,18,14,0.4)");
    ring.setAttribute("stroke-width", "1.5");
    this.svg.appendChild(ring);

    this.blades.forEach((p, i) => p.setAttribute("d", bladePath(i, this.open)));
  }

  private bind() {
    this.root.setAttribute("role", "slider");
    this.root.setAttribute("tabindex", "0");
    this.root.setAttribute("aria-label", "Aperture: drag or use arrow keys to open the iris");
    this.root.setAttribute("aria-valuemin", "0");
    this.root.setAttribute("aria-valuemax", "100");

    // capture on the window: a tilted 3D panel can miss the hit test, but the
    // aperture still knows where it is on screen.
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        const r = this.root.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
        e.stopPropagation();
        e.preventDefault();
        this.dragging = true;
        this.moved = false;
        this.downY = e.clientY;
        this.startOpen = this.open;
        this.root.setPointerCapture(e.pointerId);
      },
      { capture: true }
    );
    this.root.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dy = this.downY - e.clientY;
      if (Math.abs(dy) > 3) this.moved = true;
      this.target = clamp(this.startOpen + dy / 190, 0, 1);
      this.open = this.target;
      this.render(performance.now());
    });
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.moved) this.target = this.target > 0.45 ? 0 : 1;
      this.animate();
    };
    this.root.addEventListener("pointerup", up);
    this.root.addEventListener("pointercancel", up);

    this.root.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.25 : 0.08;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        this.target = clamp(this.target + step, 0, 1);
        this.animate();
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        this.target = clamp(this.target - step, 0, 1);
        this.animate();
      } else if (e.key === "Home") {
        e.preventDefault();
        this.target = 0;
        this.animate();
      } else if (e.key === "End") {
        e.preventDefault();
        this.target = 1;
        this.animate();
      }
    });
  }

  /** one-time flourish when this panel first becomes the focus */
  openOnce() {
    if (this.seen) return;
    this.seen = true;
    if (reduced) {
      this.target = 0.55;
      this.animate();
      return;
    }
    this.target = 0.78;
    this.animate();
    window.setTimeout(() => {
      if (!this.dragging && this.target > 0.6) {
        this.target = 0.54;
        this.animate();
      }
    }, 1700);
  }

  private animate() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.open = damp(this.open, this.target, 7, dt);
    if (Math.abs(this.target - this.open) < 0.0015) {
      this.open = this.target;
      this.raf = 0;
    } else {
      this.raf = requestAnimationFrame(this.tick);
    }
    this.render(now);
  };

  private render(_now: number) {
    const o = this.open;
    if (Math.abs(o - this.rendered) < 0.0008) return;
    this.rendered = o;
    this.blades.forEach((p, i) => p.setAttribute("d", bladePath(i, o)));
    const r = 2 + o * 164;
    const pct = Math.round(o * 100);
    this.pct.textContent = `${String(pct).padStart(2, "0")}%`;
    this.holeRing.style.setProperty("--hole", String(((r * 2) / 400) * 100));
    this.root.setAttribute("aria-valuenow", String(pct));
    const f = o < 0.08 ? "22" : o < 0.3 ? "11" : o < 0.52 ? "5.6" : o < 0.72 ? "4" : o < 0.9 ? "2.8" : "1.4";
    const ui = this.root.querySelector(".iris-ui span");
    if (ui) ui.textContent = `ƒ/${f}`;
  }

  private redraw = () => {
    this.drawPhoto();
  };

  private drawPhoto() {
    const c = this.canvas;
    const css = c.clientWidth || 380;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css * dpr);
    if (!px) return;
    c.width = px;
    c.height = px;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    /* ── the scene, painted in greyscale first ── */
    const S = 520;
    const off = document.createElement("canvas");
    off.width = off.height = S;
    const o = off.getContext("2d", { willReadFrequently: true })!;
    const horizon = S * 0.69;

    const sky = o.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#0b0c14");
    sky.addColorStop(0.55, "#2c2a33");
    sky.addColorStop(1, "#8c7f7b");
    o.fillStyle = sky;
    o.fillRect(0, 0, S, horizon);

    // moon
    const mx = S * 0.5, my = S * 0.42, mr = S * 0.135;
    const glow = o.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 1.95);
    glow.addColorStop(0, "rgba(255,248,230,0.55)");
    glow.addColorStop(0.45, "rgba(245,235,212,0.16)");
    glow.addColorStop(1, "rgba(200,190,175,0)");
    o.fillStyle = glow;
    o.fillRect(0, 0, S, horizon);
    const moon = o.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, "#fbf6e8");
    moon.addColorStop(0.82, "#efe6d2");
    moon.addColorStop(1, "#ddd0b6");
    o.fillStyle = moon;
    o.beginPath();
    o.arc(mx, my, mr, 0, Math.PI * 2);
    o.fill();

    // craters
    o.globalAlpha = 0.09;
    o.fillStyle = "#4a4438";
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * mr * 0.72;
      o.beginPath();
      o.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, mr * (0.06 + Math.random() * 0.14), 0, Math.PI * 2);
      o.fill();
    }
    o.globalAlpha = 1;

    // one low band, kept away from the moon
    o.globalAlpha = 0.5;
    o.fillStyle = "#1a1920";
    o.beginPath();
    o.moveTo(0, horizon * 0.84);
    o.bezierCurveTo(S * 0.25, horizon * 0.77, S * 0.5, horizon * 0.9, S * 0.78, horizon * 0.8);
    o.bezierCurveTo(S * 0.9, horizon * 0.76, S, horizon * 0.82, S, horizon * 0.82);
    o.lineTo(S, horizon * 0.9);
    o.bezierCurveTo(S * 0.6, horizon * 0.98, S * 0.3, horizon * 0.86, 0, horizon * 0.92);
    o.closePath();
    o.fill();
    o.globalAlpha = 1;

    // stars
    o.fillStyle = "#f8f0dd";
    for (let i = 0; i < 26; i++) {
      const sx = Math.random() * S;
      const sy = Math.random() * horizon * 0.72;
      const sr = 0.6 + Math.random() * 1.1;
      const sd = Math.hypot(sx - mx, sy - my);
      if (sd < mr * 1.5) continue;
      o.globalAlpha = 0.4 + Math.random() * 0.55;
      o.beginPath();
      o.arc(sx, sy, sr, 0, Math.PI * 2);
      o.fill();
    }
    o.globalAlpha = 1;

    // water
    const water = o.createLinearGradient(0, horizon, 0, S);
    water.addColorStop(0, "#4b4650");
    water.addColorStop(0.25, "#26242c");
    water.addColorStop(1, "#0d0c10");
    o.fillStyle = water;
    o.fillRect(0, horizon, S, S - horizon);

    // moon column on the water
    for (let i = 0; i < 34; i++) {
      const y = horizon + (i / 34) * (S - horizon);
      const w = mr * (0.7 + Math.sin(i * 0.8) * 0.16 + (i / 34) * 0.7);
      const a = 0.45 - (i / 34) * 0.33;
      o.globalAlpha = Math.max(0, a) * (0.35 + Math.random() * 0.6);
      o.fillStyle = "#f2e8d2";
      o.fillRect(mx - w / 2 + Math.sin(i * 1.7) * 6, y, w * (0.4 + Math.random() * 0.5), 1 + Math.random() * 1.8);
    }
    // horizontal ripple lines
    o.globalAlpha = 0.16;
    o.strokeStyle = "#cfc3aa";
    for (let i = 0; i < 28; i++) {
      const y = horizon + 6 + Math.random() * (S - horizon - 10);
      o.lineWidth = 0.7 + Math.random() * 1.2;
      o.beginPath();
      o.moveTo(Math.random() * S * 0.75, y);
      o.lineTo(S * (0.2 + Math.random() * 0.8), y + Math.random() * 1.5);
      o.stroke();
    }
    o.globalAlpha = 1;

    // distant pier silhouette
    o.fillStyle = "#08080a";
    o.fillRect(0, horizon - 3, S * 0.28, 5);
    for (let i = 0; i < 7; i++) {
      o.fillRect(S * 0.02 + i * S * 0.037, horizon - 22 + (i % 2) * 4, 3, 22);
    }
    // foreground bank
    o.beginPath();
    o.moveTo(0, S);
    o.lineTo(0, S * 0.86);
    o.bezierCurveTo(S * 0.2, S * 0.82, S * 0.42, S * 0.92, S * 0.63, S * 0.88);
    o.bezierCurveTo(S * 0.8, S * 0.85, S * 0.9, S * 0.9, S, S * 0.84);
    o.lineTo(S, S);
    o.closePath();
    o.fill();

    // grain
    const grain = o.getImageData(0, 0, S, S);
    for (let i = 0; i < grain.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      grain.data[i] += n;
      grain.data[i + 1] += n;
      grain.data[i + 2] += n;
    }
    o.putImageData(grain, 0, 0);

    /* ── then screened into two inks ── */
    const src = o.getImageData(0, 0, S, S).data;
    ctx.fillStyle = "#e8e2d4";
    ctx.fillRect(0, 0, px, px);
    const cell = Math.max(3, Math.round(px / 88));
    for (let y = 0; y < px; y += cell) {
      for (let x = 0; x < px; x += cell) {
        const sx = Math.min(S - 1, Math.floor((x / px) * S));
        const sy = Math.min(S - 1, Math.floor((y / px) * S));
        const idx = (sy * S + sx) * 4;
        const lum = (src[idx] * 0.3 + src[idx + 1] * 0.55 + src[idx + 2] * 0.15) / 255;
        const dark = clamp(1 - lum, 0, 1);
        if (dark < 0.16) continue;
        const r = cell * 0.46 * Math.sqrt(dark);
        ctx.fillStyle = dark > 0.55 ? "rgba(27,43,255,0.9)" : "rgba(255,59,0,0.88)";
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
        if (dark > 0.8) {
          ctx.fillStyle = "rgba(23,18,14,0.16)";
          ctx.beginPath();
          ctx.arc(x + cell / 2 + dpr * 1.2, y + cell / 2 - dpr * 0.8, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // subtle edge darkening
    const edge = ctx.createRadialGradient(px / 2, px / 2, px * 0.32, px / 2, px / 2, px * 0.52);
    edge.addColorStop(0, "rgba(23,18,14,0)");
    edge.addColorStop(1, "rgba(23,18,14,0.38)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, px, px);
  }
}
