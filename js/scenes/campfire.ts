// Campfire scene: the fox walks along the path to the campfire site on the lakeshore. The fire
// lights up, and the fox roasts a sausage.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The campfire site is at the end of the
// path on the lakeshore, south of the path. The fox steps from the path next to the fire, and Fox
// Lake is visible in the background. The stones, trees, flames and sparks of the fire are 3D
// models.
//
// The lesson panel gathers the outdoor-life signs of the topo map (MML legend): campfire site,
// nature reserve, significant natural feature, sports and recreation area and park.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Symbols } from '../symbols';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { LessonStage, StageSettings } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const CAMPFIRE = Foxwood.CAMPFIRE;
// The fox stands west of the fire, so that the sausage stick reaches the fire.
const FOX_SPOT = [CAMPFIRE[0] - 7, CAMPFIRE[1] - 1];
// The flames and sparks are 3D (creatures.ts), the flames about 2.5 m high. They flicker all the
// time while the fire burns.
let flames: ReturnType<typeof Creatures.flames> | null = null;
let stopFlicker: (() => void) | null = null;
// Lesson panel: the colours on the topo map (MML legend), the line the fox walks from left to right
// and the stage.
const MML = {
  reserve: '#007945',
  recreation: '#E7EA97',
  park: '#B3D383',
  black: '#1A1919',
};
const FOX_Z = 3;
const STAGE: StageSettings = {
  camera: [3, 5.5, 16],
  gaze: [4, 0.5, -2],
  fox: 1.5,
  foxPosition: [-3, FOX_Z],
};

// Sausage stick: a 3D stick from the fox's mouth over the fire. The ends of the stick are computed
// on every frame: the mouth moves with the fox's head, and the sausage stays above the flames even
// when the fox turns to look at the camera. The sizes are in metres (the fox and the fire are
// exaggerated in size).
const MOUTH: Vec3 = [0.44, -0.08, 0]; // the mouth in the fox's head group (fox.ts, model units)
const SAUSAGE_HEIGHT = 1.4; // height of the sausage above the fire (m)
let sausageStick: ReturnType<typeof makeSausageStick> | null = null;
function makeSausageStick(terrain: Terrain) {
  const { world, fox, stage } = terrain;
  const material = (color: string) =>
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), material('#8A6440'));
  const sausage = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), material('#D0654A'));
  const group = new THREE.Group();
  group.add(stick, sausage);
  world.scene.add(group);
  const up = new THREE.Vector3(0, 1, 0);
  const mouth = new THREE.Vector3();
  // The sausage is slightly on the fox's side of the middle of the fire, above the flames.
  const fire = world.toWorld(...CAMPFIRE);
  const point = world.toWorld(CAMPFIRE[0] - 1.2, CAMPFIRE[1] - 0.2);
  point.y = fire.y + SAUSAGE_HEIGHT;
  stage.beforeDraw.push(() => {
    if (!group.parent) return;
    fox.head.localToWorld(mouth.set(...MOUTH));
    const direction = point.clone().sub(mouth);
    stick.position.copy(mouth).addScaledVector(direction, 0.5);
    stick.scale.y = direction.length();
    stick.quaternion.setFromUnitVectors(up, direction.normalize());
    sausage.position.copy(point);
    sausage.quaternion.copy(stick.quaternion);
  });
  return { group, sausage, materials: [stick.material, sausage.material] };
}

