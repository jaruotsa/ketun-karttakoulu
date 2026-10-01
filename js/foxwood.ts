// Foxwood (Foxwood): the shared map area where all the lessons take place.
// The same terrain is drawn in two ways: as a map (MML colours) and as an aerial photo from above.
// The landscape of every lesson must show the same things as this map.
import * as MapType from './map-type';
import type { Point } from './types';
import { Symbols, type BuildingKind, type StoneLevel } from './symbols';
import { t } from './i18n';

const MAP_WIDTH = 600; // map width
const shapes = {
  field: 'M20,30 L170,22 L182,120 L30,135 Z',
  hill: [
    'M200,190 C190,150 230,120 280,125 C330,130 350,165 335,195 C318,225 225,230 200,190 Z',
    'M225,185 C220,160 245,145 278,148 C310,152 322,170 312,188 C300,206 240,208 225,185 Z',
    'M250,178 C250,165 265,160 280,162 C296,164 300,174 292,182 C282,192 256,190 250,178 Z',
  ],
  lake: 'M420,90 C480,60 570,80 580,150 C590,230 560,320 480,330 C420,335 395,280 400,236 C402,190 380,130 420,90 Z',
  mire: 'M236,304 C262,296 330,298 368,306 C388,318 384,352 356,362 C318,372 264,370 242,358 C224,346 222,316 236,304 Z',
  trail: 'M30,345 C110,335 140,290 210,292 C280,294 320,248 398,236',
  // The brook comes from the forest in the north, goes around the hill and runs into the lake.
  stream: 'M262,0 C280,30 320,40 336,70 C350,95 380,96 412,112',
  // Campfire site on the lakeshore at the end of the path. The shape is for highlighting.
  campfire: 'M368,262 a14,14 0 1,0 28,0 a14,14 0 1,0 -28,0',
  // Track (gravel road) starts at the beginning of the path, goes around the edge of the field and
  // rises to the road.
  track:
    'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 194,40 196,9',
  // Access road: the track comes from the south edge of the map to the start of the path, where the
  // path and the track part.
  accessRoad: 'M30,345 C27,358 24,370 22,380',
  // A small road runs along the top edge of the map and crosses the brook.
  carRoad: 'M0,10 C120,6 240,12 330,10 C420,8 520,14 600,12',
  // Bridge: a piece of the road at the brook (the road crosses the brook at 270, 10.4).
  bridge: 'M259,10.3 L281,10.41',
  // Thicket: young, dense spruce forest between the path and the track. The outer shape is
  // slow-running forest and the inner one is hard to run through (the greens of the orienteering
  // map). On the MML map it is ordinary conifer forest.
  thicket: [
    'M82,232 C78,210 96,198 116,200 C136,202 146,214 144,230 C142,248 124,256 106,254 C90,252 84,244 82,232 Z',
    'M99,228 C98,218 106,214 115,214 C125,214 131,220 130,228 C129,236 121,239 113,238 C105,237 100,234 99,228 Z',
  ],
  // Forest is everywhere there is nothing else: the highlight goes around the whole map.
  forest: 'M4,4 H596 V376 H4 Z',
  // Farmyard at the junction of the track and the road. The shape is for highlighting.
  building: 'M200,45 a32,32 0 1,0 64,0 a32,32 0 1,0 -64,0',
  // Lookout tower on the east side of the clearing at the top of the hill. The shape is for
  // highlighting.
  lookoutTower: 'M274,168 a14,14 0 1,0 28,0 a14,14 0 1,0 -28,0',
  // Fence of the farmyard. The shape is for highlighting.
  fences: 'M207,21 H257 V71 H207 Z',
  // Power line along the road (for highlighting; the exact line is in POWER_LINE).
  powerLine: 'M0,18 L122,16 L212,19 L300,20 L500,21 L600,22',
  // Stones in Fox Lake near the south shore. The shape is for highlighting.
  stones: 'M494,309 a19,19 0 1,0 38,0 a19,19 0 1,0 -38,0',
};
// The roads and the brook that reach the edge of the map continue outside the map in the 3D world
// (the map is cropped, the terrain is not). The extensions are not shown on the map.
const EXTENSIONS = {
  carRoad: [
    'M0,10 C-150,14 -350,-6 -600,4 C-850,14 -1000,0 -1200,8',
    'M600,12 C750,10 950,26 1200,18 C1450,10 1600,14 1800,12',
  ],
  track: ['M22,380 C18,460 40,560 12,700 C-10,820 22,1000 4,1550'],
  stream: [
    'M262,0 C250,-60 290,-140 262,-260 C240,-360 282,-520 266,-700 C254,-850 280,-1000 270,-1200',
  ],
};
const CAMPFIRE: Point = [382, 262];
// Bridge where the road crosses the brook: the ends [x, y] on the map and the width in metres (same
// as the road in the aerial photo).
const BRIDGE: { start: Point; end: Point; width: number } = {
  start: [259, 10.3],
  end: [281, 10.41],
  width: 10,
};
// Stones in water (MML: "stones" in the water section): the big stone that the fox jumps on stands
// above the water a few metres from the south shore of Fox Lake. Next to it one stone reaches the
// water surface and one is under it. The terrain map has no sign for a single stone on land.
const STONE: Point = [513, 315];
const WATER_STONES: { at: Point; level: StoneLevel }[] = [
  { at: STONE, level: 'above' },
  { at: [500, 310], level: 'surface' },
  { at: [526, 304], level: 'under' },
];
// Cliff on the east slope of the hill below the lookout tower: the rock wall faces the lake. The
// points go from south to north, so the spikes on the map (the lower slope) point east. Below the
// north end of the wall there is a boulder field [x, y, size].
const CLIFF: Point[] = [
  [321, 193],
  [326, 182],
  [327, 170],
  [324, 158],
];
// The boulders have fallen from the north end of the wall. On the terrain map they are a boulder
// field (sparse black triangles), on the orienteering map each boulder is a dot. They stay off the
// fox's route along the foot of the wall.
const BOULDERS: [number, number, number][] = [
  [333, 158, 1],
  [338, 152, 0.7],
  [337, 164, 0.6],
  [343, 158, 0.8],
  [331, 150, 0.5],
];
// Lookout tower at the top of the hill: from the tower you can see over the forest to the lake.
const LOOKOUT_TOWER: Point = [288, 170];
// Pools of the mire in the aerial photo [cx, cy, rx, ry]. The tussocks of the 3D mire do not grow
// in them.
const MIRE_POOLS: [number, number, number, number][] = [
  [280, 330, 14, 7],
  [330, 345, 10, 5],
  [350, 318, 8, 4],
  [258, 352, 9, 4],
];
// Buildings [kind, x, y, width, height]: the farmyard (house and barn) next to the field,
// the summer cabin and the sauna on the north shore of the lake.
const BUILDINGS: Record<string, [BuildingKind, number, number, number, number]> = {
  house: ['residential', 232, 32, 18, 11],
  barn: ['other', 228, 58, 10, 15],
  cabin: ['holiday', 496, 52, 11, 8],
  sauna: ['other', 524, 69, 6, 6],
};
// Fences (MML: "fence, gate"). In the topographic database a stone wall is also a fence (at least
// 1.2 m high, fences 2 m; at least 100 m long, closed 70 m), so on the MML map both are the same
// fence sign. The farmyard fence goes along the edge of the yard lawn, and the gate is on the west
// side at the track. The old stone wall runs between the south edge of the field and the track. The
// fence is a square so that it looks tidy on the map. The gate is in the middle of the west side.
const YARD_FENCE: { center: Point; half: number } = { center: [232, 46], half: 22 };
const GATE_WIDTH = 7;
const [PX, PY] = YARD_FENCE.center,
  P = YARD_FENCE.half,
  PL = GATE_WIDTH / 2;
