// Small symbols of the MML topographic map (campfire site, tree kinds, buildings, stones and rock,
// towers). The same drawings are used by the map (foxwood.ts), the sign cards (signs.ts) and the
// lesson panels.

// Campfire site: a black flame with two triangles below it.
function fire(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="#1a1a1a">
    <path d="M0,-11 C3,-7 5,-4 4,-1 C3.4,1.6 1.6,2.6 0,2.6 C-2.4,2.6 -4,1 -4,-1.2 C-4,-3.4 -2,-4.6 -1.4,-6.6 C-0.6,-5 0.4,-4.6 1,-4.2 C1.2,-6.4 0.6,-8.6 0,-11 Z"/>
    <path d="M-1.4,4 L-7.6,5.4 L-4.2,9.8 Z"/><path d="M1.4,4 L7.6,5.4 L4.2,9.8 Z"/>
  </g>`;
}

// A circle open at the bottom (the crown of a deciduous tree).
const arc = (cx: number, cy: number, r: number) => {
  const dx = (r * 0.5).toFixed(2);
  const dy = (r * 0.87).toFixed(2);
  return `M${cx - +dx},${cy + +dy} A${r},${r} 0 1 1 ${cx + +dx},${cy + +dy}`;
};

// Forest tree kinds: conifer (Λ), deciduous (open circle), mixed (circle on top of a Λ) and shrub
// (three small open circles). // Centre (x, y), height about 12 * s.
const TREES = {
  conifer: 'M-3.2,6 L0,-6 L3.2,6',
  deciduous: arc(0, 0, 5),
  mixed: `M-3.2,6.5 L0,-0.5 L3.2,6.5 ${arc(0, -4, 3.4)}`,
  shrub: `${arc(0, -2.6, 2.6)} ${arc(-2.9, 2.4, 2.6)} ${arc(2.9, 2.4, 2.6)}`,
};
export type TreeKind = keyof typeof TREES;
function tree(kind: TreeKind, x: number, y: number, s = 1, stroke = 1.4) {
  return `<path d="${TREES[kind]}" transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#1a1a1a" stroke-width="${(stroke / s).toFixed(2)}"/>`;
}

// Buildings: the colour tells the kind (MML 1:10 000 – 1:25 000). The colours are picked from the
// legend.
const BUILDING_COLORS = {
  residential: '#5F605E', // residential building: dark grey
  holiday: '#00A99D', // holiday building: turquoise
  commercial: '#E76FA3', // commercial or public building: pink
  church: '#94428E', // church: purple cross
  other: '#D4D5D4', // other building (sauna, barn, shed): light grey
};
export type BuildingKind = keyof typeof BUILDING_COLORS;
// A building centred at (x, y) with width w and height h. A church is a cross.
function building(kind: BuildingKind, x: number, y: number, w: number, h: number) {
  const edge = `fill="${BUILDING_COLORS[kind]}" stroke="#2b2b2b" stroke-width="${Math.max(0.6, w / 30).toFixed(2)}" stroke-linejoin="round"`;
  if (kind === 'church') {
    const a = w / 2;
    const b = w / 6;
    return `<path d="M${x - b},${y - a} h${2 * b} v${a - b} h${a - b} v${2 * b} h${b - a} v${a - b} h${-2 * b} v${b - a} h${b - a} v${-2 * b} h${a - b} Z" ${edge}/>`;
  }
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ${edge}/>`;
}

// Stone in water (in the legend: "stones", in the water section). The horizontal line is the water
// surface: a stone above the water is ⊥, a stone at the surface + and a stone under the water T.
// The terrain map has no sign for a single stone on land. Centre (x, y), height about 10 * s.
export type StoneLevel = 'above' | 'surface' | 'under';
const STONE_PATHS: Record<StoneLevel, string> = {
  above: 'M-5,5 H5 M0,5 V-5',
  surface: 'M-5,0 H5 M0,-5 V5',
  under: 'M-5,-5 H5 M0,-5 V5',
};
function stone(x: number, y: number, s = 1, level: StoneLevel = 'above') {
  return `<path d="${STONE_PATHS[level]}" transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#1a1a1a" stroke-width="1.8"/>`;
}