const scene: Scene = {
  map: Foxwood.map({
    route: 'M30,345 C110,335 140,290 210,292 C280,294 316,256 346,248',
    name: t('scenes.campfire.mapLabel'),
    namePosition: [470, 360],
    nameColor: '#D35400',
  }),
  feature: 'campfire',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    // At the end the camera looks between the fox and the fire, so that both are visible.
    camera: {
      behind: 40,
      height: 20,
      ahead: 12,
      direction: [0, -75],
      gaze: { point: [CAMPFIRE[0] - 16, CAMPFIRE[1] - 4], start: 0.6 },
      fox: 5,
    },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      // The fox steps from the path next to the fire.
      fox.poses.add('walking');
      await animate(1100, (t) =>
        terrain.moveFox(x0 + (FOX_SPOT[0] - x0) * t, y0 + (FOX_SPOT[1] - y0) * t),
      );
      fox.poses.remove('walking');
      terrain.turnFox(...CAMPFIRE);
      // The fox reaches out a paw, and the fire lights up. Sparks fly for a moment.
      fox.poses.add('pawUp');
      await wait(400);
      flames!.sparks = true;
      stopFlicker = terrain.everyFrame((time) => flames!.update(time));
      await animate(700, (t) => flames!.size(t));
      fox.poses.remove('pawUp');
      setTimeout(() => (flames!.sparks = false), 4400);
      await wait(500);
      // The sausage stick appears, and the sausage browns over the fire.
      sausageStick = sausageStick || makeSausageStick(terrain);
      const stick = sausageStick;
      terrain.world.scene.add(stick.group);
      await animate(400, (t) => {
        for (const a of stick.materials) a.opacity = t;
        terrain.draw();
      });
      await animate(2000, (t) => {
        stick.sausage.material.color.set(mix([208, 101, 74], [140, 62, 38], t));
        terrain.draw();
      });
      fox.poses.add('facingViewer');
      await wait(900);
    },

    reset(_terrainSvg, terrain) {
      flames ??= Creatures.flames();
      stopFlicker?.();
      flames.size(0);
      terrain.place(flames, ...CAMPFIRE, 0.3);
      if (sausageStick) {
        sausageStick.group.removeFromParent();
        for (const a of sausageStick.materials) a.opacity = 0;
        sausageStick.sausage.material.color.set('#D0654A');
      }
    },
  },

  // Topo map (MML legend): a campfire site is a black flame over two triangles, the edge of a nature
  // reserve a green line with short slanted lines on the inside, a significant natural feature a
  // black six-pointed star with a white dot, a sports and recreation area light yellow-green and a
  // park green.
  lesson: {
    title: t('scenes.campfire.lesson.title'),
    instruction: t('scenes.campfire.lesson.instruction'),
    stage: STAGE,
    items: [
      {
        name: t('scenes.campfire.lesson.items.campfire.name'),
        summary: t('scenes.campfire.lesson.items.campfire.summary'),
        text: t('scenes.campfire.lesson.items.campfire.text'),
        icon: icon(Symbols.fire(50, 24, 1.8)),
        camera: { position: [1.5, 3.2, 9.5], gaze: [3, 0.6, -1] },
        show: campfireSite,
      },
      {
        name: t('scenes.campfire.lesson.items.reserve.name'),
        summary: t('scenes.campfire.lesson.items.reserve.summary'),
        text: t('scenes.campfire.lesson.items.reserve.text'),
        icon: icon(
          `<path d="M8,36 H92" stroke="${MML.reserve}" stroke-width="2.6" stroke-dasharray="24 4"/>
          <path d="${Array.from({ length: 12 }, (_, i) => `M${10 + i * 7},36 l5,-8`).join(' ')}" stroke="${MML.reserve}" stroke-width="1.8"/>`,
        ),
        camera: { position: [2.5, 4, 12.5], gaze: [5.5, 1.2, -2] },
        show: reserve,
      },
      {
        name: t('scenes.campfire.lesson.items.naturalFeature.name'),
        summary: t('scenes.campfire.lesson.items.naturalFeature.summary'),
        text: t('scenes.campfire.lesson.items.naturalFeature.text'),
        icon: icon(
          `<path d="${star(50, 25, 13, 5.5)}" fill="${MML.black}"/>
          <circle cx="50" cy="25" r="2.2" fill="#fff"/>`,
        ),
        show: boulder,
      },
      {
        name: t('scenes.campfire.lesson.items.recreationArea.name'),
        summary: t('scenes.campfire.lesson.items.recreationArea.summary'),
        text: t('scenes.campfire.lesson.items.recreationArea.text'),
        icon: icon(`<rect x="10" y="6" width="80" height="38" fill="${MML.recreation}"/>`),
        show: sportsField,
      },
      {
        name: t('scenes.campfire.lesson.items.park.name'),
        summary: t('scenes.campfire.lesson.items.park.summary'),
        text: t('scenes.campfire.lesson.items.park.text'),
        icon: icon(`<rect x="10" y="6" width="80" height="38" fill="${MML.park}"/>`),
        show: park,
      },
    ],
  },
};

