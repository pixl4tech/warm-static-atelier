import { clamp, el, rng } from "./util";
import type { Sheet } from "./sheet";
import type { Thermal } from "./thermal";
import type { Iris } from "./iris";
import type { Ribbon } from "./ribbon";
import type { Sfx } from "./sound";

export class UI {
  private sheet: Sheet;
  private thermal: Thermal;
  private iris: Iris;
  private ribbon: Ribbon;
  private sfx: Sfx;
  private panels: HTMLElement[];
  private titles: string[];
  private mini: HTMLButtonElement[] = [];
  private hint = el<HTMLElement>("#hint");
  private hintTimer = 0;
  private current = -1;
  private proofBtn = el<HTMLButtonElement>("#proofBtn");
  private proofRead!: HTMLElement;
  private toastEl = el<HTMLElement>("#toast");
  private toastTimer = 0;
  private soundBtn = el<HTMLButtonElement>("#soundBtn");
  private heatBtn = el<HTMLButtonElement>("#heatBtn");

  constructor(sheet: Sheet, thermal: Thermal, iris: Iris, ribbon: Ribbon, sfx: Sfx) {
    this.sheet = sheet;
    this.thermal = thermal;
    this.iris = iris;
    this.ribbon = ribbon;
    this.sfx = sfx;
    this.panels = sheet.panels;
    this.titles = this.panels.map((p) => p.dataset.title || "PANEL");

    this.buildMonitor();
    this.buildBarcode();
    this.buildProofUI();
    this.bind();
    this.startClock();
    this.fitMasthead();
    document.fonts?.ready.then(() => this.fitMasthead());
    window.setTimeout(() => this.fitMasthead(), 600);
    window.setTimeout(() => this.fitMasthead(), 1600);

    this.hintTimer = window.setTimeout(() => this.hideHint(), 11000);
    document.body.classList.add("is-booting");
    window.setTimeout(() => document.body.classList.remove("is-booting"), 220);

    // paper sheen, one per panel
    this.panels.forEach((p) => {
      const paper = p.querySelector(".paper");
      if (!paper) return;
      const sh = document.createElement("div");
      sh.className = "sheen";
      paper.appendChild(sh);
    });
  }

  /* ── chrome ───────────────────────────────────────────── */

  private buildMonitor() {
    const sheet = el<HTMLElement>("#monitorSheet");
    const read = el<HTMLElement>("#monitorRead");
    this.titles.forEach((title, i) => {
      const b = document.createElement("button");
      b.className = "mini-p";
      b.type = "button";
      b.dataset.i = String(i);
      b.setAttribute("aria-label", `Panel ${i + 1}: ${title}`);
      b.title = `${String(i + 1).padStart(2, "0")} — ${title}`;
      b.addEventListener("click", () => {
        if (this.sheet.inProof) this.toggleProof(false);
        this.sheet.goTo(i);
      });
      b.addEventListener("pointerenter", () => {
        read.textContent = `${String(i + 1).padStart(2, "0")} — ${title}`;
      });
      sheet.appendChild(b);
      this.mini.push(b);
    });
    sheet.addEventListener("pointerleave", () => {
      read.textContent = `${String(this.sheet.index + 1).padStart(2, "0")} — ${this.titles[this.sheet.index]}`;
    });
  }

