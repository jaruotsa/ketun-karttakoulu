// Small features scene (orienteering map only): the fox walks in the forest south of the path,
// peeks into a pit, climbs a knoll and finally sniffs an ant nest. They are the small brown terrain
// features of the orienteering map. The features and their signs are in the
// Orienteering.SMALL_FEATURES object (orienteering.ts), and the 3D terrain builds them (world.ts:
// the knoll and the pit are landforms, the ant nest is a model). Fences have their own page
// (fences.ts).
//
// The fox stops at each feature (terrain.stops). The map sign of the feature is shown above it, and
// on the map the same sign grows for a moment on top of the fox's map sign.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { World } from '../world';
import type { Pose } from '../fox';
import { t } from '../i18n';
import type { Scene, SceneContext } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const S = Orienteering;
const P = S.SMALL_FEATURES;
const V = S.COLORS;
const SVG_NS = 'http://www.w3.org/2000/svg';

// The stops on the route: at the edge of the pit and at the top of the knoll.
const STOPS: Point[] = [
  [171, 337],
  [198, 348],
];
// Which feature each stop looks at, and the position of the feature (gaze and signs).
type SmallId = 'pit' | 'knoll' | 'antNest';
const FEATURES: SmallId[] = ['pit', 'knoll'];
const SPOTS: Record<SmallId, Point> = { pit: P.pit, knoll: P.knoll, antNest: P.antNest };

// Map signs centred at (0, 0).
const SIGN_ICONS: Record<SmallId, (s: number) => string> = {
  pit: (s: number) => S.pit(0, 0, s * 1.3),
  knoll: (s: number) => S.knollRing(0, 0, s * 1.3),
  antNest: (s: number) => S.antNest(0, 0, s * 1.3),
};
const signCircle = (id: SmallId) => `<g class="small-marker" data-id="${id}" opacity="0">
  <circle r="22" fill="#fff" stroke="${V.brown}" stroke-width="3"/>${SIGN_ICONS[id](2)}</g>`;
const SIGN_SCALE = 0.1; // the size of the sign in the terrain (m / SVG unit)
const SIGN_LIFT = 7.5;

// The ants and the final camera shot (south-west, gazing between the fox and the nest).
let ants: ReturnType<typeof Creatures.ants> | null = null,
  stopAnts: (() => void) | null = null;
const NEST_DISTANCE = 7.2; // the fox's distance from the centre of the nest (m)
function finalShot(terrain: Terrain) {
  const [x0, y0] = terrain.routePoint(1);
  const [px, py] = P.antNest;
  const [mx, my] = [(x0 + px) / 2, (y0 + py) / 2];
  const h = (x: number, y: number) => terrain.world.heightAt(x, y);
  return {
    position: [mx - 17, my + 17, h(mx - 17, my + 17) + 12] as Vec3,
    target: [mx, my, h(mx, my) + 1.5] as Vec3,
  };
}
function foxSpot(terrain: Terrain) {
  const [x0, y0] = terrain.routePoint(1);
  const [px, py] = P.antNest;
  const d = Math.hypot(px - x0, py - y0);
  return [px - ((px - x0) / d) * NEST_DISTANCE, py - ((py - y0) / d) * NEST_DISTANCE];
}

