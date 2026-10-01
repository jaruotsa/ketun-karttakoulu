// Bridge scene: the fox walks along the track to the road and along the edge of the road to the
// bank of the brook below the bridge. A car drives over the bridge, and a leaf floats under it: the
// road goes over the water, the water flows under the road.
//
// On the map the bridge is a part of the road where the red fill is almost black (MML). The terrain
// is the 3D world of Foxwood (sign-terrain.ts): the channel of the brook is deep at the bridge, and
// the bridge is a 3D model (world.ts). At the end the camera looks from the south-west over the
// farmyard, so the bridge is in front and the brook flows under it.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Terrain } from '../sign-terrain';
import type { Point } from '../types';

// The centre of the bridge on the map (World is loaded only later, so the centre is computed from
// Foxwood).
const {
  start: [ax, ay],
  end: [bx, by],
} = Foxwood.BRIDGE;
const BRIDGE_CENTER: Point = [(ax + bx) / 2, (ay + by) / 2];
// The car drives east in the right lane (the south side of the road) over the bridge.
const DRIVE: [number, number] = [0.33, 0.6];
const LANE = 1.8;
// The leaf floats from the start of the brook (the north edge of the map) under the bridge and past
// the fox.
const FLOW: [number, number] = [0, 0.32];
// At the end the camera is in the south-west over the yard. A gap is left in the forest from there
// to the fox, so that the trees do not hide the fox.
const CAMERA_SPOT: Point = [244, 45];
const FOX_SPOT: Point = [290, 40];
let car: ReturnType<Terrain['world']['createCar']> | null = null;
let leaf: ReturnType<typeof Creatures.leaf> | null = null;
// In the lesson panel the fox walks from left to right along the line z = FOX_Z.
const FOX_Z = 3;

