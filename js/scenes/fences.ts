// Fences scene: the fox walks along the track past the field. At the edge of the field there is an
// old stone wall: the fox jumps on top of it to look around and back to the road. At the yard fence
// the fox stops, and finally it opens the gate, goes into the yard and the gate closes behind it.
//
// Fences are on both maps (Foxwood.FENCES). On the MML map a fence is a thin black line with dots,
// and a stone wall is a fence too (in the topographic database a stone wall is a fence if it is at
// least 1.2 m high). At a gate there are two cross lines. On the orienteering map a fence has
// slanted spikes, a stone wall dots, and a gate is a gap.
//
// At the stops (terrain.stops) the map sign of the feature is shown above it in the terrain, and on
// the map the same sign grows on top of the fox's map sign (as with the small features).
import type * as THREE from 'three';
import * as MapType from '../map-type';
import { Symbols } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene, SceneContext } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const S = Orienteering;
const A = Foxwood.FENCES;
const ORIENTEERING = MapType.current() === 'orienteering';
const SVG_NS = 'http://www.w3.org/2000/svg';

// The stops on the track: at the stone wall and next to the yard fence.
const STOPS: Point[] = [
  [130, 142.3],
  [199, 70],
];
const FEATURES: FenceId[] = ['stoneFence', 'fence'];
type FenceId = 'stoneFence' | 'fence' | 'gate';
// The positions of the features on the map: the spot of the stone wall north of the road, the
// nearest spot of the yard fence and the centre of the gate.
const GATE_CENTER: Point = [(A.gate[0][0] + A.gate[1][0]) / 2, (A.gate[0][1] + A.gate[1][1]) / 2];
const SPOTS: Record<FenceId, Point> = {
  stoneFence: [130, 131.6],
  fence: [210, 66],
  gate: GATE_CENTER,
};
// The fox in the yard behind the gate.
const INSIDE: Point = [GATE_CENTER[0] + 9, GATE_CENTER[1] - 0.5];

// Map signs centred at (0, 0) according to the chosen map type.
const SIGN_ICONS: Record<FenceId, () => string> = ORIENTEERING
  ? {
      stoneFence: () =>
        S.stoneFence(
          [
            [-15, 0],
            [15, 0],
          ],
          0.8,
        ),
      fence: () =>
        S.fence(
          [
            [-15, -2],
            [15, -2],
          ],
          0.8,
        ),
      gate: () =>
        `${S.fence(
          [
            [-15, -2],
            [-4, -2],
          ],
          0.8,
        )}${S.fence(
          [
            [4, -2],
            [15, -2],
          ],
          0.8,
        )}${S.gate([-4, -2], [4, -2], 0.8)}`,
    }
  : {
      stoneFence: () =>
        Symbols.fence(
          [
            [-15, 0],
            [15, 0],
          ],
          1.5,
        ),
      fence: () =>
        Symbols.fence(
          [
            [-15, 0],
            [15, 0],
          ],
          1.5,
        ),
      gate: () =>
        `${Symbols.fence(
          [
            [-15, 0],
            [15, 0],
          ],
          1.5,
        )}${Symbols.gate([-3.5, 0], [3.5, 0], 1.5)}`,
    };
const signCircle = (id: FenceId) => `<g class="fence-marker" data-id="${id}" opacity="0">
  <circle r="22" fill="#fff" stroke="#444" stroke-width="3"/>${SIGN_ICONS[id]()}</g>`;
const SIGN_SCALE = 0.1; // the size of the sign in the terrain (m / SVG unit)
const SIGN_LIFT = 7.5;

// The final camera south-west of the gate: the gate, the yard and the house are visible.
function finalShot(terrain: Terrain) {
  const h = (x: number, y: number) => terrain.world.heightAt(x, y);
  const [px, py] = [GATE_CENTER[0] - 24, GATE_CENTER[1] + 22];
  return {
    position: [px, py, h(px, py) + 13] as Vec3,
    gaze: [GATE_CENTER[0] + 4, GATE_CENTER[1] - 2, h(GATE_CENTER[0], GATE_CENTER[1]) + 2] as Vec3,
  };
}