  private buildBarcode() {
    const svg = document.querySelector<SVGSVGElement>(".barcode");
    if (!svg) return;
    const r = rng("WS-04-2026");
    let x = 0;
    let out = "";
    while (x < 98) {
      const w = 0.6 + Math.floor(r() * 3) * 0.55;
      if (r() > 0.28) out += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="24"/>`;
      x += w + 0.55 + r() * 0.7;
    }
    out += `<rect x="0" y="0" width="1.4" height="24"/><rect x="98.6" y="0" width="1.4" height="24"/>`;
    svg.setAttribute("viewBox", "0 0 100 24");
    svg.innerHTML = out;
    svg.setAttribute("shape-rendering", "crispEdges");
  }

  private buildProofUI() {
    const wrap = document.createElement("div");
    wrap.className = "proof-ui";
    wrap.innerHTML = `<div class="mono">PROOF — NINE PANELS, ONE SHEET</div>
      <div class="serif-i">Click a panel to open it.</div>
      <div class="mono proof-read">MOVE TO READ THE PANEL</div>`;
    document.body.appendChild(wrap);
    this.proofRead = wrap.querySelector(".proof-read") as HTMLElement;

    const back = document.createElement("div");
    back.className = "proof-back";
    back.setAttribute("aria-hidden", "true");
    back.innerHTML = `<svg viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="188" fill="none" stroke="currentColor" stroke-width="0.55"/>
        <circle cx="200" cy="200" r="142" fill="none" stroke="currentColor" stroke-width="0.55" stroke-dasharray="2 6"/>
        <circle cx="200" cy="200" r="3" fill="#ff3b00"/>
        <path d="M200 8v48M200 344v48M8 200h48M344 200h48M200 156v88M156 200h88" fill="none" stroke="currentColor" stroke-width="0.55"/>
      </svg>
      <div class="mono proof-foot">NINE PANELS · 9558 × 728 PX · READ SIDEWAYS</div>`;
    document.body.appendChild(back);
  }

  private startClock() {
    const node = el<HTMLElement>("#clock");
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => {
      node.textContent = fmt.format(new Date());
    };
    tick();
    window.setInterval(tick, 1000);
  }

  private fitMasthead() {
    const mast = document.querySelector<HTMLElement>(".masthead");
    const span = mast?.querySelector<HTMLElement>(".mast-fit");
    if (!mast || !span) return;
    mast.style.fontSize = "200px";
    const avail = mast.clientWidth;
    const width = span.offsetWidth;
    if (width > 10 && avail > 10) {
      mast.style.fontSize = `${Math.min(280, (200 * (avail - 1)) / width).toFixed(2)}px`;
    }
  }

  hideHint() {
    window.clearTimeout(this.hintTimer);
    this.hint.classList.add("is-gone");
  }

  toast(msg: string, ms = 2800) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("is-on");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("is-on"), ms);
  }

  /* ── sheet callbacks ──────────────────────────────────── */

  setIndex(i: number) {
    const first = this.current === -1;
    this.current = i;
    const title = this.titles[i];
    el<HTMLElement>("#folioBig").textContent = String(i + 1).padStart(2, "0");
    el<HTMLElement>("#folioName").textContent = title;
    el<HTMLElement>("#folioNow").textContent = String(i + 1).padStart(2, "0");
    document.querySelectorAll<HTMLElement>(".track i").forEach((t, n) => t.classList.toggle("is-on", n === i));
    this.panels.forEach((p) => p.classList.remove("is-target"));
    this.mini.forEach((b, n) => {
      b.classList.toggle("is-on", n === i);
      b.setAttribute("aria-current", n === i ? "true" : "false");
    });
    el<HTMLElement>("#monitorRead").textContent = `${String(i + 1).padStart(2, "0")} — ${title}`;
    document.title = i === 0 ? "Warm Static — a software atelier" : `${title} — Warm Static`;
    this.thermal.setActive(this.panels[i]);
    this.ribbon.setActive(i <= 1);
    if (i === 3) this.iris.openOnce();
    if (!first && this.sfx.enabled) this.sfx.paper();
    try {
      history.replaceState(null, "", `#p${i + 1}`);
    } catch {
      /* fine */
    }
  }

  setPos(pos: number) {
    if (!this.mini.length) return;
    this.mini.forEach((b, i) => {
      const d = i - pos;
      b.style.transform = `rotateY(${clamp(d * 3.4, -13, 13).toFixed(2)}deg) translateZ(${(
        -Math.min(Math.abs(d), 4) * 2.5
      ).toFixed(2)}px)`;
    });
  }

  /* ── wiring ───────────────────────────────────────────── */

