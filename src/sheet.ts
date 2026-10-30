import { clamp, damp, reduced } from "./util";

type Callbacks = {
  onIndex: (index: number) => void;
  onMove: (pos: number) => void;
  onFirstMove: () => void;
};

const MOBILE = () => window.matchMedia("(max-width: 899px)").matches;

export class Sheet {
  private el = document.getElementById("sheet") as HTMLElement;
  private stage = document.getElementById("stage") as HTMLElement;
  readonly panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
  private papers = this.panels.map((p) => p.querySelector<HTMLElement>(".paper")!);
  private cb: Callbacks;

  private pw = 1200;
  private pos = 0;
  private goal = 0;
  private vel = 0;
  private wave = 0;
  private drag = false;
  private dragged = false;
  private startX = 0;
  private startY = 0;
  private startPos = 0;
  private lastX = 0;
  private lastT = 0;
  private wheelTimer = 0;
  private wheelVel = 0;
  private lastTilt = { x: 0, y: 0 };
  private tilt = { x: 0, y: 0 };
  private prev = 0;
  private active = -1;
  private proof = false;
  private keyboard = false;
  private draggingCss = "";

  constructor(cb: Callbacks) {
    this.cb = cb;
    this.measure();
    this.bind();
    this.el.style.transform = this.normalTransform();
    this.applyPanels();
    this.setActive(0, true);
    this.prev = performance.now();
    requestAnimationFrame(this.loop);
  }

  get index() {
    return Math.round(this.pos);
  }
  get activePanel(): HTMLElement {
    return this.panels[this.index];
  }
  get inProof() {
    return this.proof;
  }

  measure() {
    this.pw = this.panels[0].offsetWidth || this.pw;
    if (MOBILE()) {
      this.el.style.transform = "none";
      this.panels.forEach((p) => (p.style.transform = "none"));
    }
  }

  goTo(i: number, smooth = true) {
    if (this.proof) return;
    const target = clamp(i, 0, this.panels.length - 1);
    if (MOBILE()) {
      const p = this.panels[target];
      const top = p.getBoundingClientRect().top + window.scrollY - 62;
      window.scrollTo({ top, behavior: smooth && !reduced ? "smooth" : "auto" });
      this.pos = target;
      this.goal = target;
      this.setActive(target);
      this.cb.onFirstMove();
      return;
    }
    if (!smooth) this.pos = target;
    this.goal = target;
    this.cb.onFirstMove();
  }

  nudge(delta: number) {
    if (this.proof) return;
    this.goal = clamp(this.goal + delta, 0, this.panels.length - 1);
    this.cb.onFirstMove();
  }

  setProof(on: boolean) {
    if (this.proof === on) return;
    this.proof = on;
    document.body.classList.toggle("is-proof", on);
    this.el.style.transition = "transform 1s cubic-bezier(.22,1,.36,1)";
    this.panels.forEach((p) => (p.style.transition = "transform 1s cubic-bezier(.22,1,.36,1)"));
    if (on) {
      this.updateProofTransform();
      this.panels.forEach((p) => {
        p.style.transform = "translateZ(0px)";
        p.style.zIndex = "1";
      });
    } else {
      this.el.style.transform = this.normalTransform();
      this.applyPanels();
    }
    window.setTimeout(() => {
      this.el.style.transition = "";
      this.panels.forEach((p) => (p.style.transition = ""));
    }, 1050);
  }

  private normalTransform() {
    const x = (4 - this.pos) * this.pw;
    return `translate(-50%, -50%) translate3d(${x}px, 0, 0)`;
  }

  private updateProofTransform() {
    const sheetW = this.pw * this.panels.length;
    const s = clamp((window.innerWidth * 0.965) / sheetW, 0.04, 0.6);
    this.el.style.transform =
      `translate(-50%, -50%) translateY(1.5vh) rotateX(29deg) rotateZ(-7deg) scale(${s})`;
  }