const FENCES: { yard: Point[]; gate: [Point, Point]; stoneFence: Point[] } = {
  // From the north post of the gate clockwise around the yard to the south post.
  yard: [
    [PX - P, PY - PL],
    [PX - P, PY - P],
    [PX + P, PY - P],
    [PX + P, PY + P],
    [PX - P, PY + P],
    [PX - P, PY + PL],
  ],
  // Gate: the posts [north, south].
  gate: [
    [PX - P, PY - PL],
    [PX - P, PY + PL],
  ],
  stoneFence: [
    [36, 141],
    [166, 128],
  ],
};

// The power line runs south of the road, about 9 m from it, and branches go from it to the house of
// the farmyard and to the summer cabin. The poles [x, y] are about 40 m apart and do not hit the
// track or the brook. The line continues outside the map in the 3D world (the first and the last
// pole are outside the map). A branch goes from a pole to the wall of a building (joint [x, y]).
const POWER_LINE: { poles: Point[]; branches: Record<string, { pole: Point; joint: Point }> } = {
  poles: [
    [-230, 21],
    [-190, 20],
    [-150, 19],
    [-110, 18],
    [-70, 18],
    [-30, 18],
    [8, 18],
    [46, 17],
    [84, 16],
    [122, 16],
    [167, 17],
    [212, 19],
    [250, 20],
    [300, 20],
    [340, 20],
    [380, 20],
    [420, 20],
    [460, 21],
    [500, 21],
    [540, 22],
    [580, 22],
    [620, 22],
    [660, 22],
    [700, 23],
    [740, 24],
    [780, 25],
    [820, 26],
  ],
  branches: {
    house: { pole: [212, 19], joint: [225, 26.5] },
    cabin: { pole: [500, 21], joint: [497, 48] },
  },
};
// The part shown on the map: the main line from edge to edge and the branches.
const powerLineSegments = (() => {
  const p = POWER_LINE.poles;
  const i = p.findIndex(([x]) => x > 0),
    j = p.findLastIndex(([x]) => x < MAP_WIDTH);
  const edgeAt = (a: Point, b: Point, x: number): Point => [
    x,
    +(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])).toFixed(1),
  ];
  const main = [edgeAt(p[i - 1], p[i], 0), ...p.slice(i, j + 1), edgeAt(p[j], p[j + 1], MAP_WIDTH)];
  return {
    main,
    branches: Object.values(POWER_LINE.branches).map(
      ({ pole, joint }) => [pole, joint] as [Point, Point],
    ),
  };
})();