  private bind() {
    document.querySelectorAll<HTMLElement>("[data-goto]").forEach((b) => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.goto);
        this.hideHint();
        this.sheet.goTo(i);
      });
    });

    this.proofBtn.addEventListener("click", () => this.toggleProof());

    this.soundBtn.addEventListener("click", async () => {
      const on = !this.sfx.enabled;
      await this.sfx.setEnabled(on);
      this.soundBtn.setAttribute("aria-pressed", String(on));
      this.soundBtn.innerHTML = `SOUND <span class="dim">${on ? "ON" : "OFF"}</span>`;
      this.toast(on ? "SOUND ON. THE PRESS IS RUNNING." : "SOUND OFF.");
    });

    this.heatBtn.addEventListener("click", () => {
      const on = this.heatBtn.getAttribute("aria-pressed") !== "true";
      this.heatBtn.setAttribute("aria-pressed", String(on));
      this.thermal.setEnabled(on);
      this.toast(on ? "WARM INK ON. MOVE SLOWLY." : "INK IS COLD.");
    });

    // nine folds, annotated — the little strips are real chains, laid out in 3D
    const foldUnits: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>(".pass").forEach((pass) => {
      const folds = Number(pass.dataset.pass || 1);
      const foldlet = pass.querySelector<HTMLElement>(".foldlet");
      if (!foldlet) return;
      const segs = Array.from(foldlet.querySelectorAll<HTMLElement>("i"));
      let hot = false;
      const draw = () => {
        if (!segs.length) return;
        const w = segs[0].offsetWidth || 40;
        const amp = hot ? 61 : 39;
        let x = 0;
        let z = 0;
        let abs = 0;
        segs.forEach((seg, i) => {
          if (i > 0 && i <= folds) abs += (i % 2 ? 1 : -1) * amp;
          seg.style.transitionDelay = `${i * 22}ms`;
          seg.style.transform = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${abs.toFixed(
            2
          )}deg)`;
          const rad = (abs * Math.PI) / 180;
          x += w * Math.cos(rad);
          z -= w * Math.sin(rad);
        });
      };
      draw();
      foldUnits.push(draw);
      pass.addEventListener("pointerenter", () => {
        hot = true;
        draw();
      });
      pass.addEventListener("pointerleave", () => {
        hot = false;
        draw();
      });
      pass.addEventListener("focusin", () => {
        hot = true;
        draw();
      });
      pass.addEventListener("focusout", () => {
        hot = false;
        draw();
      });
    });
    window.addEventListener("resize", () => foldUnits.forEach((d) => d()));

    this.buildWaveform();

    // ticket
    const ticket = document.getElementById("ticket");
    const tstamp = document.getElementById("ticketStamp");
    if (ticket && tstamp) {
      const states = ["FIRED", "ON THE PASS", "SERVED"];
      let n = 0;
      ticket.addEventListener("click", () => {
        n = (n + 1) % states.length;
        tstamp.textContent = states[n];
        tstamp.classList.toggle("stamp--pass", n === 1);
        tstamp.classList.remove("is-fresh");
        void tstamp.offsetWidth;
        tstamp.classList.add("is-fresh");
        this.sfx.stamp();
        this.toast(`TICKET 0412 — ${states[n]}`);
      });
    }

    // notes: stamp with prejudice
    document.querySelectorAll<HTMLElement>(".note").forEach((note) => {
      const btn = note.querySelector<HTMLButtonElement>(".note-action");
      if (!btn) return;
      const label = document.createElement("span");
      while (btn.firstChild && btn.firstChild.nodeType !== Node.ELEMENT_NODE) btn.removeChild(btn.firstChild);
      label.textContent = "STAMP IT";
      btn.insertBefore(label, btn.firstChild);
      btn.addEventListener("click", () => {
        const on = note.classList.toggle("is-stamped");
        label.textContent = on ? "UNSTAMP" : "STAMP IT";
        btn.setAttribute("aria-pressed", String(on));
        if (on) {
          this.sfx.stamp();
          this.toast("STAMPED. THE EMAIL IS REAL.");
        } else {
          this.sfx.paper();
        }
      });
    });

    // commission form
    const form = document.getElementById("orderForm") as HTMLFormElement | null;
    if (form) {
      form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => {
        c.addEventListener("change", () => this.sfx.tick());
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const checked = Array.from(form.querySelectorAll<HTMLInputElement>("input:checked")).map((i) => i.value);
        const lines =
          checked.length > 0
            ? ["What is true:", ...checked.map((c) => `— ${c}`), "", "The feeling, in a sentence or two:", "", ""]
            : ["None of the boxes are true yet.", "", "The feeling, in a sentence or two:", "", ""];
        const body = [
          "Hello Warm Static,",
          "",
          ...lines,
          "Edition of interest:",
          "Timeline:",
          "",
          "— sent from the sheet",
        ].join("\n");
        const href = `mailto:hello@warmstatic.studio?subject=${encodeURIComponent(
          "A commission / " + (checked[0] || "a feeling")
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = href;
        this.toast("DRAFT OPENED IN YOUR MAIL APP.");
        this.sfx.print();
      });
    }

    // tear-off strip
    const tear = document.getElementById("tear");
    const tearBtn = document.getElementById("tearBtn") as HTMLButtonElement | null;
    const restore = document.getElementById("tearRestore") as HTMLButtonElement | null;
    if (tear && tearBtn && restore) {
      tearBtn.addEventListener("click", () => {
        tear.classList.add("is-torn");
        (tearBtn as HTMLButtonElement).tabIndex = -1;
        this.sfx.tear();
        this.toast("TORN. KEEP THE ADDRESS. TAPE IT BACK IF YOU LIKE.");
        window.setTimeout(() => restore.focus({ preventScroll: true }), 900);
      });
      restore.addEventListener("click", () => {
        tear.classList.remove("is-torn");
        tearBtn.tabIndex = 0;
        this.sfx.paper();
        tearBtn.focus({ preventScroll: true });
      });
    }

    // proof: hover inspection + click to return
    document.addEventListener("pointermove", (e) => {
      if (!this.sheet.inProof) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".panel");
      this.panels.forEach((p) => p.classList.toggle("is-target", p === hit));
      if (hit) {
        const i = Number(hit.dataset.index);
        this.proofRead.textContent = `PANEL ${String(i + 1).padStart(2, "0")} — ${this.titles[i]}`;
      } else {
        this.proofRead.textContent = "MOVE TO READ THE PANEL";
      }
    });

    document.addEventListener("click", (e) => {
      if (!this.sheet.inProof) return;
      const hit = (e.target as HTMLElement).closest<HTMLElement>(".panel");
      if (!hit) return;
      const i = Number(hit.dataset.index);
      this.toggleProof(false);
      this.sheet.goTo(i, false);
    });

    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if (t.matches("input, textarea, select") || t.isContentEditable) return;
      if (e.key === "Escape" && this.sheet.inProof) {
        this.toggleProof(false);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        this.toggleProof();
      }
      if (e.key === "t" || e.key === "T") {
        this.heatBtn.click();
      }
    });

    window.addEventListener("resize", () => {
      this.fitMasthead();
    });
  }

  private buildWaveform() {
    const bars = document.getElementById("waveBars");
    if (!bars) return;
    const r = rng("shutter-take-41");
    const N = 96;
    for (let i = 0; i < N; i++) {
      const b = document.createElement("i");
      let env: number;
      if (i < 10) env = 0.05 + r() * 0.07;
      else if (i < 17) env = 0.18 + r() * 0.45;
      else if (i < 25) env = 0.95 * Math.exp(-(i - 17) * 0.14) + r() * 0.12;
      else env = Math.exp(-(i - 25) / 19) * (0.3 + r() * 0.62);
      b.style.setProperty("--h", `${Math.max(5, Math.min(100, env * 100)).toFixed(1)}%`);
      if (i >= N - 13) b.classList.add("is-last");
      bars.appendChild(b);
    }
    bars.style.setProperty("--play", "72%");
  }

  toggleProof(force?: boolean) {
    const on = force ?? !this.sheet.inProof;
    if (on === this.sheet.inProof) return;
    this.sheet.setProof(on);
    this.proofBtn.setAttribute("aria-pressed", String(on));
    this.proofBtn.innerHTML = on ? 'CLOSE <span class="dim">PROOF</span>' : 'PROOF <svg class="ico"><use href="#i-rot"/></svg>';
    this.hideHint();
    if (on) {
      this.proofRead.textContent = "MOVE TO READ THE PANEL";
      this.sfx.tick();
    } else {
      this.panels.forEach((p) => p.classList.remove("is-target"));
      this.sfx.paper();
    }
  }
}
