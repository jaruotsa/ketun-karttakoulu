// Mire scene: the fox walks along the path past the hill and steps onto the mire. Its paws sink
// into the wet mud, and the fox shakes them.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The route turns off the path onto the
// mire, which is south of the path. At the end the camera turns west, so that the mire is in front
// of the fox and the hill in the background.
import * as THREE from 'three';
import { Symbols } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Point } from '../types';

// A mud pit inside the mire, south-east of the end of the route (map coordinates).
const MUD_PIT: Point = [272, 330];
// Wet mud around the fox (creatures.ts).
let mud: ReturnType<typeof Creatures.mud> | null = null;
// Lesson panel (orienteering map): the colours and the line the fox walks from left to right.
const V = Orienteering.COLORS;
const S = Symbols.MIRE;
const FOX_Z = 3;

const scene: Scene = {
  map: Foxwood.map({
    route: 'M30,345 C110,335 140,290 210,292 C236,293 252,306 264,320',
    name: t('scenes.mire.mapLabel'),
    namePosition: [440, 356],
    nameColor: '#1B8FD6',
  }),
  feature: 'mire',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: { behind: 38, height: 21, ahead: 12, direction: [0, 0], fox: 5 },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      // The fox steps deeper into the mire and sinks. Wet mud spreads around it.
      fox.poses.add('walking');
      await animate(700, (t) => {
        const [x, y] = [x0 + (MUD_PIT[0] - x0) * t, y0 + (MUD_PIT[1] - y0) * t];
        terrain.moveFox(x, y, -1 * t);
        terrain.place(mud!, x, y, 0.05);
        mud!.visibility(t);
      });
      fox.poses.remove('walking');
      terrain.splash(...MUD_PIT, '#6E6232');
      // A surprised look at the camera.
      fox.poses.add('facingViewer');
      await wait(900);
      fox.poses.remove('facingViewer');
      // Shaking a paw.
      for (let i = 0; i < 2; i++) {
        fox.poses.add('pawUp');
        await wait(300);
        fox.poses.remove('pawUp');
        await wait(250);
      }
    },

    reset(_terrainSvg, terrain) {
      // The tussocks of the mire make way for the route and the mud pit.
      const route = Array.from({ length: 101 }, (_, i) => terrain.routePoint(i / 100));
      const [x1, y1] = route.at(-1)!;
      const toPit = Array.from(
        { length: 6 },
        (_, i): Point => [x1 + ((MUD_PIT[0] - x1) * i) / 5, y1 + ((MUD_PIT[1] - y1) * i) / 5],
      );
      terrain.world.clearing([...route, ...toPit], 6);
      mud ??= Creatures.mud();
      terrain.place(mud, ...MUD_PIT, 0.05);
      mud.visibility(0);
    },
  },

  // On the MML map the colour of a mire tells whether trees grow in it (treeless yellow, forested
  // grey), and blue lines tell that the mire is hard to cross. The colours are picked from the MML
  // legend (Symbols.MIRE).
  lesson: {
    title: t('scenes.mire.lesson.title'),
    instruction: t('scenes.mire.lesson.instruction'),
    stage: { camera: [3, 5.5, 16], gaze: [4, 0.5, -2], fox: 1.5, foxPosition: [-3, FOX_Z] },
    items: [
      {
        name: t('scenes.mire.lesson.items.treelessMire.name'),
        summary: t('scenes.mire.lesson.items.treelessMire.summary'),
        text: t('scenes.mire.lesson.items.treelessMire.text'),
        icon: icon(topoMire(S.treeless)),
        show: (o, motion) =>
          walk(o, motion, mire(o, { seed: 3, ground: '#B3AA66', pools: 1 }), { sink: 0.06 }),
      },
      {
        name: t('scenes.mire.lesson.items.forestedMire.name'),
        summary: t('scenes.mire.lesson.items.forestedMire.summary'),
        text: t('scenes.mire.lesson.items.forestedMire.text'),
        icon: icon(topoMire(S.forested)),
        show: (o, motion) =>
          walk(o, motion, mire(o, { seed: 5, ground: '#7FA25A', pools: 2, trees: 'forest' }), {
            sink: 0.06,
          }),
      },
      {
        name: t('scenes.mire.lesson.items.wetOpenMire.name'),
        summary: t('scenes.mire.lesson.items.wetOpenMire.summary'),
        text: t('scenes.mire.lesson.items.wetOpenMire.text'),
        icon: icon(topoMire(S.treeless, true)),
        show: (o, motion) =>
          walk(o, motion, mire(o, { seed: 2, ground: '#A09A5C', pools: 10 }), {
            sink: 0.4,
            duration: 3400,
          }),
      },
      {
        name: t('scenes.mire.lesson.items.wetForestMire.name'),
        summary: t('scenes.mire.lesson.items.wetForestMire.summary'),
        text: t('scenes.mire.lesson.items.wetForestMire.text'),
        icon: icon(topoMire(S.forested, true)),
        show: (o, motion) =>
          walk(o, motion, mire(o, { seed: 4, ground: '#7E7A48', pools: 12, trees: 'pines' }), {
            sink: 0.4,
            duration: 3400,
          }),
      },
    ],
  },

  // On the orienteering map a mire is blue lines. The density of the lines and the colour of the
  // background tell what kind of mire it is (ISOM 307–310).
  orienteering: {
    lesson: {
      title: t('scenes.mire.orienteeringLesson.title'),
      instruction: t('scenes.mire.orienteeringLesson.instruction'),
      stage: { camera: [3, 5.5, 16], gaze: [4, 0.5, -2], fox: 1.5, foxPosition: [-3, FOX_Z] },
      items: [
        {
          name: t('scenes.mire.orienteeringLesson.items.marshyGround.name'),
          summary: t('scenes.mire.orienteeringLesson.items.marshyGround.summary'),
          text: t('scenes.mire.orienteeringLesson.items.marshyGround.text'),
          icon: icon(mireLines(6, 'stroke-dasharray="7 5"')),
          show: (o, motion) =>
            walk(o, motion, mire(o, { seed: 1, ground: '#7FA25A', pools: 3, trees: 'forest' }), {
              sink: 0.08,
            }),
        },
        {
          name: t('scenes.mire.orienteeringLesson.items.mire.name'),
          summary: t('scenes.mire.orienteeringLesson.items.mire.summary'),
          text: t('scenes.mire.orienteeringLesson.items.mire.text'),
          icon: icon(mireLines(5)),
          show: (o, motion) =>
            walk(o, motion, mire(o, { seed: 2, ground: '#8E9A58', pools: 8, trees: 'pines' }), {
              sink: 0.35,
              duration: 3200,
            }),
        },
        {
          name: t('scenes.mire.orienteeringLesson.items.openMire.name'),
          summary: t('scenes.mire.orienteeringLesson.items.openMire.summary'),
          text: t('scenes.mire.orienteeringLesson.items.openMire.text'),
          icon: icon(
            `<rect x="12" y="4" width="76" height="42" fill="${V.openForest}"/>${mireLines(5)}`,
          ),
          show: (o, motion) =>
            walk(o, motion, mire(o, { seed: 3, ground: '#A09A5C', pools: 8 }), {
              sink: 0.35,
              duration: 3200,
            }),
        },
        {
          name: t('scenes.mire.orienteeringLesson.items.impassableMire.name'),
          summary: t('scenes.mire.orienteeringLesson.items.impassableMire.summary'),
          text: t('scenes.mire.orienteeringLesson.items.impassableMire.text'),
          icon: icon(
            `${mireLines(3)}<rect x="12" y="4" width="76" height="42" fill="none" stroke="${V.black}" stroke-width="2"/>`,
          ),
          show: (o, motion) =>
            stopAtEdge(
              o,
              motion,
              mire(o, { seed: 4, ground: '#6E6232', pools: 26, trees: 'pines', center: [11, -2] }),
            ),
        },
      ],
    },
  },
};

