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
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage } from '../lesson-panel';
import type { Point } from '../types';

// The end of the path is on the shore of the lake; the splash and the fish are east of it in the
// lake (map coordinates).
const SHORE: Point = [403, 236];
// Lesson panel (orienteering map): the colours, the water area of the icons and the line the fox
// walks from left to right.
const V = Orienteering.COLORS;
const AREA = 'M14,24 C14,10 40,6 56,9 C76,12 90,16 88,28 C86,40 64,44 44,42 C24,40 14,36 14,24 Z';
const FOX_Z = 3;

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

  // Orienteering map: the black shoreline of the lake tells that you cannot cross the water (ISOM
  // 301). The edge of shallow water is blue, so you can wade through it (302). A water pit is a
  // blue V (303).
  orienteering: {
    lesson: {
      title: t('scenes.lake.orienteeringLesson.title'),
      instruction: t('scenes.lake.orienteeringLesson.instruction'),
      stage: { camera: [3, 5.5, 16], gaze: [4, 0.5, -2], fox: 1.5, foxPosition: [-3, FOX_Z] },
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

// ---------- Lesson panel (orienteering map): waters on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
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

export { scene as lake };
