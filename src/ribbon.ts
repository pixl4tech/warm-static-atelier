import { damp, reduced, type Mat4 } from "./util";

/* ── small matrix helpers ─────────────────────────────────────── */
function lookAt(eye: number[], target: number[], up: number[]): Mat4 {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}
const sub = (a: number[], b: number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: number[], b: number[]): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: number[]): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const rotY = (a: number): Mat4 => {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
};
const rotX = (a: number): Mat4 => {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
};
const rotZ = (a: number): Mat4 => {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
};
const mul = (a: Mat4, b: Mat4): Mat4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
  return o;
};
const perspective = (fovy: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
};

/* ── the ribbon: one continuous folded strip, seen in three dimensions ── */
type V3 = [number, number, number];
const W = 0.285;

function centerline(t: number): V3 {
  return [
    (t - 0.5) * 2.34,
    0.3 * Math.sin(t * Math.PI * 2.05 + 0.55),
    0.6 * Math.sin(t * Math.PI * 3.05 + 0.4),
  ];
}
function tangent(t: number): V3 {
  const e = 0.0008;
  const a = centerline(t - e);
  const b = centerline(t + e);
  return norm(sub(b, a));
}
function surface(t: number, s: number): V3 {
  const p = centerline(t);
  const tg = tangent(t);
  const up: V3 = [0, 1, 0];
  let w: V3 = norm(sub(up, [tg[0] * dot(up, tg), tg[1] * dot(up, tg), tg[2] * dot(up, tg)]));
  // rotate the cross-section about the tangent — a small, elegant twist
  const tw = 0.75 * Math.sin(t * Math.PI * 2.2 + 0.3);
  const c = Math.cos(tw), sn = Math.sin(tw);
  const cr = cross(tg, w);
  w = [w[0] * c + cr[0] * sn, w[1] * c + cr[1] * sn, w[2] * c + cr[2] * sn];
  const wd = W * (0.86 + 0.14 * Math.sin(t * Math.PI * 3.4 + 1.2));
  return [p[0] + w[0] * s * wd, p[1] + w[1] * s * wd, p[2] + w[2] * s * wd];
}

