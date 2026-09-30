// Power line scene: the fox walks along the track to the edge of the road, under the power line
// next to a pole. A glowing spark travels along the wire to the pole and from there along the
// branch to the house, and a wagtail sitting on the branch wire flies off.
//
// The line is on both maps (Foxwood.POWER_LINE): the main line south of the road and branches to
// the house of the farmyard and the summer cabin. On the MML map a power line is a thin black line
// with a Z now and then, and the poles are black dots. On the orienteering map it is a thin black
// line with cross lines at the poles (ISOM 510). In the terrain the line is the poles and wires of
// the 3D world (world.ts), and there is a treeless strip under it.
import * as THREE from 'three';
import { Symbols } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage, StageSettings } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const V = Orienteering.COLORS;
const SL = Foxwood.POWER_LINE;
// The pole next to which the fox stops: a branch to the house starts from it.
const POLE = SL.branches.house.pole;
// The spark comes from the direction of the previous pole (the main line segment that ends at the
// POLE pole).
const SEGMENT = SL.poles.findIndex(([x, y]) => x === POLE[0] && y === POLE[1]) - 1;
const BIRD_T = 0.55; // the position of the bird on the branch wire (0 = pole, 1 = wall of the house)
let bird: ReturnType<typeof Creatures.bird> | null = null,
  spark: ReturnType<typeof Creatures.spark> | null = null;
// The stage of the lesson panel: the line runs across the stage from left to right behind the fox
// (z = LINE_Z).
const STAGE: StageSettings = {
  camera: [0, 7, 30],
  gaze: [3, 5, -4],
  fox: 2.4,
  foxPosition: [-9, 6],
};
const LINE_Z = -4;

