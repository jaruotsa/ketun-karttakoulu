// Lookout tower scene: the fox walks along the path and climbs the hill. There is a lookout tower
// at the top of the hill, and the fox climbs its stairs. From the tower the fox looks over the
// forest to the lake. Finally the camera rises straight above the tower, and the terrain turns into
// a map: from above the landscape looks like a map.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts), and the tower is a 3D model (world.ts).
// The stairs wind around the outside of the tower (World.TOWER.porras), so the fox climbs them.
import * as THREE from 'three';
import { Symbols } from '../symbols';
import { Foxwood } from '../foxwood';
import { animate } from '../animation';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Point, Vec3 } from '../types';

const TOWER = Foxwood.LOOKOUT_TOWER;
const VIEW_HEIGHT = 330;
// From the tower the fox looks east to the lake.
const LAKE_VIEW: Point = [480, 190];
// The state of the parts (World.PARTS: forest, field, mire, hill, lake, path): 0 = terrain, 1 =
// map.
const partStates = (t: number) => World.PARTS.map(() => t);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const scene: Scene = {
  map: Foxwood.map({
    // Along the path to the slope of the hill. The route ends on the slope, so that the fox sign on
    // the map does not cover the tower sign.
    route: 'M30,345 C110,335 140,290 210,292 C240,293 262,262 266,232 C268,215 266,204 264,196',
    name: t('scenes.lookoutTower.mapLabel'),
    namePosition: [150, 196],
    nameColor: '#5A4636',
  }),
  feature: 'lookoutTower',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: {
      behind: 44,
      height: 19,
      ahead: 14,
      direction: [0, -20],
      gaze: { point: TOWER, start: 0.6 },
      fox: 5,
    },
    overlay: '',

    async arrive({ fox, wait, terrain }) {
      const { world } = terrain;
      const T = World.TOWER;
      const [cx, cy] = TOWER;
      const base = world.towerBase();
      // A point of the tower [x, y, height] in map coordinates; the height is the world height.
      const toMap = ([x, h, z]: number[]) => [cx + x, cy + z, base + h];
      const moveFox = (x: number, y: number, h: number, angle = 0) =>
        terrain.moveFox(x, y, h - world.surface(x, y), angle);

      // The fox walks from the slope to the foot of the tower.
      const [x0, y0] = terrain.routePoint(1);
      const [ax, ay] = toMap(T.stairs(0));
      fox.poses.add('walking');
      await animate(1800, (t) => terrain.moveFox(x0 + (ax - x0) * t, y0 + (ay - y0) * t));

      // The fox climbs the stairs two rounds up. The camera rises with it.
      const cameraPath = (t: number): [Vec3, Vec3] => [
        [cx - 40, cy + 40, base + 12 + 18 * t],
        [cx, cy, base + 5 + 13 * t],
      ];
      await animate(7500, (t) => {
        const [x, y, h] = toMap(T.stairs(t));
        moveFox(x, y, h + 0.15, -14);
        terrain.fly(smooth(Math.min(1, t * 4)), ...cameraPath(t));
      });

      // On the platform the fox steps to the middle and turns to look at the lake.
      const [bx, by, bh] = toMap(T.stairs(1));
      const [ex, ey] = [cx + 1.5, cy + 0.5];
      await animate(900, (t) => moveFox(bx + (ex - bx) * t, by + (ey - by) * t, bh + 0.05));
      fox.poses.remove('walking');
      terrain.turnFox(...LAKE_VIEW);

      // The camera flies behind the fox and looks over its shoulder over the forest to the lake.
      const [p1, q1] = cameraPath(1);
      const p2: Vec3 = [cx - 22, cy + 5, bh + 4.5];
      const q2: Vec3 = [LAKE_VIEW[0], LAKE_VIEW[1], 0];
      await animate(2600, (t) =>
        terrain.fly(1, lerp3(p1, p2, smooth(t)), lerp3(q1, q2, smooth(t))),
      );
      fox.poses.add('facingViewer');
      await wait(1400);
      fox.poses.remove('facingViewer');

      // The camera rises straight above the tower, and the terrain turns into a map.
      await animate(3200, (t) => {
        const p = smooth(t);
        terrain.fromAbove(p, cx, cy, VIEW_HEIGHT);
        fox.visibility(1 - Math.min(1, Math.max(0, (p - 0.5) / 0.3)));
      });
      await animate(2200, (t) => {
        world.setParts(partStates(t));
        terrain.draw();
      });
      await wait(500);
    },

    reset(_terrainSvg, terrain) {
      terrain.fox.visibility(1);
      terrain.world.setParts(partStates(0));
      terrain.fromAbove(0);
      terrain.fly(0);
    },
  },

  lesson: {
    title: t('scenes.lookoutTower.lesson.title'),
    instruction: t('scenes.lookoutTower.lesson.instruction'),
    stage: {
      camera: [0, 2.6, 15],
      gaze: [3, 8, -12],
      fov: 50,
      fox: 1.4,
      foxPosition: [-3, 2.5],
      foxDirection: -20,
    },
    items: [
      {
        name: t('scenes.lookoutTower.lesson.items.lookoutTower.name'),
        summary: t('scenes.lookoutTower.lesson.items.lookoutTower.summary'),
        text: t('scenes.lookoutTower.lesson.items.lookoutTower.text'),
        icon: icon(Symbols.lookoutTower(50, 34, 2.6)),
        show: (o, motion) => raise(o, motion, lookoutTower(o)),
      },
      {
        name: t('scenes.lookoutTower.lesson.items.windTurbine.name'),
        summary: t('scenes.lookoutTower.lesson.items.windTurbine.summary'),
        text: t('scenes.lookoutTower.lesson.items.windTurbine.text'),
        icon: icon(Symbols.windTurbine(50, 38, 2.9)),
        camera: { position: [0, 3, 34], gaze: [4, 17, -20] },
        show: (o, motion) => raise(o, motion, windTurbine(o)),
      },
      {
        name: t('scenes.lookoutTower.lesson.items.waterTower.name'),
        summary: t('scenes.lookoutTower.lesson.items.waterTower.summary'),
        text: t('scenes.lookoutTower.lesson.items.waterTower.text'),
        icon: icon(Symbols.waterTower(50, 25, 2.4)),
        camera: { position: [0, 3, 26], gaze: [4, 12, -16] },
        show: (o, motion) => raise(o, motion, waterTower(o)),
      },
      {
        name: t('scenes.lookoutTower.lesson.items.mast.name'),
        summary: t('scenes.lookoutTower.lesson.items.mast.summary'),
        text: t('scenes.lookoutTower.lesson.items.mast.text'),
        icon: icon(Symbols.mast(50, 30, 2.2)),
        camera: { position: [0, 3, 34], gaze: [4, 17, -20] },
        show: (o, motion) => raise(o, motion, mast(o)),
      },
    ],
  },
};

