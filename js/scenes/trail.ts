// Path and road scene: the fox walks from the start of the path along the track (gravel road) past
// the field to the road. At the edge of the road the fox stops and looks for cars.
//
// On the map a track is a black line and a small road a thin red line with black edges. The terrain
// is the 3D world of Foxwood (sign-terrain.ts): the road runs in front of the fox from left to
// right, and the farmyard at the junction (house and barn) is on the right. The car is a 3D model
// that drives along the road of the map.
//
// On the orienteering map the scene is the same, but the road is a wide road (brown, black edges,
// ISOM 502) and the lesson panel tells how clear a path is: the clearer the path, the longer the
// black dashes (ISOM 503–507).
import * as THREE from 'three';
import * as MapType from '../map-type';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Terrain } from '../sign-terrain';

const ORIENTEERING = MapType.current() === 'orienteering';

const V = Orienteering.COLORS;
// The car drives east in the right lane (the south side of the road), from the map position x = 30
// to x = 420.
const DRIVE: [number, number] = [0.05, 0.7];
const LANE = 1.8;
let car: ReturnType<Terrain['world']['createCar']> | null = null;

const scene: Scene = {
  map: Foxwood.map({
    // Along the track to the edge of the road (the end slightly before the road, so that the fox is
    // fully visible).
    route:
      'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 196,54 197,30',
    name: t('scenes.trail.mapLabel'),
    namePosition: [400, 45],
    nameColor: ORIENTEERING ? '#A8652E' : '#B0412E',
  }),
  feature: 'carRoad',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: { behind: 40, height: 19, ahead: 12, direction: [0, -30], fox: 5 },
    overlay: `
      <path id="car-road-line" d="${Foxwood.shapes.carRoad}" fill="none" stroke="none"/>`,

    async arrive({ terrainSvg, fox, wait, terrain }) {
      // Look first: the fox looks at the viewer, then along the road.
      fox.poses.add('facingViewer');
      await wait(600);
      fox.poses.remove('facingViewer');
      fox.poses.add('curious');
      const line = terrainSvg.querySelector<SVGGeometryElement>('#car-road-line')!;
      const length = line.getTotalLength();
      await animate(2600, (t) => {
        const s = (DRIVE[0] + (DRIVE[1] - DRIVE[0]) * t) * length;
        const a = line.getPointAtLength(s);
        const b = line.getPointAtLength(s + 1);
        const direction = Math.atan2(b.y - a.y, b.x - a.x);
        // The lane is on the right in the direction of travel.
        car!.place(a.x - Math.sin(direction) * LANE, a.y + Math.cos(direction) * LANE, direction);
        terrain.draw();
      });
      car!.visible = false;
      terrain.draw();
      fox.poses.remove('curious');
      fox.poses.add('facingViewer');
      await wait(700);
    },

    reset(_terrainSvg, terrain) {
      car ??= terrain.world.createCar('#D9463A');
      car.visible = false;
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.trail.lesson.title'),
    instruction: t('scenes.trail.lesson.instruction'),
    stage: { camera: [1.5, 3.2, 13], gaze: [2.5, 0.8, -2], fox: 1.8, foxPosition: [-1.6, 3] },
    items: [
      {
        name: t('scenes.trail.lesson.items.trail.name'),
        summary: t('scenes.trail.lesson.items.trail.summary'),
        text: t('scenes.trail.lesson.items.trail.text'),
        icon: lineIcon(
          '<path d="M6,25 H94" stroke="#1a1a1a" stroke-width="2.4" stroke-dasharray="8 6"/>',
        ),
        show: (o, motion) => cross(o, motion, road(o, 'trail')),
      },
      {
        name: t('scenes.trail.lesson.items.track.name'),
        summary: t('scenes.trail.lesson.items.track.summary'),
        text: t('scenes.trail.lesson.items.track.text'),
        icon: lineIcon('<path d="M6,25 H94" stroke="#1a1a1a" stroke-width="2.4"/>'),
        show: (o, motion) => cross(o, motion, road(o, 'track')),
      },
      {
        name: t('scenes.trail.lesson.items.smallCarRoad.name'),
        summary: t('scenes.trail.lesson.items.smallCarRoad.summary'),
        text: t('scenes.trail.lesson.items.smallCarRoad.text'),
        icon: lineIcon(red(7, 4)),
        show: (o, motion) => waitForCars(o, motion, road(o, 'pieni'), 1),
      },
      {
        name: t('scenes.trail.lesson.items.largeCarRoad.name'),
        summary: t('scenes.trail.lesson.items.largeCarRoad.summary'),
        text: t('scenes.trail.lesson.items.largeCarRoad.text'),
        icon: lineIcon(red(13, 9)),
        camera: { position: [2.5, 4, 16], gaze: [4.5, 1, -3] },
        show: (o, motion) => waitForCars(o, motion, road(o, 'iso'), 2),
      },
    ],
  },

  // Orienteering map: paths and roads are black (ISOM 503–507), and a wide road is brown (502).
  // The fox runs along the path: the less clear the path, the slower.
  orienteering: {
    lesson: {
      title: t('scenes.trail.orienteeringLesson.title'),
      instruction: t('scenes.trail.orienteeringLesson.instruction'),
      stage: { camera: [1.5, 3.2, 13], gaze: [2.5, 0.8, -2], fox: 1.8, foxPosition: [-1.6, 3] },
      items: [
        {
          name: t('scenes.trail.orienteeringLesson.items.wideRoad.name'),
          summary: t('scenes.trail.orienteeringLesson.items.wideRoad.summary'),
          text: t('scenes.trail.orienteeringLesson.items.wideRoad.text'),
          icon: lineIcon(
            `<path d="M6,25 H94" stroke="${V.black}" stroke-width="12"/><path d="M6,25 H94" stroke="${V.brown}" stroke-width="8"/>`,
          ),
          show: (o, motion) => waitForCars(o, motion, road(o, 'pieni'), 1),
        },
        {
          name: t('scenes.trail.orienteeringLesson.items.track.name'),
          summary: t('scenes.trail.orienteeringLesson.items.track.summary'),
          text: t('scenes.trail.orienteeringLesson.items.track.text'),
          icon: lineIcon(`<path d="M6,25 H94" stroke="${V.black}" stroke-width="3"/>`),
          show: (o, motion) => run(o, motion, crossing(o, 'track')),
        },
        {
          name: t('scenes.trail.orienteeringLesson.items.trail.name'),
          summary: t('scenes.trail.orienteeringLesson.items.trail.summary'),
          text: t('scenes.trail.orienteeringLesson.items.trail.text'),
          icon: lineIcon(
            `<path d="M6,25 H94" stroke="${V.black}" stroke-width="2.6" stroke-dasharray="15 3"/>`,
          ),
          show: (o, motion) => run(o, motion, crossing(o, 'trail')),
        },
        {
          name: t('scenes.trail.orienteeringLesson.items.unclearTrail.name'),
          summary: t('scenes.trail.orienteeringLesson.items.unclearTrail.summary'),
          text: t('scenes.trail.orienteeringLesson.items.unclearTrail.text'),
          icon: lineIcon(
            `<path d="M6,25 H94" stroke="${V.black}" stroke-width="2" stroke-dasharray="7 3 7 10"/>`,
          ),
          show: (o, motion) => {
            crossing(o, 'epaselva');
            return search(o, motion);
          },
        },
      ],
    },
  },
};

