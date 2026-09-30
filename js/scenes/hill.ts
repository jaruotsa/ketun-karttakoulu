// Hill scene: the fox walks along the path and climbs to the top of the hill. The brown contour
// lines of the map are drawn on the slope. At the end the camera rises into the air and looks
// straight down, and the terrain turns into a map: seen from above, the contours are the same as on
// the map.
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts), where the height of the hill is
// computed from the contours of the map. The fox climbs the slope along the ground surface, so no
// separate hill shape is needed.
import * as THREE from 'three';
import * as FoxSvg from '../fox-svg';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { World } from '../world';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Point } from '../types';

// The summit of the hill (map coordinates) and the height from which the camera looks down (m).
const SUMMIT: Point = [276, 176];
const VIEW_HEIGHT = 330;
// The state of the parts (World.PARTS: forest, field, mire, hill, lake, path): 0 = terrain, 1 =
// map.
const partStates = (t: number) => World.PARTS.map(() => t);
// Lesson panel (orienteering map): the colour of the contours and the line the fox starts from.
const BROWN = Orienteering.COLORS.brown;
const FOX_Z = 3;

const scene: Scene = {
  map: Foxwood.map({
    route: 'M30,345 C110,335 140,290 210,292 C240,293 262,262 268,232 C272,212 274,194 276,180',
    name: t('scenes.hill.mapLabel'),
    namePosition: [150, 196],
    nameColor: '#B8652A',
  }),
  feature: 'hill',
  bubblePosition: { x: 4, y: 6 },

  terrain: {
    camera: { behind: 44, height: 19, ahead: 14, direction: [0, -15], fox: 5 },
    overlay: `
      <g id="fox-marker" opacity="0">${FoxSvg.mapMarker()}</g>`,

    async arrive({ terrainSvg, fox, wait, terrain }) {
      const { world } = terrain;
      const sign = terrainSvg.querySelector('#fox-marker');
      fox.poses.add('facingViewer');
      await wait(600);
      // The contours of the map are drawn on the slope.
      await animate(1500, (t) => {
        world.contours(t);
        terrain.draw();
      });
      await wait(900);
      // The camera rises into the air and looks straight down at the summit. From above the fox is
      // shown as a map sign.
      terrain.pin(sign!, ...SUMMIT, 0, 1);
      await animate(3200, (t) => {
        const p = t * t * (3 - 2 * t);
        terrain.fromAbove(p, ...SUMMIT, VIEW_HEIGHT);
        fox.visibility(1 - Math.min(1, Math.max(0, (p - 0.5) / 0.3)));
        sign!.setAttribute('opacity', String(Math.min(1, Math.max(0, (p - 0.6) / 0.3))));
      });
      // The hill flattens and the whole terrain turns into a map.
      await animate(2200, (t) => {
        world.setParts(partStates(t));
        terrain.draw();
      });
      await wait(500);
    },

    reset(terrainSvg, terrain) {
      terrain.fox.visibility(1);
      terrainSvg.querySelector('#fox-marker')!.setAttribute('opacity', String(0));
      terrain.world.setParts(partStates(0));
      terrain.world.contours(0);
      terrain.fromAbove(0);
    },
  },

  // On the orienteering map landforms are brown contours (ISOM 101–103).
  orienteering: {
    lesson: {
      title: t('scenes.hill.orienteeringLesson.title'),
      instruction: t('scenes.hill.orienteeringLesson.instruction'),
      stage: { camera: [2, 7, 17], gaze: [4, 1, -2], fox: 1.5, foxPosition: [-3, FOX_Z] },
      items: [
        {
          name: t('scenes.hill.orienteeringLesson.items.gentleHill.name'),
          summary: t('scenes.hill.orienteeringLesson.items.gentleHill.summary'),
          text: t('scenes.hill.orienteeringLesson.items.gentleHill.text'),
          icon: icon(rings([1, 0.55])),
          camera: { position: [1, 7, 16], gaze: [4.5, 2.2, -3] },
          show: (o, motion) =>
            climb(
              o,
              motion,
              hill(o, { center: [6, -3], height: 4, radius: 10, contours: [1.3, 2.6] }),
              false,
            ),
        },
        {
          name: t('scenes.hill.orienteeringLesson.items.steepHill.name'),
          summary: t('scenes.hill.orienteeringLesson.items.steepHill.summary'),
          text: t('scenes.hill.orienteeringLesson.items.steepHill.text'),
          icon: icon(rings([1, 0.8, 0.6, 0.4])),
          show: (o, motion) =>
            climb(
              o,
              motion,
              hill(o, { center: [6, -3], height: 6.5, radius: 5, contours: [1.3, 2.6, 3.9, 5.2] }),
              true,
            ),
        },
        {
          name: t('scenes.hill.orienteeringLesson.items.mound.name'),
          summary: t('scenes.hill.orienteeringLesson.items.mound.summary'),
          text: t('scenes.hill.orienteeringLesson.items.mound.text'),
          icon: icon(rings([0.7], 'stroke-dasharray="7 4"')),
          show: (o, motion) =>
            crossKnoll(
              o,
              motion,
              hill(o, {
                center: [5, FOX_Z - 0.5],
                height: 0.8,
                radius: 4.5,
                contours: [0.55],
                dashed: true,
              }),
            ),
        },
      ],
    },
  },
};