function mix(a: Vec3, b: Vec3, t: number) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

// ---------- Lesson panel: outdoor-life places on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// A six-pointed star centred at (x, y): outer radius r, inner radius r0.
function star(x: number, y: number, r: number, r0: number) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    const k = i % 2 ? r0 : r;
    return `${(x + Math.cos(a) * k).toFixed(2)},${(y + Math.sin(a) * k).toFixed(2)}`;
  });
  return `M${points.join(' L')} Z`;
}
function turnTo(o: LessonStage, [x, z]: Point) {
  const { position: p } = o.fox.group;
  o.turn((Math.atan2(-(z - p.z), x - p.x) * 180) / Math.PI);
}
async function walkTo(o: LessonStage, target: Point, duration: number) {
  const { x, z } = o.fox.group.position;
  turnTo(o, target);
  o.fox.poses.set('walking');
  await o.animate(duration, (t) => o.foxTo(x + (target[0] - x) * t, z + (target[1] - z) * t));
  o.fox.poses.remove('walking');
}
// Final pose: the fox looks at the viewer and rejoices. lift raises it (e.g. onto a bench).
function finish(o: LessonStage, target: Point, motion: number, lift = 0) {
  if (!motion) o.foxTo(...target, lift);
  o.turn(-30);
  o.fox.lookAt(null);
  o.fox.poses.set('facingViewer', 'cheering');
}

// Campfire site: a ring of stones with logs in the middle. The fox walks to the fire and reaches
// out a paw, and the fire lights up with sparks. The flames are the campfire model of the scene
// (creatures.ts), scaled down to the fox of the stage.
async function campfireSite(o: LessonStage, motion: number) {
  const { rock, mesh, group } = o.models;
  const FIRE: Point = [4, -0.5];
  const stones = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * 2 * Math.PI;
    return o.add(rock(0.3, i + 1), [FIRE[0] + Math.cos(a) * 0.9, FIRE[1] + Math.sin(a) * 0.9]);
  });
  const logs = group(
    ...[0, 1, 2].map((i) => {
      const log = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), '#6B4A34', 0, 0.3, 0);
      log.rotation.set(Math.PI / 2 - 0.45, (i / 3) * Math.PI * 2, 0, 'YXZ');
      return log;
    }),
  );
  const fire = Creatures.flames();
  const holder = group(fire);
  holder.scale.setScalar(0.45);
  o.add(holder, FIRE);
  o.everyFrame((time) => fire.update(time));
  await o.grow([...stones, o.add(logs, FIRE)], motion, 600, 0.06);
  const spot: Point = [1.6, 0.9];
  if (!motion) {
    fire.sparks = false;
    fire.size(1);
    return finish(o, spot, motion);
  }
  await walkTo(o, spot, 1500);
  turnTo(o, FIRE);
  o.fox.poses.set('pawUp');
  await o.pause(400);
  await o.animate(700, (t) => fire.size(t));
  o.fox.poses.remove('pawUp');
  await o.pause(1600);
  fire.sparks = false;
  finish(o, spot, motion);
}