export class Ribbon {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private lineProg: WebGLProgram | null = null;
  private tri: WebGLBuffer | null = null;
  private lines: WebGLBuffer | null = null;
  private triCount = 0;
  private lineCount = 0;
  private mvpLoc: WebGLUniformLocation | null = null;
  private modelLoc: WebGLUniformLocation | null = null;
  private lineMvp: WebGLUniformLocation | null = null;
  private last = 0;
  private active = false;
  private raf = 0;
  private yaw = -0.42;
  private pitch = 0.08;
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private start = performance.now();
  private fallback = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    try {
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
      if (!gl) throw new Error("no webgl2");
      this.gl = gl;
      this.build();
    } catch {
      this.fallback = true;
    }
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener(
      "pointermove",
      (e) => {
        this.target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        this.target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) {
      this.last = performance.now();
      if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private resize = () => {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (this.gl) this.gl.viewport(0, 0, w, h);
      if (this.fallback) this.drawFallback();
    }
  };

  private compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || "shader");
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    return p;
  }

  private build() {
    const gl = this.gl!;
    const N = 168;
    const data: number[] = [];
    const edgeData: number[] = [];

    const addTri = (a: V3, b: V3, c: V3) => {
      let n = norm(cross(sub(b, a), sub(c, a)));
      if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
      for (const v of [a, b, c]) data.push(v[0], v[1], v[2], n[0], n[1], n[2]);
    };

    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const a = surface(t0, -1), b = surface(t0, 1);
      const c = surface(t1, -1), d = surface(t1, 1);
      addTri(a, b, c);
      addTri(b, d, c);
    }
    this.triCount = data.length / 6;

    // long edges
    const pushEdge = (p: V3, q: V3) => {
      const n = norm(cross(sub(q, p), [0, 1, 0]));
      const off = 0.0035;
      edgeData.push(
        p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off,
        q[0] + n[0] * off, q[1] + n[1] * off, q[2] + n[2] * off
      );
    };
    for (let i = 0; i < N; i++) {
      pushEdge(surface(i / N, -1), surface((i + 1) / N, -1));
      pushEdge(surface(i / N, 1), surface((i + 1) / N, 1));
    }
    // the leading edge
    // nine creases, one for each panel
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      pushEdge(surface(t, -1), surface(t, 1));
    }
    this.lineCount = edgeData.length / 3;

    this.tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    this.lines = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lines);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeData), gl.STATIC_DRAW);

    const vs = `#version 300 es
      in vec3 aPos; in vec3 aNormal;
      uniform mat4 uMVP; uniform mat4 uModel;
      out vec3 vNormal; out vec3 vWorld;
      void main(){
        vec4 wp = uModel * vec4(aPos,1.0);
        vWorld = wp.xyz;
        vNormal = mat3(uModel) * aNormal;
        gl_Position = uMVP * vec4(aPos,1.0);
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 vNormal; in vec3 vWorld;
      uniform vec3 uEye;
      out vec4 outColor;
      const vec3 PAPER = vec3(0.902,0.874,0.816);
      const vec3 VERM = vec3(1.0,0.231,0.0);
      const vec3 COBALT = vec3(0.106,0.169,1.0);
      const vec3 INK = vec3(0.09,0.07,0.055);

      vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*p; }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }

      void main(){
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(uEye - vWorld);
        float ndl = dot(n, normalize(vec3(-0.45, 0.82, 0.62)));
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float lum = clamp(0.58 + 0.58 * ndl, 0.0, 1.0);
        lum = mix(lum, 0.98, rim * 0.35);

        float darkness = clamp(1.0 - lum, 0.0, 1.0);
        vec2 fc = gl_FragCoord.xy;
        vec2 cell = rot2(fc, 0.62) / 3.35;
        float d = length(fract(cell) - 0.5);
        float r = 0.58 * sqrt(darkness);
        float dots = smoothstep(r, r - 0.09, d);

        vec3 tint = mix(VERM, COBALT, smoothstep(0.55, 0.96, darkness));
        tint = mix(tint, INK, smoothstep(0.93, 1.0, darkness));

        // misregistered second hit
        vec2 cell2 = rot2(fc + vec2(1.8, -1.2), 0.62) / 3.35;
        float d2 = length(fract(cell2) - 0.5);
        float dots2 = smoothstep(r * 0.85, r * 0.85 - 0.08, d2);

        vec3 col = mix(PAPER, tint, dots * 0.92);
        col = mix(col, INK, dots2 * 0.10);
        col *= 0.965 + 0.035 * hash(floor(fc / 1.5));
        float alpha = max(dots, dots2 * 0.1);
        alpha = max(alpha, 0.015);
        outColor = vec4(col, alpha);
      }`;
    const lvs = `#version 300 es
      in vec3 aPos; uniform mat4 uMVP;
      void main(){ gl_Position = uMVP * vec4(aPos,1.0); }`;
    const lfs = `#version 300 es
      precision mediump float; out vec4 o; 
      void main(){ o = vec4(0.09,0.07,0.055,0.92); }`;

    this.prog = this.compile(gl, vs, fs);
    this.lineProg = this.compile(gl, lvs, lfs);
    this.mvpLoc = gl.getUniformLocation(this.prog, "uMVP");
    this.modelLoc = gl.getUniformLocation(this.prog, "uModel");
    this.lineMvp = gl.getUniformLocation(this.lineProg, "uMVP");
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(this.prog);
    const pl = gl.getAttribLocation(this.prog, "aPos");
    const nl = gl.getAttribLocation(this.prog, "aNormal");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.enableVertexAttribArray(pl);
    gl.vertexAttribPointer(pl, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(nl);
    gl.vertexAttribPointer(nl, 3, gl.FLOAT, false, 24, 12);
    this.eyeLoc = gl.getUniformLocation(this.prog, "uEye");
  }

  private eyeLoc: WebGLUniformLocation | null = null;

  private draw(time: number) {
    const gl = this.gl;
    if (!gl || !this.prog || !this.lineProg) return;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const yaw = this.yaw + this.current.x * 0.24;
    const pitch = this.pitch + this.current.y * 0.16;
    const model = mul(mul(rotY(yaw), rotX(pitch)), rotZ(-0.09 + Math.sin(time * 0.13) * 0.02));

    const aspect = w / h || 1;
    const proj = perspective((31 * Math.PI) / 180, aspect, 0.1, 20);
    const eye = [0, 0.42, 3.65];
    const view = lookAt(eye, [0, -0.02, 0], [0, 1, 0]);
    const mvp = mul(proj, mul(view, model));

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.mvpLoc, false, mvp);
    gl.uniformMatrix4fv(this.modelLoc, false, model);
    gl.uniform3fv(this.eyeLoc, new Float32Array(eye));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.enableVertexAttribArray(gl.getAttribLocation(this.prog, "aPos"));
    gl.vertexAttribPointer(gl.getAttribLocation(this.prog, "aPos"), 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(this.prog, "aNormal"));
    gl.vertexAttribPointer(gl.getAttribLocation(this.prog, "aNormal"), 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, this.triCount);

    gl.useProgram(this.lineProg);
    gl.uniformMatrix4fv(this.lineMvp, false, mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lines);
    const lp = gl.getAttribLocation(this.lineProg, "aPos");
    gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 12, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.LINES, 0, this.lineCount);
    gl.disable(gl.BLEND);
  }

  private drawFallback() {
    const c = this.canvas;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(27,43,255,0.75)";
    for (let i = 0; i < 9; i++) {
      const y = h * (0.3 + 0.16 * Math.sin(i * 1.3));
      ctx.fillRect(w * 0.12, y, w * 0.76, h * 0.055);
      ctx.fillStyle = i % 2 ? "rgba(255,59,0,0.8)" : "rgba(27,43,255,0.75)";
    }
    ctx.strokeStyle = "rgba(23,18,14,0.6)";
    ctx.strokeRect(w * 0.12, h * 0.2, w * 0.76, h * 0.6);
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!reduced) {
      this.current.x = damp(this.current.x, this.target.x, 2.5, dt);
      this.current.y = damp(this.current.y, this.target.y, 2.5, dt);
      this.yaw += dt * 0.11;
    }
    if (this.fallback) this.drawFallback();
    else this.draw((now - this.start) / 1000);
    if (this.active) this.raf = requestAnimationFrame(this.loop);
    else this.raf = 0;
  };
}
