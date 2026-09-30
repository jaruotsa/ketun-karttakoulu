// The 3D world of Foxwood (Three.js). Everything is built from the data of foxwood.ts, so the
// landscape and the map are the same place.
//
// Coordinates: the map point (x, y) is (x - 300, height, y - 190) in the world. One map unit is a
// metre. The height of the ground is computed in only one place, and every object is placed on the
// ground with heightAt(x, y). So a tree cannot float and a cabin cannot rise from the water: a
// position can only be given as map coordinates.
//
// The parts (PARTS order: forest, field, mire, hill, lake, path) turn into a map with a number
// 0..1: the surface picture of the ground changes to the map and the 3D objects sink into the
// ground (trees, buildings, hill, depth of the lake).
import * as THREE from 'three';
import { Foxwood } from './foxwood';
import { Orienteering } from './orienteering';
import type { Point, Vec3 } from './types';

// A tree, a seedling or a tussock: a place on the map and how it is drawn. The last fields are set
// later (clearing, bend).
interface Plant {
  x: number;
  y: number;
  k: number;
  rotation: number;
  tone: number;
  width?: number;
  tilt?: number;
  kx?: number;
  ky?: number;
  removed?: boolean;
  cotton?: boolean;
}
// An object of the world: a model at a map point that stands at baseLevel() and sinks into the
// ground with its part of the map.
interface WorldObject {
  model: THREE.Group;
  x: number;
  y: number;
  part: string;
  baseLevel: () => number;
  direction?: number;
}
// A wire between two points [x, y, height above the ground]; line is drawn later.
interface Wire {
  a: Vec3;
  b: Vec3;
  sag: number;
  line?: THREE.Line;
}

const WIDTH = 600;
const HEIGHT = 380;
const CELL = 2; // spacing of the height grid in metres
const NX = WIDTH / CELL + 1;
const NY = HEIGHT / CELL + 1;
// The MML contour interval is 5 m. The vertical is exaggerated to double, so that the hill stands
// out from behind the trees.
const CONTOUR_INTERVAL = 10;
const WATER_LEVEL = -0.3;
const PARTS = ['forest', 'field', 'mire', 'hill', 'lake', 'trail'];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- Map shapes prepared for computation ----------
const SVG_NS = 'http://www.w3.org/2000/svg';
const measureSvg = document.createElementNS(SVG_NS, 'svg');
measureSvg.style.cssText = 'position:absolute;width:0;height:0';
const measurePath = document.createElementNS(SVG_NS, 'path');
measureSvg.appendChild(measurePath);
document.body.appendChild(measureSvg);

function samples(d: string, step = 2): Point[] {
  measurePath.setAttribute('d', d);
  const length = measurePath.getTotalLength();
  const n = Math.max(12, Math.ceil(length / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const q = measurePath.getPointAtLength((i / n) * length);
    return [q.x, q.y];
  });
}

// A shape can tell the distance to its edge and (for a closed shape) whether a point is inside.
// For a far away point only a lower bound is returned, which is at least `limit`.
function shape(d: string, closed: boolean) {
  const p = samples(d);
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  function distance(x: number, y: number, limit = Infinity) {
    const outside = Math.max(x0 - x, x - x1, y0 - y, y - y1);
    if (outside > limit) return outside;
    let smallest = Infinity;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1];
      const [bx, by] = p[i];
      const dx = bx - ax,
        dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
      const ex = ax + t * dx - x,
        ey = ay + t * dy - y;
      smallest = Math.min(smallest, ex * ex + ey * ey);
    }
    return Math.sqrt(smallest);
  }
  function inside(x: number, y: number) {
    if (!closed || x < x0 || x > x1 || y < y0 || y > y1) return false;
    let isInside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) isInside = !isInside;
    }
    return isInside;
  }
  // Signed distance: positive inside, negative outside.
  const signed = (x: number, y: number, limit?: number) =>
    (inside(x, y) ? 1 : -1) * distance(x, y, limit);
  return { points: p, distance, inside, signed };
}

const M = Foxwood.shapes;
const HILL = M.hill.map((d) => shape(d, true));
const LAKE = shape(M.lake, true);
const FIELD = shape(M.field, true);
const MIRE = shape(M.mire, true);
const BROOK = shape(M.stream, false);
// Thicket: [slow-running edge, hard-to-run centre].
const THICKET = M.thicket.map((d) => shape(d, true));
// The density of the forest at a map point: 0 = ordinary forest, 1 = slow, 2 = hard to run (the
// greens of the orienteering map).
const density = (x: number, y: number) =>
  THICKET[1].inside(x, y) ? 2 : THICKET[0].inside(x, y) ? 1 : 0;
const ROADS = {
  trail: shape(M.trail, false),
  track: shape(M.track, false),
  accessRoad: shape(M.accessRoad, false),
  carRoad: shape(M.carRoad, false),
};
// Bridge: the road crosses the brook. The axis of the bridge runs on the map from start to end.
const BRIDGE = (() => {
  const {
    start: [ax, ay],
    end: [bx, by],
    width,
  } = Foxwood.BRIDGE;
  const length = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / length,
    uy = (by - ay) / length;
  const centre: Point = [(ax + bx) / 2, (ay + by) / 2];
  // Is the map point on the deck of the bridge?
  const isOn = (x: number, y: number) => {
    const dx = x - centre[0],
      dy = y - centre[1];
    return Math.abs(dx * ux + dy * uy) <= length / 2 && Math.abs(dy * ux - dx * uy) <= width / 2;
  };
  // The corners and ends of the deck, at whose highest point the deck is placed.
  const edges = [-1, 0, 1].flatMap((s) =>
    (
      [
        [ax, ay],
        [bx, by],
      ] as Point[]
    ).map(([x, y]): Point => [x - (s * uy * width) / 2, y + (s * ux * width) / 2]),
  );
  return { length, width, centre, direction: Math.atan2(by - ay, bx - ax), isOn, edges };
})();
// The small features are only on the orienteering map (orienteering.ts). In the terrain they are
// only shown in the orienteering map mode.
const SMALL = Orienteering.SMALL_FEATURES;
// Fences are on both maps (Foxwood.FENCES): the yard fence and the stone wall.
const FENCES = {
  yard: shape(`M${Foxwood.FENCES.yard.join(' L')}`, false),
  stoneFence: shape(`M${Foxwood.FENCES.stoneFence.join(' L')}`, false),
};
// Power line (Foxwood.POWER_LINE): the main line along the road and branches to the house and the
// cabin. There is a treeless strip under the line.
const SL = Foxwood.POWER_LINE;
const POWER = {
  main: shape(`M${SL.poles.join(' L')}`, false),
  branches: Object.values(SL.branches).map(({ pole: poleXY, joint: jointXY }) =>
    shape(`M${poleXY} L${jointXY}`, false),
  ),
};
const underPowerLine = (x: number, y: number, margin = 0) =>
  POWER.main.distance(x, y, 7 + margin) < 7 + margin ||
  POWER.branches.some((h) => h.distance(x, y, 5 + margin) < 5 + margin);
// The knoll and the pit are landforms (m): the height at the top of the knoll and the depth of the
// pit.
const KNOLL = { height: 4.5, radius: 10 };
const PIT = { depth: 2.2, radius: 5 };
const bump = (r: number, R: number) => (r < R ? (1 + Math.cos((Math.PI * r) / R)) / 2 : 0);
function smallFeatureHeight(x: number, y: number) {
  if (!SMALL) return 0;
  const [kx, ky] = SMALL.knoll,
    [px, py] = SMALL.pit;
  return (
    KNOLL.height * bump(Math.hypot(x - kx, y - ky), KNOLL.radius) -
    PIT.depth * bump(Math.hypot(x - px, y - py), PIT.radius)
  );
}
// Is the point (x, y) less than `limit` metres from some small feature? Trees are not planted on
// them.
function nearSmallFeature(x: number, y: number, limit: number) {
  if (!SMALL) return false;
  const points: [Point, number][] = [
    [SMALL.knoll, KNOLL.radius],
    [SMALL.pit, PIT.radius + 2],
    [SMALL.antNest, 3],
  ];
  return points.some(([[a, b], r]) => Math.hypot(x - a, y - b) < r + limit);
}

// The cliff (Foxwood.CLIFF) is a step on the east slope of the hill: the upper side rises and the
// lower side falls by half of the step, and the change fades out on the slope over `width` metres.
// At the step a rock wall (cliffModel) covers the steep part of the ground. A point s = the
// distance from the line, positive towards the lower slope. The height is exaggerated like the fox
// (5 m), so that the wall is tall next to the fox.
const CLIFF_STEP = { height: 9, width: 17, ramp: 1.5 };
function fromCliff(x: number, y: number) {
  const P = Foxwood.CLIFF;
  let best: { d: number; along: number; side: number } | null = null,
    start = 0;
  for (let i = 1; i < P.length; i++) {
    const [[ax, ay], [bx, by]] = [P[i - 1], P[i]];
    const l = Math.hypot(bx - ax, by - ay);
    const [ux, uy] = [(bx - ax) / l, (by - ay) / l];
    const t = clamp(((x - ax) * ux + (y - ay) * uy) / l);
    const d = Math.hypot(ax + ux * t * l - x, ay + uy * t * l - y);
    // The line runs from south to north, so the lower slope (east) is on the right in the walking
    // direction.
    if (!best || d < best.d)
      best = { d, along: start + t * l, side: ux * (y - ay) - uy * (x - ax) < 0 ? -1 : 1 };
    start += l;
  }
  return { s: best!.side * best!.d, along: best!.along, length: start };
}
// The rise (+) or fall (-) of the ground at the cliff (m). The ends of the step flatten out into
// the slope.
function cliffChange(x: number, y: number) {
  const { s, along, length } = fromCliff(x, y);
  if (Math.abs(s) > CLIFF_STEP.width + CLIFF_STEP.ramp) return 0;
  const ends = smoothstep(clamp(along / 6)) * smoothstep(clamp((length - along) / 6));
  const [h, r] = [(CLIFF_STEP.height / 2) * ends, CLIFF_STEP.ramp];
  if (Math.abs(s) <= r) return (-h * s) / r;
  return Math.sign(-s) * h * (1 - smoothstep(clamp((Math.abs(s) - r) / CLIFF_STEP.width)));
}

// Roads and the brook that continue outside the map (only in the 3D world).
const EXTENSIONS = Object.entries(Foxwood.EXTENSIONS).flatMap(([kind, paths]) =>
  paths.map((d) => ({ kind, shape: shape(d, false) })),
);

