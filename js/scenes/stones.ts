// Stone scene: the fox walks along the path past the campfire site to the shore of Fox Lake. On the
// shore there is a big stone with a lizard basking on top. The lizard gets scared and darts away,
// and the fox jumps on top of the stone.
//
// The terrain is the 3D world of Foxwood (sign-3d.ts). The fox walks east along the south shore of
// the lake, and the camera follows it from the south: the lake is on the left and the summer cabin
// and the sauna are visible on the opposite shore.
import * as THREE from 'three';
import * as MapType from '../map-type';
import { Symbols } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const STONE = Foxwood.STONE;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ORIENTEERING = MapType.current() === 'orienteering';
// On the way the fox stops at the foot of the cliff on the east slope of the hill (Foxwood.CLIFF)
// and looks up at the wall.
const BREAK_SPOT: Point = [339, 180];
const CLIFF_CENTER: Point = [326, 176]; // the centre of the wall
// The map sign of the cliff according to the chosen map, centred at (0, 0).
const cliffSign = (s: number) =>
  ORIENTEERING
    ? Orienteering.cliff(
        [
          [-12, 0],
          [12, 0],
        ],
        s * 1.3,
      )
    : Symbols.cliff(-12, 0, 12, 0, s);
const SIGN_SCALE = 0.12; // the size of the sign in the terrain (m / SVG unit)
// The camera looks at the wall from the lake side when the fox is at its foot.
function cliffShot(terrain: Terrain) {
  const h = (x: number, y: number) => terrain.world.heightAt(x, y);
  return {
    position: [372, 196, h(372, 196) + 9] as Vec3,
    target: [330, 176, h(330, 176) + 3] as Vec3,
  };
}
// The top of the stone is about 2.4 m above the ground (world.ts: stoneModel).
const TOP_HEIGHT = 2.3;
// The lizard is exaggerated in size (about 1.2 m), so that it can be seen (creatures.ts).
let lizard: ReturnType<typeof Creatures.lizard> | null = null;
let stopRunning: (() => void) | null = null;