const scene: Scene = {
  map: Foxwood.map({
    // From the start of the path into the forest east, to the edge of the pit and to the top of the
    // knoll.
    route:
      'M30,345 C60,354 110,354 140,349 C155,346 165,341 171,337 C176,342 188,348 198,348 C202,349 203,351 203,354',
    name: t('scenes.smallFeatures.mapLabel'),
    namePosition: [165, 268],
    nameColor: V.brown,
  }),
  feature: 'smallFeatures',
  // The highlight goes around the ant nest that the fox is at at the end.
  highlight: `M${P.antNest[0] - 12},${P.antNest[1]} a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 Z`,

  terrain: {
    camera: { behind: 34, height: 17, ahead: 8, direction: [0, -50], turnAt: 0.9, fox: 5 },
    duration: 7000,
    stops: STOPS,
    overlay: [...FEATURES, 'antNest' as const].map(signCircle).join(''),

    async atStop(n, { terrainSvg, mapSvg, fox, wait, terrain }) {
      const id = FEATURES[n];
      const [kx, ky] = SPOTS[id];
      const [x, y] = STOPS[n];
      terrain.turnFox(kx, ky);
      const pose: Pose = id === 'pit' ? 'curious' : 'facingViewer';
      fox.poses.add(pose);
      // At the edge of the pit the fox peeks down.
      if (id === 'pit') await animate(400, (t) => terrain.moveFox(x, y, 0, 22 * t));
      if (id === 'knoll') fox.poses.add('cheering');
      await showSign(id, { terrainSvg, mapSvg, terrain });
      await wait(900);
      if (id === 'pit') await animate(300, (t) => terrain.moveFox(x, y, 0, 22 * (1 - t)));
      fox.poses.remove(pose, 'cheering');
      hideSign(id, { terrainSvg, mapSvg });
      terrain.draw();
    },

    // The fox walks to the ant nest and sniffs. The ants scurry out, and the fox leaps further
    // away.
    async arrive({ terrainSvg, mapSvg, fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      const [x1, y1] = foxSpot(terrain);
      const [px, py] = P.antNest;
      const { position, target } = finalShot(terrain);
      fox.poses.add('walking');
      await animate(1300, (t) => {
        terrain.moveFox(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        terrain.fly(t * t * (3 - 2 * t), position, target);
      });
      fox.poses.remove('walking');
      terrain.turnFox(px, py);
      fox.poses.add('curious');
      await animate(400, (t) => terrain.moveFox(x1, y1, 0, 16 * t));
      const shown = showSign('antNest', { terrainSvg, mapSvg, terrain });
      // The ants come out.
      const start = performance.now() / 1000;
      stopAnts?.();
      stopAnts = terrain.everyFrame((time) =>
        ants!.update(time, Math.min(1, (time - start) / 1.6)),
      );
      await shown;
      await wait(700);
      // The fox leaps backwards and shakes its paws.
      fox.poses.remove('curious');
      fox.poses.add('facingViewer');
      const d = Math.hypot(px - x1, py - y1);
      const [ux, uy] = [(px - x1) / d, (py - y1) / d];
      await animate(500, (t) =>
        terrain.moveFox(
          x1 - ux * 4 * t,
          y1 - uy * 4 * t,
          2.2 * Math.sin(Math.PI * t),
          16 * (1 - t) - 12 * Math.sin(Math.PI * t),
        ),
      );
      for (let i = 0; i < 2; i++) {
        fox.poses.add('pawUp');
        await wait(280);
        fox.poses.remove('pawUp');
        await wait(220);
      }
    },

    reset(terrainSvg, terrain, mapSvg) {
      // A gap at the route (as in sign-3d.ts), at the fox's path to the nest and in the line of
      // sight from the camera.
      const route = Array.from({ length: 301 }, (_, i) => terrain.routePoint(i / 300));
      const [x0, y0] = terrain.routePoint(1);
      const [x1, y1] = foxSpot(terrain);
      const [cx, cy] = finalShot(terrain).position;
      const linePoints = ([ax, ay]: Point, [bx, by]: Point) =>
        Array.from(
          { length: 16 },
          (_, i): Point => [ax + ((bx - ax) * i) / 15, ay + ((by - ay) * i) / 15],
        );
      terrain.world.clearing(
        [
          ...route,
          ...linePoints([x0, y0], [x1, y1]),
          ...linePoints([cx, cy], [x1, y1]),
          ...linePoints([cx, cy], P.antNest),
        ],
        6,
      );
      ants ??= Creatures.ants();
      stopAnts?.();
      stopAnts = null;
      ants.update(0, 0);
      terrain.place(ants, ...P.antNest);
      terrainSvg
        .querySelectorAll('.small-marker')
        .forEach((el) => el.setAttribute('opacity', String(0)));
      // The enlarged signs of the map are on top of the fox's map sign, so they are added at the
      // end of the map.
      if (!mapSvg.querySelector('.small-lift')) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.innerHTML = (Object.keys(SIGN_ICONS) as SmallId[])
          .map((id) => {
            const [x, y] = enlargedSpot(id);
            return `<g class="small-lift" data-id="${id}" opacity="0" transform="translate(${x} ${y})">
            <circle r="15" fill="#fff" stroke="${V.brown}" stroke-width="2.5"/>${SIGN_ICONS[id](1.2)}</g>`;
          })
          .join('');
        mapSvg.appendChild(g);
      }
      mapSvg.querySelectorAll('.small-lift').forEach((el) => el.setAttribute('opacity', String(0)));
    },
  },

  orienteering: {
    lesson: {
      title: t('scenes.smallFeatures.orienteeringLesson.title'),
      instruction: t('scenes.smallFeatures.orienteeringLesson.instruction'),
      stage: { camera: [1.5, 3.4, 10], gaze: [1.8, 0.6, -1], fox: 1.5, foxPosition: [-2.5, 2] },
      items: [
        {
          name: t('scenes.smallFeatures.orienteeringLesson.items.antNest.name'),
          summary: t('scenes.smallFeatures.orienteeringLesson.items.antNest.summary'),
          text: t('scenes.smallFeatures.orienteeringLesson.items.antNest.text'),
          icon: icon(S.antNest(50, 27, 4)),
          show: antNestLesson,
        },
        {
          name: t('scenes.smallFeatures.orienteeringLesson.items.knoll.name'),
          summary: t('scenes.smallFeatures.orienteeringLesson.items.knoll.summary'),
          text: t('scenes.smallFeatures.orienteeringLesson.items.knoll.text'),
          icon: icon(`${S.knollRing(38, 25, 3.2)}${S.knoll(74, 25, 2.2)}`),
          show: knollLesson,
        },
        {
          name: t('scenes.smallFeatures.orienteeringLesson.items.pit.name'),
          summary: t('scenes.smallFeatures.orienteeringLesson.items.pit.summary'),
          text: t('scenes.smallFeatures.orienteeringLesson.items.pit.text'),
          icon: icon(S.pit(50, 25, 4)),
          show: pitLesson,
        },
      ],
    },
  },
};

// The map sign rises above the feature in the terrain and grows on the map.
async function showSign(
  id: SmallId,
  { terrainSvg, mapSvg, terrain }: Pick<SceneContext, 'terrainSvg' | 'mapSvg' | 'terrain'>,
) {
  const sign = terrainSvg.querySelector(`.small-marker[data-id="${id}"]`);
  const enlarged = mapSvg.querySelector(`.small-lift[data-id="${id}"]`);
  const [x, y] = SPOTS[id];
  const [nx, ny] = enlargedSpot(id);
  terrain.pin(sign!, x, y, SIGN_LIFT, SIGN_SCALE);
  await animate(350, (t) => {
    sign!.setAttribute('opacity', String(t));
    enlarged!.setAttribute('opacity', String(t));
    enlarged!.setAttribute('transform', `translate(${nx} ${ny}) scale(${0.6 + 0.4 * t})`);
    terrain.draw();
  });
}
// The enlarged sign on the map is at the feature, but fully inside the map.
const enlargedSpot = (id: SmallId): Point => [SPOTS[id][0], Math.min(SPOTS[id][1], 362)];
// The signs are hidden when the fox continues its way.
function hideSign(
  id: SmallId,
  { terrainSvg, mapSvg }: Pick<SceneContext, 'terrainSvg' | 'mapSvg'>,
) {
  terrainSvg.querySelector(`.small-marker[data-id="${id}"]`)!.setAttribute('opacity', String(0));
  mapSvg.querySelector(`.small-lift[data-id="${id}"]`)!.setAttribute('opacity', String(0));
}

// ---------- Lesson panel: small features on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// The Foxwood models are at the scale of the fox (5 m); the fox of the stage is 1.5 m.
const SCALE = 0.32;
const small = <T extends THREE.Object3D>(object: T, size = SCALE): T => {
  object.scale.setScalar(size);
  return object;
};
// The fox turns towards the point (x, z).
function turnTo(o: LessonStage, [x, z]: Point) {
  const { position: p } = o.fox.group;
  o.turn((Math.atan2(-(z - p.z), x - p.x) * 180) / Math.PI);
}
// The fox walks to the point (x, z). lift(t) raises it on the way (a hill, a jump).
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

// Ant nest: the nest rises from the ground, the fox sniffs, the ants come out and the fox leaps
// further away.
async function antNestLesson(o: LessonStage, motion: number) {
  const NEST: Point = [2.4, 0.4];
  const mound = o.add(small(World.models.antNest()), NEST);
  const ants = o.add(small(Creatures.ants()), NEST);
  let amount = motion ? 0 : 1;
  o.everyFrame((time) => ants.update(time, amount));
  await o.grow([mound], motion);
  const sniffAt: Point = [0.6, 1.2],
    further: Point = [-0.6, 1.9];
  if (!motion) {
    o.foxTo(...further);
    turnTo(o, NEST);
    o.fox.poses.set('facingViewer');
    return;
  }
  await walkTo(o, sniffAt, 1300);
  o.fox.poses.set('curious');
  await o.animate(400, (t) => o.foxTo(...sniffAt, 0, 16 * t));
  await o.animate(1400, (t) => (amount = t));
  o.fox.poses.set('facingViewer');
  await o.animate(500, (t) =>
    o.foxTo(
      sniffAt[0] + (further[0] - sniffAt[0]) * t,
      sniffAt[1] + (further[1] - sniffAt[1]) * t,
      0.7 * Math.sin(Math.PI * t),
      16 * (1 - t),
    ),
  );
  for (let i = 0; i < 2; i++) {
    o.fox.poses.set('facingViewer', 'pawUp');
    await o.pause(280);
    o.fox.poses.set('facingViewer');
    await o.pause(220);
  }
}

// Knoll: a small round hill rises from the ground, and the fox climbs to its top.
const KNOLL: { radius: number; height: number; position: Point } = {
  radius: 3.2,
  height: 1,
  position: [2.4, -0.2],
};
function knollHeight(x: number, z: number) {
  const r = Math.hypot(x - KNOLL.position[0], z - KNOLL.position[1]);
  return r < KNOLL.radius ? (KNOLL.height * (1 + Math.cos((Math.PI * r) / KNOLL.radius))) / 2 : 0;
}
async function knollLesson(o: LessonStage, motion: number) {
  const { radius, height, position } = KNOLL;
  const profile = Array.from({ length: 9 }, (_, i) => radius * (1 - i / 8)).map(
    (r) => new THREE.Vector2(r, (height * (1 + Math.cos((Math.PI * r) / radius))) / 2),
  );
  const knollMesh = o.models.castShadows(
    new THREE.Mesh(new THREE.LatheGeometry(profile, 24), o.models.material('#8CB765')),
  );
  o.add(knollMesh, position);
  await o.grow([knollMesh], motion);
  const top: Point = [position[0] - 0.2, position[1] + 0.3];
  if (!motion) {
    o.foxTo(top[0], top[1], knollHeight(top[0], top[1]));
    o.fox.poses.set('facingViewer', 'cheering');
    return;
  }
  await walkTo(o, top, 1800, (_t, x, z) => knollHeight(x, z));
  o.turn(-30);
  o.fox.poses.set('facingViewer', 'cheering');
}

// Pit: a dug pit with its earth bank. The fox walks to the edge and peeks down.
async function pitLesson(o: LessonStage, motion: number) {
  const SPOT: Point = [2.6, 0.6];
  const k = o.add(World.models.pit(1.5, 0, 0.02), SPOT);
  await o.grow([k], motion);
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

export { scene as smallFeatures };
