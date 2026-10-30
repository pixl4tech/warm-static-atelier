/** Tiny press-room foley, synthesised. No audio files, no autoplay. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = false;

  async setEnabled(on: boolean) {
    this.enabled = on;
    if (on) {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        const len = Math.floor(this.ctx.sampleRate * 1.2);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      await this.ctx.resume();
      this.tick();
    }
  }

  private noise(opts: { dur: number; type: BiquadFilterType; freq: number; q?: number; gain: number; when?: number }) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const t = ctx.currentTime + (opts.when ?? 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
  }

  paper(strength = 1) {
    if (!this.enabled) return;
    this.noise({ dur: 0.22, type: "bandpass", freq: 1100 + Math.random() * 900, q: 0.7, gain: 0.028 * strength });
  }
  print() {
    if (!this.enabled) return;
    this.noise({ dur: 0.09, type: "bandpass", freq: 2600, q: 1.2, gain: 0.02 });
    this.noise({ dur: 0.14, type: "lowpass", freq: 700, q: 0.6, gain: 0.025, when: 0.05 });
  }
  tick() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1350;
    g.gain.setValueAtTime(0.012, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  }
  stamp() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(58, ctx.currentTime + 0.13);
    g.gain.setValueAtTime(0.075, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    this.noise({ dur: 0.06, type: "bandpass", freq: 1900, q: 0.9, gain: 0.035 });
  }
  tear() {
    if (!this.enabled) return;
    for (let i = 0; i < 5; i++) {
      this.noise({
        dur: 0.09 + Math.random() * 0.12,
        type: "highpass",
        freq: 1400 + Math.random() * 2400,
        q: 0.6,
        gain: 0.022,
        when: i * 0.055,
      });
    }
  }
}