const scene: Scene = {
  map: Foxwood.map({
    // Along the track past the field to the gate of the yard.
    route:
      'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 197,70 198,56 C199,50 200,47 203,46',
    name: t('scenes.fences.mapLabel'),
    namePosition: [300, 100],
    nameColor: '#444444',
  }),
  feature: 'fences',

  terrain: {
    camera: { behind: 44, height: 21, ahead: 12, direction: [0, -45], turnAt: 0.9, fox: 5 },
    duration: 6500,
    stops: STOPS,
    overlay: (['stoneFence', 'fence', 'gate'] as const).map(signCircle).join(''),

    async atStop(n, { terrainSvg, mapSvg, fox, wait, terrain }) {
      const id = FEATURES[n];
      const [kx, ky] = SPOTS[id];
      const [x, y] = STOPS[n];
      terrain.turnFox(kx, ky);
      if (id === 'stoneFence') {
        // A jump on top of the stone wall, a look around and back to the road.
        const RIDGE = 1.5;
        await animate(600, (t) =>
          terrain.moveFox(
            x + (kx - x) * t,
            y + (ky - y) * t,
            RIDGE * t + 2.5 * Math.sin(Math.PI * t),
            -15 * Math.sin(Math.PI * t),
          ),
        );
        fox.poses.add('facingViewer', 'cheering');
        await showSign(id, { terrainSvg, mapSvg, terrain });
        await wait(1000);
        fox.poses.remove('facingViewer', 'cheering');
        terrain.turnFox(x, y + 5);
        await animate(600, (t) =>
          terrain.moveFox(
            kx + (x - kx) * t,
            ky + (y - ky) * t,
            RIDGE * (1 - t) + 2.5 * Math.sin(Math.PI * t),
            10 * Math.sin(Math.PI * t),
          ),
        );
      } else {
        fox.poses.add('pawUp');
        await showSign(id, { terrainSvg, mapSvg, terrain });
        await wait(900);
        fox.poses.remove('pawUp');
      }
      hideSign(id, { terrainSvg, mapSvg });
      terrain.draw();
    },

    // The gate opens, the fox walks into the yard, and the gate closes behind it.
    async arrive({ terrainSvg, mapSvg, fox, wait, terrain }) {
      const { gate } = terrain.world;
      const [x0, y0] = terrain.routePoint(1);
      const { position, gaze } = finalShot(terrain);
      terrain.turnFox(...GATE_CENTER);
      fox.poses.add('pawUp');
      await animate(900, (t) => {
        gate.open(t * t * (3 - 2 * t));
        terrain.fly(t * t * (3 - 2 * t), position, gaze);
      });
      fox.poses.remove('pawUp');
      fox.poses.add('walking');
      await animate(1300, (t) =>
        terrain.moveFox(x0 + (INSIDE[0] - x0) * t, y0 + (INSIDE[1] - y0) * t),
      );
      fox.poses.remove('walking');
      terrain.turnFox(...GATE_CENTER);
      await animate(700, (t) => {
        gate.open(1 - t * t * (3 - 2 * t));
        terrain.draw();
      });
      await showSign('gate', { terrainSvg, mapSvg, terrain });
      await wait(600);
    },

    reset(terrainSvg, terrain, mapSvg) {
      // A gap at the route (as in sign-terrain.ts) and in the line of sight from the camera to the
      // gate.
      const route = Array.from({ length: 301 }, (_, i) => terrain.routePoint(i / 300));
      const [cx, cy] = finalShot(terrain).position;
      const line = ([ax, ay]: Point, [bx, by]: Point) =>
        Array.from(
          { length: 16 },
          (_, i): Point => [ax + ((bx - ax) * i) / 15, ay + ((by - ay) * i) / 15],
        );
      terrain.world.clearing([...route, ...line([cx, cy], GATE_CENTER)], 6);
      terrain.world.gate.open(0);
      terrainSvg
        .querySelectorAll('.fence-marker')
        .forEach((el) => el.setAttribute('opacity', String(0)));
      // The enlarged signs of the map are on top of the fox's map sign, so they are added at the
      // end of the map.
      if (!mapSvg.querySelector('.fence-lift')) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.innerHTML = (Object.keys(SIGN_ICONS) as FenceId[])
          .map(
            (
              id,
            ) => `<g class="fence-lift" data-id="${id}" opacity="0" transform="translate(${SPOTS[id]})">
            <circle r="16" fill="#fff" stroke="#444" stroke-width="2.5"/><g transform="scale(0.62)">${SIGN_ICONS[id]()}</g></g>`,
          )
          .join('');
        mapSvg.appendChild(g);
      }
      mapSvg.querySelectorAll('.fence-lift').forEach((el) => el.setAttribute('opacity', String(0)));
    },
  },

  // MML map: fence, stone wall (the same sign), gate and hedge.
  lesson: {
    title: t('scenes.fences.lesson.title'),
    instruction: t('scenes.fences.lesson.instruction'),
    stage: { camera: [1.5, 3.4, 10], gaze: [1.8, 0.6, -1], fox: 1.5, foxPosition: [-2.5, 2] },
    items: [
      {
        name: t('scenes.fences.lesson.items.fence.name'),
        summary: t('scenes.fences.lesson.items.fence.summary'),
        text: t('scenes.fences.lesson.items.fence.text'),
        icon: icon(
          Symbols.fence(
            [
              [10, 25],
              [90, 25],
            ],
            2.2,
          ),
        ),
        show: fenceLesson,
      },
      {
        name: t('scenes.fences.lesson.items.stoneWall.name'),
        summary: t('scenes.fences.lesson.items.stoneWall.summary'),
        text: t('scenes.fences.lesson.items.stoneWall.text'),
        icon: icon(
          Symbols.fence(
            [
              [10, 25],
              [90, 25],
            ],
            2.2,
          ),
        ),
        show: stoneFenceLesson,
      },
      {
        name: t('scenes.fences.lesson.items.gate.name'),
        summary: t('scenes.fences.lesson.items.gate.summary'),
        text: t('scenes.fences.lesson.items.gate.text'),
        icon: icon(
          `${Symbols.fence(
            [
              [10, 25],
              [90, 25],
            ],
            2.2,
          )}${Symbols.gate([45, 25], [55, 25], 2.2)}`,
        ),
        show: gateLesson,
      },
      {
        name: t('scenes.fences.lesson.items.hedge.name'),
        summary: t('scenes.fences.lesson.items.hedge.summary'),
        text: t('scenes.fences.lesson.items.hedge.text'),
        icon: icon(
          `<g fill="#2BA64A">${Array.from({ length: 9 }, (_, i) => `<circle cx="${14 + i * 9}" cy="25" r="2.6"/>`).join('')}</g>`,
        ),
        show: hedgeLesson,
      },
    ],
  },

  // Orienteering map: fence, high fence, stone wall and gate (ISOM 516–519).
  orienteering: {
    lesson: {
      title: t('scenes.fences.orienteeringLesson.title'),
      instruction: t('scenes.fences.orienteeringLesson.instruction'),
      stage: { camera: [1.5, 3.4, 10], gaze: [1.8, 0.6, -1], fox: 1.5, foxPosition: [-2.5, 2] },
      items: [
        {
          name: t('scenes.fences.orienteeringLesson.items.fence.name'),
          summary: t('scenes.fences.orienteeringLesson.items.fence.summary'),
          text: t('scenes.fences.orienteeringLesson.items.fence.text'),
          icon: icon(
            S.fence(
              [
                [10, 22],
                [90, 22],
              ],
              2,
            ),
          ),
          show: fenceLesson,
        },
        {
          name: t('scenes.fences.orienteeringLesson.items.highFence.name'),
          summary: t('scenes.fences.orienteeringLesson.items.highFence.summary'),
          text: t('scenes.fences.orienteeringLesson.items.highFence.text'),
          icon: icon(
            S.fence(
              [
                [10, 22],
                [90, 22],
              ],
              2,
              true,
            ),
          ),
          show: highFenceLesson,
        },
        {
          name: t('scenes.fences.orienteeringLesson.items.stoneWall.name'),
          summary: t('scenes.fences.orienteeringLesson.items.stoneWall.summary'),
          text: t('scenes.fences.orienteeringLesson.items.stoneWall.text'),
          icon: icon(
            S.stoneFence(
              [
                [10, 25],
                [90, 25],
              ],
              2,
            ),
          ),
          show: stoneFenceLesson,
        },
        {
          name: t('scenes.fences.orienteeringLesson.items.gate.name'),
          summary: t('scenes.fences.orienteeringLesson.items.gate.summary'),
          text: t('scenes.fences.orienteeringLesson.items.gate.text'),
          icon: icon(
            `${S.fence(
              [
                [10, 22],
                [42, 22],
              ],
              2,
            )}${S.fence(
              [
                [58, 22],
                [90, 22],
              ],
              2,
            )}${S.gate([42, 22], [58, 22], 2)}`,
          ),
          show: gateLesson,
        },
      ],
    },
  },
};