// One black triangle of stony ground or a boulder field, centre (x, y), turned by `rotation`
// degrees.
function triangle(x: number, y: number, size = 4, rotation = 0) {
  return `<path d="M0,${-size * 0.6} L${size * 0.5},${size * 0.3} L${-size * 0.5},${size * 0.3} Z" transform="translate(${x} ${y}) rotate(${rotation})" fill="#1a1a1a"/>`;
}

// Stony ground and boulder field: black triangles inside the rectangle (x, y, w, h). In stony
// ground the triangles are dense, in a boulder field sparse. The seed makes the pattern always the
// same.
function triangles(x: number, y: number, w: number, h: number, spacing: number, size = 4) {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let s = '';
  for (let py = y + spacing / 2; py < y + h; py += spacing) {
    for (let px = x + spacing / 2; px < x + w; px += spacing) {
      const tx = (px + (random() - 0.5) * spacing * 0.6).toFixed(1);
      const ty = (py + (random() - 0.5) * spacing * 0.6).toFixed(1);
      s += triangle(+tx, +ty, size, Math.round(random() * 120));
    }
  }
  return `<g>${s}</g>`;
}

// Bare rock is a greyish-pink area. The colour is picked from the legend.
const BEDROCK = '#D3C7C4';

// Mire: a treeless mire is yellow and a forested one greyish blue. A mire that is hard to cross has
// blue horizontal lines (the line is about a third of the spacing). The colours are picked from the
// legend.
const MIRE = { treeless: '#D7C473', forested: '#CCDBDE', lines: '#58BCD7' };

// Cliff: a thick black line with short spikes pointing down the slope
// (to the right of the walking direction).
function cliff(x0: number, y0: number, x1: number, y1: number, s = 1) {
  return cliffLine(
    [
      [x0, y0],
      [x1, y1],
    ],
    s,
  );
}
// A cliff as a polyline through the points [[x, y], ...]. The spike spacing is measured along the
// whole line.
function cliffLine(points: number[][], s = 1) {
  let spikes = '';
  let passed = 0,
    d = 3 * s;
  for (let i = 1; i < points.length; i++) {
    const [[x0, y0], [x1, y1]] = [points[i - 1], points[i]];
    const length = Math.hypot(x1 - x0, y1 - y0);
    const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length];
    const end = i === points.length - 1 ? length - 2 * s : length;
    for (; d - passed < end; d += 7 * s) {
      const [px, py] = [x0 + ux * (d - passed), y0 + uy * (d - passed)];
      spikes += `M${px.toFixed(1)},${py.toFixed(1)} l${(-uy * 5 * s + ux * 0.8 * s).toFixed(1)},${(ux * 5 * s + uy * 0.8 * s).toFixed(1)} `;
    }
    passed += length;
  }
  return `<g fill="none" stroke="#1a1a1a" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${points.join(' L')}" stroke-width="${2.4 * s}"/><path d="${spikes}" stroke-width="${1.1 * s}"/>
  </g>`;
}