// ---------- Lesson panel: from a path to a big road ----------
function lineIcon(line: string) {
  return `<rect width="100" height="50" fill="#fff"/><g fill="none">${line}</g>`;
}
// Road: a red line with black edges (MML).
function red(edge: number, fill: number) {
  return `<path d="M6,25 H94" stroke="#1a1a1a" stroke-width="${edge}"/><path d="M6,25 H94" stroke="#B0412E" stroke-width="${fill}"/>`;
}

// Roads on the 3D stage: the road comes from far in the north towards the viewer, and its west edge
// is at x = 0 in front of the fox. Further away the road curves slightly. width in metres.
interface RoadStyle {
  width: number;
  surface: string;
  grass?: string;
  shoulder?: number;
  edgeLines?: boolean;
  centerLine?: boolean;
  runTime?: number;
  offset?: number;
  dashes?: boolean;
}
const ROADS: Record<string, RoadStyle> = {
  trail: { width: 0.8, surface: '#B89468' },
  track: { width: 3.5, surface: '#CDBB92', grass: '#8AAE62' },
  pieni: { width: 6, surface: '#5A5B60', shoulder: 0.6, edgeLines: true },
  iso: { width: 11, surface: '#55565B', shoulder: 1, edgeLines: true, centerLine: true },
};
const FROM_Z = -140,
  TO_Z = 30;