// The map sign rises above the feature in the terrain and grows on the map.
async function showSign(
  id: FenceId,
  { terrainSvg, mapSvg, terrain }: Pick<SceneContext, 'terrainSvg' | 'mapSvg' | 'terrain'>,
) {
  const merkki = terrainSvg.querySelector(`.fence-marker[data-id="${id}"]`);
  const nosto = mapSvg.querySelector(`.fence-lift[data-id="${id}"]`);
  const [x, y] = SPOTS[id];
  terrain.pin(merkki!, x, y, SIGN_LIFT, SIGN_SCALE);
  await animate(350, (t) => {
    merkki!.setAttribute('opacity', String(t));
    nosto!.setAttribute('opacity', String(t));
    nosto!.setAttribute('transform', `translate(${x} ${y}) scale(${0.6 + 0.4 * t})`);
    terrain.draw();
  });
}
// The signs are hidden when the fox continues its way.
function hideSign(
  id: FenceId,
  { terrainSvg, mapSvg }: Pick<SceneContext, 'terrainSvg' | 'mapSvg'>,
) {
  terrainSvg.querySelector(`.fence-marker[data-id="${id}"]`)!.setAttribute('opacity', String(0));
  mapSvg.querySelector(`.fence-lift[data-id="${id}"]`)!.setAttribute('opacity', String(0));
}