// The forest of Foxwood is conifer forest (spruces grow in the landscapes), so the white forest is
// sprinkled with conifer forest signs. The positions avoid features and name tags. The yard lawns
// in the aerial photo [x, y, rx, ry, colour, radius]: the farmyard and the yard of the cabin. The
// lawn of the farmyard is a square with rounded corners (radius = the corner radius) like its
// fence; without a radius the yard is an ellipse.
const YARDS: [number, number, number, number, string, number?][] = [
  [232, 46, 25, 25, '#7FA35A', 6],
  [505, 58, 22, 14, '#6E9A4E'],
];
// The shape of a yard as SVG; attributes = the other attributes (e.g. fill).
const yardShape = ([x, y, rx, ry, , radius]: (typeof YARDS)[number], attributes: string) =>
  radius
    ? `<rect x="${x - rx}" y="${y - ry}" width="${2 * rx}" height="${2 * ry}" rx="${radius}" ${attributes}/>`
    : `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${attributes}/>`;
// Is the point in the yard or at most `margin` away from its edge.
function isInYard(x: number, y: number, margin = 0) {
  return YARDS.some(([px, py, rx, ry, , radius]) => {
    if (!radius) return ((x - px) / (rx + margin)) ** 2 + ((y - py) / (ry + margin)) ** 2 < 1;
    const dx = Math.max(Math.abs(x - px) - (rx - radius), 0),
      dy = Math.max(Math.abs(y - py) - (ry - radius), 0);
    return Math.hypot(dx, dy) < radius + margin;
  });
}
const CONIFER_MARKS: Point[] = [
  [262, 70],
  [240, 100],
  [20, 235],
  [25, 292],
  [190, 265],
  [110, 300],
  [195, 355],
  [575, 355],
  [560, 36],
];

// The blue horizontal lines of the mire (open mire that is hard to cross).
const mireLines = Array.from({ length: 14 }, (_, i) => 300 + i * 5)
  .map((y) => `<line x1="215" x2="395" y1="${y}" y2="${y}"/>`)
  .join('');

