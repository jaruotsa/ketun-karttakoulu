// Field scene: the fox walks along the track through the forest to the edge of the field, notices a
// vole and does the mouse pounce typical of foxes. The vole gets away, and the fox looks sheepishly
// at the camera.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The route follows the track of the map
// north, and the camera follows the fox from the south, so the field is in front of the fox and the
// farmyard (house and barn) behind it.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage, StageSettings } from '../lesson-panel';
import type { Point } from '../types';

// Map coordinates: the south edge of the field at the track, the vole's burrow in the field and the
// vole's escape spot.
const EDGE: Point = [106, 138];
const BURROW: Point = [115, 116];
const ESCAPE: Point = [140, 104];
// The vole and the tuft of grass are 3D models (creatures.ts).
let vole: ReturnType<typeof Creatures.vole> | null = null,
  grass: ReturnType<typeof Creatures.grass> | null = null;
// Lesson panels: the colours on the topo map (MML legend) and on the orienteering map, the line the
// fox walks from left to right and the stage.
const MML = {
  field: '#FBD58D',
  gardenDot: '#009949',
  meadow: '#FFE981',
  clearCut: '#BDC129',
  black: '#1A1919',
};
const V = Orienteering.COLORS;
const FOX_Z = 3;
const STAGE: StageSettings = {
  camera: [3, 5.5, 16],
  gaze: [4, 0.5, -2],
  fox: 1.5,
  foxPosition: [-3, FOX_Z],
};

