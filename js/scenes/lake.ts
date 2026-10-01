// Lake scene: the fox walks along the path to the shore of the lake, dips a paw in the water and
// sees a fish.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The fox walks along the path of the
// map, and the camera follows it from the south. At the end the camera turns slightly south-west,
// so that Fox Lake and its opposite shore (the summer cabin and the sauna) are visible in front of
// the fox. The campfire site is at the end of the path on the south side.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { formatNumber, t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage, StageSettings } from '../lesson-panel';
import type { Point } from '../types';

// The end of the path is on the shore of the lake; the splash and the fish are east of it in the
// lake (map coordinates).
const SHORE: Point = [403, 236];
// Lesson panels: the colours on the topo map (MML legend) and on the orienteering map, the water
// area of the icons, the height of the lake surface (m above the sea), the line the fox walks from
// left to right and the stage.
const MML = {
  water: '#71C8E6',
  shore: '#0067A5',
  reliction: '#ABDCEC',
  point: '#007FBA',
  black: '#1A1919',
};
const V = Orienteering.COLORS;
const AREA = 'M14,24 C14,10 40,6 56,9 C76,12 90,16 88,28 C86,40 64,44 44,42 C24,40 14,36 14,24 Z';
const LAKE_HEIGHT = 42;
const FOX_Z = 3;
const STAGE: StageSettings = {
  camera: [3, 5.5, 16],
  gaze: [4, 0.5, -2],
  fox: 1.5,
  foxPosition: [-3, FOX_Z],
};

const scene: Scene = {
  map: Foxwood.map({
    route: Foxwood.shapes.trail,
    name: t('scenes.lake.mapLabel'),
    namePosition: [490, 150],
  }),
  feature: 'lake',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: { behind: 46, height: 19, ahead: 16, direction: [0, -28], fox: 5 },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      fox.poses.add('pawUp');
      terrain.splash(...SHORE);
      await wait(700);
      fox.poses.remove('pawUp');
      await wait(200);
      fox.poses.add('curious');
      await jumpingFish(terrain);
      fox.poses.remove('curious');
    },

    reset(_terrainSvg, terrain) {
      fish ??= Creatures.fish();
      fish.removeFromParent();
      terrain.draw();
    },
  },

  // Topo map (MML legend): a lake is a blue area with a dark blue shoreline and the height of its
  // surface. A reed bed is black tufts on light blue, a dock a black line into the water, a spring
  // a blue dot in a black U and a well a blue circle with a line through it.
  lesson: {
    title: t('scenes.lake.lesson.title'),
    instruction: t('scenes.lake.lesson.instruction'),
    stage: STAGE,
    items: [
      {
        name: t('scenes.lake.lesson.items.lake.name'),
        summary: t('scenes.lake.lesson.items.lake.summary'),
        text: t('scenes.lake.lesson.items.lake.text'),
        icon: icon(
          `<path d="${AREA}" fill="${MML.water}" stroke="${MML.shore}" stroke-width="1.6"/>
          <text x="51" y="31" text-anchor="middle" font-size="16" font-weight="700" fill="${MML.shore}" stroke="#fff" stroke-width="3" paint-order="stroke">${formatNumber(LAKE_HEIGHT)}</text>`,
        ),
        show: lake,
      },
      {
        name: t('scenes.lake.lesson.items.reeds.name'),
        summary: t('scenes.lake.lesson.items.reeds.summary'),
        text: t('scenes.lake.lesson.items.reeds.text'),
        icon: icon(
          `<path d="${AREA}" fill="${MML.reliction}" stroke="${MML.shore}" stroke-width="1.6"/>
          ${reedTuft(36, 30)}${reedTuft(62, 24)}`,
        ),
        show: shallow,
      },
      {
        name: t('scenes.lake.lesson.items.dock.name'),
        summary: t('scenes.lake.lesson.items.dock.summary'),
        text: t('scenes.lake.lesson.items.dock.text'),
        icon: icon(
          `<path d="${AREA}" fill="${MML.water}" stroke="${MML.shore}" stroke-width="1.6"/>
          <path d="M6,26 H34" stroke="${MML.black}" stroke-width="3.5"/>`,
        ),
        show: dock,
      },
      {
        name: t('scenes.lake.lesson.items.spring.name'),
        summary: t('scenes.lake.lesson.items.spring.summary'),
        text: t('scenes.lake.lesson.items.spring.text'),
        icon: icon(
          `<path d="M58,29 C68,33 78,31 92,37" fill="none" stroke="${MML.point}" stroke-width="2.4"/>
          <path d="M42,12 V25 A8,8 0 0 0 58,25 V12" fill="none" stroke="${MML.black}" stroke-width="3"/>
          <circle cx="50" cy="24" r="5.5" fill="${MML.point}"/>`,
        ),
        camera: { position: [2, 4.5, 11], gaze: [5, 0.3, -1.5] },
        show: spring,
      },
      {
        name: t('scenes.lake.lesson.items.well.name'),
        summary: t('scenes.lake.lesson.items.well.summary'),
        text: t('scenes.lake.lesson.items.well.text'),
        icon: icon(
          `<circle cx="50" cy="25" r="11" fill="${MML.point}" stroke="${MML.black}" stroke-width="3"/>
          <path d="M39,25 H61" stroke="${MML.black}" stroke-width="3"/>`,
        ),
        camera: { position: [1, 4.5, 11], gaze: [3.5, 1, -0.5] },
        show: well,
      },
    ],
  },

  // Orienteering map: the black shoreline of the lake tells that you cannot cross the water (ISOM
  // 301). The edge of shallow water is blue, so you can wade through it (302). A water pit is a
  // blue V (303).
  orienteering: {
    lesson: {
      title: t('scenes.lake.orienteeringLesson.title'),
      instruction: t('scenes.lake.orienteeringLesson.instruction'),
      stage: STAGE,
      items: [
        {
          name: t('scenes.lake.orienteeringLesson.items.lake.name'),
          summary: t('scenes.lake.orienteeringLesson.items.lake.summary'),
          text: t('scenes.lake.orienteeringLesson.items.lake.text'),
          icon: icon(`<path d="${AREA}" fill="${V.water}" stroke="${V.black}" stroke-width="2"/>`),
          show: lake,
        },
        {
          name: t('scenes.lake.orienteeringLesson.items.shallowWater.name'),
          summary: t('scenes.lake.orienteeringLesson.items.shallowWater.summary'),
          text: t('scenes.lake.orienteeringLesson.items.shallowWater.text'),
          icon: icon(
            `<path d="${AREA}" fill="${V.shallowWater}" stroke="${V.water}" stroke-width="1.6"/>`,
          ),
          show: shallow,
        },
        {
          name: t('scenes.lake.orienteeringLesson.items.waterPit.name'),
          summary: t('scenes.lake.orienteeringLesson.items.waterPit.summary'),
          text: t('scenes.lake.orienteeringLesson.items.waterPit.text'),
          icon: icon(
            `<path d="M41.6,18.3 L50,31.7 L58.4,18.3" fill="none" stroke="${V.water}" stroke-width="4.8" stroke-linejoin="round"/>`,
          ),
          show: waterPit,
        },
      ],
    },
  },
};

