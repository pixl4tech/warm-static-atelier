/**
 * Paper. Not a texture file — a small press run at boot.
 * Fibres, flecks, and the faint tooth of uncoated stock.
 */
export function makePaperGrain(): string {
  const size = 220;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = Math.random();
      const mott = Math.sin(x * 0.031) * Math.cos(y * 0.043) * 5;
      const v = 245 - n * 26 + mott;
      d[i] = v;
      d[i + 1] = v - 3;
      d[i + 2] = v - 9;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // fibres
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#5a4a35";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    const l = 6 + Math.random() * 34;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * l * 0.5 + Math.random() * 4,
      y + Math.sin(a) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l
    );
    ctx.stroke();
  }

  // a couple of darker flecks, like recycled stock
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#3d3124";
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }

  return c.toDataURL("image/png");
}

export function installGrain() {
  const url = makePaperGrain();
  document.documentElement.style.setProperty("--grain-url", `url(${url})`);
}
