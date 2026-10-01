// Orienteering map (ISOM 2017, the Finnish Orienteering Federation's "Most common map symbols").
// Foxwood is drawn as an orienteering map too, so that it can be compared with the MML topographic
// map (foxwood.ts). The colours are picked from the Federation's legend. On an orienteering map the
// colour tells how easy it is to run in the terrain. The proportions of the signs are ISOM's, but
// they are enlarged to the same size as the signs of the MML map (1 mm = 6 units).
import { Foxwood, setOrienteeringBase } from './foxwood';
import type { Point } from './types';

const COLORS = {
  paper: '#FFFFFF', // white forest: easy to run
  black: '#1a1a1a',
  open: '#FCC868', // open area, easy to cross (grass, field)
  openForest: '#FCE0B4', // open area in the forest (clearing, open mire)
  slow: '#CCE4D0', // slow-running forest
  difficult: '#A0D4A4', // difficult-to-run forest
  lines: '#3EB55F', // slow-running ground: green vertical lines
  water: '#00ACE0',
  shallowWater: '#98CCEC',
  brown: '#D88C3C', // contour lines, fill of the wide road
  yard: '#B8B454', // yard: an area forbidden to orienteers (olive green)
  parkingLot: '#ECBF93', // parking area or gravel field (light brown, black edge)
  rock: '#D8D8DC',
  course: '#D848A0', // course markings (start, control, finish)
};
const MM = 6;

// ---------- Small signs (centre x, y; the size s is the enlargement) ----------
// Large stone (ISOM 205): a black dot. A stone (204) is a smaller dot.
const stone = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${y}" r="${(0.3 * MM * s).toFixed(2)}" fill="${COLORS.black}"/>`;
const smallStone = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${y}" r="${(0.2 * MM * s).toFixed(2)}" fill="${COLORS.black}"/>`;
// Small special feature: a black ×. There is no sign for a campfire site, so it is a special
// feature.
function cross(x: number, y: number, s = 1) {
  const a = 0.344 * MM * s;
  return `<path d="M${x - a},${y - a} L${x + a},${y + a} M${x + a},${y - a} L${x - a},${y + a}" stroke="${COLORS.black}" stroke-width="${(0.16 * MM * s).toFixed(2)}" fill="none"/>`;
}
// High tower (ISOM 524): a black ball and a cross.
function tower(x: number, y: number, s = 1) {
  const a = 0.7 * MM * s;
  return `<g stroke="${COLORS.black}" stroke-width="${(0.16 * MM * s).toFixed(2)}"><path d="M${x - a},${y} H${x + a} M${x},${y - a} V${y + a}"/></g>
    <circle cx="${x}" cy="${y}" r="${(0.4 * MM * s).toFixed(2)}" fill="${COLORS.black}"/>`;
}
// Ant nest: a brown triangle.
function antNest(x: number, y: number, s = 1) {
  const a = 0.45 * MM * s;
  return `<path d="M${x},${y - a} L${x + a},${y + a * 0.75} L${x - a},${y + a * 0.75} Z" fill="none" stroke="${COLORS.brown}" stroke-width="${(0.18 * MM * s).toFixed(2)}" stroke-linejoin="round"/>`;
}
// Small knoll: a brown dot.
const knoll = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${y}" r="${(0.4 * MM * s).toFixed(2)}" fill="${COLORS.brown}"/>`;
// Knoll: a small brown contour ring.
const knollRing = (x: number, y: number, s = 1) =>
  `<ellipse cx="${x}" cy="${y}" rx="${(0.6 * MM * s).toFixed(2)}" ry="${(0.45 * MM * s).toFixed(2)}" fill="none" stroke="${COLORS.brown}" stroke-width="${(0.25 * MM * s).toFixed(2)}"/>`;