const parts = {
  forest: `<g class="feature-forest">${CONIFER_MARKS.map(([x, y]) => Symbols.tree('conifer', x, y)).join('')}</g>`,
  grid: `<g stroke="#E6E9EA" stroke-width="1">
    <line x1="150" y1="0" x2="150" y2="380"/><line x1="300" y1="0" x2="300" y2="380"/><line x1="450" y1="0" x2="450" y2="380"/>
    <line x1="0" y1="127" x2="600" y2="127"/><line x1="0" y1="254" x2="600" y2="254"/>
  </g>`,
  field: `<path class="feature-field" d="${shapes.field}" fill="#FCD592"/>`,
  mire: `<g class="feature-mire">
    <clipPath id="mire-clip"><path d="${shapes.mire}"/></clipPath>
    <path d="${shapes.mire}" fill="${Symbols.MIRE.treeless}"/>
    <g clip-path="url(#mire-clip)" stroke="${Symbols.MIRE.lines}" stroke-width="1.6">${mireLines}</g>
  </g>`,
  hill: `<g class="feature-hill" fill="none" stroke="#B8652A" stroke-width="1.6">${shapes.hill.map((d) => `<path d="${d}"/>`).join('')}</g>`,
  lake: `<g class="feature-lake">
    <path d="${shapes.lake}" fill="#71C8E6" stroke="#0067A5" stroke-width="3"/>
    <text x="490" y="205" text-anchor="middle" fill="#0067A5" font-style="italic" font-size="22" letter-spacing="2">${t('foxwood.lakeName')}</text>
  </g>`,
  trail: `<path d="${shapes.trail}" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-dasharray="9 6"/>`,
  // MML: a track is a black line, a small (class III) road a thin red line with black edges.
  track: `<g class="feature-track" fill="none" stroke="#1a1a1a" stroke-width="1.8"><path d="${shapes.track}"/><path d="${shapes.accessRoad}"/></g>`,
  // At the bridge the red fill of the road is almost black (MML: "road, bridge"; the colour is
  // picked from the legend).
  carRoad: `<g class="feature-carRoad" fill="none"><path d="${shapes.carRoad}" stroke="#1a1a1a" stroke-width="5.5"/><path d="${shapes.carRoad}" stroke="#B0412E" stroke-width="3.2"/>
    <g class="feature-bridge"><path d="${shapes.bridge}" stroke="#1a1a1a" stroke-width="5.5"/><path d="${shapes.bridge}" stroke="#3D0F06" stroke-width="3.2"/></g></g>`,
  stream: `<path class="feature-stream" d="${shapes.stream}" fill="none" stroke="#0074B0" stroke-width="2.4" stroke-linecap="round"/>`,
  campfire: `<g class="feature-campfire">${Symbols.fire(CAMPFIRE[0], CAMPFIRE[1], 1.3)}</g>`,
  building: `<g class="feature-building">${Object.values(BUILDINGS)
    .map((r) => Symbols.building(...r))
    .join('')}</g>`,
  stones: `<g class="feature-stones">${WATER_STONES.map(({ at: [x, y], level }) => Symbols.stone(x, y, 1, level)).join('')}</g>`,
  // The cliff and the boulder field at its foot on the east slope of the hill.
  cliff: `<g class="feature-cliff">${Symbols.cliffLine(CLIFF, 1)}${BOULDERS.map(([x, y], i) => Symbols.triangle(x, y, 4.5, i * 47)).join('')}</g>`,
  lookoutTower: `<g class="feature-lookoutTower">${Symbols.lookoutTower(LOOKOUT_TOWER[0], LOOKOUT_TOWER[1], 1.4)}</g>`,
  // Fences: the yard fence is a closed line with two cross lines at the gate. A stone wall is the
  // same fence sign. Power line: the main line along the road and branches to the house and the
  // cabin. The dots of the poles only inside the map.
  powerLine: `<g class="feature-powerLine">${Symbols.powerLine(
    powerLineSegments.main,
    POWER_LINE.poles.filter(([x]) => x > 0 && x < MAP_WIDTH),
    1.2,
    4,
    5,
  )}
    ${powerLineSegments.branches.map((h) => Symbols.powerLine(h, [], 1.2, 0)).join('')}</g>`,
  fences: `<g class="feature-fences">
    <g class="fence-yard">${Symbols.fence([...FENCES.yard, FENCES.gate[0]], 1.3)}${Symbols.gate(...FENCES.gate, 1.3)}</g>
    <g class="fence-stones">${Symbols.fence(FENCES.stoneFence, 1.3)}</g>
  </g>`,
};

