// Forest scene: the fox leaves the start of the path into the forest between the path and the
// track, towards the hill. Under a big spruce a squirrel peeks from a branch and drops a cone on
// the fox's head.
//
// On the map the forest is white, and the forest of Foxwood is conifer forest (Λ signs), so spruces
// grow in the terrain. The terrain is the 3D world of Foxwood (sign-terrain.ts): the fox walks to
// the end of the route and steps under the nearest spruce in front of it.
//
// On the orienteering map the colour of the forest tells how easy it is to run there (ISOM
// 405–408). The fox walks through the thicket (Foxwood.shapes.thicket): in light green it slows
// down and in green it can only go slowly. After the thicket, in the white forest, the fox looks
// back and shakes the needles from its fur.
import * as THREE from 'three';
import * as MapType from '../map-type';
import { Symbols, type TreeKind } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const ORIENTEERING = MapType.current() === 'orienteering';
const V = Orienteering.COLORS;
// The speed by density (world.density): white, slow-running and difficult-to-run forest.
const SPEED: [number, number, number] = [1, 0.5, 0.22];
const THICKET_CENTER: Point = [114, 228];
// The final camera south-east of the fox: gazing between the fox and the thicket ([x, y, height],
// the height as the world height).
function finalShot(terrain: Terrain) {
  const [x0, y0] = terrain.routePoint(1);
  const h = (x: number, y: number) => terrain.world.heightAt(x, y);
  return {
    position: [x0 + 16, y0 + 20, h(x0 + 16, y0 + 20) + 26] as Vec3,
    target: [x0 - 11, y0 + 8, h(x0, y0) + 1] as Vec3,
  };
}
// In the lesson panel the fox walks from left to right along the line z = FOX_Z.
const FOX_Z = 3;
// The squirrel and the cone are 3D models (creatures.ts), slightly exaggerated so that they are
// visible next to the spruce.
let squirrel: ReturnType<typeof Creatures.squirrel> | null = null,
  cone: ReturnType<typeof Creatures.cone> | null = null;
// The fox's head is about 3.6 m above the ground (the fox is exaggerated to 5 m tall).
const HEAD_HEIGHT = 3.6;