// Pit: a brown V.
function pit(x: number, y: number, s = 1) {
  const a = 0.35 * MM * s;
  return `<path d="M${x - a},${y - a * 0.8} L${x},${y + a * 0.8} L${x + a},${y - a * 0.8}" fill="none" stroke="${COLORS.brown}" stroke-width="${(0.2 * MM * s).toFixed(2)}" stroke-linejoin="round"/>`;
}
// A line through the points [[x, y], ...] with marks along it every `spacing` units: f(x, y, ux,
// uy) draws one mark (ux, uy = the direction of the line).
function lineWithMarks(
  points: Point[],
  spacing: number,
  width: number,
  f: (x: number, y: number, ux: number, uy: number) => string,
) {
  let d = `M${points[0]}`,
    marks = '';
  // The spacing of the marks is measured along the whole line, so on a curved line (many short
  // pieces) the spacing stays the same.
  let passed = 0,
    next = spacing / 2;
  for (let i = 1; i < points.length; i++) {
    const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
    const length = Math.hypot(bx - ax, by - ay);
    const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
    d += ` L${bx},${by}`;
    for (; next < passed + length; next += spacing)
      marks += f(ax + ux * (next - passed), ay + uy * (next - passed), ux, uy);
    passed += length;
  }
  return `<path d="${d}" fill="none" stroke="${COLORS.black}" stroke-width="${width.toFixed(2)}"/>${marks}`;
}
// Fence: a black line with slanted spikes on one side. On a high fence the spikes are in pairs.
function fence(points: Point[], s = 1, high = false) {
  const l = 0.8 * MM * s;
  return lineWithMarks(points, 2.4 * MM * s, 0.2 * MM * s, (x, y, ux, uy) => {
    // The spike leaves the line at 45° backwards to the right side of the line.
    const [px, py] = [(-ux - uy) * Math.SQRT1_2 * l, (-uy + ux) * Math.SQRT1_2 * l];
    const spike = (k: number) => {
      const [ax, ay] = [x + ux * k, y + uy * k];
      return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${(ax + px).toFixed(1)}" y2="${(ay + py).toFixed(1)}" stroke="${COLORS.black}" stroke-width="${(0.2 * MM * s).toFixed(2)}"/>`;
    };
    return high ? spike(-0.25 * MM * s) + spike(0.25 * MM * s) : spike(0);
  });
}
// Gate or passage: the fence has a gap with a cross line at both ends. a and b = the ends of the
// gap.
function gate([ax, ay]: Point, [bx, by]: Point, s = 1) {
  const d = Math.hypot(bx - ax, by - ay);
  const [px, py] = [(-(by - ay) / d) * 0.5 * MM * s, ((bx - ax) / d) * 0.5 * MM * s];
  const viiva = (x: number, y: number) =>
    `<line x1="${(x - px).toFixed(1)}" y1="${(y - py).toFixed(1)}" x2="${(x + px).toFixed(1)}" y2="${(y + py).toFixed(1)}"/>`;
  return `<g stroke="${COLORS.black}" stroke-width="${(0.25 * MM * s).toFixed(2)}">${viiva(ax, ay)}${viiva(bx, by)}</g>`;
}
// Impassable cliff (ISOM 201): a thick black line and dense spikes towards the lower slope (to the
// right of the walking direction, like the cliff on the MML map). Dimensions from
// OpenOrienteering's ISOM 2017-2 symbol set.
function cliff(points: Point[], s = 1) {
  const l = 0.575 * MM * s;
  return lineWithMarks(
    points,
    0.5 * MM * s,
    0.35 * MM * s,
    (x, y, ux, uy) =>
      `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - uy * l).toFixed(1)}" y2="${(y + ux * l).toFixed(1)}" stroke="${COLORS.black}" stroke-width="${(0.12 * MM * s).toFixed(2)}"/>`,
  );
}
// Stone wall: a black line with dots on it.
function stoneFence(points: Point[], s = 1) {
  return lineWithMarks(
    points,
    2.4 * MM * s,
    0.2 * MM * s,
    (x, y) =>
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.3 * MM * s).toFixed(2)}" fill="${COLORS.black}"/>`,
  );
}
// Power line (ISOM 510): a thin black line with a cross line on both sides of it at the poles.
// points = the bends of the line, poles = the positions of the cross lines (on the line).
function powerLine(points: Point[], poles: Point[] = [], s = 1) {
  const l = 0.6 * MM * s;
  const direction = ([x, y]: Point): Point => {
    // The direction of the line at the nearest part.
    let best: Point = [1, 0],
      smallest = Infinity;
    for (let i = 1; i < points.length; i++) {
      const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
      const d = Math.hypot(x - (ax + bx) / 2, y - (ay + by) / 2) - Math.hypot(bx - ax, by - ay) / 2;
      const p = Math.hypot(bx - ax, by - ay);
      if (d < smallest) [smallest, best] = [d, [(bx - ax) / p, (by - ay) / p]];
    }
    return best;
  };
  const ticks = poles
    .map(([x, y]) => {
      const [ux, uy] = direction([x, y]);
      return `<line x1="${(x + uy * l).toFixed(1)}" y1="${(y - ux * l).toFixed(1)}" x2="${(x - uy * l).toFixed(1)}" y2="${(y + ux * l).toFixed(1)}"/>`;
    })
    .join('');
  return `<g stroke="${COLORS.black}" stroke-width="${(0.14 * MM * s).toFixed(2)}" fill="none"><path d="M${points.join(' L')}"/>${ticks}</g>`;
}
// Course markings in purple: start (a triangle with its tip towards the next control), control (a
// circle) and finish (two circles).
const courseStyle = `fill="none" stroke="${COLORS.course}" stroke-width="${0.35 * MM}"`;
function start(x: number, y: number, s = 1, angle = -90) {
  const r = 3.5 * MM * s * 0.577;
  const k = (d: number) =>
    [
      x + r * Math.cos(((angle + d) * Math.PI) / 180),
      y + r * Math.sin(((angle + d) * Math.PI) / 180),
    ]
      .map((v) => v.toFixed(1))
      .join(',');
  return `<path d="M${k(0)} L${k(120)} L${k(240)} Z" ${courseStyle}/>`;
}
const control = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${y}" r="${(2.5 * MM * s).toFixed(1)}" ${courseStyle}/>`;
const finish = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${y}" r="${(2 * MM * s).toFixed(1)}" ${courseStyle}/><circle cx="${x}" cy="${y}" r="${(3 * MM * s).toFixed(1)}" ${courseStyle}/>`;