function nameTag(text: string, x: number, y: number, color: string) {
  const width = text.length * 14 + 36;
  return `<g class="feature-name" transform="translate(${x} ${y})">
    <rect x="${-width / 2}" y="-20" width="${width}" height="40" rx="20" fill="${color}" stroke="#fff" stroke-width="3"/>
    <text y="7" text-anchor="middle" fill="#fff" font-size="20" font-weight="800" letter-spacing="1">${text}</text>
  </g>`;
}

// The map for a lesson: route = the path the fox walks, name = the name tag of the feature. When
// the orienteering map is the chosen map type (map-type.ts), the base is Foxwood as an orienteering
// map (orienteering.ts). The orienteering base is registered from orienteering.ts (modules cannot
// import each other in a cycle).
let orienteeringBase: (() => string) | undefined;
export function setOrienteeringBase(f: () => string) {
  orienteeringBase = f;
}

function map({
  route,
  name,
  namePosition,
  nameColor = '#0067A5',
}: {
  route: string;
  name: string;
  namePosition: Point;
  nameColor?: string;
}) {
  const base =
    MapType.current() === 'orienteering' && orienteeringBase
      ? orienteeringBase()
      : `<rect width="600" height="380" fill="#FBF8F0"/>
    ${parts.grid}${parts.forest}${parts.field}${parts.mire}${parts.hill}${parts.stream}${parts.lake}${parts.trail}${parts.track}${parts.carRoad}${parts.campfire}${parts.building}${parts.powerLine}${parts.fences}${parts.cliff}${parts.stones}${parts.lookoutTower}`;
  return `
    ${base}
    <path id="route" d="${route}" fill="none" stroke="none"/>
    ${nameTag(name, namePosition[0], namePosition[1], nameColor)}`;
}