// ---------- Height ----------
// Soft, repeating noise: the same map always produces the same terrain.
function hash(i: number, j: number) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x: number, y: number) {
  const i = Math.floor(x),
    j = Math.floor(y);
  const fx = smoothstep(x - i),
    fy = smoothstep(y - j);
  return lerp(
    lerp(hash(i, j), hash(i + 1, j), fx),
    lerp(hash(i, j + 1), hash(i + 1, j + 1), fx),
    fy,
  );
}
const noise = (x: number, y: number) =>
  0.65 * valueNoise(x / 70, y / 70) + 0.35 * valueNoise(x / 23 + 50, y / 23);

// Hill: the contours of the map are exactly at the heights of 1, 2 and 3 contour intervals. Between
// the contours the height goes evenly from one contour to the next, so the shape of the hill comes
// from the map.
function hillHeight(x: number, y: number) {
  const [d0, d1, d2] = HILL.map((m) => m.signed(x, y, 60));
  const V = CONTOUR_INTERVAL;
  if (d0 <= 0) return V * (1 - clamp(-d0 / 45)) ** 2;
  if (d1 <= 0) return V + (V * d0) / (d0 - d1);
  if (d2 <= 0) return 2 * V + (V * d1) / (d1 - d2);
  return 3 * V + V * 0.7 * (1 - (1 - clamp(d2 / 18)) ** 2);
}

// Three parts separately, so that the hill and the lake can be flattened like a map.
const N = NX * NY;
const base = new Float32Array(N);
const hillLayer = new Float32Array(N);
const water = new Float32Array(N);
const smallLayer = new Float32Array(N);
const cliff = new Float32Array(N); // part of the hill: flattens with the hill
const current = new Float32Array(N);

for (let j = 0; j < NY; j++) {
  for (let i = 0; i < NX; i++) {
    const x = i * CELL,
      y = j * CELL;
    const k = j * NX + i;
    hillLayer[k] = hillHeight(x, y);
    smallLayer[k] = smallFeatureHeight(x, y);
    cliff[k] = cliffChange(x, y);
    const inLake = LAKE.signed(x, y, 20);
    const toBrook = BROOK.distance(x, y, 12);
    const toRoad = Math.min(...Object.values(ROADS).map((t) => t.distance(x, y, 8)));
    // Bumpiness is less than a contour interval, so it does not show on the map. It fades out at
    // the edges and in flat places.
    let bumpiness = noise(x, y) * 1.2;
    bumpiness *= clamp(Math.min(x, WIDTH - x, y, HEIGHT - y) / 30);
    if (FIELD.inside(x, y) || MIRE.inside(x, y)) bumpiness *= 0.2;
    bumpiness *= clamp(-inLake / 6) * clamp(toBrook / 10) * (0.4 + 0.6 * clamp(toRoad / 8));
    base[k] = bumpiness * (1 - clamp(hillLayer[k] / CONTOUR_INTERVAL));
    // The lake deepens from the shore. The brook is a channel that is deeper and wider at the
    // bridge, so that you can see under the bridge. At the north edge of the map the channel
    // flattens to the level of the ground outside the map.
    let v = inLake > 0 ? -(0.8 + Math.min(inLake * 0.1, 3.5)) : 0;
    const nearBridge = clamp(1 - Math.hypot(x - BRIDGE.centre[0], y - BRIDGE.centre[1]) / 35);
    const channel = 3.5 + 1.5 * nearBridge;
    if (toBrook < channel)
      v = Math.min(v, -(1.3 + 1.7 * nearBridge) * (1 - (toBrook / channel) ** 2) * clamp(y / 4));
    water[k] = v;
  }
}
// The folds of the hill are smoothed at the contours (moves the contours by less than a metre).
for (let pass = 0; pass < 2; pass++) {
  const old = hillLayer.slice();
  for (let j = 1; j < NY - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      let s = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) s += old[(j + dj) * NX + i + di];
      hillLayer[j * NX + i] = s / 9;
    }
  }
}

// The share of the small features (knoll, pit): 0 = the state of the MML map or the map, 1 = the
// terrain of the orienteering map.
const flattening = { hill: 0, lake: 0, smallFeatures: 1 };
function computeCurrent() {
  for (let k = 0; k < N; k++)
    current[k] =
      base[k] +
      (hillLayer[k] + cliff[k]) * (1 - flattening.hill) +
      water[k] * (1 - flattening.lake) +
      smallLayer[k] * (1 - flattening.smallFeatures);
}
computeCurrent();

function sample(table: Float32Array, x: number, y: number) {
  if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return 0;
  const gx = Math.min(x / CELL, NX - 1.001),
    gy = Math.min(y / CELL, NY - 1.001);
  const i = Math.floor(gx),
    j = Math.floor(gy);
  const fx = gx - i,
    fy = gy - j;
  const k = j * NX + i;
  return lerp(lerp(table[k], table[k + 1], fx), lerp(table[k + NX], table[k + NX + 1], fx), fy);
}
// The height of the ground at the map point (x, y) in the current state. Outside the map the ground
// is at level 0.
const heightAt = (x: number, y: number) => sample(current, x, y);
const initialHeight = (x: number, y: number) =>
  sample(base, x, y) + sample(hillLayer, x, y) + sample(cliff, x, y) + sample(water, x, y);
const toWorld = (x: number, y: number, lift = 0) =>
  new THREE.Vector3(x - WIDTH / 2, heightAt(x, y) + lift, y - HEIGHT / 2);
// The surface where the fox, a car or a fish is: the deck on the bridge, the water surface in the
// lake, otherwise the ground. The height of the deck of the bridge (null when the bridge has sunk
// into a map) is set after the world is built.
let deck: number | null = null;
function surface(x: number, y: number) {
  if (deck !== null && BRIDGE.isOn(x, y)) return Math.max(heightAt(x, y), deck);
  return LAKE.inside(x, y) && flattening.lake < 1
    ? Math.max(heightAt(x, y), WATER_LEVEL)
    : heightAt(x, y);
}

// ---------- Is the place free for a tree? ----------
const BUILDINGS = Object.entries(Foxwood.BUILDINGS);
function isFree(x: number, y: number) {
  if (FIELD.signed(x, y, 5) > -5 || MIRE.signed(x, y, 4) > -4 || LAKE.signed(x, y, 5) > -5)
    return false;
  if (BROOK.distance(x, y, 7) < 7) return false;
  if (Object.values(ROADS).some((t) => t.distance(x, y, 8) < 8)) return false;
  if (Math.hypot(x - Foxwood.CAMPFIRE[0], y - Foxwood.CAMPFIRE[1]) < 16) return false;
  if (Math.hypot(x - Foxwood.STONE[0], y - Foxwood.STONE[1]) < 10) return false;
  if (Math.hypot(x - Foxwood.LOOKOUT_TOWER[0], y - Foxwood.LOOKOUT_TOWER[1]) < 13) return false;
  // There are no trees in front of and on top of the wall of the cliff, so that the wall is visible
  // from the lake.
  if (Math.abs(fromCliff(x, y).s) < 9) return false;
  if (Foxwood.BOULDERS.some(([a, b, size]) => Math.hypot(x - a, y - b) < 4 + 3 * size))
    return false;
  if (Foxwood.isInYard(x, y, 5)) return false;
  if (
    BUILDINGS.some(
      ([, [, rx, ry, l, k]]) => Math.abs(x - rx) < l / 2 + 7 && Math.abs(y - ry) < k / 2 + 7,
    )
  )
    return false;
  if (Math.hypot(x - 30, y - 345) < 26) return false; // the position of the fox at the start of the path
  if (HILL[2].inside(x, y)) return false; // there is a small clearing at the top of the hill, from which you can see far
  if (THICKET[0].signed(x, y, 1) > -1) return false; // in the thicket only young spruces (seedlings) grow
  if (nearSmallFeature(x, y, 3)) return false;
  if (Object.values(FENCES).some((m) => m.distance(x, y, 4) < 3)) return false;
  if (underPowerLine(x, y)) return false;
  return true;
}

// ---------- Checks ----------
// The map data is searched for places that would look wrong in the terrain.
function check(treeCount: number) {
  const result: { level: 'ok' | 'warning' | 'error'; text: string }[] = [];
  const add = (level: 'ok' | 'warning' | 'error', text: string) => result.push({ level, text });
  const NAMES: Record<string, string> = {
    house: 'House',
    barn: 'Barn',
    cabin: 'Cabin',
    sauna: 'Sauna',
  };
  for (const [name, [, x, y, l, k]] of BUILDINGS) {
    const corners: Point[] = [
      [x, y],
      [x - l / 2, y - k / 2],
      [x + l / 2, y - k / 2],
      [x - l / 2, y + k / 2],
      [x + l / 2, y + k / 2],
    ];
    if (corners.some(([a, b]) => LAKE.inside(a, b)))
      add('error', `${NAMES[name]} is partly in the lake.`);
    else if (LAKE.distance(x, y) - Math.max(l, k) / 2 < 4)
      add('warning', `${NAMES[name]} is right at the shoreline (less than 4 m).`);
    if (corners.some(([a, b]) => FIELD.inside(a, b) || MIRE.inside(a, b)))
      add('error', `${NAMES[name]} is in a field or a mire.`);
    for (const [road, t] of Object.entries(ROADS)) {
      if (t.distance(x, y) < Math.min(l, k) / 2)
        add('error', `${NAMES[name]} is on a road (${road}).`);
    }
    const heights = corners.map(([a, b]) => initialHeight(a, b));
    const difference = Math.max(...heights) - Math.min(...heights);
    if (difference > 2)
      add(
        'warning',
        `${NAMES[name]} is on a slope (${difference.toFixed(1)} m height difference). The plinth hides it.`,
      );
  }
  if (LAKE.inside(...Foxwood.CAMPFIRE)) add('error', 'The campfire site is in the lake.');
  if (LAKE.inside(...Foxwood.STONE)) add('error', 'The big stone is in the lake.');
  else if (LAKE.distance(...Foxwood.STONE) < 4)
    add('warning', 'The big stone is right at the shoreline.');
  for (const [road, t] of Object.entries(ROADS)) {
    if (t.points.some(([a, b]) => LAKE.inside(a, b)))
      add('error', `The road (${road}) goes through the lake.`);
    if (t.points.some(([a, b]) => MIRE.inside(a, b)))
      add('warning', `The road (${road}) goes through the mire.`);
  }
  const end = BROOK.points.at(-1)!;
  if (LAKE.signed(end[0], end[1]) < -3) add('error', 'The brook does not flow into the lake.');
  // The brook must flow downhill: the height of the ground at the channel must not rise.
  let highest = -Infinity,
    rise = 0;
  for (const [a, b] of [...BROOK.points].reverse()) {
    const h = sample(base, a, b) + sample(hillLayer, a, b);
    highest = Math.max(highest, h);
    rise = Math.max(rise, highest - h);
  }
  if (rise > 1) add('error', `The brook flows uphill (${rise.toFixed(1)} m).`);
  // A road may cross the channel of the brook only on a bridge.
  if (ROADS.carRoad.points.some(([a, b]) => BROOK.distance(a, b, 6) < 5 && !BRIDGE.isOn(a, b)))
    add('error', 'A road crosses the brook without a bridge.');
  else add('ok', 'The bridge takes the road over the brook.');
  if (Object.values(ROADS).some((t) => t.points.some(([a, b]) => THICKET[0].inside(a, b))))
    add('warning', 'A road goes through the thicket.');
  const fencePoints = Object.values(FENCES).flatMap((m) => m.points);
  if (
    fencePoints.some(
      ([a, b]) =>
        LAKE.inside(a, b) ||
        FIELD.inside(a, b) ||
        Object.values(ROADS).some((t) => t.distance(a, b, 5) < 4),
    )
  ) {
    add('error', 'A fence goes through water, a field or a road.');
  }
  const poleWrong = SL.poles.some(
    ([a, b]) =>
      LAKE.inside(a, b) ||
      BROOK.distance(a, b, 8) < 6 ||
      Object.values(ROADS).some((t) => t.distance(a, b, 5) < 4),
  );
  if (poleWrong) add('error', 'A power pole is in water, next to the brook or on a road.');
  if (SMALL) {
    const points = [SMALL.knoll, SMALL.pit, SMALL.antNest];
    const wrong = points.some(
      ([a, b]) =>
        LAKE.inside(a, b) ||
        MIRE.inside(a, b) ||
        FIELD.inside(a, b) ||
        Object.values(ROADS).some((t) => t.distance(a, b, 5) < 4),
    );
    if (wrong)
      add(
        'error',
        'A small feature (orienteering map) is in water, in a mire, in a field or on a road.',
      );
  }
  add('ok', `${treeCount} trees planted, each on the surface of the ground.`);
  return result;
}