function road(o: LessonStage, kind: string) {
  const t = ROADS[kind];
  const { strip, group } = o.models;
  const centerAt = (z: number) => t.width / 2 + (z < -8 ? 0.012 * (z + 8) ** 2 : 0);
  const g = group();
  if (t.shoulder) g.add(strip(centerAt, t.width + 2 * t.shoulder, FROM_Z, TO_Z, '#BCAE8C', 0.015));
  g.add(strip(centerAt, t.width, FROM_Z, TO_Z, t.surface, 0.025));
  // Grass grows in the middle of a track.
  if (t.grass) g.add(strip(centerAt, 0.6, FROM_Z, TO_Z, t.grass, 0.035));
  if (t.edgeLines) {
    for (const side of [-1, 1])
      g.add(
        strip(
          (z) => centerAt(z) + side * (t.width / 2 - 0.35),
          0.15,
          FROM_Z,
          TO_Z,
          '#F4F1E8',
          0.035,
        ),
      );
  }
  // The centre line is dashed: 3 m of line, 9 m gaps.
  if (t.centerLine) {
    for (let z = FROM_Z; z < TO_Z; z += 12)
      g.add(strip(centerAt, 0.15, z, z + 3, '#F4F1E8', 0.035));
  }
  o.add(g);
  return { ...t, centerAt };
}

// The fox can walk across a path and a track.
async function cross(o: LessonStage, motion: number, road: RoadStyle) {
  const { fox } = o;
  const [x0, z0] = [-1.6, 3];
  const x1 = road.width + 1.6;
  if (!motion) return o.foxTo(x1, z0);
  await o.pause(400);
  fox.poses.set('walking');
  await o.animate(900 + 250 * road.width, (t) => o.foxTo(x0 + (x1 - x0) * t, z0));
  fox.poses.set('facingViewer');
}

// ---------- Lesson panel (orienteering map): the fox runs along a path ---------- The path runs
// from left to right under the fox (z = FOX_Z). An indistinct path is pieces with grass growing
// between them.
const FOX_Z = 3;
const CROSSING: Record<string, RoadStyle> = {
  track: { ...ROADS.track, runTime: 1500, offset: 0.9 }, // the fox runs along the far rut of the track
  trail: { ...ROADS.trail, runTime: 1900 },
  epaselva: { width: 0.55, surface: '#AE9C6E', dashes: true },
};
function crossing(o: LessonStage, kind: string) {
  const t = CROSSING[kind];
  const { strip, group, seeded } = o.models;
  // The strip is built in the north-south direction and turned: the local z is the x of the stage,
  // and the local x = -FOX_Z is the fox's line. offset = the middle of the road from the fox's line
  // towards the viewer. The path meanders slightly.
  const centerAt = (z: number) =>
    -FOX_Z - (t.offset ?? 0) + (t.width < 2 ? 0.25 * Math.sin(z / 4) : 0);
  const g = group();
  if (t.dashes) {
    const r = seeded(5);
    for (let z = -40; z < 40; ) {
      const length = 1.2 + r() * 1.8;
      g.add(strip(centerAt, t.width, z, z + length, t.surface, 0.025));
      z += length + 0.8 + r() * 1.6;
    }
  } else {
    g.add(strip(centerAt, t.width, -40, 40, t.surface, 0.025));
    if (t.grass) g.add(strip(centerAt, 0.6, -40, 40, t.grass, 0.035));
  }
  o.add(g, [0, 0], 90);
  return t;
}