const scene: Scene = {
  map: Foxwood.map({
    route: 'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144',
    name: t('scenes.field.mapLabel'),
    namePosition: [100, 76],
    nameColor: '#B8860B',
  }),
  feature: 'field',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: { behind: 44, height: 21, ahead: 14, direction: [0, -35], fox: 5 },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      // The fox steps from the road to the edge of the field.
      fox.poses.add('walking');
      await animate(900, (t) => terrain.moveFox(x0 + (EDGE[0] - x0) * t, y0 + (EDGE[1] - y0) * t));
      fox.poses.remove('walking');
      // The vole peeks out of the grass towards the fox.
      fox.poses.add('curious');
      await animate(400, (t) =>
        terrain.place(vole!, BURROW[0] + 0.8, BURROW[1] + 0.8, -0.9 * (1 - t), EDGE),
      );
      await wait(700);
      fox.poses.remove('curious');
      // Mouse pounce: a high arc, nose first.
      await animate(750, (t) => {
        terrain.moveFox(
          EDGE[0] + (BURROW[0] - EDGE[0]) * t,
          EDGE[1] + (BURROW[1] - EDGE[1]) * t,
          7 * Math.sin(Math.PI * t),
          -25 + 60 * t,
        );
      });
      terrain.moveFox(...BURROW);
      terrain.splash(...BURROW, '#C9A441');
      // The vole scurries away across the field and disappears into its burrow.
      const direction = Math.atan2(ESCAPE[1] - BURROW[1], ESCAPE[0] - BURROW[0]);
      animate(900, (t) => {
        const away = t > 0.85 ? (t - 0.85) / 0.15 : 0;
        terrain.place(
          vole!,
          BURROW[0] + (ESCAPE[0] - BURROW[0]) * t,
          BURROW[1] + (ESCAPE[1] - BURROW[1]) * t,
          0.4 * Math.abs(Math.sin(t * 15)) - 0.9 * away,
          direction,
        );
      });
      await wait(500);
      fox.poses.add('facingViewer');
      await wait(900);
    },

    // The vole hides in its burrow and the tuft of grass goes at the burrow in the field.
    reset(_terrainSvg, terrain) {
      vole ??= Creatures.vole();
      grass ??= Creatures.grass();
      terrain.place(vole, BURROW[0] + 0.8, BURROW[1] + 0.8, -0.9, EDGE);
      terrain.place(grass, ...BURROW);
    },
  },

  // On the topo map (MML legend) a field is dark yellow, a garden has green dots on it, a meadow is
  // light yellow with a grass tuft, and a clear-cut (open forest land) has green diagonal dashes on
  // white.
  lesson: {
    title: t('scenes.field.lesson.title'),
    instruction: t('scenes.field.lesson.instruction'),
    stage: STAGE,
    items: [
      {
        name: t('scenes.field.lesson.items.field.name'),
        summary: t('scenes.field.lesson.items.field.summary'),
        text: t('scenes.field.lesson.items.field.text'),
        icon: icon(`<rect x="10" y="6" width="80" height="38" fill="${MML.field}"/>`),
        show: (o, motion) => walk(o, motion, crops(o), 3000),
      },
      {
        name: t('scenes.field.lesson.items.garden.name'),
        summary: t('scenes.field.lesson.items.garden.summary'),
        text: t('scenes.field.lesson.items.garden.text'),
        icon: icon(`<defs><pattern id="lesson-topo-garden" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="${MML.field}"/><circle cx="4" cy="4" r="1.6" fill="${MML.gardenDot}"/></pattern></defs>
            <rect x="10" y="6" width="80" height="38" fill="url(#lesson-topo-garden)"/>`),
        show: (o, motion) => walk(o, motion, orchard(o), 3000),
      },
      {
        name: t('scenes.field.lesson.items.meadow.name'),
        summary: t('scenes.field.lesson.items.meadow.summary'),
        text: t('scenes.field.lesson.items.meadow.text'),
        icon: icon(`<rect x="10" y="6" width="80" height="38" fill="${MML.meadow}"/>
            <path d="M47,20 V30 M53,20 V30" stroke="${MML.black}" stroke-width="2"/>`),
        show: (o, motion) => walk(o, motion, meadow(o), 1800),
      },
      {
        name: t('scenes.field.lesson.items.clearCut.name'),
        summary: t('scenes.field.lesson.items.clearCut.summary'),
        text: t('scenes.field.lesson.items.clearCut.text'),
        icon: icon(`<defs><pattern id="lesson-topo-clear-cut" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <path d="M0,3 H4" stroke="${MML.clearCut}" stroke-width="1.6"/></pattern></defs>
            <rect x="10" y="6" width="80" height="38" fill="url(#lesson-topo-clear-cut)" stroke="#D8D8D0" stroke-width="1"/>`),
        show: (o, motion) => walk(o, motion, heath(o), 3400, 0.3),
      },
    ],
  },

  // On the orienteering map yellow tells of an open place where no trees grow (ISOM 401–403, 412).
  orienteering: {
    lesson: {
      title: t('scenes.field.orienteeringLesson.title'),
      instruction: t('scenes.field.orienteeringLesson.instruction'),
      stage: STAGE,
      items: [
        {
          name: t('scenes.field.orienteeringLesson.items.openArea.name'),
          summary: t('scenes.field.orienteeringLesson.items.openArea.summary'),
          text: t('scenes.field.orienteeringLesson.items.openArea.text'),
          icon: icon(`<rect x="10" y="6" width="80" height="38" rx="10" fill="${V.open}"/>`),
          show: (o, motion) => walk(o, motion, meadow(o), 1800),
        },
        {
          name: t('scenes.field.orienteeringLesson.items.forestClearing.name'),
          summary: t('scenes.field.orienteeringLesson.items.forestClearing.summary'),
          text: t('scenes.field.orienteeringLesson.items.forestClearing.text'),
          icon: icon(`<rect x="10" y="6" width="80" height="38" rx="10" fill="${V.openForest}"/>`),
          show: (o, motion) => walk(o, motion, heath(o), 3400, 0.3),
        },
        {
          name: t('scenes.field.orienteeringLesson.items.semiOpenArea.name'),
          summary: t('scenes.field.orienteeringLesson.items.semiOpenArea.summary'),
          text: t('scenes.field.orienteeringLesson.items.semiOpenArea.text'),
          icon: icon(`<defs><pattern id="lesson-semi-open" width="7" height="7" patternUnits="userSpaceOnUse">
              <rect width="7" height="7" fill="${V.open}"/><circle cx="3.5" cy="3.5" r="1.9" fill="#fff"/></pattern></defs>
            <rect x="10" y="6" width="80" height="38" rx="10" fill="url(#lesson-semi-open)"/>`),
          show: (o, motion) => walk(o, motion, semiOpen(o), 2400),
        },
        {
          name: t('scenes.field.orienteeringLesson.items.field.name'),
          summary: t('scenes.field.orienteeringLesson.items.field.summary'),
          text: t('scenes.field.orienteeringLesson.items.field.text'),
          icon: icon(`<defs><pattern id="lesson-field" width="7" height="7" patternUnits="userSpaceOnUse">
              <rect width="7" height="7" fill="${V.open}"/><circle cx="3.5" cy="3.5" r="0.9" fill="${V.black}"/></pattern></defs>
            <rect x="10" y="6" width="80" height="38" fill="url(#lesson-field)" stroke="${V.black}" stroke-width="1.5"/>`),
          show: (o, motion) => walk(o, motion, crops(o), 3000),
        },
      ],
    },
  },
};