const scene: Scene = {
  map: Foxwood.map({
    // From the path to the east slope of the hill at the foot of the cliff, then down past the
    // campfire site and along the south shore of the lake to the stone.
    route:
      'M30,345 C110,335 140,290 210,292 C280,294 316,256 336,244 C352,234 346,200 339,180 ' +
      'C346,176 360,184 366,200 C372,222 374,240 384,254 C392,266 394,278 396,292 C402,318 418,340 452,342 C482,344 505,332 524,326',
    name: t('scenes.stones.mapLabel'),
    namePosition: [480, 272],
    nameColor: '#6E6C66',
  }),
  feature: 'stones',

  terrain: {
    camera: { behind: 42, height: 19, ahead: 12, direction: [0, -80], turnAt: 0.8, fox: 5 },
    duration: 8500,
    stops: [BREAK_SPOT],
    overlay: `<g class="cliff-marker" opacity="0"><circle r="24" fill="#fff" stroke="#1a1a1a" stroke-width="3"/>${cliffSign(1.3)}</g>`,

    // At the foot of the cliff the camera turns to look at the wall from the lake side, and the fox
    // looks up.
    async atStop(_n, { terrainSvg, mapSvg, fox, wait, terrain }) {
      const { position, target } = cliffShot(terrain);
      const sign = terrainSvg.querySelector('.cliff-marker');
      const enlarged = mapSvg.querySelector('.cliff-lift');
      // A fox detached from the route (moveFox) stays turned towards the wall.
      terrain.moveFox(...BREAK_SPOT);
      terrain.turnFox(...CLIFF_CENTER);
      fox.poses.add('curious');
      await animate(1200, (t) => terrain.fly(t * t * (3 - 2 * t), position, target));
      terrain.pin(sign!, CLIFF_CENTER[0], CLIFF_CENTER[1], 9, SIGN_SCALE);
      await animate(350, (t) => {
        sign!.setAttribute('opacity', String(t));
        enlarged!.setAttribute('opacity', String(t));
        enlarged!.setAttribute(
          'transform',
          `translate(${CLIFF_CENTER[0]} ${CLIFF_CENTER[1]}) scale(${0.6 + 0.4 * t})`,
        );
        terrain.draw();
      });
      await wait(1600);
      fox.poses.remove('curious');
      sign!.setAttribute('opacity', String(0));
      enlarged!.setAttribute('opacity', String(0));
      await animate(1000, (t) => terrain.fly(1 - t * t * (3 - 2 * t), position, target));
    },

    async arrive({ fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      // The lizard basks on top of the stone; the fox notices it.
      terrain.place(lizard!, STONE[0] - 0.3, STONE[1], TOP_HEIGHT - 0.15, [x0, y0]);
      fox.poses.add('curious');
      await wait(700);
      // The lizard gets scared and darts down the side of the stone to the ground and away.
      stopRunning = terrain.everyFrame((time) => lizard!.run(time));
      const direction = Math.atan2(1, 5);
      await animate(900, (t) => {
        terrain.place(
          lizard!,
          STONE[0] + 7 * t,
          STONE[1] + 1.4 * t,
          (TOP_HEIGHT - 0.15) * (1 - t * t),
          direction,
        );
        lizard!.rotation.z = -0.5 * Math.sin(Math.PI * Math.min(1, t * 1.5));
      });
      stopRunning!();
      lizard!.removeFromParent();
      fox.poses.remove('curious');
      await wait(300);
      // A leap on top of the stone.
      await animate(750, (t) => {
        const jump = Math.sin(Math.PI * t);
        terrain.moveFox(
          x0 + (STONE[0] - x0) * t,
          y0 + (STONE[1] - y0) * t,
          TOP_HEIGHT * t + 2.5 * jump,
          -18 * jump,
        );
      });
      terrain.moveFox(STONE[0], STONE[1], TOP_HEIGHT);
      await wait(300);
      fox.poses.add('facingViewer');
      await wait(700);
    },

    reset(terrainSvg, terrain, mapSvg) {
      // The line of sight from the lake side to the cliff and the fox.
      const {
        position: [cx, cy],
      } = cliffShot(terrain);
      const linePoints = ([ax, ay]: Point, [bx, by]: Point) =>
        Array.from(
          { length: 16 },
          (_, i): Point => [ax + ((bx - ax) * i) / 15, ay + ((by - ay) * i) / 15],
        );
      const route = Array.from({ length: 301 }, (_, i) => terrain.routePoint(i / 300));
      terrain.world.clearing(
        [...route, ...linePoints([cx, cy], BREAK_SPOT), ...linePoints([cx, cy], CLIFF_CENTER)],
        6,
      );
      terrainSvg.querySelector('.cliff-marker')!.setAttribute('opacity', String(0));
      // On the map the sign of the cliff grows for a moment (on top of the fox's map sign, so at
      // the end of the map).
      if (!mapSvg.querySelector('.cliff-lift')) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'cliff-lift');
        g.innerHTML = `<circle r="17" fill="#fff" stroke="#1a1a1a" stroke-width="2.5"/>${cliffSign(0.9)}`;
        mapSvg.appendChild(g);
      }
      mapSvg.querySelector('.cliff-lift')!.setAttribute('opacity', String(0));
      lizard ??= Creatures.lizard();
      stopRunning?.();
      lizard.removeFromParent();
      lizard.rotation.z = 0;
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.stones.lesson.title'),
    instruction: t('scenes.stones.lesson.instruction'),
    stage: { camera: [0, 3, 12], gaze: [1.2, 1.4, -1], fox: 1.9, foxPosition: [-4, 3.5] },
    items: [
      {
        name: t('scenes.stones.lesson.items.largeStone.name'),
        summary: t('scenes.stones.lesson.items.largeStone.summary'),
        text: t('scenes.stones.lesson.items.largeStone.text'),
        icon: icon(Symbols.stone(50, 25, 2.8)),
        show: (o, motion) => raise(o, motion, bigStone(o)),
      },
      {
        name: t('scenes.stones.lesson.items.stoneField.name'),
        summary: t('scenes.stones.lesson.items.stoneField.summary'),
        text: t('scenes.stones.lesson.items.stoneField.text'),
        icon: icon(Symbols.triangles(12, 5, 76, 40, 8, 5)),
        show: (o, motion) => raise(o, motion, stonyGround(o), 0.008),
      },
      {
        name: t('scenes.stones.lesson.items.boulderField.name'),
        summary: t('scenes.stones.lesson.items.boulderField.summary'),
        text: t('scenes.stones.lesson.items.boulderField.text'),
        icon: icon(Symbols.triangles(12, 5, 76, 40, 15, 5)),
        show: (o, motion) => raise(o, motion, boulderField(o)),
      },
      {
        name: t('scenes.stones.lesson.items.bedrock.name'),
        summary: t('scenes.stones.lesson.items.bedrock.summary'),
        text: t('scenes.stones.lesson.items.bedrock.text'),
        icon: icon(`<rect x="14" y="8" width="72" height="34" rx="12" fill="${Symbols.BEDROCK}"/>`),
        show: (o, motion) => raise(o, motion, [bedrock(o)]),
      },
      {
        name: t('scenes.stones.lesson.items.cliff.name'),
        summary: t('scenes.stones.lesson.items.cliff.summary'),
        text: t('scenes.stones.lesson.items.cliff.text'),
        icon: icon(Symbols.cliff(12, 20, 88, 20, 2)),
        camera: { position: [-1, 3.5, 21], gaze: [1, 3.6, -3] },
        show: (o, motion) => raise(o, motion, [cliffWall(o)]),
      },
    ],
  },

  // Orienteering map (ISOM 201–214): stones are black dots and stony ground black triangles, bare
  // rock is grey. A cliff is a black line: over a thin line you can climb, but not over a thick one
  // with spikes.
  orienteering: {
    lesson: {
      title: t('scenes.stones.orienteeringLesson.title'),
      instruction: t('scenes.stones.orienteeringLesson.instruction'),
      stage: { camera: [0, 3, 12], gaze: [1.2, 1.4, -1], fox: 1.9, foxPosition: [-4, 3.5] },
      items: [
        {
          name: t('scenes.stones.orienteeringLesson.items.stones.name'),
          summary: t('scenes.stones.orienteeringLesson.items.stones.summary'),
          text: t('scenes.stones.orienteeringLesson.items.stones.text'),
          icon: icon(`${Orienteering.stone(36, 25, 3)}${Orienteering.smallStone(66, 27, 3)}`),
          show: (o, motion) =>
            raise(o, motion, [...bigStone(o), o.add(o.models.rock(0.9, 3), [7, 0.5])]),
        },
        {
          name: t('scenes.stones.orienteeringLesson.items.stoneField.name'),
          summary: t('scenes.stones.orienteeringLesson.items.stoneField.summary'),
          text: t('scenes.stones.orienteeringLesson.items.stoneField.text'),
          icon: icon(Symbols.triangles(12, 5, 76, 40, 10, 6)),
          show: (o, motion) => raise(o, motion, boulderField(o)),
        },
        {
          name: t('scenes.stones.orienteeringLesson.items.bedrock.name'),
          summary: t('scenes.stones.orienteeringLesson.items.bedrock.summary'),
          text: t('scenes.stones.orienteeringLesson.items.bedrock.text'),
          icon: icon(
            `<rect x="14" y="8" width="72" height="34" rx="12" fill="${Orienteering.COLORS.rock}"/>`,
          ),
          show: (o, motion) => raise(o, motion, [bedrock(o)]),
        },
        {
          name: t('scenes.stones.orienteeringLesson.items.lowCliff.name'),
          summary: t('scenes.stones.orienteeringLesson.items.lowCliff.summary'),
          text: t('scenes.stones.orienteeringLesson.items.lowCliff.text'),
          icon: icon(
            `<path d="M12,25 H88" stroke="${Orienteering.COLORS.black}" stroke-width="2.4" stroke-linecap="round"/>`,
          ),
          show: (o, motion) => climb(o, motion, 1.4),
        },
        {
          name: t('scenes.stones.orienteeringLesson.items.highCliff.name'),
          summary: t('scenes.stones.orienteeringLesson.items.highCliff.summary'),
          text: t('scenes.stones.orienteeringLesson.items.highCliff.text'),
          icon: icon(
            Orienteering.cliff(
              [
                [12, 20],
                [88, 20],
              ],
              2.4,
            ),
          ),
          camera: { position: [-1, 3.5, 21], gaze: [1, 3.6, -3] },
          show: (o, motion) => raise(o, motion, [cliffWall(o)]),
        },
      ],
    },
  },
};