// ---------- Lesson panel: fences on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// The Foxwood models are at the scale of the fox (5 m); the fox of the stage is 1.5 m.
const SCALE = 0.45;
const small = <T extends THREE.Object3D>(object: T): T => {
  object.scale.setScalar(SCALE);
  return object;
};
const straight = (length: number): Point[] => [
  [-length / 2, 0],
  [length / 2, 0],
];
// The fox turns towards the point (x, z).
function turnTo(o: LessonStage, [x, z]: Point) {
  const { position: p } = o.fox.group;
  o.turn((Math.atan2(-(z - p.z), x - p.x) * 180) / Math.PI);
}
// The fox walks to the point (x, z). lift(t, x, z) raises it on the way (a jump).
async function walkTo(
  o: LessonStage,
  target: Point,
  duration: number,
  lift: (...a: number[]) => number = () => 0,
) {
  const { x, z } = o.fox.group.position;
  turnTo(o, target);
  o.fox.poses.set('walking');
  await o.animate(duration, (t) => {
    const [px, pz] = [x + (target[0] - x) * t, z + (target[1] - z) * t];
    o.foxTo(px, pz, lift(t, px, pz));
  });
  o.fox.poses.remove('walking');
}
// Final pose: the fox looks at the viewer and rejoices.
function finish(o: LessonStage, target: Point, motion: number) {
  if (!motion) o.foxTo(...target);
  o.turn(-20);
  o.fox.poses.set('facingViewer', ...(motion ? (['cheering'] as const) : []));
}