// ---------- Lesson panel (orienteering map): mire types on the 3D stage (lesson-panel.ts)
// ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// A mire of the MML map: the colour, and blue lines for a mire that is hard to cross.
function topoMire(color: string, withLines = false) {
  const rows = withLines
    ? Array.from(
        { length: 8 },
        (_, i) => `<line x1="12" x2="88" y1="${7 + i * 5.2}" y2="${7 + i * 5.2}"/>`,
      ).join('')
    : '';
  return `<rect x="12" y="4" width="76" height="42" fill="${color}"/><g stroke="${S.lines}" stroke-width="1.8">${rows}</g>`;
}
// Blue mire lines: the spacing (in units) and extra attributes of the line (dashed).
function mireLines(spacing: number, extra = '') {
  const rows = Array.from(
    { length: Math.floor(40 / spacing) + 1 },
    (_, i) => `<line x1="12" x2="88" y1="${5 + i * spacing}" y2="${5 + i * spacing}" ${extra}/>`,
  );
  return `<g stroke="${V.water}" stroke-width="2">${rows.join('')}</g>`;
}

// A mire in front of the fox: wet ground, pools of water, tussocks and cotton grass, and trees
// (forest = spruces and birches, pines = small bog pines). Returns the growing targets and the west
// edge of the mire.
const MIRE_AREA: { center: Point; rx: number; rz: number } = { center: [7, -2], rx: 10, rz: 7 };
// The objects that grow into view; edge = the west edge of the mire (x).
type Plants = THREE.Object3D[] & { edge: number };
function mire(
  o: LessonStage,
  {
    seed,
    ground,
    pools,
    trees,
    center = MIRE_AREA.center,
  }: { seed: number; ground: string; pools: number; trees?: 'forest' | 'pines'; center?: Point },
): Plants {
  const { mesh, patch, seeded, pine, spruce, birch } = o.models;
  const r = seeded(seed * 17);
  const [[cx, cz], { rx, rz }] = [center, MIRE_AREA];
  const inside = (x: number, z: number, k = 1) =>
    ((x - cx) / (rx * k)) ** 2 + ((z - cz) / (rz * k)) ** 2 < 1;
  o.add(patch(rx, rz, ground, seed), [cx, cz]);
  const water = new THREE.MeshPhongMaterial({
    color: '#46626E',
    specular: '#CFE6F2',
    shininess: 60,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (let i = 0; i < pools; i++) {
    const [x, z] = [cx - rx + r() * 2 * rx, cz - rz + r() * 2 * rz];
    if (!inside(x, z, 0.85)) continue;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), water);
    pool.scale.set(0.8 + r() * 1.6, 1, 0.4 + r() * 0.7);
    pool.position.y = 0.02;
    o.add(pool, [x, z]);
  }
  const plants: THREE.Object3D[] = [];
  for (let i = 0; i < 50; i++) {
    const [x, z] = [cx - rx + r() * 2 * rx, cz - rz + r() * 2 * rz];
    if (!inside(x, z, 0.95) || Math.abs(z - FOX_Z) < 0.7) continue;
    const tussock = mesh(
      new THREE.IcosahedronGeometry(0.3 + r() * 0.25, 0),
      r() < 0.5 ? '#8E8A4A' : '#B8B56E',
      0,
      0.05,
    );
    tussock.scale.y = 0.6;
    plants.push(o.add(tussock, [x, z]));
    // The white tufts of the cotton grass.
    if (!trees && r() < 0.6)
      plants.push(o.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), '#FBF8F0', 0.1, 0.5), [x, z]));
  }
  const count = trees ? { forest: 16, pines: 9 }[trees] : 0;
  for (let i = 0; i < count; i++) {
    const [x, z] = [cx - rx + r() * 2 * rx, cz - rz * 1.1 + r() * 1.6 * rz];
    if (!inside(x, z, 1.05) || Math.abs(z - FOX_Z) < 1.6) continue;
    const tree =
      trees === 'forest' ? (i % 3 ? spruce(5 + r() * 3) : birch(5 + r() * 2)) : pine(2 + r() * 1.5);
    plants.push(o.add(tree, [x, z]));
  }
  return Object.assign(plants, { edge: cx - rx });
}