// ---------- Lesson panel: stones and rock on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}

// The big stone is the same model as on the shore of Foxwood (about 2.4 m high).
const bigStone = (o: LessonStage) => [o.add(World.models.stone(), [2.5, -1])];

// Stony ground: many small stones side by side.
function stonyGround(o: LessonStage) {
  const r = o.models.seeded(3);
  const stones = [];
  for (let z = -6; z <= 2.5; z += 0.9) {
    for (let x = -1; x <= 9; x += 0.9) {
      const k = o.models.rock(0.25 + r() * 0.35, stones.length);
      stones.push(o.add(k, [x + (r() - 0.5) * 0.6, z + (r() - 0.5) * 0.6], r() * 360));
    }
  }
  return stones;
}

// Boulder field: a few huge boulders with gaps between them.
function boulderField(o: LessonStage) {
  return [
    [-0.5, -5, 2.4],
    [4.5, -7, 3.2],
    [9.5, -4, 2.6],
    [2, 0.2, 1.6],
    [6.8, 0.8, 2],
    [11, 2.5, 1.4],
  ].map(([x, z, size], i) => o.add(o.models.rock(size, i + 2), [x, z], i * 50));
}

// Bare rock: a low, smooth, reddish-grey mound with a little moss and lichen.
function bedrock(o: LessonStage) {
  const { mesh, group, castShadows } = o.models;
  const mound = mesh(new THREE.IcosahedronGeometry(1, 2), '#A89B95');
  mound.scale.set(6.5, 1.8, 4.5);
  const g = group(mound);
  for (const [x, z, r] of [
    [-6.6, 1.2, 0.9],
    [6.2, 1.8, 0.8],
    [0.5, 4.6, 0.7],
  ] as Vec3[]) {
    const moss = mesh(new THREE.CylinderGeometry(r, r, 0.1, 9), '#7E9A4E', x, 0.05, z);
    moss.scale.z = 0.5;
    g.add(moss);
  }
  for (const [x, y, z] of [
    [-1.5, 1.55, 1.8],
    [2.5, 1.3, 2.4],
    [-3.4, 1.1, 2.6],
  ] as Vec3[]) {
    const lichen = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 8), '#DADCC0', x, y, z);
    lichen.rotation.x = 0.4;
    g.add(lichen);
  }
  return o.add(castShadows(g), [4, -2.5]);
}