// The fox runs along the path to the right and rejoices on arrival. path.runTime = the duration of
// the run (ms).
const RUN: [number, number] = [-1.6, 6];
async function run(o: LessonStage, motion: number, path: RoadStyle) {
  const { fox } = o;
  o.turn(0);
  if (!motion) return o.foxTo(RUN[1], FOX_Z);
  await o.pause(400);
  fox.poses.set('walking');
  await o.animate(path.runTime!, (t) => o.foxTo(RUN[0] + (RUN[1] - RUN[0]) * t, FOX_Z));
  o.turn(-15);
  fox.poses.set('facingViewer', 'cheering');
}

// On an indistinct path the fox stops and looks for the path with its nose to the ground before
// continuing slowly.
async function search(o: LessonStage, motion: number) {
  const { fox } = o;
  const [x0, x1] = RUN;
  const half = 2.2;
  o.turn(0);
  if (!motion) return o.foxTo(x1, FOX_Z);
  await o.pause(400);
  fox.poses.set('walking');
  await o.animate(1700, (t) => o.foxTo(x0 + (half - x0) * t, FOX_Z));
  fox.poses.set('curious');
  const gaze = new THREE.Vector3();
  for (const [x, z] of [
    [half + 2, FOX_Z - 1.5],
    [half + 2, FOX_Z + 1.5],
    [half + 3, FOX_Z],
  ]) {
    fox.lookAt(gaze.set(x, 0, z));
    await o.pause(650);
  }
  fox.lookAt(null);
  fox.poses.set('walking');
  await o.animate(2400, (t) => o.foxTo(half + (x1 - half) * t, FOX_Z));
  o.turn(-15);
  fox.poses.set('facingViewer');
}

// At the edge of the road the fox waits until the cars have passed. The fox follows the cars with
// its gaze. Right-hand traffic: a car coming towards the viewer drives in the lane on the fox's
// side.
async function waitForCars(
  o: LessonStage,
  motion: number,
  road: RoadStyle & { centerAt: (z: number) => number },
  count: number,
) {
  const { fox } = o;
  if (!motion) return;
  const cars = [
    { color: '#D9463A', lane: -1, from: -110, to: 40, delay: 0 },
    { color: '#2E6FB7', lane: 1, from: 30, to: -110, delay: 0.25 },
  ]
    .slice(0, count)
    .map((a) => ({
      ...a,
      model: o.add(o.models.car(a.color), [0, a.from], a.lane < 0 ? -90 : 90),
    }));
  await o.pause(400);
  fox.poses.set('curious');
  const gaze = new THREE.Vector3();
  await o.animate(4200, (t) => {
    for (const a of cars) {
      const u = Math.min(1, Math.max(0, (t - a.delay) / (1 - a.delay)));
      const z = a.from + (a.to - a.from) * u;
      a.model.position.set(road.centerAt(z) + (a.lane * road.width) / 4, 0.03, z);
      const heading = Math.atan2(road.centerAt(z + 1) - road.centerAt(z), 1);
      a.model.rotation.y = (a.lane < 0 ? -Math.PI / 2 : Math.PI / 2) + heading;
    }
    // The fox looks at the nearest car.
    const nearest = cars.reduce((p, a) =>
      Math.abs(a.model.position.z - 3) < Math.abs(p.model.position.z - 3) ? a : p,
    );
    fox.lookAt(gaze.copy(nearest.model.position).setY(1));
  });
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

export { scene as trail };