const scene: Scene = {
  map: Foxwood.map({
    // Along the track north to the edge of the road and under the power line next to the pole.
    route:
      'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 196,50 197,34 C198,28 201,25 205,24',
    name: t('scenes.powerLine.mapLabel'),
    namePosition: [110, 80],
    nameColor: '#1a1a1a',
  }),
  feature: 'powerLine',

  terrain: {
    // At the end the camera is in the south-west and looks between the pole and the house, so that
    // the branch to the house is visible.
    camera: {
      behind: 44,
      height: 20,
      ahead: 10,
      direction: [0, -50],
      gaze: { point: [214, 21], start: 0.6 },
      fox: 5,
    },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      const power = terrain.world.power;
      const [x0, y0] = terrain.routePoint(1);
      // The fox turns towards the pole and looks up at the wires.
      terrain.moveFox(x0, y0);
      terrain.turnFox(...POLE);
      fox.poses.add('curious');
      await wait(500);
      // The spark travels along the main line to the pole.
      const glow = (t: number) => spark!.glow(0.75 + 0.25 * Math.sin(t * 60));
      await animate(1300, (t) => {
        const [x, y, h] = power.wire(SEGMENT, t);
        terrain.place(spark!, x, y, h);
        glow(t);
        terrain.draw();
      });
      // The spark continues along the branch to the house, and the bird flies off before the spark
      // reaches it.
      const [lx, ly, lh] = power.branch('house', BIRD_T);
      await animate(1500, (t) => {
        const [x, y, h] = power.branch('house', t);
        terrain.place(spark!, x, y, h);
        glow(t);
        const q = Math.max(0, (t - 0.2) / 0.8);
        if (q > 0) {
          terrain.place(bird!, lx + 14 * q, ly - 10 * q, lh + 9 * q * (2 - q), [lx + 20, ly - 14]);
          bird!.wings(0.5 + 0.5 * Math.sin(q * 50));
        }
        terrain.draw();
      });
      spark!.removeFromParent();
      bird!.removeFromParent();
      fox.poses.remove('curious');
      fox.poses.add('facingViewer');
      await wait(1000);
    },

    reset(_terrainSvg, terrain) {
      bird ??= Creatures.bird();
      spark ??= Creatures.spark();
      // The wagtail sits on the wire of the branch to the house and looks towards the pole.
      const [x, y, h] = terrain.world.power.branch('house', BIRD_T);
      terrain.place(bird, x, y, h - 0.05, POLE);
      bird.wings(0);
      spark.removeFromParent();
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.powerLine.lesson.title'),
    instruction: t('scenes.powerLine.lesson.instruction'),
    stage: STAGE,
    items: [
      {
        name: t('scenes.powerLine.lesson.items.powerLine.name'),
        summary: t('scenes.powerLine.lesson.items.powerLine.summary'),
        text: t('scenes.powerLine.lesson.items.powerLine.text'),
        icon: icon(
          Symbols.powerLine(
            [
              [6, 25],
              [30, 25],
              [70, 25],
              [94, 25],
            ],
            [
              [30, 25],
              [70, 25],
            ],
            2,
            4,
            2,
          ),
        ),
        show: (o, motion) => sparkRun(o, motion, woodenLine(o)),
      },
      {
        name: t('scenes.powerLine.lesson.items.pole.name'),
        summary: t('scenes.powerLine.lesson.items.pole.summary'),
        text: t('scenes.powerLine.lesson.items.pole.text'),
        icon: icon(
          Symbols.powerLine(
            [
              [6, 25],
              [94, 25],
            ],
            [[50, 25]],
            2.4,
            0,
          ),
        ),
        camera: { position: [0, 12, 46], gaze: [4, 11, -6] },
        show: (o, motion) => lookUp(o, motion, bigLine(o)),
      },
      {
        name: t('scenes.powerLine.lesson.items.gasPipe.name'),
        summary: t('scenes.powerLine.lesson.items.gasPipe.summary'),
        text: t('scenes.powerLine.lesson.items.gasPipe.text'),
        icon: icon(`<path d="M6,25 H94" stroke="#1a1a1a" stroke-width="1.6" stroke-dasharray="11 6"/>
          <path d="M48.5,19 V31 M54,19 L48.5,25 L54,31" fill="none" stroke="#1a1a1a" stroke-width="1.4"/>`),
        show: (o, motion) => sniff(o, motion, gasLine(o)),
      },
    ],
  },

  // Orienteering map: a power line is a thin line with cross lines at the poles (ISOM 510). Under
  // the line there is a gap that is easy to run along. A narrow line is just a gap in the forest
  // (the Orienteering Federation's legend).
  orienteering: {
    lesson: {
      title: t('scenes.powerLine.orienteeringLesson.title'),
      instruction: t('scenes.powerLine.orienteeringLesson.instruction'),
      stage: STAGE,
      items: [
        {
          name: t('scenes.powerLine.orienteeringLesson.items.powerLine.name'),
          summary: t('scenes.powerLine.orienteeringLesson.items.powerLine.summary'),
          text: t('scenes.powerLine.orienteeringLesson.items.powerLine.text'),
          icon: icon(
            Orienteering.powerLine(
              [
                [6, 25],
                [94, 25],
              ],
              [
                [30, 25],
                [70, 25],
              ],
              2.4,
            ),
          ),
          show: (o, motion) => run(o, motion, woodenLine(o, { forest: true })),
        },
        {
          name: t('scenes.powerLine.orienteeringLesson.items.narrowClearing.name'),
          summary: t('scenes.powerLine.orienteeringLesson.items.narrowClearing.summary'),
          text: t('scenes.powerLine.orienteeringLesson.items.narrowClearing.text'),
          icon: icon(
            `<path d="M6,25 H94" stroke="${V.black}" stroke-width="1.6" stroke-dasharray="14 6"/>`,
          ),
          // The camera looks along the line from above, so that the gap is visible.
          camera: { position: [4, 16, 24], gaze: [4, 0, -14] },
          show: (o, motion) => run(o, motion, narrowLine(o)),
        },
      ],
    },
  },
};

// ---------- Lesson panel: power lines on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}

