// Controls scene (orienteering map only): the fox runs an orienteering course. The course starts
// from the start triangle in the fox's clearing at the beginning of the path, the controls are at
// the west end of the mire (1), at the top of the hill (2) and in the south-east corner of the
// field (3), and the finish is at the edge of the track. The course markings are purple (ISOM
// 701–706, Orienteering.start, control, finish).
//
// In the terrain every control has a white-and-orange control flag (creatures.ts). The fox stops at
// the controls (terrain.stops) and punches, and the number of the control shows above the flag. At
// the finish the fox runs under the finish gate.
import type * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import type { Point } from '../types';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';

const V = Orienteering.COLORS;
const START: Point = [30, 345];
const CONTROLS: Point[] = [
  [238, 316],
  [268, 178],
  [186, 124],
];
const FINISH: Point = [118, 176];
// The positions of the control numbers on the map: the number is on the side of the control where
// there are no course lines.
const NUMBER_POSITIONS = [
  [262, 338],
  [270, 152],
  [172, 102],
];
const MM = 6; // the dimensions of the course markings as in orienteering.ts (1 mm = 6 units)
const CONTROL_R = 2.5 * MM,
  FINISH_R = 3 * MM,
  START_R = 3.5 * MM * 0.577;

// A course line between two markings. The line starts and ends at the edge of the marking.
function courseLine([ax, ay]: Point, ra: number, [bx, by]: Point, rb: number) {
  const d = Math.hypot(bx - ax, by - ay);
  const [ux, uy] = [(bx - ax) / d, (by - ay) / d];
  return `<line x1="${(ax + ux * ra).toFixed(1)}" y1="${(ay + uy * ra).toFixed(1)}" x2="${(bx - ux * rb).toFixed(1)}" y2="${(by - uy * rb).toFixed(1)}"/>`;
}
const angle = ([ax, ay]: Point, [bx, by]: Point) => (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
const points = [START, ...CONTROLS, FINISH];
const radii = [START_R, ...CONTROLS.map(() => CONTROL_R), FINISH_R];
const course = `<g class="feature-controls">
  ${Orienteering.start(...START, 1, angle(START, CONTROLS[0]))}
  ${CONTROLS.map(([x, y], i) => `<g class="course-control" data-n="${i}">${Orienteering.control(x, y)}</g>`).join('')}
  ${Orienteering.finish(...FINISH)}
  <g stroke="${V.course}" stroke-width="${0.35 * MM}">${points
    .slice(1)
    .map((p, i) => courseLine(points[i], radii[i], p, radii[i + 1]))
    .join('')}</g>
  <g fill="${V.course}" stroke="#fff" stroke-width="4" paint-order="stroke" font-size="22" font-weight="800" text-anchor="middle">
    ${NUMBER_POSITIONS.map(([x, y], i) => `<text x="${x}" y="${y + 8}">${i + 1}</text>`).join('')}
  </g>
</g>`;

// 3D: control flags and the finish gate (creatures.ts). The flags are slightly to the side of the
// route, so that the fox stops next to the flag.
let flags: ReturnType<typeof Creatures.controlFlag>[] = [],
  gate: ReturnType<typeof Creatures.finishGate> | null = null;
const flagPositions: Point[] = [];
const NUMBER_SCALE = 0.06;
// The direction of the camera at the end (in degrees, 0 = from the south): in the south-west in
// front of the finish gate.
const FINAL_DIRECTION = -40;

const scene: Scene = {
  map:
    Foxwood.map({
      // Start → 1 (along the path to the mire) → 2 (to the top of the hill) → 3 (to the corner of
      // the field) → finish.
      route:
        'M30,345 C110,335 140,290 210,292 C224,293 232,305 238,316 C244,290 258,250 262,226 C266,206 267,192 268,178 C252,166 214,138 186,124 C168,134 134,156 118,176',
      name: t('scenes.controls.mapLabel'),
      namePosition: [140, 235],
      nameColor: V.course,
    }) + course,
  feature: 'controls',
  // The outer circle of the finish pulses when the fox is at the finish.
  highlight: `M${FINISH[0] - FINISH_R},${FINISH[1]} a${FINISH_R},${FINISH_R} 0 1,0 ${2 * FINISH_R},0 a${FINISH_R},${FINISH_R} 0 1,0 ${-2 * FINISH_R},0 Z`,
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    // A long course: the camera only turns in front of the finish gate on the last leg, so that the
    // fox runs towards it.
    camera: {
      behind: 36,
      height: 18,
      ahead: 12,
      direction: [0, FINAL_DIRECTION],
      turnAt: 0.8,
      fox: 5,
    },
    duration: 10000,
    stops: CONTROLS,
    overlay: CONTROLS.map(
      (_, i) => `<g class="control-number" opacity="0">
        <circle r="16" fill="#fff" stroke="${V.course}" stroke-width="4"/>
        <text y="8" text-anchor="middle" fill="${V.course}" font-size="22" font-weight="800">${i + 1}</text></g>`,
    ).join(''),

    // At a control the fox turns to the flag and punches. The number of the control shows above the
    // flag, and the control on the map fills in.
    async atStop(n, { terrainSvg, mapSvg, fox, wait, terrain }) {
      const [lx, ly] = flagPositions[n + 1];
      terrain.turnFox(lx, ly);
      fox.poses.add('pawUp');
      await wait(350);
      flags[n + 1].stamp(1);
      mapSvg.querySelector(`.course-control[data-n="${n}"]`)!.classList.add('visited');
      const numberEl = terrainSvg.querySelectorAll('.control-number')[n];
      terrain.pin(numberEl, lx, ly, 5.6, NUMBER_SCALE);
      await animate(250, (t) => {
        numberEl.setAttribute('opacity', String(t));
        terrain.draw();
      });
      await wait(450);
      fox.poses.remove('pawUp');
      flags[n + 1].stamp(0);
      terrain.draw();
    },

    async arrive({ wait }) {
      await wait(300);
    },

    reset(terrainSvg, terrain, mapSvg) {
      // A gap at the route (as in sign-terrain.ts), around the finish gate and in the line of sight
      // from the camera to the finish.
      const route = Array.from({ length: 301 }, (_, i) => terrain.routePoint(i / 300));
      const a = (FINAL_DIRECTION * Math.PI) / 180;
      const view = Array.from(
        { length: 16 },
        (_, i): Point => [FINISH[0] + Math.sin(a) * i * 3, FINISH[1] + Math.cos(a) * i * 3],
      );
      const clearing = Array.from(
        { length: 12 },
        (_, i): Point => [FINISH[0] + Math.cos(i * 0.52) * 6, FINISH[1] + Math.sin(i * 0.52) * 6],
      );
      terrain.world.clearing([...route, ...view, ...clearing], 6);
      if (!flags.length) {
        flags = [START, ...CONTROLS].map(() => Creatures.controlFlag());
        gate = Creatures.finishGate();
        // The flag 3 m to the right of the route (seen in the walking direction).
        [START, ...CONTROLS].forEach((p) => {
          const t = terrain.routeProgress(p);
          const [ax, ay] = terrain.routePoint(t - 0.004);
          const [bx, by] = terrain.routePoint(t + 0.004);
          const d = Math.hypot(bx - ax, by - ay) || 1;
          flagPositions.push([p[0] - ((by - ay) / d) * 3, p[1] + ((bx - ax) / d) * 3]);
        });
      }
      flags.forEach((flag, i) => {
        flag.stamp(0);
        terrain.place(flag, ...flagPositions[i]);
      });
      // The finish gate is across the last leg: the fox comes from control 3 and runs under it.
      terrain.place(gate!, ...FINISH, 0, CONTROLS[2]);
      terrainSvg
        .querySelectorAll('.control-number')
        .forEach((el) => el.setAttribute('opacity', String(0)));
      mapSvg.querySelectorAll('.course-control').forEach((el) => el.classList.remove('visited'));
    },
  },

  orienteering: {
    lesson: {
      title: t('scenes.controls.orienteeringLesson.title'),
      instruction: t('scenes.controls.orienteeringLesson.instruction'),
      stage: { camera: [1.5, 3.6, 10.5], gaze: [2, 0.7, -1.5], fox: 1.5, foxPosition: [-2.5, 2.5] },
      items: [
        {
          name: t('scenes.controls.orienteeringLesson.items.start.name'),
          summary: t('scenes.controls.orienteeringLesson.items.start.summary'),
          text: t('scenes.controls.orienteeringLesson.items.start.text'),
          icon: icon(
            `${Orienteering.start(22, 27, 1.2, 0)}<line x1="36" y1="27" x2="67" y2="27" stroke="${V.course}" stroke-width="2.1"/>${Orienteering.control(78, 27, 0.75)}`,
          ),
          show: showStart,
        },
        {
          name: t('scenes.controls.orienteeringLesson.items.control.name'),
          summary: t('scenes.controls.orienteeringLesson.items.control.summary'),
          text: t('scenes.controls.orienteeringLesson.items.control.text'),
          icon: icon(`${Orienteering.control(46, 25, 1.25)}${numberLabel(74, 12, 1, 18)}`),
          show: showControl,
        },
        {
          name: t('scenes.controls.orienteeringLesson.items.controlOrder.name'),
          summary: t('scenes.controls.orienteeringLesson.items.controlOrder.summary'),
          text: t('scenes.controls.orienteeringLesson.items.controlOrder.text'),
          icon: icon(`${Orienteering.control(20, 30, 0.8)}${Orienteering.control(80, 30, 0.8)}
            <line x1="32" y1="30" x2="68" y2="30" stroke="${V.course}" stroke-width="2.1"/>${numberLabel(35, 12, 1, 14)}${numberLabel(94, 12, 2, 14)}`),
          show: showOrder,
        },
        {
          name: t('scenes.controls.orienteeringLesson.items.finish.name'),
          summary: t('scenes.controls.orienteeringLesson.items.finish.summary'),
          text: t('scenes.controls.orienteeringLesson.items.finish.text'),
          icon: icon(Orienteering.finish(50, 25, 1.15)),
          show: showFinish,
        },
      ],
    },
  },
};