// The fish jumps in an arc out of the lake and dives back. The fish is exaggerated in size (2 m)
// like the fox.
let fish: ReturnType<typeof Creatures.fish> | null = null;
async function jumpingFish(terrain: Terrain) {
  const [x0, y0] = [SHORE[0] + 8, SHORE[1] - 1];
  const [x1, y1] = [SHORE[0] + 22, SHORE[1] - 5];
  const direction = Math.atan2(y1 - y0, x1 - x0);
  terrain.splash(x0, y0);
  await animate(1300, (t) => {
    terrain.place(
      fish!,
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t,
      3.5 * Math.sin(Math.PI * t) - 0.5,
      direction,
    );
    fish!.rotation.z = 0.9 - 1.8 * t; // nose up first, down at the end
    fish!.visible = t > 0.04 && t < 0.96;
  });
  fish!.removeFromParent();
  terrain.splash(x1, y1);
}

// ---------- Lesson panels: waters on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// A reed tuft on the topo map: four short black strokes fanning out from the bottom.
function reedTuft(x: number, y: number) {
  return `<path d="M${x - 5},${y - 3} L${x - 3},${y + 2} M${x - 2},${y - 7} L${x - 1},${y + 2} M${x + 2},${y - 7} L${x + 1},${y + 2} M${x + 5},${y - 3} L${x + 3},${y + 2}" stroke="${MML.black}" stroke-width="1.6" stroke-linecap="round"/>`;
}
const waterMaterial = (color: string) =>
  new THREE.MeshPhongMaterial({
    color: color,
    specular: '#D6ECF6',
    shininess: 70,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

// A water area at `center`: the bank (sand or mud) and the water on top of it. With the same seed
// the shapes are the same. A pond: the centre [x, z] and the radii (m).
interface Pond {
  center: Point;
  rx: number;
  rz: number;
}
function waterBody(
  o: LessonStage,
  { center, rx, rz }: Pond,
  color: string,
  bank: string,
  seed: number,
) {
  const { patch, group } = o.models;
  const surface = patch(rx, rz, color, seed, 0.03);
  surface.material = waterMaterial(color);
  return o.add(group(patch(rx + 0.8, rz + 0.6, bank, seed, 0.012), surface), center);
}

// Reeds at the edge of the water (or inside it). No reeds on the fox's line or on the viewer's
// side, so that the fox is visible.
function reeds(
  o: LessonStage,
  { center: [cx, cz], rx, rz }: { center: number[]; rx: number; rz: number },
  count: number,
  seed: number,
  inside = false,
) {
  const { mesh, seeded } = o.models;
  const r = seeded(seed * 37);
  const reeds = [];
  for (let i = 0; i < count; i++) {
    const a = r() * 2 * Math.PI;
    const k = inside ? 0.3 + r() * 0.6 : 0.92 + r() * 0.15;
    const [x, z] = [cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k];
    if (Math.abs(z - FOX_Z) < 0.8 || (!inside && z > cz + rz * 0.4)) continue;
    const h = 0.6 + r() * 0.6;
    reeds.push(
      o.add(
        mesh(
          new THREE.CylinderGeometry(0.025, 0.04, h, 5).translate(0, h / 2, 0),
          r() < 0.5 ? '#6E8A3E' : '#86A04A',
        ),
        [x, z],
      ),
    );
  }
  return reeds;
}

// The fox turns towards the point (x, z) and walks there. lift(x) raises or sinks it on the way
// (wading).
function turnTo(o: LessonStage, [x, z]: Point) {
  const { position: p } = o.fox.group;
  o.turn((Math.atan2(-(z - p.z), x - p.x) * 180) / Math.PI);
}
async function walkTo(
  o: LessonStage,
  target: Point,
  duration: number,
  lift: (...a: number[]) => number = () => 0,
  everyFrame: (...a: number[]) => void = () => {},
) {
  const { x, z } = o.fox.group.position;
  turnTo(o, target);
  o.fox.poses.set('walking');
  await o.animate(duration, (t) => {
    const [px, pz] = [x + (target[0] - x) * t, z + (target[1] - z) * t];
    o.foxTo(px, pz, lift(px));
    everyFrame(px, pz);
  });
  o.fox.poses.remove('walking');
}
// Final pose: the fox looks at the viewer and rejoices.
function finish(o: LessonStage, target: Point, motion: number) {
  if (!motion) o.foxTo(...target);
  o.turn(-30);
  o.fox.poses.set('facingViewer', 'cheering');
}

// Lake: the fox walks to the shore and tests the water with a paw. It cannot cross, so it goes
// around along the shore.
const LAKE: Pond = { center: [8, -2.5], rx: 9, rz: 5 };
async function lake(o: LessonStage, motion: number) {
  const g = waterBody(o, LAKE, '#3F92C8', '#B8A77A', 2);
  const trees = (
    [
      [1, -9],
      [5, -10],
      [9.5, -9.5],
      [14, -9],
      [17, -6],
    ] as Point[]
  ).map(([x, z], i) => o.add(o.models.spruce(6 + (i % 3) * 1.5), [x, z]));
  await o.grow([g], motion, 800);
  await o.grow([...reeds(o, LAKE, 26, 4), ...trees], motion, 500, 0.03);
  const bank: Point = [0.4, 1.6],
    circled: Point = [8.5, 4.6];
  if (!motion) return finish(o, circled, 0);
  await walkTo(o, bank, 1400);
  o.fox.poses.set('pawUp');
  await o.pause(500);
  o.fox.poses.set('curious');
  await o.pause(800);
  await walkTo(o, circled, 2200);
  finish(o, circled, motion);
}

// Shallow water: the fox wades through a pond. It sinks up to its ankles, and rings form in the
// water.
const SHALLOW: Pond = { center: [4.5, 2.6], rx: 3.4, rz: 2.4 };
async function shallow(o: LessonStage, motion: number) {
  const g = waterBody(o, SHALLOW, '#6FAED0', '#A89A6A', 5);
  await o.grow([g], motion, 800);
  await o.grow(reeds(o, SHALLOW, 30, 6, true), motion, 500, 0.03);
  // The edges of the water on the fox's line and the depth: shallow at the edges, up to the ankles
  // in the middle.
  const half = SHALLOW.rx * Math.sqrt(1 - ((FOX_Z - SHALLOW.center[1]) / SHALLOW.rz) ** 2);
  const [x0, x1] = [SHALLOW.center[0] - half, SHALLOW.center[0] + half];
  const depth = (x: number) => -0.3 * Math.min(1, Math.max(0, Math.min(x - x0, x1 - x) / 1));
  const end: Point = [11, FOX_Z];
  if (!motion) return finish(o, end, 0);
  o.fox.poses.set('curious');
  await o.pause(600);
  // The rings expand and fade.
  const rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  const material = new THREE.MeshBasicMaterial({ color: '#EAF6FC', transparent: true });
  o.everyFrame((time) => {
    for (const r of rings) {
      const age = time - r.userData.start;
      r.scale.setScalar(1 + age * 2.2);
      r.material.opacity = Math.max(0, 0.9 - age * 0.9);
    }
  });
  let previous = 0;
  await walkTo(o, end, 3400, depth, (x, z) => {
    const now = performance.now() / 1000;
    if (depth(x) < -0.05 && now - previous > 0.35) {
      previous = now;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.32, 28).rotateX(-Math.PI / 2),
        material.clone(),
      );
      ring.position.y = 0.05;
      ring.userData.start = now;
      rings.push(o.add(ring, [x, z]));
    }
  });
  o.fox.poses.set('pawUp');
  await o.pause(700);
  finish(o, end, motion);
}