const scene: Scene = {
  map: ORIENTEERING
    ? Foxwood.map({
        // From the start of the path north through the thicket and north-east into the white
        // forest.
        route: 'M30,345 C50,320 70,285 88,262 C100,246 112,228 124,212 C134,200 146,194 162,190',
        name: t('scenes.forest.mapLabel'),
        namePosition: [178, 322],
        nameColor: '#3E8A52',
      })
    : Foxwood.map({
        route: 'M30,345 C60,330 90,300 120,285 C135,277 145,265 150,255',
        name: t('scenes.forest.mapLabel'),
        namePosition: [135, 208],
        nameColor: '#3E6B48',
      }),
  feature: 'forest',
  // On the orienteering map the highlight goes around the thicket.
  highlight: ORIENTEERING ? Foxwood.shapes.thicket[0] : undefined,
  bubblePosition: { x: 4, y: 6 },

  terrain: ORIENTEERING
    ? {
        // On the way the camera is behind the fox. At the end it flies south-east, from where the
        // thicket and the fox at its edge are visible.
        camera: { behind: 36, height: 20, ahead: 6, direction: [0, -60], fox: 5 },
        duration: 7500,
        speed: (x, y, world) => SPEED[world.density(x, y)],
        overlay: '',

        // The fox got through the thicket: it turns to look at it and shakes the needles from its
        // paws.
        async arrive({ fox, wait, terrain }) {
          const [x0, y0] = terrain.routePoint(1);
          const { position, target } = finalShot(terrain);
          terrain.moveFox(x0, y0);
          terrain.turnFox(...THICKET_CENTER);
          fox.poses.add('curious');
          await animate(1800, (t) => terrain.fly(t * t * (3 - 2 * t), position, target));
          fox.poses.remove('curious');
          for (let i = 0; i < 2; i++) {
            fox.poses.add('pawUp');
            await wait(300);
            fox.poses.remove('pawUp');
            await wait(250);
          }
        },

        // A gap at the route (as in sign-terrain.ts) and in the line of sight from the camera to
        // the fox.
        reset(_terrainSvg, terrain) {
          const route = Array.from({ length: 301 }, (_, i) => terrain.routePoint(i / 300));
          const [x0, y0] = terrain.routePoint(1);
          const [px, py] = finalShot(terrain).position;
          // Lines of sight from the camera to the fox and to the edge of the thicket.
          const linePoints = ([ax, ay]: Point, [bx, by]: Point) =>
            Array.from(
              { length: 16 },
              (_, i): Point => [ax + ((bx - ax) * i) / 15, ay + ((by - ay) * i) / 15],
            );
          const targets: Point[] = [
            [x0, y0],
            [146, 206],
          ];
          terrain.world.clearing([...route, ...targets.flatMap((k) => linePoints([px, py], k))], 6);
          terrain.draw();
        },
      }
    : {
        camera: { behind: 40, height: 19, ahead: 12, direction: [0, -20], fox: 5 },
        overlay: '',

        async arrive({ fox, wait, terrain }) {
          // The spruce in front of the fox: the nearest tree that is beyond the end of the route in
          // the walking direction.
          const [x0, y0] = terrain.routePoint(1);
          const [ax, ay] = terrain.routePoint(0.95);
          const d = Math.hypot(x0 - ax, y0 - ay) || 1;
          const [dx, dy] = [(x0 - ax) / d, (y0 - ay) / d];
          const tree = terrain.world.nearestTree(
            x0 + dx * 8,
            y0 + dy * 8,
            (p) => (p.x - x0) * dx + (p.y - y0) * dy > 3,
          );
          // The fox steps under the spruce (6 m before the trunk). The squirrel sits on top of the
          // lowest layer of branches on the fox's side of the trunk, slightly east, sheltered by
          // the upper layer (the dimensions of the spruce: world.ts, KUUSI).
          const under: Point = [tree!.x - dx * 6, tree!.y - dy * 6];
          const angle = Math.atan2(-dy, -dx) - 0.6;
          const onBranch = (radius: number): Point => [
            tree!.x + Math.cos(angle) * radius * tree!.height,
            tree!.y + Math.sin(angle) * radius * tree!.height,
          ];
          const branch: Vec3 = [...onBranch(0.2), tree!.height * 0.28];
          fox.poses.add('walking');
          await animate(800, (t) =>
            terrain.moveFox(x0 + (under[0] - x0) * t, y0 + (under[1] - y0) * t),
          );
          fox.poses.remove('walking');
          // The fox looks up, and the squirrel peeks out from among the branches.
          fox.poses.add('curious');
          await animate(500, (t) => {
            const [x, y] = onBranch(0.1 + 0.1 * t);
            terrain.place(squirrel!, x, y, branch[2] + 0.5 * (1 - t), under);
          });
          await wait(500);
          // The cone falls on the fox's head and bounces to the ground.
          await animate(550, (t) => {
            terrain.place(
              cone!,
              branch[0] + (under[0] - branch[0]) * t,
              branch[1] + (under[1] - branch[1]) * t,
              branch[2] + (HEAD_HEIGHT - branch[2]) * t * t,
            );
            cone!.rotation.z = 3.5 * t;
          });
          fox.poses.remove('curious');
          fox.poses.add('facingViewer');
          await animate(600, (t) => {
            const height = HEAD_HEIGHT * (1 - t * t) + 1.2 * Math.sin(Math.PI * t);
            terrain.place(cone!, under[0] + 3 * t, under[1] + 1.5 * t, Math.max(height, 0.35));
            cone!.rotation.z = 3.5 + 5 * t;
          });
          cone!.rotation.z = Math.PI / 2; // the cone is left lying on its side
          terrain.draw();
          await wait(900);
        },

        // The squirrel and the cone hide.
        reset(_terrainSvg, terrain) {
          squirrel ??= Creatures.squirrel();
          cone ??= Creatures.cone();
          squirrel.removeFromParent();
          cone.removeFromParent();
          terrain.draw();
        },
      },

  // Orienteering map: the colour tells how easy it is to run in the forest (ISOM 405–408, 409).
  orienteering: {
    lesson: {
      title: t('scenes.forest.orienteeringLesson.title'),
      instruction: t('scenes.forest.orienteeringLesson.instruction'),
      stage: { camera: [3, 5.5, 16], gaze: [4, 0.5, -2], fox: 1.5, foxPosition: [-3, FOX_Z] },
      items: [
        {
          name: t('scenes.forest.orienteeringLesson.items.easyForest.name'),
          summary: t('scenes.forest.orienteeringLesson.items.easyForest.summary'),
          text: t('scenes.forest.orienteeringLesson.items.easyForest.text'),
          icon: colorIcon(V.paper),
          show: (o, motion) =>
            run(o, motion, grove(o, { seed: 1, spacing: 4.2, size: [6, 9] }), 1800),
        },
        {
          name: t('scenes.forest.orienteeringLesson.items.slowForest.name'),
          summary: t('scenes.forest.orienteeringLesson.items.slowForest.summary'),
          text: t('scenes.forest.orienteeringLesson.items.slowForest.text'),
          icon: colorIcon(V.slow),
          show: (o, motion) =>
            run(o, motion, grove(o, { seed: 2, spacing: 2.1, size: [2.4, 3.6] }), 3600),
        },
        {
          name: t('scenes.forest.orienteeringLesson.items.thicket.name'),
          summary: t('scenes.forest.orienteeringLesson.items.thicket.summary'),
          text: t('scenes.forest.orienteeringLesson.items.thicket.text'),
          icon: colorIcon(V.difficult),
          show: (o, motion) =>
            run(
              o,
              motion,
              grove(o, { seed: 3, spacing: 1.35, size: [2, 3.2], bushes: true }),
              6000,
            ),
        },
        {
          name: t('scenes.forest.orienteeringLesson.items.heath.name'),
          summary: t('scenes.forest.orienteeringLesson.items.heath.summary'),
          text: t('scenes.forest.orienteeringLesson.items.heath.text'),
          icon: icon(`<clipPath id="lesson-ground"><rect x="10" y="6" width="80" height="38" rx="10"/></clipPath>
            <rect x="10" y="6" width="80" height="38" rx="10" fill="#fff" stroke="#D5D0C4" stroke-width="1.5"/>
            <g clip-path="url(#lesson-ground)" stroke="${V.lines}" stroke-width="1.6">
              ${Array.from({ length: 16 }, (_, i) => `<line x1="${12.5 + i * 5}" x2="${12.5 + i * 5}" y1="6" y2="44"/>`).join('')}
            </g>`),
          show: (o, motion) =>
            run(
              o,
              motion,
              [...grove(o, { seed: 4, spacing: 4.2, size: [6, 9] }), ...heath(o)],
              3400,
              0.3,
            ),
        },
      ],
    },
  },

  lesson: {
    title: t('scenes.forest.lesson.title'),
    instruction: t('scenes.forest.lesson.instruction'),
    // The spruce forest of the background is hidden, so that only the trees of the pressed forest
    // are visible.
    stage: {
      camera: [0, 2.6, 15],
      gaze: [0, 3.2, -4],
      fox: 1.5,
      foxPosition: [-0.8, 3.5],
      background: false,
    },
    items: [
      {
        name: t('scenes.forest.lesson.items.coniferForest.name'),
        summary: t('scenes.forest.lesson.items.coniferForest.summary'),
        text: t('scenes.forest.lesson.items.coniferForest.text'),
        icon: treeIcon('conifer'),
        show: (o, motion) => growForest(o, motion, ['spruce', 'pine', 'spruce']),
      },
      {
        name: t('scenes.forest.lesson.items.deciduousForest.name'),
        summary: t('scenes.forest.lesson.items.deciduousForest.summary'),
        text: t('scenes.forest.lesson.items.deciduousForest.text'),
        icon: treeIcon('deciduous'),
        show: (o, motion) => growForest(o, motion, ['birch']),
      },
      {
        name: t('scenes.forest.lesson.items.mixedForest.name'),
        summary: t('scenes.forest.lesson.items.mixedForest.summary'),
        text: t('scenes.forest.lesson.items.mixedForest.text'),
        icon: treeIcon('mixed'),
        show: (o, motion) => growForest(o, motion, ['spruce', 'birch', 'pine', 'birch']),
      },
      {
        name: t('scenes.forest.lesson.items.shrubland.name'),
        summary: t('scenes.forest.lesson.items.shrubland.summary'),
        text: t('scenes.forest.lesson.items.shrubland.text'),
        icon: treeIcon('shrub'),
        camera: { position: [0, 1.8, 10], gaze: [0, 1, -2] },
        show: (o, motion) => growForest(o, motion, ['shrub'], true),
      },
    ],
  },
};