// Fence: a wooden fence rises from the ground behind the fox, and the fox walks along it.
async function fenceLesson(o: LessonStage, motion: number) {
  const a = o.add(small(World.models.fence(straight(18))), [2, 0.4]);
  await o.grow([a], motion);
  if (motion) await walkTo(o, [4.4, 2], 2600);
  finish(o, [4.4, 2], motion);
}

// Stone wall: a low stone wall rises at an angle in front of the fox, and the fox jumps over it.
const SLANT: { center: Point; rotation: number } = { center: [1.4, 2], rotation: 50 };
async function stoneFenceLesson(o: LessonStage, motion: number) {
  const a = o.add(small(World.models.stoneWall(straight(15))), SLANT.center, SLANT.rotation);
  await o.grow([a], motion);
  if (motion)
    await walkTo(o, [4.8, 2], 2200, (_t, x) => Math.max(0, 1 - ((x - SLANT.center[0]) / 1.3) ** 2));
  finish(o, [4.8, 2], motion);
}

// High fence: a high wooden fence rises at an angle in front of the fox. The fox stops, looks up
// and turns back.
async function highFenceLesson(o: LessonStage, motion: number) {
  const a = o.add(
    small(World.models.fence(straight(15), () => 0, 4.6)),
    SLANT.center,
    SLANT.rotation,
  );
  await o.grow([a], motion);
  const front: Point = [-0.6, 2.6];
  if (!motion) {
    o.foxTo(...front);
    turnTo(o, SLANT.center);
    o.fox.poses.set('curious');
    return;
  }
  await walkTo(o, front, 1400);
  o.fox.poses.set('curious');
  await o.pause(900);
  o.turn(-120);
  o.fox.poses.set('facingViewer');
}

// Gate: a slanted fence with a gate in the middle. The gate opens, the fox walks through and the
// gate closes.
async function gateLesson(o: LessonStage, motion: number) {
  const WIDTH = 7;
  const gateGroup = o.models.group(
    World.models.fence([
      [-8, 0],
      [-WIDTH / 2, 0],
    ]),
    World.models.fence([
      [WIDTH / 2, 0],
      [8, 0],
    ]),
  );
  const leaf = World.models.gate(WIDTH);
  leaf.position.x = -WIDTH / 2;
  gateGroup.add(leaf);
  o.add(small(gateGroup), SLANT.center, SLANT.rotation);
  await o.grow([gateGroup], motion);
  const through: Point = [4.8, 2];
  if (!motion) {
    finish(o, through, 0);
    return;
  }
  await o.animate(700, (t) => leaf.open(t * t * (3 - 2 * t)));
  await walkTo(o, through, 2000);
  await o.animate(600, (t) => leaf.open(1 - t * t * (3 - 2 * t)));
  finish(o, through, motion);
}

// Hedge: a dense row of bushes rises behind the fox, and the fox walks along it.
async function hedgeLesson(o: LessonStage, motion: number) {
  const bushes = Array.from({ length: 14 }, (_, i) =>
    o.add(o.models.shrub(1.3 + 0.15 * ((i * 7) % 3)), [-6 + i * 1.2, -0.6], i * 47),
  );
  await o.grow(bushes, motion, 700, 0.05);
  if (motion) await walkTo(o, [4.4, 2], 2600);
  finish(o, [4.4, 2], motion);
}

export { scene as fences };