// Water pit: a small pit with water at the bottom and an earth bank around it. The fox peeks over
// the edge.
async function waterPit(o: LessonStage, motion: number) {
  const { patch, group, mesh, castShadows } = o.models;
  const SPOT: Point = [2.6, 0.6];
  const rim = mesh(
    new THREE.TorusGeometry(1.35, 0.25, 6, 28).rotateX(Math.PI / 2),
    '#7A6A48',
    0,
    0.02,
    0,
  );
  rim.scale.y = 0.6;
  const surface = patch(1.1, 0.95, '#2F6E9A', 7, 0.03);
  surface.material = waterMaterial('#2F6E9A');
  const pit = o.add(castShadows(group(patch(1.5, 1.3, '#5E4A32', 7, 0.012), rim, surface)), SPOT);
  await o.grow([pit], motion);
  const edge: Point = [0.4, 1.2];
  if (!motion) {
    o.foxTo(...edge, 0, 24);
    turnTo(o, SPOT);
    o.fox.poses.set('curious');
    return;
  }
  await walkTo(o, edge, 1300);
  turnTo(o, SPOT);
  o.fox.poses.set('curious');
  await o.animate(500, (t) => o.foxTo(...edge, 0, 24 * t));
}

// Dock: a wooden dock from the shore into the lake. The fox walks to its end and looks into the
// water.
const DOCK = { x: 4, from: 3.2, to: -1.8, top: 0.35 };
async function dock(o: LessonStage, motion: number) {
  const { mesh, group, castShadows } = o.models;
  const g = waterBody(o, LAKE, '#3F92C8', '#B8A77A', 2);
  const length = DOCK.from - DOCK.to;
  const d = group(
    mesh(new THREE.BoxGeometry(1.3, 0.1, length), '#A57C52', 0, DOCK.top, 0),
    ...[-0.55, 0.55].flatMap((x) =>
      [-length / 2 + 0.2, 0, length / 2 - 0.2].map((z) =>
        mesh(
          new THREE.CylinderGeometry(0.07, 0.07, DOCK.top + 0.1, 6),
          '#7A5638',
          x,
          DOCK.top / 2,
          z,
        ),
      ),
    ),
  );
  const planks = o.add(castShadows(d), [DOCK.x, (DOCK.from + DOCK.to) / 2]);
  await o.grow([g], motion, 800);
  await o.grow([planks, ...reeds(o, LAKE, 18, 8)], motion, 500, 0.03);
  const start: Point = [DOCK.x, DOCK.from + 0.3],
    end: Point = [DOCK.x, DOCK.to + 0.5];
  if (!motion) {
    o.foxTo(end[0], end[1], DOCK.top);
    return o.fox.poses.set('facingViewer', 'cheering');
  }
  await walkTo(o, start, 1500);
  await walkTo(o, end, 1800, () => DOCK.top);
  o.fox.poses.set('curious');
  await o.animate(400, (t) => o.foxTo(end[0], end[1], DOCK.top, 20 * t));
  await o.pause(700);
  o.foxTo(end[0], end[1], DOCK.top);
  finish(o, end, motion);
}