// Aerial photo of the same place: tree tops, golden field, dark lake.
const aerial = {
  forest: `<defs>
      <pattern id="canopies" width="26" height="24" patternUnits="userSpaceOnUse">
        <rect width="26" height="24" fill="#3F6B3C"/>
        <circle cx="7" cy="7" r="7" fill="#4F8248"/><circle cx="5.5" cy="5.5" r="3" fill="#6A9C5B"/>
        <circle cx="20" cy="17" r="7.5" fill="#4A7B44"/><circle cx="18" cy="15" r="3.2" fill="#679A58"/>
        <circle cx="20" cy="4" r="4" fill="#3A6236"/><circle cx="6" cy="20" r="4.5" fill="#56894D"/>
      </pattern>
      <pattern id="field-rows" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
        <rect width="10" height="10" fill="#E3C45E"/><rect width="10" height="4" fill="#D4B04A"/>
      </pattern>
      <radialGradient id="hill-light" cx=".42" cy=".38" r=".6">
        <stop offset="0" stop-color="#FFF6C8" stop-opacity=".45"/><stop offset=".6" stop-color="#FFF6C8" stop-opacity="0"/>
        <stop offset="1" stop-color="#0E2410" stop-opacity=".45"/>
      </radialGradient>
      <radialGradient id="depth" cx=".6" cy=".5" r=".6">
        <stop offset="0" stop-color="#1D4E7A"/><stop offset=".85" stop-color="#2F6E9E"/><stop offset="1" stop-color="#6FA7B8"/>
      </radialGradient>
    </defs>
    <rect width="600" height="380" fill="url(#canopies)"/>`,
  field: `<path d="${shapes.field}" fill="url(#field-rows)" stroke="#B89B45" stroke-width="2"/>`,
  mire: `<g>
    <path d="${shapes.mire}" fill="#9C9A5C"/>
    ${MIRE_POOLS.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#46626E"/>`).join('')}
    <g fill="#B8B56E"><circle cx="300" cy="318" r="4"/><circle cx="262" cy="320" r="3.5"/><circle cx="312" cy="356" r="4"/><circle cx="360" cy="342" r="3"/></g>
  </g>`,
  hill: `<path d="${shapes.hill[0]}" fill="url(#hill-light)"/>`,
  lake: `<path d="${shapes.lake}" fill="url(#depth)" stroke="#C8B98A" stroke-width="4"/>
    <g stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round">
      <line x1="470" y1="150" x2="500" y2="150"/><line x1="500" y1="230" x2="540" y2="230"/><line x1="450" y1="280" x2="470" y2="280"/>
    </g>`,
  trail: `<path d="${shapes.trail}" fill="none" stroke="#C9B083" stroke-width="5" stroke-linecap="round"/>`,
  track: `<g fill="none" stroke="#D8C79A" stroke-width="5" stroke-linecap="round"><path d="${shapes.track}"/><path d="${shapes.accessRoad}"/></g>`,
  // The bridge has railings on both sides of the road.
  carRoad: `<path d="${shapes.carRoad}" fill="none" stroke="#C9B98E" stroke-width="10"/><path d="${shapes.carRoad}" fill="none" stroke="#6E6E6C" stroke-width="7"/>
    <g fill="none" stroke="#DAD6CC" stroke-width="1.4"><path d="${shapes.bridge}" transform="translate(0 -4.4)"/><path d="${shapes.bridge}" transform="translate(0 4.4)"/></g>`,
  stream: `<path d="${shapes.stream}" fill="none" stroke="#6E9C78" stroke-width="7" stroke-linecap="round"/>
    <path d="${shapes.stream}" fill="none" stroke="#2F6E9E" stroke-width="3.5" stroke-linecap="round"/>`,
  campfire: `<g transform="translate(${CAMPFIRE[0]} ${CAMPFIRE[1]})">
    <circle r="7" fill="#8E8A80"/><circle r="4.5" fill="#3A302A"/><circle r="2" fill="#E8742A"/>
  </g>`,
  // Gable roofs from above: a light and a shaded side, lawn in the yard.
  building: `${YARDS.map((p) => yardShape(p, `fill="${p[4]}"`)).join('')}
    ${Object.entries(BUILDINGS)
      .map(([nimi, [, x, y, l, k]]) => {
        const [valo, varjo] = (
          {
            house: ['#8A3A30', '#6A2A22'],
            barn: ['#8E8A82', '#6E6A62'],
            cabin: ['#5C5048', '#433A34'],
            sauna: ['#6E6A62', '#55514A'],
          } as Record<string, string[]>
        )[nimi];
        // The ridge of the roof runs along the long side of the building.
        const [x0, y0, L, K] = [x - l / 2 - 1, y - k / 2 - 1, l + 2, k + 2];
        return l >= k
          ? `<rect x="${x0}" y="${y0}" width="${L}" height="${K / 2}" fill="${valo}"/><rect x="${x0}" y="${y}" width="${L}" height="${K / 2}" fill="${varjo}"/>`
          : `<rect x="${x0}" y="${y0}" width="${L / 2}" height="${K}" fill="${valo}"/><rect x="${x}" y="${y0}" width="${L / 2}" height="${K}" fill="${varjo}"/>`;
      })
      .join('')}`,
  // Stones in the lake from above: the stone above the water is a grey lump whose light side is in
  // the north-west, the stone at the surface a small lump with a ring of ripples, and the stone
  // under the water only a dim shadow.
  stones: `<g transform="translate(${STONE[0]} ${STONE[1]})">
    <ellipse rx="9" ry="8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>
    <ellipse rx="7.5" ry="6.5" fill="#7E7B74"/><ellipse cx="-1.8" cy="-1.6" rx="5" ry="4" fill="#ABA79D"/>
  </g>
  ${WATER_STONES.filter(({ level }) => level !== 'above')
    .map(({ at: [x, y], level }) =>
      level === 'surface'
        ? `<ellipse cx="${x}" cy="${y}" rx="5" ry="4.5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="3" ry="2.6" fill="#8E8A80"/>`
        : `<ellipse cx="${x}" cy="${y}" rx="4" ry="3.5" fill="#4F6E72" opacity=".6"/>`,
    )
    .join('')}`,
};

export const Foxwood = {
  shapes,
  parts,
  aerial,
  map,
  CAMPFIRE,
  BUILDINGS,
  STONE,
  WATER_STONES,
  CLIFF,
  BOULDERS,
  LOOKOUT_TOWER,
  YARDS,
  yardShape,
  isInYard,
  EXTENSIONS,
  BRIDGE,
  FENCES,
  MIRE_POOLS,
  POWER_LINE,
  powerLineSegments,
};