// ---------- Lesson panels: open areas on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}

// A forest edge behind and beside the clearing, so that the clearing stands out from the forest.
function forestEdge(o: LessonStage, [cx, cz]: Point, rx: number, rz: number, seed: number) {
  const r = o.models.seeded(seed);
  const trees = [];
  for (let a = 165; a <= 375; a += 8) {
    const k = 1.08 + r() * 0.25;
    const [x, z] = [
      cx + Math.cos((a * Math.PI) / 180) * rx * k,
      cz + Math.sin((a * Math.PI) / 180) * rz * k,
    ];
    trees.push(o.add(o.models.spruce(6 + r() * 4), [x, z]));
  }
  return trees;
}

// Meadow: low, light grass with flowers.
function meadow(o: LessonStage) {
  const { mesh, patch, seeded } = o.models;
  const r = seeded(21);
  o.add(patch(12, 7, '#B2D276', 2), [5, -1]);
  const flowers = [];
  for (let i = 0; i < 60; i++) {
    const [x, z] = [-5 + r() * 20, -7 + r() * 13];
    if (Math.abs(z - FOX_Z) < 0.8) continue;
    flowers.push(
      o.add(
        mesh(
          new THREE.IcosahedronGeometry(0.09, 0),
          ['#FBF8F0', '#F2D24A', '#D98AB8'][i % 3],
          0,
          0.2,
        ),
        [x, z],
      ),
    );
  }
  return [...forestEdge(o, [5, -1], 12, 7, 3), ...flowers];
}

// A clearing in the forest (clear-cut or heath): brownish-green heath, stumps and small seedlings.
function heath(o: LessonStage) {
  const { mesh, patch, seeded, spruce } = o.models;
  const r = seeded(22);
  o.add(patch(12, 7, '#8E9458', 3), [5, -1]);
  const plants = [];
  for (let i = 0; i < 90; i++) {
    const [x, z] = [-5 + r() * 20, -7 + r() * 13];
    const twig = mesh(
      new THREE.IcosahedronGeometry(0.25 + r() * 0.2, 0),
      ['#6E7A3E', '#7E6A5E', '#8A6E86'][i % 3],
      0,
      0.1,
    );
    twig.scale.y = 0.6;
    plants.push(o.add(twig, [x, z]));
  }
  for (const [x, z] of [
    [1, 0],
    [6, -4],
    [9, 1.2],
    [-2, -3],
    [12, -2],
    [4, 5],
  ] as Point[]) {
    plants.push(
      o.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.4, 7).translate(0, 0.2, 0), '#8A6A48'), [
        x,
        z,
      ]),
    );
  }
  for (const [x, z] of [
    [3, -2.5],
    [10, -5],
    [-1, 0.5],
    [13, 5],
  ] as Point[])
    plants.push(o.add(spruce(0.9 + r() * 0.5), [x, z]));
  return [...forestEdge(o, [5, -1], 12, 7, 4), ...plants];
}