// ---------- Lesson panel (orienteering map): landforms on the 3D stage (lesson-panel.ts)
// ----------
function icon(content: string) {
  return `<rect width="100" height="50" fill="#fff"/>${content}`;
}
// Nested contours on the map: the sizes relative to the outermost.
function rings(sizes: number[], extra = '') {
  return `<g fill="none" stroke="${BROWN}" stroke-width="2.5" ${extra}>${sizes.map((k: number) => `<ellipse cx="50" cy="25" rx="${40 * k}" ry="${20 * k}"/>`).join('')}</g>`;
}

// A round hill: the height h(r) = height · (1 + cos(π r / radius)) / 2. The contours go around the
// hill at the given heights. A round hill on the 3D stage: the mound, the contour rings (hidden at
// first) and the height of the ground at a point (x, z).
interface Hill {
  mound: THREE.Group;
  rings: THREE.Group[];
  onSurface: (x: number, z: number) => number;
  center: Point;
  radius: number;
}
function hill(
  o: LessonStage,
  {
    center,
    height,
    radius,
    contours,
    dashed = false,
  }: { center: Point; height: number; radius: number; contours: number[]; dashed?: boolean },
): Hill {
  const { group, castShadows } = o.models;
  const h = (r: number) =>
    r >= radius ? 0 : (height * (1 + Math.cos((Math.PI * r) / radius))) / 2;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++)
    profile.push(new THREE.Vector2((radius * i) / 40, h((radius * i) / 40)));
  const surface = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 64),
    new THREE.MeshLambertMaterial({ color: '#8DB866', side: THREE.DoubleSide }),
  );
  // The hill does not shadow itself, because that would put stripes on the slope.
  const g = castShadows(group(surface));
  surface.castShadow = false;
  o.add(g, center);
  // The contours are brown rings on the slope. A dashed line is made of pieces of a ring.
  const material = new THREE.MeshLambertMaterial({
    color: BROWN,
    emissive: BROWN,
    emissiveIntensity: 0.3,
  });
  const rings = contours.map((level) => {
    const r = (radius * Math.acos((2 * level) / height - 1)) / Math.PI;
    const segments = dashed ? 14 : 1;
    const ring = group();
    ring.position.y = level + 0.03;
    for (let i = 0; i < segments; i++) {
      const arc = dashed ? ((2 * Math.PI) / segments) * 0.62 : 2 * Math.PI;
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.09, 6, dashed ? 8 : 96, arc).rotateX(Math.PI / 2),
        material,
      );
      m.rotation.y = ((2 * Math.PI) / segments) * i;
      ring.add(m);
    }
    ring.visible = false;
    o.add(ring, center);
    return ring;
  });
  // The fox walks on the ground surface: the height at the map point (x, z).
  const onSurface = (x: number, z: number) => h(Math.hypot(x - center[0], z - center[1]));
  return { mound: g, rings, onSurface, center, radius };
}

// The hill grows, and the contours are drawn on the slope from the lowest to the highest.
async function showHill(o: LessonStage, motion: number, { mound, rings }: Hill) {
  await o.grow([mound], motion, 900);
  if (!motion) return rings.forEach((r) => (r.visible = true));
  for (const r of rings) {
    await o.pause(250);
    r.visible = true;
    o.draw();
  }
  await o.pause(300);
}

// The fox climbs to the top of a gentle hill. At the foot of a steep hill it stops and looks up.
async function climb(o: LessonStage, motion: number, m: Hill, steep: boolean) {
  const { fox } = o;
  const [sx, sz] = [-3, FOX_Z];
  const [cx, cz] = m.center;
  const distance = Math.hypot(cx - sx, cz - sz);
  const end = steep ? distance - m.radius - 0.3 : distance - 0.8;
  const point = (s: number): Point => [
    sx + ((cx - sx) * s) / distance,
    sz + ((cz - sz) * s) / distance,
  ];
  const walk = (s: number) => {
    const [x, z] = point(s);
    const [xe, ze] = point(s + 0.3);
    const angle = (-Math.atan2(m.onSurface(xe, ze) - m.onSurface(x, z), 0.3) * 180) / Math.PI;
    o.foxTo(x, z, m.onSurface(x, z), angle);
  };
  o.turn((Math.atan2(-(cz - sz), cx - sx) * 180) / Math.PI);
  await showHill(o, motion, m);
  if (!motion) return walk(end);
  fox.poses.set('walking');
  await o.animate(steep ? 1600 : 3600, (t) => walk(end * t));
  if (steep) {
    // At the foot of a steep slope the fox looks up.
    fox.poses.set('curious');
    fox.lookAt(new THREE.Vector3(cx, m.onSurface(cx, cz), cz));
    await o.pause(1200);
    fox.lookAt(null);
    fox.poses.set('facingViewer');
  } else {
    fox.poses.set('facingViewer', 'cheering');
  }
}

// The fox walks easily over a low knoll.
async function crossKnoll(o: LessonStage, motion: number, m: Hill) {
  const { fox } = o;
  const [start, end] = [-3, m.center[0]];
  const walk = (x: number) => o.foxTo(x, FOX_Z, m.onSurface(x, FOX_Z));
  await showHill(o, motion, m);
  if (!motion) return walk(end);
  fox.poses.set('walking');
  await o.animate(2200, (t) => walk(start + (end - start) * t));
  fox.poses.set('facingViewer', 'cheering');
}

export { scene as hill };