// Spring: a small clear pool among stones where the water bubbles up. A brook flows out of it. The
// fox comes to drink.
async function spring(o: LessonStage, motion: number) {
  const { rock, strip, group } = o.models;
  const POOL: Pond = { center: [5, 0.4], rx: 1.4, rz: 1.1 };
  const pool = waterBody(o, POOL, '#4FA7D6', '#7A6A48', 9);
  // The brook leaves the pool to the north-east and bends slowly (strip: x(z) along z).
  const course = (z: number) => 0.035 * z * z - 1.3 * z;
  const brook = o.add(
    group(
      strip(course, 1.2, -7.5, 0, '#7A6A48', 0.012),
      strip(course, 0.6, -7.5, 0, null, 0.03, waterMaterial('#4FA7D6')),
    ),
    [POOL.center[0] + 0.6, POOL.center[1] - 0.8],
  );
  const stones = (
    [
      [3.4, -0.4, 0.5],
      [4.2, -0.9, 0.4],
      [6.5, 0.9, 0.45],
      [6.3, -0.3, 0.35],
      [3.6, 1.2, 0.3],
    ] as [number, number, number][]
  ).map(([x, z, k], i) => o.add(rock(k, i + 3), [x, z]));
  await o.grow([pool, brook], motion, 800);
  await o.grow(stones, motion, 500, 0.08);
  // Rings rise from the bottom of the pool.
  const material = new THREE.MeshBasicMaterial({ color: '#EAF6FC', transparent: true });
  const rings = [0, 0.33, 0.66].map((phase) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.17, 24).rotateX(-Math.PI / 2),
      material.clone(),
    );
    ring.position.y = 0.05;
    ring.userData.phase = phase;
    return o.add(ring, POOL.center);
  });
  o.everyFrame((time) => {
    for (const r of rings) {
      const age = (time * 0.6 + r.userData.phase) % 1;
      r.scale.setScalar(1 + age * 4);
      r.material.opacity = 0.9 * (1 - age);
    }
  });
  const edge: Point = [3.3, 1.6];
  const drink = () => {
    turnTo(o, POOL.center);
    o.fox.poses.set('curious');
  };
  if (!motion) {
    o.foxTo(...edge, 0, 26);
    return drink();
  }
  await walkTo(o, edge, 1500);
  drink();
  await o.animate(500, (t) => o.foxTo(...edge, 0, 26 * t));
  await o.pause(900);
  await o.animate(400, (t) => o.foxTo(...edge, 0, 26 * (1 - t)));
  finish(o, edge, motion);
}