// Nature reserve: an old forest with big spruces, birches, mossy stones and a fallen tree. A
// squirrel sits on the fallen tree, and the fox tiptoes closer to look at it.
async function reserve(o: LessonStage, motion: number) {
  const { spruce, birch, rock, patch, mesh, group, castShadows } = o.models;
  o.add(patch(10, 5, '#6F9A4C', 3), [7, -4]);
  const trees = (
    [
      [0.5, -7, 12],
      [4.5, -9, 14],
      [8, -6.5, 11],
      [11.5, -8.5, 13],
      [14.5, -5, 12],
    ] as Vec3[]
  ).map(([x, z, height]) => o.add(spruce(height), [x, z]));
  const birches = (
    [
      [6, -4.5, 8],
      [13, -2, 7],
    ] as Vec3[]
  ).map(([x, z, height]) => o.add(birch(height), [x, z]));
  const stones = (
    [
      [2.5, -2.5, 0.6],
      [11, 0.5, 0.8],
    ] as Vec3[]
  ).map(([x, z, size], i) => o.add(rock(size, i + 2), [x, z]));
  const LOG: Point = [8, -1];
  const fallen = o.add(
    castShadows(
      group(
        mesh(new THREE.CylinderGeometry(0.35, 0.45, 6, 8).rotateZ(Math.PI / 2), '#7A5638', 0, 0.4),
        mesh(new THREE.BoxGeometry(5, 0.1, 0.4), '#5E8A3E', 0, 0.78),
      ),
    ),
    LOG,
    10,
  );
  const squirrel = Creatures.squirrel();
  squirrel.scale.setScalar(0.5);
  squirrel.position.y = 0.8;
  o.add(squirrel, [LOG[0] + 0.6, LOG[1]], 180);
  o.everyFrame((time) => (squirrel.tail.rotation.x = 0.2 * Math.sin(time * 5)));
  await o.grow([...trees, ...birches], motion, 900, 0.08);
  await o.grow([fallen, ...stones, squirrel], motion, 500, 0.1);
  const spot: Point = [4, 1.8];
  if (motion) await walkTo(o, spot, 2600);
  else o.foxTo(...spot);
  turnTo(o, LOG);
  o.fox.poses.set('curious');
  o.fox.lookAt(new THREE.Vector3(LOG[0] + 0.6, 1.2, LOG[1]));
  if (motion) await o.pause(1400);
  finish(o, spot, motion);
}

// Significant natural feature: a huge boulder left by the ice age. The fox walks to it and looks up
// at its top.
async function boulder(o: LessonStage, motion: number) {
  const { rock, spruce } = o.models;
  const STONE: Point = [9.5, -5.5];
  const big = o.add(rock(4, 2), STONE);
  const trees = (
    [
      [2, -9],
      [14, -9.5],
      [16, -5],
    ] as Point[]
  ).map(([x, z], i) => o.add(spruce(8 + i), [x, z]));
  await o.grow(trees, motion, 600, 0.1);
  await o.grow([big], motion, 1400);
  const spot: Point = [3, 0.5];
  if (motion) await walkTo(o, spot, 1500);
  else o.foxTo(...spot);
  turnTo(o, STONE);
  o.fox.poses.set('curious');
  o.fox.lookAt(new THREE.Vector3(STONE[0], 4, STONE[1]));
  if (motion) await o.pause(1400);
  finish(o, spot, motion);
}