const scene: Scene = {
  map: Foxwood.map({
    // Along the track to the road, along the edge of the road east and to the bank of the brook
    // below the bridge.
    route:
      'M30,345 C45,300 55,260 70,215 C80,185 90,160 106,144 C130,142 185,146 198,120 C204,96 196,54 197,30 C198,22 204,18 214,18 L246,18 C262,18 276,31 290,40',
    name: t('scenes.bridge.mapLabel'),
    namePosition: [400, 45],
    nameColor: '#3D0F06',
  }),
  feature: 'bridge',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: {
      behind: 42,
      height: 18,
      ahead: 10,
      direction: [0, -62],
      gaze: { point: [281, 25], start: 0.75 },
      fox: 5,
    },
    overlay: `
      <path id="car-road-line" d="${Foxwood.shapes.carRoad}" fill="none" stroke="none"/>
      <path id="stream-line" d="${Foxwood.shapes.stream}" fill="none" stroke="none"/>`,

    async arrive({ terrainSvg, fox, wait, terrain }) {
      const { world } = terrain;
      terrain.turnFox(...BRIDGE_CENTER);
      fox.poses.add('curious');
      await wait(400);
      // The car drives over the bridge. The fox follows it with its gaze.
      const roadLine = terrainSvg.querySelector<SVGGeometryElement>('#car-road-line')!;
      const roadLength = roadLine.getTotalLength();
      await animate(3600, (t) => {
        const s = (DRIVE[0] + (DRIVE[1] - DRIVE[0]) * t) * roadLength;
        const a = roadLine.getPointAtLength(s);
        const b = roadLine.getPointAtLength(s + 1);
        const direction = Math.atan2(b.y - a.y, b.x - a.x);
        car!.place(a.x - Math.sin(direction) * LANE, a.y + Math.cos(direction) * LANE, direction);
        fox.lookAt(car!.position.clone().setY(car!.position.y + 2));
        terrain.draw();
      });
      car!.visible = false;
      await wait(300);
      // The leaf floats at the bottom of the channel under the bridge. At the bridge it is hidden
      // under the deck.
      const brookLine = terrainSvg.querySelector<SVGGeometryElement>('#stream-line')!;
      const brookLength = brookLine.getTotalLength();
      await animate(3800, (t) => {
        const q = brookLine.getPointAtLength((FLOW[0] + (FLOW[1] - FLOW[0]) * t) * brookLength);
        terrain.place(
          leaf!,
          q.x,
          q.y,
          world.heightAt(q.x, q.y) - world.surface(q.x, q.y) + 0.15,
          0.6 + 0.8 * Math.sin(t * 8),
        );
        leaf!.visible = t > 0.02 && t < 0.97;
        fox.lookAt(leaf!.position);
      });
      leaf!.removeFromParent();
      fox.lookAt(null);
      fox.poses.remove('curious');
      fox.poses.add('facingViewer');
      await wait(700);
    },

    reset(_terrainSvg, terrain) {
      // A gap at the route (as in sign-terrain.ts) and in the line of sight from the camera to the
      // fox.
      const route = Array.from({ length: 201 }, (_, i) => terrain.routePoint(i / 200));
      const view = Array.from(
        { length: 17 },
        (_, i): Point => [
          CAMERA_SPOT[0] + ((FOX_SPOT[0] - CAMERA_SPOT[0]) * i) / 16,
          CAMERA_SPOT[1] + ((FOX_SPOT[1] - CAMERA_SPOT[1]) * i) / 16,
        ],
      );
      terrain.world.clearing([...route, ...view], 6);
      car ??= terrain.world.createCar('#2E6FB7');
      car.visible = false;
      // The leaf is bigger than in the brook scene, so that it can be seen from behind the bridge.
      leaf ??= Creatures.leaf();
      leaf.scale.setScalar(2.6);
      leaf.removeFromParent();
      terrain.fox.lookAt(null);
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.bridge.lesson.title'),
    instruction: t('scenes.bridge.lesson.instruction'),
    stage: { camera: [4.5, 4.2, 16], gaze: [4.5, 0.6, -1], fox: 1.4, foxPosition: [-3.5, FOX_Z] },
    items: [
      {
        name: t('scenes.bridge.lesson.items.bridge.name'),
        summary: t('scenes.bridge.lesson.items.bridge.summary'),
        text: t('scenes.bridge.lesson.items.bridge.text'),
        icon: icon(`<path d="M50,0 C44,12 56,20 50,30 C45,38 52,44 50,50" fill="none" stroke="#0074B0" stroke-width="3"/>
          <path d="M4,25 H96" stroke="#1a1a1a" stroke-width="9"/><path d="M4,25 H96" stroke="#B0412E" stroke-width="5.4"/>
          <path d="M36,25 H64" stroke="#3D0F06" stroke-width="5.4"/>`),
        show: (o, motion) => crossBridge(o, motion),
      },
      {
        name: t('scenes.bridge.lesson.items.boardwalk.name'),
        summary: t('scenes.bridge.lesson.items.boardwalk.summary'),
        text: t('scenes.bridge.lesson.items.boardwalk.text'),
        icon: icon(`<rect x="6" y="8" width="88" height="34" rx="10" fill="#DCC98A"/>
          <g stroke="#1B8FD6" stroke-width="1.4">${[14, 20, 30, 36].map((y) => `<line x1="10" x2="90" y1="${y}" y2="${y}"/>`).join('')}</g>
          <path d="${Array.from({ length: 7 }, (_, i) => `M${20 + i * 10},${32.5 - i * 4} v7 M${16.5 + i * 10},${36 - i * 4} h7`).join(' ')}" stroke="#1a1a1a" stroke-width="2"/>`),
        camera: { position: [6, 5, 17], gaze: [6, 0.3, -1] },
        show: (o, motion) => boardwalk(o, motion),
      },
      {
        name: t('scenes.bridge.lesson.items.ferry.name'),
        summary: t('scenes.bridge.lesson.items.ferry.summary'),
        text: t('scenes.bridge.lesson.items.ferry.text'),
        icon: icon(`<rect x="30" width="40" height="50" fill="#71C8E6"/><path d="M30,0 V50 M70,0 V50" stroke="#0067A5" stroke-width="2"/>
          <path d="M2,25 H30 M70,25 H98" stroke="#1a1a1a" stroke-width="7"/><path d="M2,25 H30 M70,25 H98" stroke="#B0412E" stroke-width="4"/>
          <path d="M33,25 H68" stroke="#C8602E" stroke-width="2.6" stroke-dasharray="6 4"/>`),
        camera: { position: [8, 6.5, 22], gaze: [8, 0.3, -1] },
        show: (o, motion) => ferry(o, motion),
      },
    ],
  },
};