// ---------- Surface pictures: terrain, map and the mask of the parts ----------
const defs = Foxwood.aerial.forest.match(/<defs>[\s\S]*<\/defs>/)![0];
const I = Foxwood.aerial;
const O = Foxwood.parts;
const svgImage = (content: string, attributes = '') =>
  `<svg xmlns="${SVG_NS}" viewBox="0 0 ${WIDTH} ${HEIGHT}" ${attributes}>${content}</svg>`;

// The surface of the ground in the terrain: forest floor (darker and shadier in the thicket),
// field, mire, the bottom of the lake, paths and roads. Trees are 3D objects. Under the bridge the
// brook is visible at the bottom of the channel, not the road.
const terrainSvg = svgImage(`${defs}
  <pattern id="moss" width="46" height="40" patternUnits="userSpaceOnUse">
    <rect width="46" height="40" fill="#6E9A4E"/>
    <circle cx="10" cy="12" r="9" fill="#678F48"/><circle cx="34" cy="28" r="11" fill="#74A052"/>
    <circle cx="36" cy="6" r="5" fill="#638A45"/><circle cx="14" cy="34" r="4" fill="#7AA657"/>
  </pattern>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#moss)"/>
  ${Foxwood.YARDS.map((p) => Foxwood.yardShape(p, `fill="${p[4]}"`)).join('')}
  ${M.thicket.map((d, i) => `<path d="${d}" fill="${['#5E8842', '#4E763A'][i]}"/>`).join('')}
  ${I.field}${I.mire}${I.lake}${I.stream}${I.trail}${I.track}${I.carRoad}${I.campfire}
  <clipPath id="under-bridge"><rect x="${BRIDGE.centre[0] - 12}" y="${BRIDGE.centre[1] - 7}" width="24" height="14"/></clipPath>
  <g clip-path="url(#under-bridge)">${I.stream}</g>`);