// Cliff: a rock wall behind the fox with forest growing on top of it. The wall faces the viewer.
// The ragged front edge of the wall is at about z = -4.
const WALL_Z = -4;
function cliffWall(o: LessonStage, HEIGHT = 7) {
  const { mesh, group, castShadows, spruce } = o.models;
  // Floor plan (x, z): the south edge of the wall is ragged.
  const outline = [
    [-40, 0],
    [-12, 0.4],
    [-9, -0.5],
    [-6, 0.6],
    [-3, -0.3],
    [0, 0.8],
    [3, 0],
    [5.5, 0.7],
    [8, -0.4],
    [11, 0.5],
    [14, -0.2],
    [40, 0.3],
  ];
  const shape = new THREE.Shape(
    [...outline, [40, -20], [-40, -20]].map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  const wall = mesh(
    new THREE.ExtrudeGeometry(shape, { depth: HEIGHT, bevelEnabled: false }).rotateX(-Math.PI / 2),
    '#8C8A84',
  );
  // There is moss and forest on top.
  const top = mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }).rotateX(-Math.PI / 2),
    '#6E9A4E',
    0,
    HEIGHT,
    0,
  );
  const g = group(wall, top);
  // There are fallen stones at the foot.
  [
    [-5, 1.6, 0.6],
    [2, 1.8, 0.8],
    [7, 1.4, 0.5],
    [9.5, 2.2, 0.4],
  ].forEach(([x, z, k], i) => {
    const k3 = o.models.rock(k, i + 5);
    k3.position.set(x, 0, z);
    g.add(k3);
  });
  const r = o.models.seeded(4);
  for (let x = -24; x <= 26; x += 3.5) {
    const tree = spruce(5 + r() * 3);
    tree.position.set(x + r() * 2, HEIGHT + 0.2, -2.5 - r() * 6);
    g.add(tree);
  }
  return o.add(castShadows(g), [2, WALL_Z]);
}

// The fox climbs a low cliff: it walks to the foot of the wall and leaps up.
async function climb(o: LessonStage, motion: number, height: number) {
  const { fox } = o;
  const x = -1.5;
  await raise(o, motion, [cliffWall(o, height)]);
  if (!motion) return o.foxTo(x, WALL_Z - 1.6, height);
  o.turn(90);
  fox.poses.set('walking');
  await o.animate(1100, (t) => o.foxTo(-4 + (x + 4) * t, 3.5 + (WALL_Z + 1.2 - 3.5) * t));
  fox.poses.set();
  await o.animate(650, (t) =>
    o.foxTo(
      x,
      WALL_Z + 1.2 - 2.8 * t,
      height * t + 1.2 * Math.sin(Math.PI * t),
      -20 * Math.sin(Math.PI * t),
    ),
  );
  fox.poses.set('facingViewer', 'cheering');
}

// A stone or rock rises from the ground, and the fox wonders.
async function raise(o: LessonStage, motion: number, targets: THREE.Object3D[], stagger = 0.12) {
  if (motion) o.fox.poses.set('curious');
  await o.grow(targets, motion, 800, stagger);
  if (motion) await o.pause(250);
  o.fox.poses.set('facingViewer');
}

export { scene as stones };