// Towers and masts (MML): the proportions are taken from the legend. The centre (x, y) is the
// position of the tower (the middle of the circle or dot), and the sign is about 10–14 * s tall.
const TOWER_STYLE = 'fill="none" stroke="#1a1a1a" stroke-linecap="round"';
// Lookout tower: a circle with a stick going up from it.
function lookoutTower(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" ${TOWER_STYLE} stroke-width="0.6"><circle r="2.6"/><path d="M0,-2.6 V-7.4"/></g>`;
}
// Wind turbine: a thicker circle, a long stick and two blades.
function windTurbine(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" ${TOWER_STYLE} stroke-width="0.75"><circle r="2.6"/><path d="M0,-2.6 V-12 M-2.9,-7 L0,-9 L2.9,-7"/></g>`;
}
// Water tower: a black ball.
function waterTower(x: number, y: number, s = 1) {
  return `<circle cx="${x}" cy="${y}" r="${2.4 * s}" fill="#1a1a1a"/>`;
}
// Mast: a black dot, a horizontal line and a vertical line with an arrow at the top.
function mast(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="1.7" fill="#1a1a1a"/>
    <path d="M-3.5,0 H3.5 M0,3.7 V-9.7 M-1.1,-7.8 L0,-9.7 L1.1,-7.8" ${TOWER_STYLE} stroke-width="0.45" stroke-linejoin="round"/></g>`;
}

// Fence (MML): a thin black line with dots along it. Points [[x, y], ...]; s = size.
// The dots are spread evenly along each part, so there is a dot in every corner.
function fence(points: number[][], s = 1, color = '#1a1a1a') {
  const SPACING = 6.5 * s;
  const dot = ([x, y]: number[]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.1 * s).toFixed(2)}"/>`;
  let dots = dot(points[0]);
  for (let i = 1; i < points.length; i++) {
    const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / SPACING));
    for (let j = 1; j <= n; j++) dots += dot([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  return `<path d="M${points.join(' L')}" fill="none" stroke="${color}" stroke-width="${(0.7 * s).toFixed(2)}"/><g fill="${color}">${dots}</g>`;
}
// Gate (MML): two short lines across the fence. a and b = the posts of the gate.
function gate([ax, ay]: number[], [bx, by]: number[], s = 1) {
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
  const d = Math.hypot(bx - ax, by - ay);
  const [ux, uy] = [(bx - ax) / d, (by - ay) / d];
  const [px, py] = [-uy * 3.4 * s, ux * 3.4 * s];
  const line = (k: number) => {
    const [x, y] = [mx + ux * k * 1.7 * s, my + uy * k * 1.7 * s];
    return `<line x1="${(x - px).toFixed(1)}" y1="${(y - py).toFixed(1)}" x2="${(x + px).toFixed(1)}" y2="${(y + py).toFixed(1)}"/>`;
  };
  return `<g stroke="#1a1a1a" stroke-width="${(0.8 * s).toFixed(2)}">${line(-1)}${line(1)}</g>`;
}

// Power line (MML: "power line, pylon"): a thin black line with a Z across it now and then, and
// black dots at the poles. points = the bends of the line, poles = the positions of the dots. A Z
// is drawn in the middle of every zEvery-th segment starting from segment zStart (0 = no Z), so
// that it does not hit a pole or other signs. Proportions from the legend (dot about 0.7 mm, Z
// about 1 mm).
function powerLine(points: number[][], poles: number[][] = [], s = 1, zEvery = 4, zStart = 1) {
  let z = '';
  for (let i = zStart; zEvery && i < points.length; i += zEvery) {
    const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
    const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    z += `<path d="M-2.6,-2 H1.4 L-1.4,2 H2.6" transform="translate(${((ax + bx) / 2).toFixed(1)} ${((ay + by) / 2).toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${s})"/>`;
  }
  return `<g fill="none" stroke="#1a1a1a" stroke-linejoin="round"><path d="M${points.join(' L')}" stroke-width="${(0.7 * s).toFixed(2)}"/>
    <g stroke-width="0.7">${z}</g></g>
    <g fill="#1a1a1a">${poles.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${(1.8 * s).toFixed(2)}"/>`).join('')}</g>`;
}

export const Symbols = {
  fence,
  gate,
  fire,
  tree,
  BUILDING_COLORS,
  building,
  stone,
  triangle,
  triangles,
  BEDROCK,
  MIRE,
  cliff,
  cliffLine,
  lookoutTower,
  windTurbine,
  waterTower,
  mast,
  powerLine,
};
