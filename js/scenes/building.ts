// Buildings scene: the fox walks along the track past the field to the farmyard. A cat comes to the
// door of the house, puffs up and hisses. The fox jumps back and looks at the camera.
//
// On the map the farmyard is at the junction of the track and the road next to the field: the
// residential building is dark grey and the barn light grey. The terrain is the 3D world of Foxwood
// (sign-terrain.ts): the red house and the grey barn are in the same places as the signs of the
// map. On the map the house is grey, even though it is red.
import * as THREE from 'three';
import * as MapType from '../map-type';
import { Symbols, type BuildingKind } from '../symbols';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Point } from '../types';

const ORIENTEERING = MapType.current() === 'orienteering';
const V = Orienteering.COLORS;
// The door of the house is on the south wall near the west end (world.ts: buildingModel). The cat
// sits in front of the door.
const [, TX, TY, TL, TK] = Foxwood.BUILDINGS.house;
const CAT_SPOT: Point = [TX - TL / 2 + 1.6, TY + TK / 2 + 1.5];
// The fox stops west of the cat, so that the cat is not left behind the fox, and jumps backwards
// from there.
const FOX_SPOT: Point = [CAT_SPOT[0] - 8, CAT_SPOT[1] + 1.5];
const BACK_SPOT: Point = [FOX_SPOT[0] - 4, FOX_SPOT[1] + 2];
// The cat is a 3D model (creatures.ts), about half the height of the fox. The hiss is text in the
// overlay layer.
let cat: ReturnType<typeof Creatures.cat> | null = null;
const HISS_SCALE = 0.05;