// The mire grows into view, and the fox walks across it. In the mire the paws sink (sink in
// metres).
async function walk(
  o: LessonStage,
  motion: number,
  targets: THREE.Object3D[],
  { sink, duration = 2200 }: { sink: number; duration?: number },
) {
  const { fox } = o;
  const [start, end] = [-4, 10];
  const edge = MIRE_AREA.center[0] - MIRE_AREA.rx + 1;
  const lift = (x: number) =>
    -sink *
    Math.min(1, Math.max(0, (x - edge) / 2)) *
    Math.min(1, Math.max(0, (MIRE_AREA.center[0] + MIRE_AREA.rx - 1 - x) / 2));
  if (!motion) {
    await o.grow(targets, 0);
    return o.foxTo(end, FOX_Z, lift(end));
  }
  await o.grow(targets, motion, 800, 0.02);
  await o.pause(200);
  fox.poses.set('walking');
  await o.animate(duration, (t) => {
    const x = start + (end - start) * t;
    o.foxTo(x, FOX_Z, lift(x));
  });
  fox.poses.set('facingViewer', 'cheering');
}

// At the edge of an impassable mire the fox stops, tests with a paw and backs off.
async function stopAtEdge(o: LessonStage, motion: number, targets: Plants) {
  const { fox } = o;
  const edge = targets.edge - 0.8;
  if (!motion) {
    await o.grow(targets, 0);
    return o.foxTo(edge - 0.6, FOX_Z);
  }
  await o.grow(targets, motion, 800, 0.02);
  fox.poses.set('walking');
  await o.animate(1000, (t) => o.foxTo(-3 + (edge + 3) * t, FOX_Z));
  fox.poses.set('pawUp');
  await o.pause(500);
  fox.poses.set('curious');
  await o.pause(800);
  fox.poses.set('walking');
  await o.animate(500, (t) => o.foxTo(edge - 0.6 * t, FOX_Z));
  fox.poses.set('facingViewer');
}

export { scene as mire };