const mapSvg = svgImage(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#FBF8F0"/>
  ${O.grid}${O.forest}${O.field}${O.mire}${O.hill}${O.stream}${O.lake}${O.trail}${O.track}${O.carRoad}${O.campfire}${O.building}${O.powerLine}${O.fences}${O.cliff}${O.stones}${O.lookoutTower}`);
// The orienteering map (orienteering.ts) is drawn only when the page needs it (create({
// orienteering: true })).
const orienteeringSvg = () => svgImage(Orienteering.map());

// The red channel of the mask tells which part a pixel belongs to (PARTS index * 30). The small
// features belong to the same part as on the map page: the brook and the stone to the lake, the
// roads, the campfire, the buildings and the lookout tower to the path. The lookout tower is on the
// hill, but it belongs to the path, so that the contour shader of the hill does not colour its sign
// brown.
const part = (id: string) => `rgb(${PARTS.indexOf(id) * 30},0,0)`;
const strokeLine = (d: string, id: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${part(id)}" stroke-width="${width}"/>`;
const maskSvg = svgImage(
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${part('forest')}"/>
  <path d="${M.field}" fill="${part('field')}" stroke="${part('field')}" stroke-width="4"/>
  <path d="${M.mire}" fill="${part('mire')}" stroke="${part('mire')}" stroke-width="4"/>
  <path d="${M.hill[0]}" fill="${part('hill')}" stroke="${part('hill')}" stroke-width="12"/>
  ${strokeLine(M.stream, 'lake', 7)}
  <path d="${M.lake}" fill="${part('lake')}" stroke="${part('lake')}" stroke-width="8"/>
  <circle cx="${Foxwood.STONE[0]}" cy="${Foxwood.STONE[1]}" r="6" fill="${part('lake')}"/>
  ${strokeLine(M.trail, 'trail', 5)}${strokeLine(M.track, 'trail', 5)}${strokeLine(M.accessRoad, 'trail', 5)}${strokeLine(M.carRoad, 'trail', 10)}
  <circle cx="${Foxwood.CAMPFIRE[0]}" cy="${Foxwood.CAMPFIRE[1]}" r="8" fill="${part('trail')}"/>
  ${strokeLine(`M${Foxwood.FENCES.yard.join(' L')} L${Foxwood.FENCES.gate[0]}`, 'trail', 5)}${strokeLine(`M${Foxwood.FENCES.stoneFence.join(' L')}`, 'trail', 5)}
  <circle cx="${Foxwood.LOOKOUT_TOWER[0]}" cy="${Foxwood.LOOKOUT_TOWER[1] - 3}" r="8" fill="${part('trail')}"/>
  ${[Foxwood.powerLineSegments.main, ...Foxwood.powerLineSegments.branches].map((v) => strokeLine(`M${v.join(' L')}`, 'trail', 7)).join('')}
  ${Foxwood.YARDS.map((p) => Foxwood.yardShape(p, `fill="${part('trail')}"`)).join('')}
  ${BUILDINGS.map(([, [, x, y, l, k]]) => `<rect x="${x - l / 2 - 2}" y="${y - k / 2 - 2}" width="${l + 4}" height="${k + 4}" fill="${part('trail')}"/>`).join('')}`,
  'shape-rendering="crispEdges"',
);

function drawImage(svg: string, width: number, mask?: boolean) {
  return new Promise<THREE.CanvasTexture>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((width * HEIGHT) / WIDTH);
      const c = canvas.getContext('2d')!;
      if (mask) c.imageSmoothingEnabled = false;
      c.drawImage(image, 0, 0, canvas.width, canvas.height);
      // The browser smooths the edges of the mask, which would put the number of a wrong part on
      // the edge. An edge pixel gets the part of its left neighbour.
      if (mask)
        try {
          const imageData = c.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            const part = Math.round(d[i] / 30);
            d[i] =
              Math.abs(d[i] - part * 30) <= 3 || i % (canvas.width * 4) === 0
                ? part * 30
                : d[i - 4];
          }
          c.putImageData(imageData, 0, 0);
        } catch (e) {
          console.warn('Could not tidy the edges of the mask', e);
        }
      const texture = new THREE.CanvasTexture(canvas);
      if (mask) {
        texture.minFilter = texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
      } else {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
      }
      resolve(texture);
    };
    image.onerror = reject;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// ---------- Models of objects ----------
// Merges parts into one geometry where every part has its own colour.
function merge(parts: [THREE.BufferGeometry, string][]) {
  const positions: number[] = [],
    colors: number[] = [];
  for (const [g0, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const c = new THREE.Color(color);
    positions.push(...Array.from(g.attributes.position.array));
    for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
const cone = (r: number, h: number, y: number) =>
  new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0);
// The spruce is 1 tall; the size is given as a scale. The trunk continues under the ground, so that
// no gap shows on the slope.
const SPRUCE = merge([
  [new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5).translate(0, 0.05, 0), '#6B4A34'],
  [cone(0.3, 0.42, 0.14), '#2F6040'],
  [cone(0.24, 0.38, 0.38), '#3A6B45'],
  [cone(0.16, 0.34, 0.66), '#467A50'],
]);

const material = (color: string, attributes = {}) =>
  new THREE.MeshLambertMaterial({ color: color, flatShading: true, ...attributes });
function box(l: number, h: number, k: number, color: string, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, k), material(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Building: a plinth, walls and a gable roof. The ridge runs along the long side as in the aerial
// photo.
const STYLES: Record<
  string,
  {
    wall: string;
    roof: string;
    corner?: string;
    wallHeight: number;
    roofHeight: number;
    windows: number;
  }
> = {
  house: {
    wall: '#A63E33',
    roof: '#5E2A24',
    corner: '#F4EDE0',
    wallHeight: 5,
    roofHeight: 3.4,
    windows: 3,
  },
  barn: { wall: '#8E8A82', roof: '#5F5B54', wallHeight: 5.5, roofHeight: 3.6, windows: 0 },
  cabin: {
    wall: '#7A5A44',
    roof: '#463B35',
    corner: '#E8DCC8',
    wallHeight: 3,
    roofHeight: 2.2,
    windows: 1,
  },
  sauna: { wall: '#6A4E3A', roof: '#4A4540', wallHeight: 2.6, roofHeight: 1.7, windows: 0 },
  // There is no church in Foxwood, only in the lesson panel (lesson-panel.ts adds the tower).
  church: { wall: '#F4F1E8', roof: '#7A3A2E', wallHeight: 6, roofHeight: 5, windows: 3 },
};
function buildingModel(name: string, l: number, k: number) {
  const t = STYLES[name];
  const group = new THREE.Group();
  group.add(box(l + 0.4, 3.4, k + 0.4, '#9A968C', 0, -3, 0));
  group.add(box(l, t.wallHeight, k, t.wall, 0, 0.4, 0));
  const long = Math.max(l, k),
    short = Math.min(l, k);
  const triangle = new THREE.Shape([
    new THREE.Vector2(-short / 2 - 0.5, 0),
    new THREE.Vector2(short / 2 + 0.5, 0),
    new THREE.Vector2(0, t.roofHeight),
  ]);
  const roof = new THREE.ExtrudeGeometry(triangle, {
    depth: long + 0.8,
    bevelEnabled: false,
  }).translate(0, 0, -(long + 0.8) / 2);
  if (l >= k) roof.rotateY(Math.PI / 2);
  const roofMesh = new THREE.Mesh(roof, material(t.roof));
  roofMesh.position.y = 0.4 + t.wallHeight;
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  group.add(roofMesh);
  // Gable triangles in the colour of the wall under the roof.
  const gable = new THREE.ExtrudeGeometry(
    new THREE.Shape([
      new THREE.Vector2(-short / 2, 0),
      new THREE.Vector2(short / 2, 0),
      new THREE.Vector2(0, t.roofHeight - 0.3),
    ]),
    { depth: long, bevelEnabled: false },
  ).translate(0, 0, -long / 2);
  if (l >= k) gable.rotateY(Math.PI / 2);
  const gableMesh = new THREE.Mesh(gable, material(t.wall));
  gableMesh.position.y = 0.4 + t.wallHeight;
  group.add(gableMesh);
  if (t.corner) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        group.add(box(0.35, t.wallHeight, 0.35, t.corner, (sx * l) / 2, 0.4, (sz * k) / 2));
  }
  // The door and windows on the south wall (the camera looks north).
  const front = k / 2 + 0.06;
  group.add(box(1.1, 2.1, 0.12, '#4A3326', -l / 2 + 1.6, 0.4, front));
  for (let i = 0; i < t.windows; i++) {
    const x = -l / 2 + 3.4 + ((l - 4.4) * (i + 0.5)) / t.windows;
    group.add(box(1.3, 1.3, 0.12, '#F4EDE0', x, 1.9, front));
    group.add(box(0.95, 0.95, 0.16, '#3C4A55', x, 2.08, front));
  }
  return group;
}

function campfireModel() {
  const group = new THREE.Group();
  const stone = new THREE.DodecahedronGeometry(0.4);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(stone, material('#8A867E'));
    const a = (i / 9) * Math.PI * 2;
    m.position.set(Math.cos(a) * 1.3, 0.15, Math.sin(a) * 1.3);
    m.castShadow = true;
    group.add(m);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), material('#6B4A34'));
    log.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI * 2, 0, 'YXZ');
    log.position.y = 0.45;
    group.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.4, 6),
    new THREE.MeshBasicMaterial({ color: '#F29A2E' }),
  );
  flame.position.y = 0.9;
  group.add(flame);
  group.scale.setScalar(1.5);
  return group;
}

// The car is exaggerated in size like the fox (about double), so that it stands out next to the
// fox. The front points towards +x.
function carModel(color: string) {
  const group = new THREE.Group();
  group.add(box(8.4, 2, 3.6, color, 0, 0.7, 0));
  group.add(box(4.6, 1.6, 3.2, color, -0.6, 2.7, 0));
  group.add(box(4.7, 1.1, 3.3, '#BFE3F2', -0.6, 2.9, 0));
  for (const sx of [-2.8, 2.8]) {
    for (const sz of [-1.7, 1.7]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.6, 10).rotateX(Math.PI / 2),
        material('#222'),
      );
      wheel.position.set(sx, 0.8, sz);
      group.add(wheel);
    }
  }
  group.add(
    box(0.2, 0.6, 0.8, '#FFF3B0', 4.2, 1.6, 1.1),
    box(0.2, 0.6, 0.8, '#FFF3B0', 4.2, 1.6, -1.1),
  );
  return group;
}

// Bridge: a concrete deck, asphalt, edge beams and railings, and abutments at the ends. The surface
// of the deck is at level 0, and the bridge runs along the x axis (length x, width z). The railing
// is exaggerated in height like the car and the fox.
function bridgeModel(length: number, width: number, railing = 1.6, thickness = 1) {
  const group = new THREE.Group();
  group.add(box(length, thickness, width, '#A7A399', 0, -0.05 - thickness, 0));
  group.add(box(length, 0.05, width - 1.6, '#6E6E6C', 0, -0.05, 0));
  for (const s of [-1, 1]) {
    const z = s * (width / 2 - 0.4);
    group.add(box(length, 0.45, 0.8, '#C9C5BB', 0, -0.05, z));
    const posts = Math.round(length / 2);
    for (let i = 0; i <= posts; i++)
      group.add(
        box(
          0.16,
          railing,
          0.16,
          '#6F7B83',
          -length / 2 + 0.3 + ((length - 0.6) * i) / posts,
          0.4,
          z,
        ),
      );
    group.add(box(length - 0.4, 0.16, 0.24, '#9AA5AC', 0, 0.4 + railing - 0.16, z));
    group.add(box(length - 0.4, 0.1, 0.14, '#9AA5AC', 0, 0.4 + railing * 0.5, z));
    // The abutment continues deep, so that the bank of the channel does not show under it.
    group.add(box(1.6, 7, width + 0.6, '#9A968C', s * (length / 2 - 0.8), -7 - thickness, 0));
  }
  return group;
}

// Lookout tower: a wooden lattice tower with stairs winding around the outside two rounds to the
// viewing platform. The platform has a railing and a gable roof. The height is exaggerated like the
// fox. The centre line of the stairs runs from corner to corner: the south-west, south-east,
// north-east and north-west corners.
const TOWER = {
  height: 20, // the height of the platform above the ground (m)
  side: 4.6, // the distance of the centre line of the stairs from the centre of the tower (m)
  flights: 8, // stair flights, 2.5 m of rise in each
  // The corners of the stairs [x, z] from the centre of the tower: south-west, south-east,
  // north-east and north-west.
  get corners() {
    const { side } = TOWER;
    return [
      [-side, side],
      [side, side],
      [side, -side],
      [-side, -side],
    ];
  },
  // A point of the centre line of the stairs [x, height, z] from the foot of the tower, u = 0 (on
  // the ground at the south-west corner) .. 1 (the platform).
  stairs(u: number) {
    const { height, flights, corners } = TOWER;
    const i = Math.min(flights - 1, Math.floor(clamp(u) * flights));
    const f = clamp(u) * flights - i;
    const [a, b] = [corners[i % 4], corners[(i + 1) % 4]];
    return [lerp(a[0], b[0], f), ((i + f) * height) / flights, lerp(a[1], b[1], f)];
  },
};
// A beam from point a to point b ([x, y, z]).
function beam(a: Vec3, b: Vec3, thickness: number, color: string) {
  const [va, vb] = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
  const direction = vb.clone().sub(va);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, direction.length(), thickness),
    material(color),
  );
  m.position.copy(va).addScaledVector(direction, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}
function lookoutTowerModel() {
  const { height: H, side: S, flights } = TOWER;
  const group = new THREE.Group();
  const LEG = 3.4;
  // The tower is on the north-east slope of the hill: it stands at the level of its highest corner
  // (the south-west corner where the stairs start), and the legs continue down the slope under the
  // ground to concrete footings.
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    group.add(beam([x * LEG, -9, z * LEG], [x * LEG, H + 0.2, z * LEG], 0.55, '#6E5034'));
    group.add(box(1.2, 9, 1.2, '#9A968C', x * LEG, -9.3, z * LEG));
  }
  const baseLevel = (i: number) => (i * H) / 4;
  for (let i = 0; i < 4; i++) {
    for (const [a, b] of [
      [
        [-1, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, -1],
      ],
      [
        [1, -1],
        [-1, -1],
      ],
      [
        [-1, -1],
        [-1, 1],
      ],
    ]) {
      const [p, q] = [a.map((v) => v * LEG), b.map((v) => v * LEG)];
      group.add(beam([p[0], baseLevel(i), p[1]], [q[0], baseLevel(i + 1), q[1]], 0.25, '#8A6A48'));
      group.add(beam([q[0], baseLevel(i), q[1]], [p[0], baseLevel(i + 1), p[1]], 0.25, '#8A6A48'));
      group.add(
        beam([p[0], baseLevel(i + 1), p[1]], [q[0], baseLevel(i + 1), q[1]], 0.3, '#7A5A3C'),
      );
    }
  }
  // The stair flights and the landings between them. The railing is on the outer edge of the
  // flight.
  for (let i = 0; i < flights; i++) {
    const [ax, ay, az] = TOWER.stairs(i / flights);
    const [bx, by, bz] = TOWER.stairs((i + 0.9999) / flights);
    const flight = new THREE.Group();
    flight.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    flight.rotation.y = Math.atan2(-(bz - az), bx - ax);
    const length = Math.hypot(bx - ax, bz - az);
    const angle = Math.atan2(by - ay, length);
    const deck = box(length / Math.cos(angle), 0.25, 1.6, '#A98B63', 0, -0.25, 0);
    deck.rotation.z = angle;
    flight.add(deck);
    // Steps: crosswise slats 0.8 m apart.
    for (let d = -length / 2 + 0.4; d < length / 2; d += 0.8)
      flight.add(box(0.12, 0.08, 1.6, '#8A6A48', d, d * Math.tan(angle) - 0.02, 0));
    const lift = (d: number) => d * Math.tan(angle);
    for (const d of [-length / 2, 0, length / 2])
      flight.add(box(0.15, 1.6, 0.15, '#7A5A3C', d, lift(d), 0.75));
    flight.add(
      beam(
        [-length / 2, lift(-length / 2) + 1.6, 0.75],
        [length / 2, lift(length / 2) + 1.6, 0.75],
        0.14,
        '#8A6A48',
      ),
    );
    group.add(flight);
    if (i > 0) group.add(box(1.6, 0.25, 1.6, '#A98B63', ax, ay - 0.25, az));
  }
  // Platform: the floor leaves a gap at the west edge where the top flight rises. A railing on
  // three sides.
  group.add(box(S * 2 + 0.8 - 1.6, 0.35, S * 2 + 0.8, '#9C7E58', 0.8, H - 0.35, 0));
  const R = S + 0.4;
  for (const [a, b] of [
    [
      [-S + 0.8, R],
      [R, R],
    ],
    [
      [R, R],
      [R, -R],
    ],
    [
      [R, -R],
      [-S + 0.8, -R],
    ],
  ]) {
    for (let t = 0; t <= 1; t += 0.25)
      group.add(box(0.15, 1.5, 0.15, '#7A5A3C', lerp(a[0], b[0], t), H, lerp(a[1], b[1], t)));
    group.add(beam([a[0], H + 1.5, a[1]], [b[0], H + 1.5, b[1]], 0.16, '#8A6A48'));
    group.add(beam([a[0], H + 0.75, a[1]], [b[0], H + 0.75, b[1]], 0.1, '#8A6A48'));
  }
  // The roof rests on four posts. The posts are tall, so that the exaggerated fox fits under the
  // roof.
  const POLE = 6.5;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    group.add(box(0.3, POLE, 0.3, '#6E5034', x * LEG, H, z * LEG));
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(R * 1.45, 3.4, 4).rotateY(Math.PI / 4),
    material('#5A4636'),
  );
  roof.position.y = H + POLE + 1.7;
  roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  return group;
}

function stoneModel() {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4), material('#8E8A80'));
  m.scale.set(1.25, 0.75, 1);
  m.rotation.y = 0.6;
  m.position.y = 0.6;
  m.castShadow = m.receiveShadow = true;
  const group = new THREE.Group();
  group.add(m);
  return group;
}

// The rock wall of the cliff in world coordinates (built when the ground is terrain). The wall is
// at the lower edge of the step of the ground, and its top is a strip of rock above the step. The
// wall continues under the ground, and the surface is rough.
function cliffModel() {
  const points = samples(`M${Foxwood.CLIFF.join(' L')}`, 1.5);
  const r = seeded(9);
  const ROWS = [0, 0.18, 0.4, 0.62, 0.82, 1]; // the rows of the wall from the top to the foot
  const inside = (j: number) => j > 0 && j < ROWS.length - 1;
  const grid = points.map((p, i) => {
    const [ax, ay] = points[Math.max(i - 1, 0)];
    const [bx, by] = points[Math.min(i + 1, points.length - 1)];
    const l = Math.hypot(bx - ax, by - ay);
    const [nx, ny] = [-(by - ay) / l, (bx - ax) / l]; // towards the lower slope
    const pointAt = (s: number, h: number): Vec3 => [
      p[0] + nx * s - WIDTH / 2,
      h,
      p[1] + ny * s - HEIGHT / 2,
    ];
    const atOffset = (s: number) => heightAt(p[0] + nx * s, p[1] + ny * s);
    const top = atOffset(-CLIFF_STEP.ramp) + 0.35;
    const root = atOffset(CLIFF_STEP.ramp + 2) - 1.5;
    const wall = CLIFF_STEP.ramp + 0.5;
    return [
      pointAt(-CLIFF_STEP.ramp - 1.2, atOffset(-CLIFF_STEP.ramp - 1.2) + 0.3),
      ...ROWS.map((u, j) =>
        pointAt(
          wall + (inside(j) ? (r() - 0.35) * 1.1 : 0),
          lerp(top, root, u) + (inside(j) ? (r() - 0.5) * 0.6 : 0),
        ),
      ),
    ];
  });
  // Every triangle gets its own shade, so that the wall looks assembled from boulders.
  const p: number[] = [],
    colors: number[] = [];
  const c = new THREE.Color();
  const triangle = (...corners: Vec3[]) => {
    p.push(...corners.flat());
    c.set('#A9A59B').multiplyScalar(0.85 + r() * 0.3);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < grid.length - 1; i++) {
    for (let j = 0; j < grid[i].length - 1; j++) {
      const [a, b, cc, d] = [grid[i][j], grid[i + 1][j], grid[i][j + 1], grid[i + 1][j + 1]];
      triangle(a, cc, b);
      triangle(b, cc, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material('#FFFFFF', { vertexColors: true, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  const group = new THREE.Group();
  group.add(m);
  return group;
}

// ---------- Small features (orienteering map) ---------- Exaggerated like the fox (5 m): the ant
// nest 2.3 m, the stone wall 1.4 m and the fence 2.4 m high.
const seeded =
  (s: number) =>
  (..._: number[]) =>
    (s = (s * 16807) % 2147483647) / 2147483647;
const lathe = (points: Point[], segments = 16) =>
  new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

// The height of the surface of the ant nest at the distance r from the centre (also for the ants,
// creatures.ts).
const NEST = { height: 2.3, radius: 2.9 };
const nestSurface = (r: number) => NEST.height * Math.max(0, 1 - (r / NEST.radius) ** 2);
function antNestModel() {
  const profile = Array.from({ length: 8 }, (_, i) => NEST.radius * (1 - i / 7)).map(
    (r): Point => [r, nestSurface(r)],
  );
  profile[0][1] = -0.3; // the edge continues under the ground, so that no gap shows on the slope
  const mound = new THREE.Mesh(lathe(profile, 14), material('#8A6444'));
  mound.castShadow = mound.receiveShadow = true;
  // There are needles and twigs on the surface.
  const r = seeded(3);
  const sticks: [THREE.BufferGeometry, string][] = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * 2 * Math.PI,
      radius = Math.sqrt(r()) * NEST.radius * 0.85;
    const g = new THREE.BoxGeometry(0.55, 0.07, 0.07)
      .rotateZ((r() - 0.5) * 0.8)
      .rotateY(r() * Math.PI)
      .translate(Math.cos(a) * radius, nestSurface(radius) + 0.03, Math.sin(a) * radius);
    sticks.push([g, i % 3 ? '#5E432E' : '#A8845A']);
  }
  const twigs = new THREE.Mesh(
    merge(sticks),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  twigs.castShadow = true;
  const group = new THREE.Group();
  group.add(mound, twigs);
  return group;
}

// Pit: the dark ground of a dug pit and the earth bank at its edge. In Foxwood the ground is really
// deeper at the pit (smallFeatureHeight), and the bottom follows it. In the lesson panel (depth 0)
// the bottom is flat.
function pitModel(radius = PIT.radius, depth = PIT.depth, lift = 0.3) {
  const group = new THREE.Group();
  const bands: [number, number, string][] = [
    [0, 0.4, '#3A2A1E'],
    [0.4, 0.72, '#533D2C'],
    [0.72, 1, '#6B5038'],
  ];
  bands.forEach(([a, b, color], i) => {
    const profile = Array.from({ length: 5 }, (_, j) => radius * (a + ((b - a) * j) / 4)).map(
      (r): Point => [r, -depth * bump(r, radius) + lift + i * 0.002],
    );
    const m = new THREE.Mesh(lathe(profile, 20), material(color, { side: THREE.DoubleSide }));
    m.receiveShadow = true;
    group.add(m);
  });
  const bank = new THREE.Mesh(
    lathe(
      [
        [radius * 1.32, -0.3],
        [radius * 1.12, radius * 0.1],
        [radius * 0.96, radius * 0.1],
        [radius * 0.84, lift - 0.05],
      ],
      20,
    ),
    material('#7A5C40', { side: THREE.DoubleSide }),
  );
  bank.castShadow = bank.receiveShadow = true;
  group.add(bank);
  return group;
}

// Points along a line every `step` metres: [[x, z], ...] → [[x, z, direction angle], ...].
function alongLine(points: Point[], step: number) {
  const result = [];
  let start = 0,
    next = 0;
  for (let i = 1; i < points.length; i++) {
    const [[ax, az], [bx, bz]] = [points[i - 1], points[i]];
    const length = Math.hypot(bx - ax, bz - az);
    for (; next <= start + length + 1e-6; next += step) {
      const u = (next - start) / length;
      result.push([ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bz - az, bx - ax)]);
    }
    start += length;
  }
  return result;
}

// A stone wall through the points [[x, z], ...] (local coordinates). ground(x, z) = the height of
// the ground relative to the level of the wall.
function stoneWallModel(points: Point[], ground: (x: number, z: number) => number = () => 0) {
  const r = seeded(5);
  const COLORS = ['#8E8A80', '#9A968C', '#7E7A72', '#A5A197'];
  const parts: [THREE.BufferGeometry, string][] = [];
  for (const [layer, height, size] of [
    [0, 0.3, 0.6],
    [1, 0.9, 0.48],
  ]) {
    for (const [x, z, a] of alongLine(points, 0.85).slice(layer, layer ? -1 : undefined)) {
      const [dx, dz] = [Math.cos(a) * 0.42 * layer, Math.sin(a) * 0.42 * layer];
      const g = new THREE.DodecahedronGeometry(size * (0.8 + r() * 0.4), 0)
        .scale(1.2, 0.8, 1)
        .rotateY(r() * Math.PI)
        .translate(x + dx + (r() - 0.5) * 0.2, ground(x, z) + height, z + dz + (r() - 0.5) * 0.3);
      parts.push([g, COLORS[Math.floor(r() * COLORS.length)]]);
    }
  }
  const m = new THREE.Mesh(
    merge(parts),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  m.castShadow = m.receiveShadow = true;
  const group = new THREE.Group();
  group.add(m);
  return group;
}

// An old wooden fence through the points [[x, z], ...]: posts about 3 m apart and horizontal rails.
// ground as with the stone wall. height = the height of the fence (m); a high fence has three
// rails.
function fenceModel(
  points: Point[],
  ground: (x: number, z: number) => number = () => 0,
  height = 2.4,
) {
  const group = new THREE.Group();
  // The posts are evenly spread along each part, so there is a post at every corner.
  const posts = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [[ax, az], [bx, bz]] = [points[i - 1], points[i]];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3));
    for (let j = 1; j <= n; j++) posts.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]);
  }
  const rails = height > 3 ? [0.3, 0.6, 0.9] : [0.4, 0.8];
  for (const [x, z] of posts)
    group.add(beam([x, ground(x, z) - 0.4, z], [x, ground(x, z) + height, z], 0.22, '#6E6252'));
  for (let i = 1; i < posts.length; i++) {
    const [[ax, az], [bx, bz]] = [posts[i - 1], posts[i]];
    for (const h of rails)
      group.add(
        beam(
          [ax, ground(ax, az) + h * height, az],
          [bx, ground(bx, bz) + h * height, bz],
          0.13,
          '#8E8270',
        ),
      );
  }
  return group;
}

// Gate: two sturdy posts and a wooden gate leaf that turns on its hinges (at the south post, x =
// 0). The gate runs along the x axis (0 .. width). gate.open(p): p = 0 closed, 1 open (the leaf
// turns 100°).
function gateModel(width = 7, height = 2.4) {
  const group = new THREE.Group();
  for (const x of [0, width]) group.add(beam([x, -0.5, 0], [x, height + 0.3, 0], 0.32, '#5E5244'));
  const leaf = new THREE.Group();
  const L = width - 0.3;
  for (const h of [0.35, 1.2, 2.05]) leaf.add(beam([0.15, h, 0], [L, h, 0], 0.14, '#A08868'));
  for (const x of [0.15, L / 2, L]) leaf.add(beam([x, 0.3, 0], [x, 2.1, 0], 0.14, '#A08868'));
  leaf.add(beam([0.2, 0.4, 0], [L - 0.1, 2.0, 0], 0.12, '#A08868'));
  group.add(leaf);
  return Object.assign(group, { open: (p: number) => (leaf.rotation.y = -p * 1.75) });
}

// Power pole: a wooden pole, a crossarm and insulators. The arm runs along the local z axis (across
// the line). The wires attach on top of the insulators (POLE.wires: [side, height]); the wire of a
// branch starts lower.
const POLE = {
  height: 10,
  wires: [
    [-1.2, 10],
    [0, 10.4],
    [1.2, 10],
  ],
  branch: 8.6,
};
function poleModel() {
  const { height: H } = POLE;
  const group = new THREE.Group();
  group.add(beam([0, -0.6, 0], [0, H + 0.1, 0], 0.38, '#6B5A48'));
  group.add(beam([0, H - 0.35, -1.45], [0, H - 0.35, 1.45], 0.2, '#7A6A56'));
  for (const [side, h] of POLE.wires)
    group.add(beam([0, h - 0.4, side], [0, h, side], 0.14, '#E4E2D8'));
  // The connector of the branch on the side of the pole.
  group.add(beam([0, POLE.branch - 0.25, 0.2], [0, POLE.branch, 0.2], 0.16, '#3A3A3A'));
  return group;
}

// ---------- Building the world ----------
async function create({ orienteering = false } = {}) {
  const [terrainImage, mapImage, maskImage, orienteeringImage] = await Promise.all([
    drawImage(terrainSvg, 3000),
    drawImage(mapSvg, 3000),
    drawImage(maskSvg, 1200, true),
    orienteering ? drawImage(orienteeringSvg(), 3000) : null,
  ]);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#DCEFF3', 200, 900);

  // The light comes from the west fairly low: the shaded side of the hill is in the east, as in
  // oblique-light hill shading.
  scene.add(new THREE.HemisphereLight('#D8ECF5', '#5E6E3E', 1.1));
  const sun = new THREE.DirectionalLight('#FFF1D8', 2.8);
  sun.position.set(-460, 330, 170);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -420,
    right: 420,
    top: 330,
    bottom: -330,
    near: 100,
    far: 1300,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  // Ground: a height grid whose surface blends the terrain picture and the map partly according to
  // the mask.
  const positions = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      positions[k * 3] = i * CELL - WIDTH / 2;
      positions[k * 3 + 2] = j * CELL - HEIGHT / 2;
      uv[k * 2] = (i * CELL) / WIDTH;
      uv[k * 2 + 1] = 1 - (j * CELL) / HEIGHT;
    }
  }
  const triangles = [];
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i,
        b = a + 1,
        c = a + NX,
        d = c + 1;
      triangles.push(a, c, b, b, c, d);
    }
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  groundGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  groundGeo.setIndex(triangles);
  const textureShare = new Array(PARTS.length).fill(0);
  // The contours of the hill on top of the terrain without the paper of the map (0..1), for the
  // hill scene of the sign page.
  const contourShare = { value: 0 };
  // The share of the orienteering map in the map (0 = the MML topographic map, 1 = the orienteering
  // map).
  const orienteeringShare = { value: 0 };
  const groundMaterial = new THREE.MeshLambertMaterial({ map: terrainImage });
  groundMaterial.onBeforeCompile = (s) => {
    s.uniforms.tMap = { value: mapImage };
    s.uniforms.tMask = { value: maskImage };
    s.uniforms.uShare = { value: textureShare };
    s.uniforms.uContours = contourShare;
    s.uniforms.tOrienteering = { value: orienteeringImage ?? mapImage };
    s.uniforms.uOrienteering = orienteeringShare;
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D tMap;
        uniform sampler2D tMask;
        uniform float uShare[${PARTS.length}];
        uniform float uContours;
        uniform sampler2D tOrienteering;
        uniform float uOrienteering;`,
      )
      // The map is paper: it is not shaded, so it is blended on top of the lit colour.
      .replace(
        '#include <tonemapping_fragment>',
        `
        int part = int(floor(texture2D(tMask, vMapUv).r * 255.0 / 30.0 + 0.5));
        float o = uShare[part];
        vec3 map = texture2D(tMap, vMapUv).rgb;
        // Contours: in the area of the hill the pixels of the map that differ from the paper are
        // coloured with the brown of the contour. (The colour of the map as it is would bring the
        // white of the paper to the edges of the line.) The colour is linear like gl_FragColor.
        // Only brown pixels: the black sign of the cliff is in the area of the hill, but it is not
        // a contour.
        float strokeLine = part == ${PARTS.indexOf('hill')} ? smoothstep(0.15, 0.35, distance(map, vec3(0.984, 0.973, 0.941))) * smoothstep(0.1, 0.25, map.r - map.b) : 0.0;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.3, 0.07, 0.012), uContours * strokeLine);
        map = mix(map, texture2D(tOrienteering, vMapUv).rgb, uOrienteering);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, map, o);
        #include <tonemapping_fragment>`,
      );
  };
  const ground = new THREE.Mesh(groundGeo, groundMaterial);
  ground.receiveShadow = true;
  scene.add(ground);

  function updateGround() {
    for (let k = 0; k < N; k++) positions[k * 3 + 1] = current[k];
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.computeVertexNormals();
  }
  updateGround();

  // The ground outside the map: a big plane with a hole in the middle at the map.
  const outerShape = new THREE.Shape(
    [
      [-1400, 1300],
      [1400, 1300],
      [1400, -1300],
      [-1400, -1300],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  outerShape.holes.push(
    new THREE.Path(
      [
        [-300, 190],
        [-300, -190],
        [300, -190],
        [300, 190],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    ),
  );
  const outerMaterial = new THREE.MeshLambertMaterial({ color: '#6E9A4E' });
  const outerGround = new THREE.Mesh(
    new THREE.ShapeGeometry(outerShape).rotateX(-Math.PI / 2),
    outerMaterial,
  );
  outerGround.receiveShadow = true;
  scene.add(outerGround);
  const FOREST_FLOOR = new THREE.Color('#6E9A4E');
  const PAPER = new THREE.Color('#EDE6D4');

  // A strip on top of a line onto the surface of the ground: highlights and the roads that continue
  // outside the map.
  function strip(points: Point[], width: number, lift: number) {
    const p = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[Math.max(i - 1, 0)];
      const [bx, by] = points[Math.min(i + 1, points.length - 1)];
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / length) * (width / 2),
        ny = ((bx - ax) / length) * (width / 2);
      const [x, y] = points[i];
      for (const s of [-1, 1])
        p.push(x + s * nx - WIDTH / 2, heightAt(x, y) + lift, y + s * ny - HEIGHT / 2);
    }
    const indices = [];
    for (let i = 0; i < points.length - 1; i++)
      indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  // The extensions outside the map in the same colours as in the surface picture of the ground, so
  // that the roads do not break at the edge of the map.
  const EXTENSION_LAYERS: Record<string, [number, string][]> = {
    carRoad: [
      [10, '#C9B98E'],
      [7, '#6E6E6C'],
    ],
    track: [[5, '#D8C79A']],
    stream: [
      [7, '#6E9C78'],
      [3.5, '#2F6E9E'],
    ],
  };
  const extensionMaterials: THREE.MeshLambertMaterial[] = [];
  for (const { kind, shape: m } of EXTENSIONS) {
    EXTENSION_LAYERS[kind].forEach(([width, color], i: number) => {
      const material = new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -1 - i,
        polygonOffsetUnits: -4 - 4 * i,
      });
      extensionMaterials.push(material);
      const mesh = new THREE.Mesh(strip(m.points, width, 0.05 + i * 0.05), material);
      mesh.receiveShadow = true;
      scene.add(mesh);
    });
  }

  // The surface of the lake in the shape of the shoreline of the map.
  const lakeShape = new THREE.Shape(
    LAKE.points.map(([x, y]) => new THREE.Vector2(x - WIDTH / 2, -(y - HEIGHT / 2))),
  );
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: '#3C7FAF',
    specular: '#CFE6F2',
    shininess: 60,
    transparent: true,
    opacity: 0.88,
  });
  const waterSurface = new THREE.Mesh(
    new THREE.ShapeGeometry(lakeShape, 24).rotateX(-Math.PI / 2),
    waterMaterial,
  );
  waterSurface.position.y = WATER_LEVEL;
  waterSurface.receiveShadow = true;
  scene.add(waterSurface);

  // Trees: in the forest of the map and more sparsely around the map. A clearing is left around the
  // starting position of the camera.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trees: Plant[] = [],
    outerTrees: Plant[] = [];
  function plant(
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    step: number,
    size: number,
    object: Plant[],
    condition: (x: number, y: number) => boolean,
  ) {
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const px = x + (random() - 0.5) * step * 0.9;
        const py = y + (random() - 0.5) * step * 0.9;
        const k = size * (0.75 + random() * 0.5);
        const rotation = random() * Math.PI * 2;
        const tone = 0.85 + random() * 0.3;
        if (condition(px, py)) object.push({ x: px, y: py, k, rotation, tone });
      }
    }
  }
  // On the slopes of the hill there are fewer trees, so that the shape of the hill stands out.
  plant(
    0,
    WIDTH,
    0,
    HEIGHT,
    14,
    15,
    trees,
    (x: number, y: number) =>
      x > 2 &&
      x < WIDTH - 2 &&
      y > 2 &&
      y < HEIGHT - 2 &&
      isFree(x, y) &&
      (!HILL[1].inside(x, y) || random() < 0.4),
  );
  plant(
    -500,
    1100,
    -450,
    850,
    15,
    17,
    outerTrees,
    (x: number, y: number) =>
      (x < -4 || x > WIDTH + 4 || y < -4 || y > HEIGHT + 4) &&
      Math.hypot(x + 23, y - 389) > 45 &&
      EXTENSIONS.every(({ shape: m }) => m.distance(x, y, 9) >= 9) &&
      !underPowerLine(x, y, 2),
  );

  // The young spruces of the thicket: low and lighter, denser in the centre than at the edges.
  // Planted last, so that the positions of the other trees do not change.
  const seedlings: Plant[] = [];
  plant(76, 150, 194, 260, 2.9, 5, seedlings, (x: number, y: number) => density(x, y) === 1);
  plant(94, 136, 210, 242, 1.9, 4.2, seedlings, (x: number, y: number) => density(x, y) === 2);
  // A young spruce is wide and bushy: the branches reach the neighbour, so no ground shows between
  // the trees.
  for (const p of seedlings) Object.assign(p, { tone: p.tone + 0.15, width: 1.4 });

  const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  function treeSet(list: Plant[], shadows: boolean) {
    const m = new THREE.InstancedMesh(SPRUCE, treeMaterial, list.length);
    m.castShadow = shadows;
    m.receiveShadow = true;
    const c = new THREE.Color();
    list.forEach((p, i) => m.setColorAt(i, c.setScalar(p.tone)));
    scene.add(m);
    return m;
  }
  const puuMesh = treeSet(trees, true);
  const outerMesh = treeSet(outerTrees, false);
  const seedlingMesh = treeSet(seedlings, true);
  const tmp = new THREE.Object3D();
  const UP = new THREE.Vector3(0, 1, 0),
    axis = new THREE.Vector3(),
    tilt = new THREE.Quaternion();
  // A tree can lean (a seedling that the fox pushes past): the tilt in radians in the direction
  // [kx, ky] on the map.
  function setTree(mesh: THREE.InstancedMesh, p: Plant, i: number, size: number) {
    tmp.position.set(p.x - WIDTH / 2, heightAt(p.x, p.y), p.y - HEIGHT / 2);
    tmp.quaternion.setFromAxisAngle(UP, p.rotation);
    if (p.tilt)
      tmp.quaternion.premultiply(tilt.setFromAxisAngle(axis.set(p.ky!, 0, -p.kx!), p.tilt));
    const k = p.removed ? 0.001 : Math.max(p.k * size, 0.001);
    tmp.scale.set(k * (p.width ?? 1), k, k * (p.width ?? 1));
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  }
  function setTrees(mesh: THREE.InstancedMesh, list: Plant[], size: number) {
    list.forEach((p, i) => setTree(mesh, p, i, size));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = size > 0.001;
  }
  let seedlingSize = 1;

  // The tussocks of the mire and the white tufts of the cotton grass (the mire of Foxwood is
  // treeless). They sink into a map with the mire.
  const tussocks: Plant[] = [];
  plant(
    222,
    390,
    294,
    374,
    3.2,
    1,
    tussocks,
    (x: number, y: number) =>
      MIRE.signed(x, y, 3) > 2 &&
      Foxwood.MIRE_POOLS.every(
        ([cx, cy, rx, ry]) => ((x - cx) / (rx + 1.5)) ** 2 + ((y - cy) / (ry + 1.5)) ** 2 > 1,
      ),
  );
  for (const p of tussocks) Object.assign(p, { k: 0.5 + p.k * 0.45, cotton: p.tone > 1 });
  const tussockMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    tussocks.length,
  );
  const cottonMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.2, 0),
    new THREE.MeshLambertMaterial({ color: '#FBF8F0' }),
    tussocks.length,
  );
  tussockMesh.castShadow = tussockMesh.receiveShadow = true;
  {
    const c = new THREE.Color(),
      brown = new THREE.Color('#8E8A4A'),
      green = new THREE.Color('#B8B56E');
    tussocks.forEach((p, i) => tussockMesh.setColorAt(i, c.copy(brown).lerp(green, p.tone - 0.85)));
  }
  scene.add(tussockMesh, cottonMesh);
  function setTussocks(size: number) {
    tussocks.forEach((p, i) => {
      const k = p.removed ? 0.001 : Math.max(p.k * size, 0.001);
      tmp.position.set(p.x - WIDTH / 2, heightAt(p.x, p.y) - 0.1 * p.k, p.y - HEIGHT / 2);
      tmp.quaternion.setFromAxisAngle(UP, p.rotation);
      tmp.scale.set(k, k * 0.55, k * 0.8);
      tmp.updateMatrix();
      tussockMesh.setMatrixAt(i, tmp.matrix);
      // The cotton grass is on top of the tussock, and about every second tussock has it.
      tmp.position.y += 0.5 * p.k * size;
      tmp.scale.setScalar(p.cotton ? k : 0.001);
      tmp.updateMatrix();
      cottonMesh.setMatrixAt(i, tmp.matrix);
    });
    tussockMesh.instanceMatrix.needsUpdate = cottonMesh.instanceMatrix.needsUpdate = true;
    tussockMesh.visible = cottonMesh.visible = size > 0.001;
  }
  let tussockSize = 1;

  // The fox pushes through the thicket: the seedlings near the point (x, y) bend away from the fox.
  const BEND_RADIUS = 4; // m
  function bend(x: number, y: number) {
    let changed = false;
    seedlings.forEach((p, i) => {
      const dx = p.x - x,
        dy = p.y - y;
      const d = Math.hypot(dx, dy);
      const angle = 0.95 * smoothstep(clamp(1 - d / BEND_RADIUS));
      if (Math.abs(angle - (p.tilt ?? 0)) < 0.003) return;
      [p.tilt, p.kx, p.ky] = [angle, dx / (d || 1), dy / (d || 1)];
      setTree(seedlingMesh, p, i, seedlingSize);
      changed = true;
    });
    if (changed) seedlingMesh.instanceMatrix.needsUpdate = true;
  }

  // Buildings, the campfire and the stone. Each stands at the level of its highest corner; the
  // plinth fills the slope.
  const objects: WorldObject[] = [];
  for (const [name, [, x, y, l, k]] of BUILDINGS) {
    const model = buildingModel(name, l, k);
    const corners: Point[] = [
      [x, y],
      [x - l / 2, y - k / 2],
      [x + l / 2, y - k / 2],
      [x - l / 2, y + k / 2],
      [x + l / 2, y + k / 2],
    ];
    objects.push({
      model,
      x,
      y,
      part: 'trail',
      baseLevel: () => Math.max(...corners.map(([a, b]) => heightAt(a, b))),
    });
  }
  const campfire = campfireModel();
  const flame = campfire.children.at(-1)!;
  objects.push({
    model: campfire,
    x: Foxwood.CAMPFIRE[0],
    y: Foxwood.CAMPFIRE[1],
    part: 'trail',
    baseLevel: () => heightAt(...Foxwood.CAMPFIRE),
  });
  objects.push({
    model: stoneModel(),
    x: Foxwood.STONE[0],
    y: Foxwood.STONE[1],
    part: 'lake',
    baseLevel: () => heightAt(...Foxwood.STONE),
  });
  const [tx, ty] = Foxwood.LOOKOUT_TOWER;
  const tower = {
    model: lookoutTowerModel(),
    x: tx,
    y: ty,
    part: 'trail',
    baseLevel: () => Math.max(...TOWER.corners.map(([a, b]) => heightAt(tx + a, ty + b))),
  };
  objects.push(tower);
  // The cliff and the boulders at its foot belong to the hill: they flatten with the hill.
  objects.push({
    model: cliffModel(),
    x: WIDTH / 2,
    y: HEIGHT / 2,
    part: 'hill',
    baseLevel: () => 0,
  });
  Foxwood.BOULDERS.forEach(([x, y, size], i) => {
    const model = stoneModel();
    model.scale.setScalar(size);
    model.rotation.y = i * 2.1;
    objects.push({ model, x, y, part: 'hill', baseLevel: () => heightAt(x, y) });
  });
  const bridge = {
    model: bridgeModel(BRIDGE.length, BRIDGE.width),
    x: BRIDGE.centre[0],
    y: BRIDGE.centre[1],
    part: 'trail',
    baseLevel: () => Math.max(...BRIDGE.edges.map(([a, b]) => heightAt(a, b))),
  };
  bridge.model.rotation.y = -BRIDGE.direction;
  objects.push(bridge);
  // Small features (only in the orienteering map mode): the ant nest and the bottom of the pit.
  if (SMALL) {
    const nest = SMALL.antNest,
      pit = SMALL.pit;
    objects.push({
      model: antNestModel(),
      x: nest[0],
      y: nest[1],
      part: 'smallFeatures',
      baseLevel: () => heightAt(...nest),
    });
    // The bottom of the pit is at ground level outside the pit; the ground sinks into a pit with
    // the small features.
    const edge: Point = [pit[0] + PIT.radius + 1, pit[1]];
    objects.push({
      model: pitModel(),
      x: pit[0],
      y: pit[1],
      part: 'smallFeatures',
      baseLevel: () => heightAt(edge[0], edge[1]),
    });
  }
  // The fences follow the shape of the ground. They belong to the path (structures), so they sink
  // into a map with the buildings.
  function fenceObject(
    model: (points: Point[], ground: (x: number, z: number) => number) => THREE.Group,
    points: Point[],
    centre: Point,
  ): WorldObject {
    const [kx, ky] = centre;
    const baseLevel = initialHeight(kx, ky);
    const m = model(
      points.map(([x, y]): Point => [x - kx, y - ky]),
      (x: number, z: number) => initialHeight(kx + x, ky + z) - baseLevel,
    );
    return { model: m, x: kx, y: ky, part: 'trail', baseLevel: () => heightAt(kx, ky) };
  }
  const A = Foxwood.FENCES;
  const yardCentre = A.yard.reduce<Point>(
    ([sx, sy], [x, y]) => [sx + x / A.yard.length, sy + y / A.yard.length],
    [0, 0],
  );
  objects.push(fenceObject(fenceModel, A.yard, yardCentre));
  objects.push(fenceObject(stoneWallModel, A.stoneFence, A.stoneFence[0]));
  const [[px0, py0], [px1, py1]] = A.gate;
  const gate = {
    model: gateModel(Math.hypot(px1 - px0, py1 - py0)),
    x: px0,
    y: py0,
    part: 'trail',
    baseLevel: () => heightAt(px0, py0),
  };
  gate.model.rotation.y = -Math.atan2(py1 - py0, px1 - px0);
  objects.push(gate);
  // Power line: the poles belong to the path (structures), so they sink into a map with the
  // buildings. The arm of a pole is across the line (direction = the direction between the
  // neighbouring poles on the map).
  const P = SL.poles;
  const poles = P.map(([x, y], i) => {
    const [ax, ay] = P[Math.max(0, i - 1)],
      [bx, by] = P[Math.min(P.length - 1, i + 1)];
    const direction = Math.atan2(by - ay, bx - ax);
    const model = poleModel();
    model.rotation.y = -direction;
    const object = { model, x, y, direction, part: 'trail', baseLevel: () => heightAt(x, y) };
    objects.push(object);
    return object as WorldObject & { direction: number };
  });
  // The position of the end of a wire on the map and the height above the ground: the insulator of
  // a pole (side in metres along the arm) or the wall of a building.
  const poleEnd = (p: WorldObject & { direction: number }, side: number, h: number): Vec3 => [
    p.x - Math.sin(p.direction) * side,
    p.y + Math.cos(p.direction) * side,
    h,
  ];
  const poleAt = ([x, y]: Point) => poles.find((p) => p.x === x && p.y === y)!;
  const wires: Wire[] = [];
  for (let i = 1; i < poles.length; i++) {
    for (const [side, h] of POLE.wires)
      wires.push({ a: poleEnd(poles[i - 1], side, h), b: poleEnd(poles[i], side, h), sag: 0.9 });
  }
  // Branches: one wire from a pole to the wall of a building (to a height of 4.5 m for the house,
  // 3.4 m for the cabin).
  const branches: Record<string, Wire> = {};
  for (const [name, { pole: poleXY, joint: jointXY }] of Object.entries(SL.branches)) {
    const wire: Wire = {
      a: poleEnd(poleAt(poleXY), 0.2, POLE.branch),
      b: [jointXY[0], jointXY[1], name === 'house' ? 4.5 : 3.4],
      sag: 0.6,
    };
    wires.push(wire);
    branches[name] = wire;
  }
  const wireMaterial = new THREE.LineBasicMaterial({ color: '#2A2A2A' });
  const WIRE_POINTS = 14;
  for (const j of wires) {
    const line = (j.line = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(3 * WIRE_POINTS), 3),
      ),
      wireMaterial,
    ));
    line.frustumCulled = false;
    scene.add(line);
  }
  // The point t (0..1) of a wire as map coordinates and a height above the ground (s = the size of
  // the poles, 1 = upright).
  function wirePoint(j: Wire, t: number, s = 1): Vec3 {
    const [ax, ay, ah] = j.a,
      [bx, by, bh] = j.b;
    const [x, y] = [ax + (bx - ax) * t, ay + (by - ay) * t];
    const ground = heightAt(ax, ay) + (heightAt(bx, by) - heightAt(ax, ay)) * t - heightAt(x, y);
    return [x, y, ground + s * (ah + (bh - ah) * t - 4 * j.sag * t * (1 - t))];
  }
  function setWires(s: number) {
    for (const j of wires) {
      const p = j.line!.geometry.attributes.position;
      for (let i = 0; i < WIRE_POINTS; i++) {
        const [x, y, h] = wirePoint(j, i / (WIRE_POINTS - 1), s);
        p.setXYZ(i, x - WIDTH / 2, heightAt(x, y) + h, y - HEIGHT / 2);
      }
      p.needsUpdate = true;
      j.line!.visible = s > 0.001;
    }
  }
  for (const object of objects) scene.add(object.model);
  function setObjects(sizes: Record<string, number>) {
    for (const k of objects) {
      const s = Math.max(sizes[k.part], 0.001);
      k.model.position.set(k.x - WIDTH / 2, k.baseLevel(), k.y - HEIGHT / 2);
      k.model.scale.y = s * (k.model.userData.scale ?? k.model.scale.x);
      k.model.visible = s > 0.001;
    }
    // The fox and the car move on the deck of the bridge until the bridge sinks into a map.
    deck = bridge.model.visible ? bridge.baseLevel() : null;
    setWires(Math.max(sizes.trail, 0.001));
  }
  for (const k of objects) k.model.userData.scale = k.model.scale.x;

  // Highlight: an orange strip along the edge of the feature, drawn on top of everything.
  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: '#E8742A',
    transparent: true,
    opacity: 0,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  let highlightMesh: THREE.Mesh | null = null;
  let highlightId: string | null = null;
  function buildHighlight() {
    if (highlightMesh) {
      scene.remove(highlightMesh);
      highlightMesh.geometry.dispose();
      highlightMesh = null;
    }
    if (!highlightId) return;
    const shape = (M as Record<string, string | string[]>)[highlightId];
    const d = Array.isArray(shape) ? shape[0] : shape;
    highlightMesh = new THREE.Mesh(strip(samples(d), 5, 1), highlightMaterial);
    highlightMesh.renderOrder = 10;
    scene.add(highlightMesh);
  }
  function highlight(id: string | null) {
    highlightId = id;
    buildHighlight();
  }

  // The small features are visible in the orienteering map mode (orienteeringValue) and sink into a
  // map with the forest.
  let orienteeringValue = 0,
    forestSize = 1;
  const sizes = { trail: 1, lake: 1, hill: 1, smallFeatures: 0 };
  function setSmall() {
    const k = orienteeringValue * forestSize;
    if (1 - k !== flattening.smallFeatures) {
      flattening.smallFeatures = 1 - k;
      computeCurrent();
      updateGround();
      buildHighlight();
    }
    sizes.smallFeatures = k;
    setObjects(sizes);
  }

  // The state of the parts: 0 = terrain, 1 = map.
  let old: Record<string, number> | null = null;
  function setParts(shares: number[]) {
    const o = Object.fromEntries(PARTS.map((id, i) => [id, shares[i]]));
    const previous = old;
    if (previous && PARTS.every((id) => previous[id] === o[id])) return;
    old = o;
    const start = (x: number) => smoothstep(clamp(x * 2));
    const end = (x: number) => smoothstep(clamp(x * 2 - 1));
    // In the forest and on the path the objects first sink into the ground and then the ground
    // turns into a map. On the hill the contours are first drawn on the slope and then the hill
    // flattens. In the lake the water disappears first.
    Object.assign(textureShare, [
      end(o.forest),
      o.field,
      o.mire,
      start(o.hill),
      start(o.lake),
      end(o.trail),
    ]);
    waterMaterial.opacity = 0.88 * (1 - start(o.lake));
    waterSurface.visible = waterMaterial.opacity > 0.01;
    outerMaterial.color.copy(FOREST_FLOOR).lerp(PAPER, end(o.forest));
    const next2 = { hill: end(o.hill), lake: end(o.lake) };
    if (next2.hill !== flattening.hill || next2.lake !== flattening.lake) {
      Object.assign(flattening, next2);
      computeCurrent();
      updateGround();
      buildHighlight();
    }
    for (const material of extensionMaterials) material.opacity = 1 - end(o.forest);
    const treeSize = 1 - start(o.forest);
    setTrees(puuMesh, trees, treeSize);
    setTrees(outerMesh, outerTrees, treeSize);
    seedlingSize = treeSize;
    setTrees(seedlingMesh, seedlings, treeSize);
    tussockSize = 1 - start(o.mire);
    setTussocks(tussockSize);
    Object.assign(sizes, {
      trail: 1 - start(o.trail),
      lake: 1 - start(o.lake),
      hill: 1 - end(o.hill),
    });
    forestSize = treeSize;
    setSmall();
  }
  setParts(PARTS.map(() => 0));

  // A narrow clearing in the forest at the route of the scene: trees that are less than `width`
  // metres from the points of the route ([[x, y], ...]) are left out. The clearing is made once
  // before the scene, so the trees do not disappear during the journey, and the fox and the camera
  // following it from behind can see along the route. Of the seedlings of the thicket only those
  // whose trunk would hit the fox (0.9 m) give way, so no path appears in the thicket: the
  // seedlings bend when the fox pushes past (bend), and rise upright behind it.
  function clearing(points: Point[], width: number) {
    for (const p of trees)
      p.removed = points.some(([x, y]) => Math.hypot(p.x - x, p.y - y) < width);
    for (const p of seedlings)
      p.removed = points.some(([x, y]) => Math.hypot(p.x - x, p.y - y) < 0.9);
    setTrees(puuMesh, trees, 1);
    setTrees(seedlingMesh, seedlings, 1);
    // The tussocks of the mire give way to the fox.
    for (const p of tussocks)
      p.removed = points.some(([x, y]) => Math.hypot(p.x - x, p.y - y) < 2.5);
    setTussocks(tussockSize);
  }

  // The nearest tree of the map from the point (x, y) for which condition(tree) holds: { x, y,
  // height } (height in metres).
  function nearestTree(x: number, y: number, condition: (p: Plant) => boolean = () => true) {
    let best: Plant | null = null,
      smallest = Infinity;
    for (const p of trees) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < smallest && !p.removed && condition(p)) [best, smallest] = [p, d];
    }
    return best && { x: best.x, y: best.y, height: best.k };
  }

  // A car in the world. Returns a group whose place(x, y, direction) takes it to a map point on the
  // surface of the road; direction is the walking direction in map coordinates (in radians, 0 =
  // east).
  function createCar(color = '#D9463A') {
    const car = carModel(color);
    car.visible = false;
    scene.add(car);
    return Object.assign(car, {
      place: (x: number, y: number, direction: number) => {
        car.position.set(x - WIDTH / 2, surface(x, y), y - HEIGHT / 2);
        car.rotation.y = -direction;
        car.visible = true;
      },
    });
  }

  return {
    scene,
    setParts,
    nearestTree,
    clearing,
    density,
    bend,
    createCar,
    // The contours of the hill onto the slope (0..1) without turning the terrain into a map.
    contours(n: number) {
      contourShare.value = n;
    },
    // The style of the map (0 = the MML topographic map, 1 = the orienteering map). Requires
    // create({ orienteering: true }).
    setMapStyle(n: number) {
      orienteeringShare.value = n;
      orienteeringValue = SMALL && orienteeringImage ? n : 0;
      setSmall();
    },
    // The size of the flame of the campfire (0 = out, 1 = burning).
    flame(n: number) {
      flame.scale.setScalar(Math.max(n, 0.001));
      flame.visible = n > 0.001;
    },
    heightAt,
    surface,
    toWorld,
    // The height of the foot of the lookout tower (m): the platform is TOWER.height above this.
    towerBase: () => tower.baseLevel(),
    highlight,
    highlightMaterial,
    checks: check(trees.length + seedlings.length),
    // Power line: the positions of the poles on the map and the point t of the wire of a branch (0
    // = pole, 1 = wall): [x, y, height above the ground].
    power: {
      poles: P,
      branch: (name: string, t: number) => wirePoint(branches[name], t, sizes.trail),
      wire: (i: number, t: number, side = 1) => wirePoint(wires[i * 3 + side], t, sizes.trail),
    },
    // The gate of the yard: gate.open(p), p = 0 closed, 1 open.
    gate: gate.model,
    fog: scene.fog,
  };
}

// The models are also used on the 3D stage of the lesson panels (lesson-panel.ts).
const models = {
  SPRUCE,
  material,
  box,
  beam,
  building: buildingModel,
  car: carModel,
  stone: stoneModel,
  bridge: bridgeModel,
  lookoutTower: lookoutTowerModel,
  antNest: antNestModel,
  pit: pitModel,
  stoneWall: stoneWallModel,
  fence: fenceModel,
  gate: gateModel,
  pole: poleModel,
};

export type World = Awaited<ReturnType<typeof create>>;
export const World = {
  create,
  WIDTH,
  HEIGHT,
  PARTS,
  models,
  POLE,
  BRIDGE,
  TOWER,
  NEST,
  nestSurface,
  KNOLL,
  PIT,
};