const scene: Scene = {
  map: Foxwood.map({
    // Along the track past the field to the farmyard.
    route:
      'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 197,70 198,52',
    name: t('scenes.building.mapLabel'),
    namePosition: [300, 100],
    nameColor: ORIENTEERING ? Orienteering.COLORS.black : Symbols.BUILDING_COLORS.residential,
  }),
  feature: 'building',
  // The engine draws the buildings and yards on top of the highlight, so the yard fence is drawn on
  // top of them.
  drawOver: ['fences'],

  terrain: {
    // At the end the camera looks between the fox and the cat.
    camera: {
      behind: 50,
      height: 22,
      ahead: 12,
      direction: [0, -45],
      gaze: { point: [CAT_SPOT[0] - 4, CAT_SPOT[1]], start: 0.6 },
      fox: 5,
    },
    overlay: `
      <text id="hiss-text" opacity="0" text-anchor="middle" fill="#2E211B" stroke="#fff" stroke-width="4" paint-order="stroke" font-size="18" font-weight="800">${t('scenes.building.hiss')}</text>`,

    async arrive({ terrainSvg, fox, wait, terrain }) {
      const hissText = terrainSvg.querySelector('#hiss-text');
      const [x0, y0] = terrain.routePoint(1);
      // The fox walks from the road into the yard to the door of the house.
      fox.poses.add('walking');
      await animate(1100, (t) =>
        terrain.moveFox(x0 + (FOX_SPOT[0] - x0) * t, y0 + (FOX_SPOT[1] - y0) * t),
      );
      fox.poses.remove('walking');
      // The cat steps out of the door and sits in front of the fox.
      await animate(500, (t) =>
        terrain.place(cat!, CAT_SPOT[0], CAT_SPOT[1] - 1.5 * (1 - t), 0, FOX_SPOT),
      );
      fox.poses.add('curious');
      await wait(700);
      // The cat puffs up and hisses, and the fox jumps backwards.
      terrain.pin(hissText!, CAT_SPOT[0] - 1, CAT_SPOT[1], 3.4, HISS_SCALE);
      await animate(250, (t) => {
        cat!.hiss(t);
        hissText!.setAttribute('opacity', String(t));
        terrain.draw();
      });
      await animate(450, (t) => {
        const jump = Math.sin(Math.PI * t);
        terrain.moveFox(
          FOX_SPOT[0] + (BACK_SPOT[0] - FOX_SPOT[0]) * t,
          FOX_SPOT[1] + (BACK_SPOT[1] - FOX_SPOT[1]) * t,
          1.2 * jump,
          10 * jump,
        );
      });
      fox.poses.remove('curious');
      fox.poses.add('facingViewer');
      await wait(1300);
      // The cat calms down and sits again.
      await animate(400, (t) => {
        cat!.hiss(1 - t);
        hissText!.setAttribute('opacity', String(1 - t));
        terrain.draw();
      });
    },

    reset(terrainSvg, terrain) {
      cat ??= Creatures.cat();
      cat.hiss(0);
      cat.removeFromParent();
      terrainSvg.querySelector('#hiss-text')!.setAttribute('opacity', String(0));
      // The fox walks into the yard through the gate (Foxwood.FENCES), so the gate is open.
      terrain.world.gate.open(1);
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.building.lesson.title'),
    instruction: t('scenes.building.lesson.instruction'),
    stage: { camera: [0, 6, 26], gaze: [1.5, 3.5, -3], fox: 2.6, foxPosition: [-8.5, 7] },
    items: [
      {
        name: t('scenes.building.lesson.items.residentialHouse.name'),
        summary: t('scenes.building.lesson.items.residentialHouse.summary'),
        text: t('scenes.building.lesson.items.residentialHouse.text'),
        icon: signIcon('residential', 34, 20),
        show: (o, motion) => build(o, motion, World.models.building('house', 12, 8)),
      },
      {
        name: t('scenes.building.lesson.items.cabin.name'),
        summary: t('scenes.building.lesson.items.cabin.summary'),
        text: t('scenes.building.lesson.items.cabin.text'),
        icon: signIcon('holiday', 22, 16),
        show: (o, motion) => {
          lake(o);
          return build(o, motion, World.models.building('cabin', 7, 5.5));
        },
      },
      {
        name: t('scenes.building.lesson.items.shopOrSchool.name'),
        summary: t('scenes.building.lesson.items.shopOrSchool.summary'),
        text: t('scenes.building.lesson.items.shopOrSchool.text'),
        icon: signIcon('commercial', 44, 24),
        show: (o, motion) => build(o, motion, o.models.shop()),
      },
      {
        name: t('scenes.building.lesson.items.church.name'),
        summary: t('scenes.building.lesson.items.church.summary'),
        text: t('scenes.building.lesson.items.church.text'),
        icon: signIcon('church', 34, 34),
        camera: { position: [0, 9, 34], gaze: [1.5, 8, -3] },
        show: (o, motion) => build(o, motion, o.models.church()),
      },
      {
        name: t('scenes.building.lesson.items.saunaOrBarn.name'),
        summary: t('scenes.building.lesson.items.saunaOrBarn.summary'),
        text: t('scenes.building.lesson.items.saunaOrBarn.text'),
        icon: signIcon('other', 34, 18),
        show: (o, motion) => build(o, motion, World.models.building('barn', 10, 7)),
      },
    ],
  },

  // Orienteering map (the Orienteering Federation's legend): all buildings are black (ISOM 521), a
  // yard is an olive-green forbidden area (520), and a parking area or gravel field is light brown
  // with a black edge (501).
  orienteering: {
    lesson: {
      title: t('scenes.building.orienteeringLesson.title'),
      instruction: t('scenes.building.orienteeringLesson.instruction'),
      stage: { camera: [0, 6, 26], gaze: [1.5, 3.5, -3], fox: 2.6, foxPosition: [-8.5, 7] },
      items: [
        {
          name: t('scenes.building.orienteeringLesson.items.house.name'),
          summary: t('scenes.building.orienteeringLesson.items.house.summary'),
          text: t('scenes.building.orienteeringLesson.items.house.text'),
          icon: icon(`<rect x="33" y="15" width="34" height="20" fill="${V.black}"/>`),
          show: (o, motion) => build(o, motion, World.models.building('house', 12, 8)),
        },
        {
          name: t('scenes.building.orienteeringLesson.items.allBuildings.name'),
          summary: t('scenes.building.orienteeringLesson.items.allBuildings.summary'),
          text: t('scenes.building.orienteeringLesson.items.allBuildings.text'),
          icon: icon(
            `<g fill="${V.black}"><rect x="14" y="12" width="30" height="20"/><rect x="52" y="26" width="12" height="10"/><rect x="72" y="12" width="16" height="12"/></g>`,
          ),
          camera: { position: [0, 9, 34], gaze: [1.5, 8, -3] },
          show: (o, motion) =>
            build(o, motion, o.models.church(), [
              o.add(World.models.building('sauna', 5, 4), [17, 5], -10),
            ]),
        },
        {
          name: t('scenes.building.orienteeringLesson.items.yard.name'),
          summary: t('scenes.building.orienteeringLesson.items.yard.summary'),
          text: t('scenes.building.orienteeringLesson.items.yard.text'),
          icon: icon(`<rect x="22" y="6" width="56" height="38" rx="5" fill="${V.yard}" stroke="${V.black}" stroke-width="1.5"/>
            <rect x="38" y="16" width="24" height="14" fill="${V.black}"/>`),
          show: (o, motion) => yard(o, motion),
        },
        {
          name: t('scenes.building.orienteeringLesson.items.parking.name'),
          summary: t('scenes.building.orienteeringLesson.items.parking.summary'),
          text: t('scenes.building.orienteeringLesson.items.parking.text'),
          icon: icon(
            `<rect x="16" y="8" width="68" height="34" fill="${V.parkingLot}" stroke="${V.black}" stroke-width="1.5"/>`,
          ),
          show: (o, motion) => parking(o, motion),
        },
      ],
    },
  },
};

// ---------- Lesson panel (orienteering map) ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}

// Yard: a mown lawn and bushes around the house. The fox walks to the edge of the yard, stops and
// backs off.
const LAWN: { center: Point; rx: number; rz: number } = { center: [3, -1.5], rx: 11, rz: 10.5 };
async function yard(o: LessonStage, motion: number) {
  const { patch, shrub } = o.models;
  const lawn = o.add(patch(LAWN.rx, LAWN.rz, '#6CC04A', 4, 0.03), LAWN.center);
  const bushes = [
    [-4, -9],
    [11, -8],
    [12, 4],
  ].map(([x, z]) => o.add(shrub(1.4), [x, z]));
  // On the fox's line (z = 7) the edge of the lawn is at about x = -3.5.
  const edge = -5.6;
  const { fox } = o;
  await build(o, motion, World.models.building('house', 12, 8), [lawn, ...bushes]);
  if (!motion) return o.foxTo(edge - 0.6, 7);
  fox.poses.set('walking');
  await o.animate(1000, (t) => o.foxTo(-8.5 + (edge + 8.5) * t, 7));
  fox.poses.set('pawUp');
  await o.pause(500);
  fox.poses.set('curious');
  await o.pause(800);
  fox.poses.set('walking');
  await o.animate(500, (t) => o.foxTo(edge - 0.6 * t, 7));
  fox.poses.set('facingViewer');
}

// Parking lot: a gravel field with two cars. The fox steps to the edge of the field and looks at
// the cars.
async function parking(o: LessonStage, motion: number) {
  const { mesh } = o.models;
  const lot = o.add(mesh(new THREE.BoxGeometry(18, 0.06, 12), '#C9BCA4', 0, 0.03, 0), [4, -2]);
  lot.receiveShadow = true;
  const cars = (
    [
      ['#D9463A', 1],
      ['#2E6FB7', 6.5],
    ] as [string, number][]
  ).map(([color, x]) => o.add(o.models.car(color), [x, -4], -90));
  const { fox } = o;
  if (motion) fox.poses.set('curious');
  await o.grow([lot, ...cars], motion, 800, 0.2);
  if (!motion) return o.foxTo(-4.5, 5);
  fox.poses.set('walking');
  await o.animate(900, (t) => o.foxTo(-8.5 + 4 * t, 7 - 2 * t));
  fox.poses.set('curious');
  const gaze = new THREE.Vector3();
  for (const a of cars) {
    fox.lookAt(gaze.copy(a.position).setY(1));
    await o.pause(700);
  }
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

// ---------- Lesson panel: the colour of a building tells what kind of house it is (MML) ----------
function signIcon(kind: BuildingKind, l: number, k: number) {
  return `<rect width="100" height="50" fill="#fff"/>${Symbols.building(kind, 50, 25, l, k)}`;
}

// To the right of the cabin is a lake with a sandy beach. The beach starts a few metres from the
// cabin, so that the cabin is on dry land.
function lake(o: LessonStage) {
  const { mesh } = o.models;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: '#4F9ACB', specular: '#CFE6F2', shininess: 60 }),
  );
  water.scale.set(30, 1, 16);
  water.position.y = 0.04;
  water.receiveShadow = true;
  const beach = mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), '#E2CE96', 0, 0.02, 0);
  beach.scale.set(31.5, 1, 17.5);
  const g = o.models.group(beach, water);
  o.add(g, [42, -8]);
}

// The building (and other things) grows from the ground, and the fox wonders.
async function build(
  o: LessonStage,
  motion: number,
  model: THREE.Object3D,
  others: THREE.Object3D[] = [],
) {
  o.add(model, [3, -3], -25);
  if (motion) o.fox.poses.set('curious');
  await o.grow([...others, model], motion);
  if (motion) await o.pause(250);
  o.fox.poses.set('facingViewer');
}

export { scene as building };