// Well: a round stone well with a wooden frame and a bucket. The bucket goes down into the well and
// comes back up full, and the fox peeks over the edge.
async function well(o: LessonStage, motion: number) {
  const { mesh, group, castShadows } = o.models;
  const SPOT: Point = [3.2, 0.4];
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24).rotateX(-Math.PI / 2),
    waterMaterial('#2F6E9A'),
  );
  water.position.y = 0.45;
  // The stone wall is open at the top, so its inside shows too.
  const wall = mesh(
    new THREE.CylinderGeometry(0.8, 0.85, 0.75, 20, 1, true).translate(0, 0.375, 0),
    '#8F8A80',
  );
  (wall.material as THREE.Material).side = THREE.DoubleSide;
  const bucket = group(
    mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 10), '#9AA3A8', 0, -0.14, 0),
    mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, 0.5, 0), '#D8C9A0'),
  );
  bucket.position.y = 1.5;
  const frame = group(
    wall,
    mesh(new THREE.TorusGeometry(0.8, 0.1, 6, 20).rotateX(Math.PI / 2), '#A39E94', 0, 0.75, 0),
    water,
    ...[-0.95, 0.95].map((x) =>
      mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12).translate(0, 1.05, 0), '#7A5638', x, 0, 0),
    ),
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6).rotateZ(Math.PI / 2), '#8A6A48', 0, 2.5, 0),
    mesh(new THREE.BoxGeometry(2.3, 0.08, 1.1), '#6E4E36', 0, 2.75, 0),
    bucket,
  );
  const w = o.add(castShadows(frame), SPOT);
  await o.grow([w], motion);
  const edge: Point = [1.6, 1.4];
  const peek = () => {
    turnTo(o, SPOT);
    o.fox.poses.set('curious');
  };
  if (!motion) {
    o.foxTo(...edge, 0, 22);
    return peek();
  }
  await walkTo(o, edge, 1400);
  peek();
  await o.animate(400, (t) => o.foxTo(...edge, 0, 22 * t));
  // The rope gets longer as the bucket goes down, and shorter when it comes up.
  const rope = bucket.children[1];
  const lower = (k: number) => {
    bucket.position.y = 1.5 - k;
    rope.scale.y = 1 + k;
  };
  await o.animate(1100, lower);
  await o.pause(400);
  await o.animate(1100, (t) => lower(1 - t));
  o.foxTo(...edge);
  finish(o, edge, motion);
}

export { scene as lake };