// Semi-open: a meadow with single trees and bushes.
function semiOpen(o: LessonStage) {
  const { patch, birch, pine, shrub } = o.models;
  o.add(patch(12, 7, '#A8CC70', 4), [5, -1]);
  const trees = (
    [
      [0.5, -2, birch, 6],
      [5, -5, pine, 8],
      [8.5, 0.5, shrub, 1.4],
      [11.5, -3, birch, 7],
      [3, 5.5, shrub, 1.2],
      [-3.5, -4, shrub, 1.5],
      [14, 1, pine, 7],
    ] as [number, number, (height?: number) => THREE.Group, number][]
  ).map(([x, z, model, k]) => o.add(model(k), [x, z]));
  return [...forestEdge(o, [5, -1], 12, 7, 5), ...trees];
}

// Garden: rows of apple trees on the grass. The fox walks in front of the rows.
function orchard(o: LessonStage) {
  const { mesh, group, castShadows, patch, seeded } = o.models;
  const r = seeded(24);
  o.add(patch(12, 7, '#A8CC70', 6), [5, -1]);
  const trees = [];
  for (const z of [-6, -3, 0])
    for (let x = -2; x <= 13; x += 3) {
      const k = 0.9 + r() * 0.2;
      const tree = group(
        mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.2, 6).translate(0, 0.6, 0), '#7A5638'),
        mesh(new THREE.IcosahedronGeometry(0.9, 1), '#5E9148', 0, 1.7, 0),
      );
      for (let i = 0; i < 7; i++) {
        const [a, b] = [r() * 2 * Math.PI, 0.3 + r() * 0.9];
        tree.add(
          mesh(
            new THREE.IcosahedronGeometry(0.11, 0),
            '#D0402E',
            Math.cos(a) * 0.82,
            1.1 + b,
            Math.sin(a) * 0.82,
          ),
        );
      }
      tree.scale.setScalar(k);
      trees.push(o.add(castShadows(tree), [x + (r() - 0.5) * 0.4, z]));
    }
  return trees;
}

// Field: brown soil and rows of growing grain. The fox walks along the south edge of the field.
function crops(o: LessonStage) {
  const { mesh, group, castShadows, seeded } = o.models;
  const [x0, x1, z0, z1] = [-2, 18, -12, 1.8];
  const soil = mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), '#8A6A45');
  const r = seeded(23);
  const positions = [];
  for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.45)
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.3) positions.push([x + (r() - 0.5) * 0.1, z]);
  const stalk = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 1, 0.05).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: '#C9A441' }),
    positions.length,
  );
  const ear = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.22, 0.1),
    new THREE.MeshLambertMaterial({ color: '#E3C45E' }),
    positions.length,
  );
  const m = new THREE.Matrix4();
  positions.forEach(([x, z], i) => {
    const k = 0.85 + r() * 0.3;
    stalk.setMatrixAt(i, m.makeScale(1, k, 1).setPosition(x, 0, z));
    ear.setMatrixAt(i, m.makeTranslation(x, k + 0.08, z));
  });
  const g = castShadows(group(stalk, ear));
  o.add(soil, [(x0 + x1) / 2, (z0 + z1) / 2]);
  return [o.add(g)];
}

// The area grows into view, and the fox walks across it (along the edge in the field). bounce =
// hopping over the twigs.
async function walk(
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
  await o.grow(targets, motion, 800, 0.02);
  await o.pause(200);
  fox.poses.set('walking');
  await o.animate(duration, (t) =>
    o.foxTo(start + (end - start) * t, FOX_Z, bounce * Math.abs(Math.sin(t * Math.PI * 9))),
  );
  fox.poses.set('facingViewer', 'cheering');
}

export { scene as field };