// ---------- Lesson panel: the orienteering course on the 3D stage (lesson-panel.ts) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
function numberLabel(x: number, y: number, n: number, size = 15) {
  return `<text x="${x}" y="${y + size * 0.36}" text-anchor="middle" fill="${V.course}" font-size="${size}" font-weight="800">${n}</text>`;
}

// The fox of the stage is 1.5 m. The flags are slightly bigger than in Foxwood, so that they stand
// out.
const SCALE = 0.4;
const small = <T extends THREE.Object3D>(object: T): T => {
  object.scale.setScalar(SCALE);
  return object;
};
// The fox turns towards the point (x, z).
function turnTo(o: LessonStage, [x, z]: Point) {
  const { position: p } = o.fox.group;
  o.turn((Math.atan2(-(z - p.z), x - p.x) * 180) / Math.PI);
}
// The fox runs to the point (x, z).
async function run(o: LessonStage, target: Point, duration: number) {
  const { x, z } = o.fox.group.position;
  turnTo(o, target);
  o.fox.poses.set('walking');
  await o.animate(duration, (t) => o.foxTo(x + (target[0] - x) * t, z + (target[1] - z) * t));
  o.fox.poses.remove('walking');
}
// A number above the flag in the overlay layer.
function flagNumber(o: LessonStage, [x, z]: Point, n: number) {
  const r = o.toScreen(x, 1.45, z);
  if (!r) return;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${r[0]} ${r[1]})`);
  g.innerHTML = `<circle r="11" fill="#fff" stroke="${V.course}" stroke-width="3"/><text y="5.5" text-anchor="middle" fill="${V.course}" font-size="15" font-weight="800">${n}</text>`;
  o.overlay.appendChild(g);
}

// Start: the start flag next to the fox, and the first control is visible far away. The fox turns
// to look at it.
const FIRST: Point = [6, -5];
async function showStart(o: LessonStage, motion: number) {
  const flag = o.add(small(Creatures.controlFlag()), [-1.2, 1.6]);
  const first = o.add(small(Creatures.controlFlag()), FIRST);
  await o.grow([flag], motion);
  await o.pause(motion ? 400 : 0);
  await o.grow([first], motion);
  turnTo(o, FIRST);
  flagNumber(o, FIRST, 1);
}

// Control: the flag rises from the ground, the fox runs to it and punches (the light of the punch
// lights up).
async function showControl(o: LessonStage, motion: number) {
  const flag = o.add(small(Creatures.controlFlag()), [3.6, 1.2]);
  await o.grow([flag], motion);
  if (motion) await run(o, [2.2, 1.4], 1300);
  else o.foxTo(2.2, 1.4);
  turnTo(o, [3.6, 1.2]);
  o.fox.poses.set('pawUp');
  await o.pause(motion ? 350 : 0);
  flag.stamp(1);
  o.draw();
  await o.pause(motion ? 500 : 0);
  o.fox.poses.set('facingViewer', 'cheering');
}

// Order: three numbered flags. The fox visits them in order, even though 3 is the closest.
async function showOrder(o: LessonStage, motion: number) {
  const positions: Point[] = [
    [4.5, -4],
    [7, 1],
    [0.5, -1],
  ];
  const flags = positions.map((p) => o.add(small(Creatures.controlFlag()), p));
  await o.grow(flags, motion);
  positions.forEach((p, i) => flagNumber(o, p, i + 1));
  if (!motion) return o.foxTo(-0.3, -0.2);
  for (const [i, [x, z]] of positions.entries()) {
    await run(o, [x - 0.8, z + 0.8], 1400);
    flags[i].stamp(1);
    o.draw();
    await o.pause(250);
  }
  o.fox.poses.set('facingViewer', 'cheering');
}

// Finish: the finish gate rises from the ground at an angle, so that its text is visible. The fox
// goes around behind the gate and runs under it towards the viewer.
async function showFinish(o: LessonStage, motion: number) {
  const CENTER: Point = [2.5, -1],
    ROTATION = -50;
  const n: Point = [Math.cos(ROTATION * (Math.PI / 180)), -Math.sin(ROTATION * (Math.PI / 180))]; // the direction through the gate
  const [behind, ahead] = [-5, 4].map((k): Point => [CENTER[0] + n[0] * k, CENTER[1] + n[1] * k]);
  const gate = o.add(small(Creatures.finishGate()), CENTER, ROTATION);
  await o.grow([gate], motion);
  if (motion) {
    await run(o, behind, 1500);
    await run(o, ahead, 1600);
  } else o.foxTo(...ahead);
  turnTo(o, [ahead[0] + n[0], ahead[1] + n[1]]);
  o.fox.poses.set('facingViewer', 'cheering');
}

export { scene as controls };