// ---------- Lesson panel (orienteering map): runnability on the 3D stage (lesson-panel.ts)
// ---------- The forest grows around the fox.
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
function colorIcon(v: string) {
  return icon(
    `<rect x="10" y="6" width="80" height="38" rx="10" fill="${v}" stroke="#D5D0C4" stroke-width="1.5"/>`,
  );
}

// A spruce grove around the fox: the spacing of the trees and the height [smallest, largest] in
// metres. In the difficult forest there are bushes between the spruces. A narrow lane is left at
// the fox, so that it is visible.
function grove(
  o: LessonStage,
  {
    seed,
    spacing,
    size: [k0, k1],
    bushes = false,
  }: { seed: number; spacing: number; size: [number, number]; bushes?: boolean },
) {
  const { spruce, shrub, seeded } = o.models;
  const r = seeded(seed * 29);
  const trees: [THREE.Object3D, number, number][] = [];
  for (let z = -9; z < 7; z += spacing * 0.85) {
    for (let x = -7; x < 17; x += spacing) {
      const [px, pz] = [x + (r() - 0.5) * spacing * 0.8, z + (r() - 0.5) * spacing * 0.6];
      if (Math.abs(pz - FOX_Z) < 0.9 + spacing * 0.1) continue;
      // In front (on the viewer's side) only low seedlings grow in dense forest, so that the fox is
      // visible over them.
      const inFront = pz > FOX_Z;
      if (inFront && spacing > 2.5) continue;
      const tree = spruce(inFront ? 0.9 + r() * 0.5 : k0 + r() * (k1 - k0));
      trees.push([tree, px, pz]);
      if (bushes && !inFront && r() < 0.5)
        trees.push([shrub(0.9 + r() * 0.5), px + spacing / 2, pz + (r() - 0.5)]);
    }
  }
  return trees
    .sort((a, b) => b[2] - a[2]) // nearest first
    .map(([tree, x, z]) => o.add(tree, [x, z], r() * 360));
}