// A sagging wire from point a to point b ([x, y, z]); sag in metres in the middle.
function wire(a: Vec3, b: Vec3, sag: number) {
  const points = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return new THREE.Vector3(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t),
      a[2] + (b[2] - a[2]) * t,
    );
  });
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: '#2A2A2A' }),
  );
}

// A line of wooden poles (the Foxwood pole model). The wires continue over the edges of the stage.
// forest = spruces on both sides of the line, leaving a gap under the line. Returns the growing
// targets and the ends of the middle wire for the spark.
function woodenLine(o: LessonStage, { forest = false } = {}) {
  const { group, spruce, seeded } = o.models;
  const { wires: mounts } = World.POLE;
  const X = [-52, -28, -4, 20, 44, 68];
  const g = group();
  for (const x of X) {
    const p = World.models.pole();
    p.position.x = x;
    g.add(p);
  }
  for (let i = 1; i < X.length; i++) {
    for (const [side, h] of mounts) g.add(wire([X[i - 1], h, side], [X[i], h, side], 0.8));
  }
  o.add(g, [0, LINE_Z]);
  const targets: THREE.Object3D[] = [g];
  if (forest) {
    // Spruces behind the line; a gap is left under the line and in front of the fox.
    const r = seeded(8);
    for (let x = -40; x < 60; x += 4.5) {
      for (const z of [-14, -19, -24])
        targets.push(o.add(spruce(9 + r() * 4), [x + r() * 2, z + r() * 2]));
    }
  }
  // The middle wire over two pole spans: the spark travels along it.
  const [, h] = mounts[1];
  return Object.assign(targets, {
    sparkPath: [
      [X[1], h, LINE_Z],
      [X[3], h, LINE_Z],
    ] as [Vec3, Vec3],
  });
}

// Big power line: a tall steel lattice pylon, three wires and a lightning conductor at the top.
function bigLine(o: LessonStage) {
  const { group } = o.models;
  const { beam } = World.models;
  const H = 26,
    T = '#8A8F94';
  const pylon = () => {
    const g = group();
    // Four legs taper upwards; a lattice between them.
    const leg = (sx: number, sz: number, y: number): Vec3 => [
      sx * (3 - 2.2 * (y / H)),
      y,
      sz * (3 - 2.2 * (y / H)),
    ];
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as Point[])
      g.add(beam(leg(sx, sz, 0), leg(sx, sz, H), 0.3, T));
    for (let y = 0; y < H; y += 4) {
      for (const [a, b] of [
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
        [
          [-1, 1],
          [1, 1],
        ],
      ] as [Point, Point][]) {
        g.add(beam(leg(a[0], a[1], y), leg(b[0], b[1], y + 4), 0.14, T));
        g.add(beam(leg(b[0], b[1], y), leg(a[0], a[1], y + 4), 0.14, T));
      }
    }
    // The crossarm and insulator strings.
    g.add(beam([0, H - 5, -8], [0, H - 5, 8], 0.5, T));
    for (const z of [-7, 0, 7]) g.add(beam([0, H - 5, z], [0, H - 7.5, z], 0.25, '#D8D4C8'));
    return g;
  };
  const X = [-40, 6, 52];
  const g = group();
  for (const x of X) {
    const p = pylon();
    p.position.x = x;
    g.add(p);
  }
  for (let i = 1; i < X.length; i++) {
    for (const z of [-7, 0, 7]) g.add(wire([X[i - 1], H - 7.5, z], [X[i], H - 7.5, z], 3));
    g.add(wire([X[i - 1], H, 0], [X[i], H, 0], 2));
  }
  o.add(g, [0, -8]);
  return [g];
}

// The marker posts of a gas pipeline: a yellow post and an orange cap. The pipeline is underground.
function gasLine(o: LessonStage) {
  const { group, mesh } = o.models;
  return [-12, -3, 6, 15, 24].map((x) => {
    const g = group(
      mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8).translate(0, 0.8, 0), '#F2C521'),
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 8).translate(0, 1.7, 0), '#E86A1C'),
    );
    return o.add(o.models.castShadows(g), [x, 1]);
  });
}