// ---------- Lesson panel: towers and masts on the 3D stage (lesson-panel.ts) ---------- The sizes
// are in metres (the fox is 1.4 m). The wind turbine and the mast are smaller than real, so that
// they fit in the picture. The towers are behind the fox in front of the forest.
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}

// The lookout tower is the Foxwood model scaled down (the platform at a height of about 12 m).
function lookoutTower(o: LessonStage) {
  const tower = World.models.lookoutTower();
  tower.scale.setScalar(0.6);
  return { target: o.add(tower, [4, -12], -20), top: [4, 15, -12] as Vec3 };
}

// Wind turbine: a white conical tower, a nacelle and three blades that spin in the wind.
function windTurbine(o: LessonStage) {
  const { mesh, group, castShadows } = o.models;
  const HEIGHT = 32;
  const g = group(
    mesh(new THREE.CylinderGeometry(0.9, 1.8, HEIGHT, 14).translate(0, HEIGHT / 2, 0), '#F2F2EE'),
  );
  g.add(mesh(new THREE.BoxGeometry(2, 2.2, 5).translate(0, 0, -1), '#E8E8E2', 0, HEIGHT + 0.6, 0));
  const rotor = group(mesh(new THREE.ConeGeometry(0.9, 1.8, 12).rotateX(Math.PI / 2), '#F2F2EE'));
  rotor.position.set(0, HEIGHT + 0.6, 2.2);
  const blade = new THREE.Shape([
    new THREE.Vector2(-0.7, 0),
    new THREE.Vector2(0.7, 0),
    new THREE.Vector2(0.2, 14),
    new THREE.Vector2(-0.1, 14),
  ]);
  for (let i = 0; i < 3; i++) {
    const m = mesh(
      new THREE.ExtrudeGeometry(blade, { depth: 0.2, bevelEnabled: false }),
      '#F7F7F2',
    );
    m.rotation.z = (i * Math.PI * 2) / 3;
    rotor.add(m);
  }
  g.add(rotor);
  o.everyFrame((time) => (rotor.rotation.z = time * 0.9));
  return { target: o.add(castShadows(g), [6, -22]), top: [6, HEIGHT, -22] as Vec3 };
}

// Water tower: a narrow leg with a wide tank on top.
function waterTower(o: LessonStage) {
  const { mesh, group, castShadows } = o.models;
  const profile = [
    [0, 0],
    [2.4, 0],
    [2.2, 15],
    [3.2, 17],
    [8, 20],
    [8.6, 22.5],
    [7.6, 25],
    [4, 26],
    [0, 26.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = group(mesh(new THREE.LatheGeometry(profile, 28), '#E4E0D6'));
  // A row of windows on the side of the tank.
  g.add(
    mesh(new THREE.CylinderGeometry(8.62, 8.62, 0.7, 28, 1, true).translate(0, 22.2, 0), '#8FA6B4'),
  );
  return { target: o.add(castShadows(g), [5, -16]), top: [5, 24, -16] as Vec3 };
}

// Mast: a narrow red-and-white lattice mast supported by guy wires. There is a red light at the
// top.
function mast(o: LessonStage) {
  const { mesh, group, castShadows } = o.models;
  const { beam } = World.models;
  const HEIGHT = 38;
  const g = group();
  for (let y = 0; y < HEIGHT; y += 5)
    g.add(
      mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 5, 6).translate(0, y + 2.5, 0),
        (y / 5) % 2 ? '#F4F1E8' : '#D9463A',
      ),
    );
  g.add(mesh(new THREE.SphereGeometry(0.5, 10, 8), '#FF4A3A', 0, HEIGHT + 0.4, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.4;
    const anchor: Vec3 = [Math.cos(a) * 18, 0, Math.sin(a) * 18];
    for (const h of [14, 28]) g.add(beam([0, h, 0], anchor, 0.06, '#5A5B60'));
  }
  return { target: o.add(castShadows(g), [6, -22]), top: [6, HEIGHT, -22] as Vec3 };
}

// The tower rises from the ground, and the fox looks up at its top.
async function raise(
  o: LessonStage,
  motion: number,
  { target, top }: { target: THREE.Object3D; top: Vec3 },
) {
  const { fox } = o;
  fox.poses.set('curious');
  fox.lookAt(new THREE.Vector3(...top));
  await o.grow([target], motion, 1400);
  if (motion) await o.pause(600);
  fox.lookAt(null);
  fox.poses.set('facingViewer');
}

export { scene as lookoutTower };