// ---------- Lesson panel: bridge, boardwalk and ferry on the 3D stage (lesson-panel.ts) ----------
// The sizes are in metres and real size (the fox about 1.4 m). The water flows from far in the
// north towards the viewer.
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/><g fill="none">${content}</g>`;
}

// Flowing water: a strip from x0 to x1, the banks and light streaks of the current that move
// towards the viewer. The water starts from behind the forest of the background, so that it does
// not flow through the trees.
function water(o: LessonStage, x0: number, x1: number, speed = 1.6) {
  const { strip, group, seeded } = o.models;
  const width = x1 - x0;
  const middle = () => (x0 + x1) / 2;
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: '#3F92C8',
    specular: '#D6ECF6',
    shininess: 70,
  });
  const g = group(
    strip(middle, width + 0.8, -31, 30, '#7A5E3E', 0.012),
    strip(middle, width, -31, 30, null, 0.03, waterMaterial),
  );
  const r = seeded(5);
  // The streaks are thin and faint, so that the water does not look like a road with a centre line.
  const streakMaterial = new THREE.MeshBasicMaterial({
    color: '#D6ECF6',
    transparent: true,
    opacity: 0.45,
  });
  const streaks = Array.from({ length: Math.round(width * 5) }, () => {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.5).rotateX(-Math.PI / 2),
      streakMaterial,
    );
    streak.userData = { x: x0 + 0.3 + r() * (width - 0.6), offset: r() * 40 };
    g.add(streak);
    return streak;
  });
  o.add(g);
  o.everyFrame((time) => {
    for (const j of streaks)
      j.position.set(j.userData.x, 0.04, -28 + ((j.userData.offset + time * speed) % 40));
  });
}

// A road as a strip along the x axis from x0 to x1 (at z = ROAD_Z in the middle).
const ROAD_Z = 2.4;
function road(o: LessonStage, x0: number, x1: number, width: number) {
  const { strip, group } = o.models;
  // The strip runs along the z axis, so it is turned to run along the x axis.
  const g = group(
    strip(() => 0, width + 1.2, x0, x1, '#BCAE8C', 0.015),
    strip(() => 0, width, x0, x1, '#5A5B60', 0.025),
  );
  for (const s of [-1, 1])
    g.add(strip(() => s * (width / 2 - 0.3), 0.12, x0, x1, '#F4F1E8', 0.035));
  return o.add(g, [0, ROAD_Z], 90);
}

// Bridge: a deck (the Foxwood model at real size) between two ramps. The brook flows under the
// deck.
const BRIDGE_SPEC = { x0: 1, x1: 8, height: 1.2, ramp: 5, width: 4.4 };
function bridgeHeight(x: number) {
  const { x0, x1, height, ramp } = BRIDGE_SPEC;
  return (
    height * Math.min(1, Math.max(0, Math.min((x - (x0 - ramp)) / ramp, (x1 + ramp - x) / ramp)))
  );
}
function bridge(o: LessonStage) {
  const { x0, x1, height, ramp, width } = BRIDGE_SPEC;
  const { group, material, castShadows } = o.models;
  const deck = World.models.bridge(x1 - x0, width, 1, 0.5);
  deck.position.set((x0 + x1) / 2, height, 0);
  const g = group(deck);
  // The ramps: gravel fill with asphalt on top.
  for (const [offset, direction] of [
    [x0, -1],
    [x1, 1],
  ] as [number, number][]) {
    const shape = new THREE.Shape([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0, height),
      new THREE.Vector2(direction * ramp, 0),
    ]);
    for (const [l, color, lift] of [
      [width + 1.2, '#BCAE8C', -0.02],
      [width - 0.4, '#5A5B60', 0],
    ] as [number, string, number][]) {
      const m = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: l, bevelEnabled: false }).translate(0, 0, -l / 2),
        material(color, { side: THREE.DoubleSide }),
      );
      m.position.set(offset, lift, 0);
      g.add(m);
    }
  }
  o.add(castShadows(g), [0, ROAD_Z]);
}

// The fox walks over the bridge, stops in the middle to look down at the water and continues to the
// other side.
async function crossBridge(o: LessonStage, motion: number) {
  water(o, 3, 6);
  road(o, -40, BRIDGE_SPEC.x0 - BRIDGE_SPEC.ramp, BRIDGE_SPEC.width);
  road(o, BRIDGE_SPEC.x1 + BRIDGE_SPEC.ramp, 40, BRIDGE_SPEC.width);
  bridge(o);
  const { fox } = o;
  const walkTo = (x: number) => o.foxTo(x, FOX_Z, bridgeHeight(x));
  const [offset, middle, end] = [-3.5, 4.5, 11.5];
  if (!motion) return walkTo(end);
  walkTo(offset);
  await o.pause(300);
  fox.poses.set('walking');
  await o.animate(2600, (t) => walkTo(offset + (middle - offset) * t));
  fox.poses.set('curious');
  fox.lookAt(new THREE.Vector3(middle, 0, FOX_Z + 3));
  await o.pause(1200);
  fox.lookAt(null);
  fox.poses.set('walking');
  await o.animate(2000, (t) => walkTo(middle + (end - middle) * t));
  fox.poses.set('facingViewer');
}

// Mire: a wet, brownish-green area with pools of water, tussocks and cotton grass.
// The boardwalk is pairs of planks with crossbeams at their ends.
const BOARDWALK = { x0: -2, x1: 16, plank: 3.6 };
async function boardwalk(o: LessonStage, motion: number) {
  const { mesh, group, castShadows, seeded } = o.models;
  const r = seeded(8);
  const mire = mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), '#A09A5C', 8, 0.01, -6);
  mire.scale.set(11, 1, 16);
  const g = group(mire);
  const pond = new THREE.MeshPhongMaterial({
    color: '#46626E',
    specular: '#CFE6F2',
    shininess: 60,
  });
  for (const [x, z, rx, rz] of [
    [1, 6, 1.6, 0.8],
    [9, 5.5, 2.2, 1],
    [4, 0.2, 1.8, 0.9],
    [12, -1, 1.4, 0.7],
    [6, -6, 2.6, 1.2],
    [-1, -3, 1.6, 0.8],
    [14, -8, 2, 1],
  ]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), pond);
    m.position.set(x, 0.02, z);
    m.scale.set(rx, 1, rz);
    g.add(m);
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = [r() * 17, -14 + r() * 22];
    if (Math.abs(z - FOX_Z) < 1) continue;
    const tussock = mesh(
      new THREE.IcosahedronGeometry(0.35 + r() * 0.25, 0),
      r() < 0.5 ? '#8E8A4A' : '#B8B56E',
      x,
      0.05,
      z,
    );
    tussock.scale.y = 0.6;
    g.add(tussock);
    // The white tufts of the cotton grass.
    if (r() < 0.5) g.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), '#FBF8F0', x + 0.1, 0.55, z));
  }
  for (let x = BOARDWALK.x0; x < BOARDWALK.x1; x += BOARDWALK.plank) {
    for (const dz of [-0.17, 0.17])
      g.add(
        mesh(
          new THREE.BoxGeometry(BOARDWALK.plank - 0.05, 0.1, 0.3),
          '#A98B63',
          x + BOARDWALK.plank / 2,
          0.22,
          FOX_Z + dz,
        ),
      );
    g.add(
      mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.9, 6).rotateX(Math.PI / 2),
        '#7A5E3E',
        x + 0.15,
        0.1,
        FOX_Z,
      ),
    );
  }
  o.add(castShadows(g));
  const { fox } = o;
  const walkTo = (x: number) => o.foxTo(x, FOX_Z, x > BOARDWALK.x0 ? 0.27 : 0);
  const [offset, end] = [-3, 13.5];
  if (!motion) return walkTo(end);
  walkTo(offset);
  await o.pause(300);
  fox.poses.set('walking');
  await o.animate(4200, (t) => walkTo(offset + (end - offset) * t));
  fox.poses.set('facingViewer', 'cheering');
}

// Ferry: a wide river that the ferry crosses along cables. The road continues on both banks.
const RIVER = { x0: 1, x1: 16 };
const FERRY = { length: 6, width: 4.2, deck: 0.4 };
async function ferry(o: LessonStage, motion: number) {
  const { mesh, group, castShadows } = o.models;
  const { box } = World.models;
  water(o, RIVER.x0, RIVER.x1, 0.8);
  road(o, -40, RIVER.x0, 4.4);
  road(o, RIVER.x1, 40, 4.4);
  // Cables on the surface of the water on both sides of the ferry.
  for (const s of [-1, 1])
    o.add(
      mesh(
        new THREE.BoxGeometry(RIVER.x1 - RIVER.x0, 0.05, 0.05),
        '#3A3E42',
        (RIVER.x0 + RIVER.x1) / 2,
        0.08,
        ROAD_Z + s * (FERRY.width / 2 + 0.2),
      ),
    );
  // The ferry: a blue hull, a grey deck, yellow railings and a white wheelhouse.
  const { length: L, width: K, deck } = FERRY;
  const g = group(
    box(L, deck + 0.3, K, '#2E6FB7', 0, -0.3, 0),
    box(L, 0.04, K - 0.3, '#8E8A80', 0, deck, 0),
    box(L, 0.6, 0.1, '#E8B830', 0, deck, K / 2 - 0.05),
    box(L, 0.6, 0.1, '#E8B830', 0, deck, -K / 2 + 0.05),
    box(1.2, 1.8, 1, '#F4F1E8', 0, deck, -K / 2 + 0.6),
    box(1.3, 0.5, 1.1, '#3C4A55', 0, deck + 1.1, -K / 2 + 0.6),
  );
  const hull = o.add(castShadows(g), [RIVER.x0 + L / 2, ROAD_Z]);
  const distance = RIVER.x1 - RIVER.x0 - L;
  const { fox } = o;
  const rideOffset = 1.2; // the fox's position from the middle of the ferry
  if (!motion) {
    hull.position.x += distance;
    return o.foxTo(RIVER.x1 + 2, FOX_Z);
  }
  o.foxTo(-3, FOX_Z);
  await o.pause(300);
  // The fox steps onto the ferry.
  fox.poses.set('walking');
  const ferryX = RIVER.x0 + L / 2 + rideOffset;
  await o.animate(1600, (t) => {
    const x = -3 + (ferryX - -3) * t;
    o.foxTo(x, FOX_Z, x > RIVER.x0 ? deck : 0);
  });
  fox.poses.set('curious');
  await o.pause(300);
  // The ferry glides across the river. It rocks slightly.
  const x0 = hull.position.x;
  await o.animate(4200, (t) => {
    const p = t * t * (3 - 2 * t);
    hull.position.x = x0 + distance * p;
    hull.rotation.z = 0.015 * Math.sin(t * 12);
    o.foxTo(ferryX + distance * p, FOX_Z, deck);
  });
  hull.rotation.z = 0;
  // The fox steps onto the bank.
  fox.poses.set('walking');
  const x1 = ferryX + distance;
  await o.animate(1000, (t) => {
    const x = x1 + (RIVER.x1 + 2 - x1) * t;
    o.foxTo(x, FOX_Z, x < RIVER.x1 ? deck : 0);
  });
  fox.poses.set('facingViewer', 'cheering');
}

export { scene as bridge };