  private applyPanels() {
    if (MOBILE()) {
      this.panels.forEach((p) => {
        p.style.transform = "none";
      });
      return;
    }
    const t = performance.now() / 1000;
    const tiltX = 1.35 + this.tilt.y * 1.7;
    const tiltY = this.tilt.x * 0.8;

    this.panels.forEach((panel, i) => {
      const d = i - this.pos;
      const ad = Math.abs(d);
      const wave = reduced ? 0 : this.wave * 2.2;
      const idle = reduced ? 0 : Math.sin(t * 0.42 + i * 0.8) * 0.16;
      const ry = clamp(d * 5.4 + wave * clamp(ad, 0, 1) + idle, -14, 14);
      const rx = tiltX + tiltY * clamp(d, -1, 1) * 0.6;
      const tz = -Math.min(ad, 4) * 26;
      panel.style.transform = `translateZ(${tz}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      panel.style.zIndex = String(200 - Math.round(ad * 10));
      this.papers[i].style.setProperty("--fold", String(clamp(ad * 0.2, 0, 0.75)));
      this.papers[i].style.setProperty("--sheen", String(clamp(0.5 - d * 0.32, 0, 1)));
    });
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.prev) / 1000);
    this.prev = now;
    if (!MOBILE() && !this.proof) {
      const before = this.pos;
      this.pos = damp(this.pos, this.goal, this.drag ? 22 : 7.2, dt);
      if (Math.abs(this.goal - this.pos) < 0.0005) this.pos = this.goal;
      const v = (this.pos - before) / Math.max(dt, 0.0001);
      this.vel = damp(this.vel, clamp(v, -3, 3), 6, dt);
      this.wave = damp(this.wave, clamp(v * 0.035 + this.vel * 0.02, -1.2, 1.2), 5.5, dt);
      this.tilt.x = damp(this.tilt.x, this.lastTilt.x, 5, dt);
      this.tilt.y = damp(this.tilt.y, this.lastTilt.y, 5, dt);
      this.el.style.transform = this.normalTransform();
      this.applyPanels();
      this.cb.onMove(this.pos);
      const idx = Math.round(this.pos);
      if (idx !== this.active) this.setActive(idx);
    }
    requestAnimationFrame(this.loop);
  };

  private setActive(i: number, force = false) {
    if (!force && i === this.active) return;
    this.active = i;
    this.panels.forEach((p, n) => p.classList.toggle("is-hot", n === i));
    this.cb.onIndex(i);
  }

  private bind() {
    window.addEventListener("resize", () => {
      this.measure();
      if (this.proof) this.updateProofTransform();
    });

    window.addEventListener(
      "wheel",
      (e) => {
        if (MOBILE() || this.proof) return;
        const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? this.pw : 1;
        const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const delta = raw * unit;
        if (delta === 0) return;
        e.preventDefault();
        this.cb.onFirstMove();
        const step = (delta / this.pw) * 2.1;
        this.goal = clamp(this.goal + step, 0, this.panels.length - 1);
        this.wheelVel = step;
        window.clearTimeout(this.wheelTimer);
        this.wheelTimer = window.setTimeout(() => {
          if (this.proof) return;
          const projected = this.goal + clamp(this.wheelVel * 3.2, -0.8, 0.8);
          this.goal = clamp(Math.round(projected), 0, this.panels.length - 1);
        }, 170);
      },
      { passive: false }
    );

    window.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.matches("input, textarea, select") || t.isContentEditable) return;
      if (e.key === "Tab") {
        this.keyboard = true;
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        this.nudge(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        this.nudge(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        this.goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        this.goTo(this.panels.length - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        this.goTo(Number(e.key) - 1);
      }
    });

    this.stage.addEventListener(
      "pointerdown",
      (e) => {
        if (MOBILE() || this.proof || e.button !== 0) return;
        this.keyboard = false;
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, option, .iris, .rack, .ticket, .note, .tear, .order, .cube, .order-submit")) return;
        this.drag = true;
        this.dragged = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startPos = this.pos;
        this.lastX = e.clientX;
        this.lastT = performance.now();
        this.draggingCss = document.body.style.cursor;
        document.body.style.cursor = "grabbing";
        this.cb.onFirstMove();
      },
      { passive: true }
    );

    window.addEventListener(
      "pointermove",
      (e) => {
        if (MOBILE()) return;
        this.lastTilt.x = (e.clientX / window.innerWidth - 0.5) * 2;
        this.lastTilt.y = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!this.drag || this.proof) return;
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        if (!this.dragged && Math.abs(dx) + Math.abs(dy) > 5) this.dragged = true;
        if (!this.dragged) return;
        this.pos = clamp(this.startPos + (this.startX - e.clientX) / this.pw, 0, this.panels.length - 1);
        this.goal = this.pos;
        this.vel = ((e.clientX - this.lastX) / this.pw / Math.max(8, performance.now() - this.lastT)) * -1;
        this.lastX = e.clientX;
        this.lastT = performance.now();
      },
      { passive: true }
    );

    const endDrag = () => {
      if (!this.drag) return;
      this.drag = false;
      document.body.style.cursor = this.draggingCss;
      if (!this.dragged) return;
      const projected = this.pos + clamp(this.vel * 260, -0.9, 0.9);
      this.goal = clamp(Math.round(projected), 0, this.panels.length - 1);
      this.wheelVel = 0;
    };
    window.addEventListener("pointerup", endDrag, { passive: true });
    window.addEventListener("pointercancel", endDrag, { passive: true });

    // keyboard focus travels the sheet with you
    this.stage.addEventListener("focusin", (e) => {
      if (!this.keyboard || this.proof) return;
      const panel = (e.target as HTMLElement).closest<HTMLElement>(".panel");
      if (!panel) return;
      const i = Number(panel.dataset.index);
      if (i >= 0 && i !== this.active) this.goTo(i);
    });

    document.addEventListener("pointerdown", () => (this.keyboard = false), { passive: true });
  }
}
