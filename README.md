# WARM STATIC — a software atelier

One thermochromic printed sheet. Nine panels. No scroll-reveals.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ — ~472 KB
```

## The sheet

- Desktop: drag, scroll, arrow keys, or use the sheet monitor at bottom right.
- Mobile: the concertina stacks vertically; contents and “continued” links scroll between panels.
- `P` — proof view: the whole sheet on the registration table; click a panel to open it.
- `F` — fold the sheet.
- Move slowly: the ink warms, developing carbon-copy notes hidden under the visible print.
- Panel 04: drag or click the aperture ring.
- Panel 05: stamp the ticket.
- Panel 06: drag the type cubes.
- Panel 09: tear off the bottom strip (and tape it back).

## Stack

Vite + TypeScript, no framework. Custom WebGL ribbon, CSS 3D type rack, canvas halftone
aperture, procedural paper grain, synthesized foley. Fonts self-hosted: Archivo, Bodoni Moda,
Martian Mono.
