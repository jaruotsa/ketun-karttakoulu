// Campfire scene: the fox walks along the path to the campfire site on the lakeshore. The fire
// lights up, and the fox roasts a sausage.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The campfire site is at the end of the
// path on the lakeshore, south of the path. The fox steps from the path next to the fire, and Fox
// Lake is visible in the background. The stones, trees, flames and sparks of the fire are 3D
// models.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { Terrain } from '../sign-terrain';
import type { Vec3 } from '../types';

const CAMPFIRE = Foxwood.CAMPFIRE;
// The fox stands west of the fire, so that the sausage stick reaches the fire.
const FOX_SPOT = [CAMPFIRE[0] - 7, CAMPFIRE[1] - 1];
// The flames and sparks are 3D (creatures.ts), the flames about 2.5 m high. They flicker all the
// time while the fire burns.
let flames: ReturnType<typeof Creatures.flames> | null = null;
let stopFlicker: (() => void) | null = null;

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
};

function mix(a: Vec3, b: Vec3, t: number) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

export { scene as campfire };