// Slow-running ground: low twigs and fallen sticks on the ground.
function heath(o: LessonStage) {
  const { mesh, seeded } = o.models;
  const r = seeded(41);
  const plants = [];
  for (let i = 0; i < 140; i++) {
    const [x, z] = [-6 + r() * 22, -8 + r() * 14];
    const twig = mesh(
      new THREE.IcosahedronGeometry(0.28 + r() * 0.22, 0),
      ['#4E7A3A', '#5E8A44', '#6E7A3E'][i % 3],
      0,
      0.12,
    );
    twig.scale.y = 0.6;
    plants.push(o.add(twig, [x, z]));
  }
  for (let i = 0; i < 14; i++) {
    const stick = mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.6 + r(), 5).rotateZ(Math.PI / 2),
      '#7A5A3E',
      0,
      0.1,
    );
    plants.push(o.add(stick, [-5 + r() * 20, -7 + r() * 13], r() * 180));
  }
  return plants;
}

// The forest grows into view, and the fox walks across it in the time duration (ms). bounce =
// hopping over the twigs.
async function run(
  o: LessonStage,
  motion: number,
  targets: THREE.Object3D[],
  duration: number,
  bounce = 0,
) {
  const { fox } = o;
  const [start, end] = [-3, 11];
  if (!motion) {
    await o.grow(targets, 0);
    return o.foxTo(end, FOX_Z);
  }
  await o.grow(targets, motion, 700, Math.min(0.02, 1.2 / targets.length));
  await o.pause(200);
  fox.poses.set('walking');
  await o.animate(duration, (t) =>
    o.foxTo(start + (end - start) * t, FOX_Z, bounce * Math.abs(Math.sin(t * Math.PI * 9))),
  );
  fox.poses.set('facingViewer', 'cheering');
}

// ---------- Lesson panel: the tree kinds of the forest (MML: conifer, deciduous and mixed forest,
// shrubland) ----------
function treeIcon(kind: TreeKind) {
  return `<rect width="100" height="50" fill="#fff"/>${Symbols.tree(kind, 50, 25, 2.6, 3)}`;
}

// The heights of the trees in metres.
type TreeSpecies = 'spruce' | 'pine' | 'birch' | 'shrub';
const HEIGHTS: Record<TreeSpecies, number> = { spruce: 9, pine: 10, birch: 8, shrub: 1.6 };

// The forest grows around the fox: the trees are in rows, and there is a clearing in front of the
// fox. In shrubland one bush is in front of the fox, and the fox peeks from behind it.
async function growForest(
  o: LessonStage,
  motion: number,
  species: TreeSpecies[],
  shrubland = false,
) {
  const r = o.models.seeded(9);
  const spacing = shrubland ? 2.4 : 4.5;
  const trees: [TreeSpecies, number, number, number?][] = [];
  for (let row = 0; row < (shrubland ? 6 : 5); row++) {
    const z = -4 - row * spacing * 0.9;
    for (let x = -22 + (row % 2) * spacing * 0.5; x <= 22; x += spacing) {
      const kind = species[(trees.length + row) % species.length];
      trees.push([kind, x + (r() - 0.5) * spacing * 0.5, z + (r() - 0.5) * spacing * 0.4]);
    }
  }
  // A front row at the sides, so that the fox is in the middle of the forest.
  for (const x of [-9, -6, 5.5, 8.5])
    trees.push([species[trees.length % species.length], x + (r() - 0.5), 1 + r() * 2]);
  // The bush in front of the fox is lower, so that the fox is visible behind it.
  if (shrubland) trees.push(['shrub', 0.6, 5, 1]);
  const targets = trees
    .sort((a, b) => b[2] - a[2]) // nearest first
    .map(([kind, x, z, size]) =>
      o.add(o.models[kind](size ?? HEIGHTS[kind] * (0.8 + r() * 0.35)), [x, z], r() * 360),
    );
  if (motion) o.fox.poses.set('curious');
  await o.grow(targets, motion, 700, Math.min(0.1, 1.5 / targets.length));
  o.fox.poses.set('facingViewer');
}

export { scene as forest };
