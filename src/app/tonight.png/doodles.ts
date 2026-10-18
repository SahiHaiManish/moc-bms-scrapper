/**
 * Marker doodles for the /tonight poster, as SVG data URIs (Satori draws
 * <img src="data:image/svg+xml,..."> reliably). Deliberately wobbly.
 */

const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  )}`;

/** Ruled notebook paper with a red margin line. */
export function paper(w: number, h: number, rule = "#B9CDEB", margin = "#EF7B7B"): string {
  let lines = "";
  for (let y = 150; y < h; y += 54) lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${rule}" stroke-width="2"/>`;
  return svg(
    w,
    h,
    `${lines}<line x1="104" y1="0" x2="104" y2="${h}" stroke="${margin}" stroke-width="3"/><line x1="112" y1="0" x2="112" y2="${h}" stroke="${margin}" stroke-width="1.5"/>`
  );
}

/** A hand-drawn tick. */
export const tick = (c: string) =>
  svg(80, 70, `<path d="M8 38 C 16 44, 22 52, 28 62 C 40 40, 56 20, 74 6" stroke="${c}" stroke-width="9"/>`);

/** Squiggly underline. */
export const squiggle = (c: string, w = 520) => {
  let d = "M6 16";
  for (let x = 6; x < w - 20; x += 40) d += ` q 10 -14 20 0 t 20 0`;
  return svg(w, 30, `<path d="${d}" stroke="${c}" stroke-width="6"/>`);
};

/** Curvy arrow pointing right. */
export const arrow = (c: string) =>
  svg(150, 90, `<path d="M8 70 C 40 20, 90 10, 132 40" stroke="${c}" stroke-width="7"/><path d="M106 26 L 134 42 L 112 66" stroke="${c}" stroke-width="7"/>`);

/** Handheld mic with a grille and a cable. */
export const mic = (c: string) =>
  svg(
    170,
    220,
    `<g transform="rotate(-20 85 110)">
       <circle cx="85" cy="52" r="38" stroke="${c}" stroke-width="7"/>
       <path d="M62 30 C 74 40, 96 40, 108 30 M 50 52 L 120 52 M 60 74 C 74 64, 96 64, 110 74 M 85 16 L 85 88 M 64 22 C 58 44, 58 62, 66 84 M 106 22 C 112 44, 112 62, 104 84" stroke="${c}" stroke-width="3.5"/>
       <path d="M64 92 L 106 92 L 98 116 L 72 116 Z" stroke="${c}" stroke-width="6"/>
       <path d="M72 116 L 78 186 L 92 186 L 98 116" stroke="${c}" stroke-width="7"/>
       <path d="M85 186 C 86 206, 120 200, 116 216" stroke="${c}" stroke-width="5"/>
     </g>`
  );

/** Little smiley that has seen things. */
export const smiley = (c: string) =>
  svg(
    110,
    110,
    `<circle cx="55" cy="55" r="44" stroke="${c}" stroke-width="6"/>
     <path d="M36 42 l 0 8 M 72 40 l 0 8" stroke="${c}" stroke-width="7"/>
     <path d="M32 66 C 44 84, 70 84, 80 64" stroke="${c}" stroke-width="6"/>`
  );

/** Sparkle / star scribble. */
export const sparkle = (c: string) =>
  svg(70, 70, `<path d="M35 6 C 37 26, 44 33, 64 35 C 44 37, 37 44, 35 64 C 33 44, 26 37, 6 35 C 26 33, 33 26, 35 6 Z" stroke="${c}" stroke-width="5"/>`);

/** Strip of masking tape. */
export const tape = () =>
  svg(150, 48, `<path d="M6 8 L 144 4 L 140 22 L 146 42 L 8 46 L 12 26 Z" fill="rgba(240,232,205,0.85)" stroke="rgba(160,150,120,0.5)" stroke-width="2"/>`);

/** Spiky starburst sticker (for the BOGO offer). */
export function burst(fill: string, edge: string): string {
  const pts: string[] = [];
  const n = 18;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 70 : 96 - (i % 4 === 0 ? 0 : 6);
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return svg(200, 200, `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="${edge}" stroke-width="5"/>`);
}