// Narrow line: a straight gap in a spruce forest that runs away from the viewer in front of the
// fox.
const NARROW_X = 4;
function narrowLine(o: LessonStage) {
  const { spruce, seeded } = o.models;
  const r = seeded(12);
  const trees: THREE.Object3D[] = [];
  for (let z = -40; z < -2; z += 3.5) {
    for (const side of [-1, 1]) {
      for (const k of [0, 1, 2])
        trees.push(
          o.add(spruce(8 + r() * 4), [NARROW_X + side * (3 + k * 4 + r() * 1.5), z + r() * 1.5]),
        );
    }
  }
  return Object.assign(trees, { narrow: true });
}

// The line rises from the ground, and a spark travels along the middle wire.
async function sparkRun(
  o: LessonStage,
  motion: number,
  targets: THREE.Object3D[] & { sparkPath: [Vec3, Vec3] },
) {
  const { fox } = o;
  if (motion) fox.poses.set('curious');
  await o.grow(targets, motion, 800, 0.02);
  if (!motion) return fox.poses.set('facingViewer');
  const [a, b] = targets.sparkPath;
  const spark = o.add(Creatures.spark(), [a[0], a[2]]);
  spark.scale.setScalar(0.4); // the stage is at real scale, Foxwood is exaggerated
  const gaze = new THREE.Vector3();
  await o.animate(2200, (t) => {
    spark.position.set(
      a[0] + (b[0] - a[0]) * t,
      a[1] - 4 * 0.8 * ((t * 2) % 1) * (1 - ((t * 2) % 1)),
      a[2],
    );
    spark.glow(0.75 + 0.25 * Math.sin(t * 80));
    fox.lookAt(gaze.copy(spark.position));
  });
  spark.removeFromParent();
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

// The fox looks up at the top of the big pylon.
async function lookUp(o: LessonStage, motion: number, targets: THREE.Object3D[]) {
  const { fox } = o;
  if (motion) fox.poses.set('curious');
  await o.grow(targets, motion, 1000, 0);
  if (!motion) return fox.poses.set('facingViewer');
  fox.lookAt(new THREE.Vector3(6, 26, -8));
  await o.pause(1500);
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

// The fox walks along the posts and sniffs the ground: the pipeline cannot be seen.
async function sniff(o: LessonStage, motion: number, targets: THREE.Object3D[]) {
  const { fox } = o;
  await o.grow(targets, motion, 700, 0.12);
  o.turn(0);
  if (!motion) return o.foxTo(2, 4);
  fox.poses.set('walking');
  await o.animate(1600, (t) => o.foxTo(-9 + 11 * t, 6 - 2 * t));
  fox.poses.set('curious');
  const gaze = new THREE.Vector3();
  for (const x of [4, 7]) {
    fox.lookAt(gaze.set(x, 0, 2));
    await o.pause(600);
  }
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

// The fox runs along the line: under the power line from left to right, on a narrow line away from
// the viewer.
async function run(
  o: LessonStage,
  motion: number,
  targets: THREE.Object3D[] & { narrow?: boolean },
) {
  const { fox } = o;
  await o.grow(targets, motion, 800, 0.004);
  const [x0, z0, x1, z1] = targets.narrow
    ? [NARROW_X, 6, NARROW_X, -9]
    : [-9, LINE_Z + 2, 14, LINE_Z + 2];
  o.turn(targets.narrow ? 90 : 0);
  if (!motion) return o.foxTo(x1, z1);
  o.foxTo(x0, z0);
  await o.pause(300);
  fox.poses.set('walking');
  await o.animate(1800, (t) => o.foxTo(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
  fox.poses.set('facingViewer', 'cheering');
}

export { scene as powerLine };