// ---------- Small features in Foxwood ---------- They are only on the orienteering map, so in the
// 3D terrain too they are only shown in the orienteering map mode (world.ts). All of them are in
// the forest south of the path between the fox's clearing and the mire. The knoll and the pit are
// landforms. Fences are on both maps (Foxwood.FENCES). The keys (pit, knoll, antNest) are ids.
const SMALL_FEATURES: Record<string, Point> = {
  pit: [178, 331],
  knoll: [198, 348],
  antNest: [220, 368],
};
// The dot-like signs are enlarged so that they stand out on an iPad.
const SMALL_SCALE = 2.2;

// ---------- Foxwood as an orienteering map ---------- The parts are the same as on the MML map
// (Foxwood.parts), so that the 3D world can switch them to the map with the same mask. The places
// that are open in the terrain are shown yellow: the clearing at the top of the hill and the fox's
// clearing at the start of the path.
const M = Foxwood.shapes;
const mireLines = Array.from({ length: 14 }, (_, i) => 300 + i * 5)
  .map((y) => `<line x1="215" x2="395" y1="${y}" y2="${y}"/>`)
  .join('');
const dotPattern = (
  id: string,
  spacing: number,
  r: number,
) => `<pattern id="${id}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
    <rect width="${spacing}" height="${spacing}" fill="${COLORS.open}"/><circle cx="${spacing / 2}" cy="${spacing / 2}" r="${r}" fill="${COLORS.black}"/></pattern>`;