// Sports field: grass with white lines and two goals. The fox kicks the ball into the goal.
async function sportsField(o: LessonStage, motion: number) {
  const { mesh, group, castShadows } = o.models;
  const CENTER: Point = [5.5, -2];
  const [L, W] = [13, 8];
  const line = (l: number, w: number, x: number, z: number) =>
    mesh(new THREE.BoxGeometry(l, 0.02, w), '#F4F2EC', x, 0.05, z);
  const goal = (x: number) =>
    group(
      mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12).translate(0, 0.8, 0), '#F4F2EC', x, 0, -1.6),
      mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12).translate(0, 0.8, 0), '#F4F2EC', x, 0, 1.6),
      mesh(new THREE.BoxGeometry(0.12, 0.12, 3.32), '#F4F2EC', x, 1.6, 0),
    );
  const ring = mesh(
    new THREE.RingGeometry(1.3, 1.42, 32).rotateX(-Math.PI / 2),
    '#F4F2EC',
    0,
    0.05,
  );
  const field = o.add(
    castShadows(
      group(
        mesh(new THREE.BoxGeometry(L, 0.04, W), '#86BD5A', 0, 0.02),
        line(L, 0.1, 0, -W / 2),
        line(L, 0.1, 0, W / 2),
        line(0.1, W, -L / 2, 0),
        line(0.1, W, L / 2, 0),
        line(0.1, W, 0, 0),
        ring,
        goal(-L / 2 + 0.3),
        goal(L / 2 - 0.3),
      ),
    ),
    CENTER,
  );
  const BALL: Point = [4, 0.5],
    GOAL: Point = [CENTER[0] + L / 2 - 0.7, CENTER[1]];
  const ball = o.add(
    castShadows(group(mesh(new THREE.IcosahedronGeometry(0.22, 1), '#F4F2EC', 0, 0.22))),
    BALL,
  );
  await o.grow([field], motion, 800);
  await o.grow([ball], motion, 400);
  const spot: Point = [3.1, 0.6];
  if (!motion) {
    o.add(ball, GOAL);
    return finish(o, spot, motion);
  }
  await walkTo(o, spot, 1700);
  turnTo(o, GOAL);
  o.fox.poses.set('pawUp');
  await o.pause(250);
  await o.animate(1200, (t) => {
    const k = 1 - (1 - t) * (1 - t);
    ball.position.set(BALL[0] + (GOAL[0] - BALL[0]) * k, 0, BALL[1] + (GOAL[1] - BALL[1]) * k);
    ball.rotation.z = -k * 20;
  });
  finish(o, spot, motion);
}

// Park: a mown lawn, a sandy path, birches, bushes and a bench. The fox walks along the path and
// hops onto the bench.
async function park(o: LessonStage, motion: number) {
  const { patch, strip, birch, shrub, mesh, group, castShadows } = o.models;
  const lawn = o.add(patch(10, 6, '#8FCB62', 5), [6, -2]);
  const path = o.add(
    strip((z) => 0.6 * Math.sin(z * 0.35), 1.3, -9, 9, '#D9C9A3', 0.06),
    [6, 1.2],
    90,
  );
  const trees = (
    [
      [1, -5],
      [5, -6.5],
      [9.5, -5.5],
      [13, -3.5],
    ] as Point[]
  ).map(([x, z], i) => o.add(birch(5.5 + (i % 2)), [x, z]));
  const bushes = (
    [
      [3, -2],
      [11.5, -1],
    ] as Point[]
  ).map(([x, z]) => o.add(shrub(1.1), [x, z]));
  const BENCH: Point = [8, -0.6];
  const SEAT = 0.5;
  const wood = '#9A6B44';
  const bench = o.add(
    castShadows(
      group(
        mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), wood, 0, SEAT, 0),
        mesh(new THREE.BoxGeometry(1.8, 0.4, 0.06), wood, 0, SEAT + 0.35, -0.25),
        ...[-0.75, 0.75].map((x) =>
          mesh(new THREE.BoxGeometry(0.08, SEAT, 0.45).translate(0, SEAT / 2, 0), '#4A4A4E', x),
        ),
      ),
    ),
    BENCH,
  );
  await o.grow([lawn, path], motion, 700);
  await o.grow([...trees, ...bushes, bench], motion, 700, 0.08);
  const front: Point = [BENCH[0], BENCH[1] + 1.2],
    seat: Point = [BENCH[0], BENCH[1] + 0.05];
  if (!motion) return finish(o, seat, motion, SEAT);
  await walkTo(o, front, 2400);
  await o.animate(600, (t) =>
    o.foxTo(front[0], front[1] + (seat[1] - front[1]) * t, SEAT * t + 0.6 * Math.sin(Math.PI * t)),
  );
  finish(o, seat, motion);
}

export { scene as campfire };