const parts = {
  // Magnetic north lines across the map (in place of the grid of the MML map).
  grid: `<g stroke="${COLORS.water}" stroke-width="1"><line x1="150" y1="0" x2="150" y2="380"/><line x1="300" y1="0" x2="300" y2="380"/><line x1="450" y1="0" x2="450" y2="380"/></g>`,
  // Forest is white. An orienteering map does not show tree kinds. The fox's clearing at the start
  // of the path is an open area. The thicket is green: the edges slow-running forest (light green),
  // the centre hard to run through (green).
  forest: `<circle cx="30" cy="345" r="20" fill="${COLORS.openForest}"/>
    <g class="feature-thicket"><path d="${M.thicket[0]}" fill="${COLORS.slow}"/><path d="${M.thicket[1]}" fill="${COLORS.difficult}"/></g>`,
  // A field is cultivated land: yellow with black dots.
  field: `<defs>${dotPattern('orienteering-field', 7, 0.8)}</defs><path class="feature-field" d="${M.field}" fill="url(#orienteering-field)"/>`,
  // Open mire: light yellow (open) and blue mire lines.
  mire: `<g class="feature-mire">
    <clipPath id="orienteering-mire-rajaus"><path d="${M.mire}"/></clipPath>
    <path d="${M.mire}" fill="${COLORS.openForest}"/>
    <g clip-path="url(#orienteering-mire-rajaus)" stroke="${COLORS.water}" stroke-width="1.6">${mireLines}</g>
  </g>`,
  // There is a clearing at the top of the hill (light yellow). The contours are brown like on the
  // MML map.
  hill: `<g class="feature-hill"><path d="${M.hill[2]}" fill="${COLORS.openForest}"/>
    <g fill="none" stroke="${COLORS.brown}" stroke-width="1.6">${M.hill.map((d) => `<path d="${d}"/>`).join('')}</g></g>`,
  // Lake: blue with a black shoreline. An orienteering map has no names.
  lake: `<path class="feature-lake" d="${M.lake}" fill="${COLORS.water}" stroke="${COLORS.black}" stroke-width="1.2"/>`,
  stream: `<path class="feature-stream" d="${M.stream}" fill="none" stroke="${COLORS.water}" stroke-width="1.6" stroke-linecap="round"/>`,
  // Path: a black dashed line (dashes 2 mm, gaps 0.25 mm, enlarged).
  trail: `<path d="${M.trail}" fill="none" stroke="${COLORS.black}" stroke-width="2" stroke-dasharray="12 3"/>`,
  // Track: a solid black line.
  track: `<g class="feature-track" fill="none" stroke="${COLORS.black}" stroke-width="2.1"><path d="${M.track}"/><path d="${M.accessRoad}"/></g>`,
  // Wide road: two black edge lines and a brown fill. The bridge is the same road over the brook.
  carRoad: `<g class="feature-carRoad" fill="none"><path d="${M.carRoad}" stroke="${COLORS.black}" stroke-width="6"/><path d="${M.carRoad}" stroke="${COLORS.brown}" stroke-width="3.6"/></g>`,
  campfire: `<g class="feature-campfire">${cross(Foxwood.CAMPFIRE[0], Foxwood.CAMPFIRE[1], 1.4)}</g>`,
  // Yards are olive green (forbidden area), buildings black.
  building: `<g class="feature-building">
    ${Foxwood.YARDS.map((p) => Foxwood.yardShape(p, `fill="${COLORS.yard}" stroke="${COLORS.black}" stroke-width="1"`)).join('')}
    ${Object.values(Foxwood.BUILDINGS)
      .map(
        ([, x, y, l, k]) =>
          `<rect x="${x - l / 2}" y="${y - k / 2}" width="${l}" height="${k}" fill="${COLORS.black}"/>`,
      )
      .join('')}
  </g>`,
  // Stones in the lake: the stone above the water is a large stone and the stone at the surface a
  // stone. The stone under the water cannot be seen, so it is not on the map.
  stones: `<g class="feature-stones">${Foxwood.WATER_STONES.filter(({ level }) => level !== 'under')
    .map(({ at: [x, y], level }) => (level === 'above' ? stone : smallStone)(x, y, 1.4))
    .join('')}</g>`,
  // The cliff and the boulders at its foot: the biggest is a large stone, the others stones.
  cliff: `<g class="feature-cliff">${cliff(Foxwood.CLIFF, 1.3)}
    ${Foxwood.BOULDERS.map(([x, y, size]) => (size >= 1 ? stone : smallStone)(x, y, 1.4)).join('')}</g>`,
  lookoutTower: `<g class="feature-lookoutTower">${tower(Foxwood.LOOKOUT_TOWER[0], Foxwood.LOOKOUT_TOWER[1], 1.3)}</g>`,
  // Power line along the road and branches to the house and the cabin.
  powerLine: `<g class="feature-powerLine">${powerLine(
    Foxwood.powerLineSegments.main,
    Foxwood.POWER_LINE.poles.filter(([x]) => x > 0 && x < 600),
    1.3,
  )}
    ${Foxwood.powerLineSegments.branches.map((h) => powerLine(h, [], 1.3)).join('')}</g>`,
  // The yard fence (a gap and cross lines at the gate) and the stone wall.
  fences: `<g class="feature-fences">
    <g class="fence-yard">${fence(Foxwood.FENCES.yard, 1.3)}${gate(...Foxwood.FENCES.gate, 1.3)}</g>
    <g class="fence-stones">${stoneFence(Foxwood.FENCES.stoneFence, 1.3)}</g>
  </g>`,
  smallFeatures: `<g class="feature-smallFeatures">
    <g class="small-pit">${pit(...SMALL_FEATURES.pit, SMALL_SCALE)}</g>
    <g class="small-knoll">${knollRing(...SMALL_FEATURES.knoll, SMALL_SCALE)}</g>
    <g class="small-antNest">${antNest(...SMALL_FEATURES.antNest, SMALL_SCALE)}</g>
  </g>`,
};
const ORDER = [
  'forest',
  'grid',
  'field',
  'mire',
  'hill',
  'stream',
  'lake',
  'trail',
  'track',
  'carRoad',
  'campfire',
  'building',
  'powerLine',
  'fences',
  'cliff',
  'stones',
  'lookoutTower',
  'smallFeatures',
];
const map = () =>
  `<rect width="600" height="380" fill="${COLORS.paper}"/>${ORDER.map((id) => parts[id as keyof typeof parts]).join('')}`;

export const Orienteering = {
  COLORS,
  SMALL_FEATURES,
  SMALL_SCALE,
  parts,
  map,
  stone,
  smallStone,
  cliff,
  cross,
  tower,
  antNest,
  knoll,
  knollRing,
  pit,
  fence,
  stoneFence,
  gate,
  powerLine,
  start,
  control,
  finish,
};

setOrienteeringBase(map);
