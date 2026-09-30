// Brook scene: the fox walks along the path and turns into the forest between the hill and the
// lake. The brook flows in front of it into the lake. The fox watches how a leaf floats along with
// the current, and jumps over the brook.
//
// On the orienteering map the scene is the same. The lesson panel tells whether you can cross the
// water: a small brook is a thin blue line, a wide brook a thicker line, an indistinct brook a
// dashed line and a river a blue area whose black edge tells that you cannot cross it (the
// Orienteering Federation's legend, ISOM 301 and 304–306).
//
// The terrain is the 3D world of Foxwood (sign-terrain.ts). The route turns north from the path,
// and the camera follows the fox from the south: the brook flows in front of the fox from left to
// right into the lake, the hill is on the left.
import * as THREE from 'three';
import { Foxwood } from '../foxwood';
import { Orienteering } from '../orienteering';
import { animate } from '../animation';
import { Creatures } from '../creatures';
import { t } from '../i18n';
import type { Scene } from '../scene-types';
import type { LessonStage } from '../lesson-panel';
import type { Point } from '../types';

const V = Orienteering.COLORS;
// Map coordinates: the south bank of the brook in front of the fox and the north bank the fox jumps
// to.
const BANK: Point = [365, 101];
const ACROSS: Point = [360, 84];
// The leaf is exaggerated in size (about 1.5 m), so that it can be seen in the current
// (creatures.ts).
let leaf: ReturnType<typeof Creatures.leaf> | null = null;

const scene: Scene = {
  map: Foxwood.map({
    route: 'M30,345 C110,335 140,290 210,292 C280,294 316,256 342,250 C358,240 362,170 363,118',
    name: t('scenes.stream.mapLabel'),
    namePosition: [440, 36],
  }),
  feature: 'stream',
  // The road crosses the brook on a bridge, so it is drawn on top of the brook.
  drawOver: ['carRoad'],

  terrain: {
    camera: { behind: 42, height: 21, ahead: 14, direction: [0, 0], fox: 5 },
    overlay: `
      <path id="stream-line" d="${Foxwood.shapes.stream}" fill="none" stroke="none"/>`,

    async arrive({ terrainSvg, fox, wait, terrain }) {
      const [x0, y0] = terrain.routePoint(1);
      // The fox steps to the bank of the brook.
      fox.poses.add('walking');
      await animate(700, (t) => terrain.moveFox(x0 + (BANK[0] - x0) * t, y0 + (BANK[1] - y0) * t));
      fox.poses.remove('walking');
      // The leaf floats with the current from the left past the fox towards the lake.
      fox.poses.add('curious');
      const line = terrainSvg.querySelector<SVGGeometryElement>('#stream-line')!;
      const length = line.getTotalLength();
      await animate(2600, (t) => {
        const q = line.getPointAtLength((0.45 + 0.45 * t) * length);
        // The ground is drawn as a 2 m grid, so a narrow channel looks shallower than it is: the
        // leaf floats at the level of the edges of the channel. The leaf turns slowly in the
        // current.
        const { heightAt } = terrain.world;
        const edge = Math.max(
          ...[
            [-1.5, 0],
            [1.5, 0],
            [0, -1.5],
            [0, 1.5],
          ].map(([dx, dy]) => heightAt(q.x + dx, q.y + dy)),
        );
        terrain.place(
          leaf!,
          q.x,
          q.y,
          edge - heightAt(q.x, q.y) + 0.1,
          0.4 + 0.9 * Math.sin(t * 9),
        );
        leaf!.visible = t > 0.02 && t < 0.97;
      });
      leaf!.removeFromParent();
      fox.poses.remove('curious');
      await wait(200);
      // A leap over the brook.
      await animate(700, (t) => {
        terrain.moveFox(
          BANK[0] + (ACROSS[0] - BANK[0]) * t,
          BANK[1] + (ACROSS[1] - BANK[1]) * t,
          5 * Math.sin(Math.PI * t),
          -20 + 40 * t,
        );
      });
      terrain.moveFox(...ACROSS);
      await wait(300);
      fox.poses.add('facingViewer');
      await wait(700);
    },

    reset(_terrainSvg, terrain) {
      leaf ??= Creatures.leaf();
      leaf.removeFromParent();
      terrain.draw();
    },
  },

  lesson: {
    title: t('scenes.stream.lesson.title'),
    instruction: t('scenes.stream.lesson.instruction'),
    stage: { camera: [2.5, 3.4, 12], gaze: [3, 0.3, -1], fox: 1.4, foxPosition: [-1.2, 3] },
    items: [
      {
        name: t('scenes.stream.lesson.items.smallStream.name'),
        summary: t('scenes.stream.lesson.items.smallStream.summary'),
        text: t('scenes.stream.lesson.items.smallStream.text'),
        icon: lineIcon(2.5),
        show: (o, motion) =>
          jumpOver(o, motion, brook(o, 1.6, t('scenes.stream.widthLabels.small'))),
      },
      {
        name: t('scenes.stream.lesson.items.wideStream.name'),
        summary: t('scenes.stream.lesson.items.wideStream.summary'),
        text: t('scenes.stream.lesson.items.wideStream.text'),
        icon: lineIcon(6.5),
        show: (o, motion) =>
          stopAtBank(o, motion, brook(o, 4, t('scenes.stream.widthLabels.wide'))),
      },
      {
        name: t('scenes.stream.lesson.items.river.name'),
        summary: t('scenes.stream.lesson.items.river.summary'),
        text: t('scenes.stream.lesson.items.river.text'),
        icon: `<rect width="100" height="50" fill="#fff"/>
          <path d="M0,12 C24,2 34,24 52,20 C70,16 76,32 100,28 L100,44 C76,48 68,32 52,36 C34,40 22,20 0,28 Z" fill="#7FD3F7" stroke="#0077C0" stroke-width="2"/>`,
        camera: { position: [4.5, 4.5, 15], gaze: [5, 0.3, -1] },
        show: (o, motion) =>
          stopAtBank(o, motion, brook(o, 9, t('scenes.stream.widthLabels.river'))),
      },
    ],
  },

  // Orienteering map: can you cross the water? The fox jumps over a small brook, wades through a
  // wide one and walks over an indistinct one (an almost dry ditch). The black edge of the river
  // tells that you cannot cross it.
  orienteering: {
    lesson: {
      title: t('scenes.stream.orienteeringLesson.title'),
      instruction: t('scenes.stream.orienteeringLesson.instruction'),
      stage: { camera: [2.5, 3.4, 12], gaze: [3, 0.3, -1], fox: 1.4, foxPosition: [-1.2, 3] },
      items: [
        {
          name: t('scenes.stream.orienteeringLesson.items.smallStream.name'),
          summary: t('scenes.stream.orienteeringLesson.items.smallStream.summary'),
          text: t('scenes.stream.orienteeringLesson.items.smallStream.text'),
          icon: lineIcon(2.2, V.water),
          show: (o, motion) => jumpOver(o, motion, brook(o, 1.6)),
        },
        {
          name: t('scenes.stream.orienteeringLesson.items.wideStream.name'),
          summary: t('scenes.stream.orienteeringLesson.items.wideStream.summary'),
          text: t('scenes.stream.orienteeringLesson.items.wideStream.text'),
          icon: lineIcon(4.5, V.water),
          show: (o, motion) => wade(o, motion, brook(o, 3.2)),
        },
        {
          name: t('scenes.stream.orienteeringLesson.items.unclearStream.name'),
          summary: t('scenes.stream.orienteeringLesson.items.unclearStream.summary'),
          text: t('scenes.stream.orienteeringLesson.items.unclearStream.text'),
          icon: lineIcon(2.2, V.water, '9 4'),
          show: (o, motion) => walkAcross(o, motion, brook(o, 1.2, null, { puddles: true })),
        },
        {
          name: t('scenes.stream.orienteeringLesson.items.river.name'),
          summary: t('scenes.stream.orienteeringLesson.items.river.summary'),
          text: t('scenes.stream.orienteeringLesson.items.river.text'),
          icon: `<rect width="100" height="50" fill="#fff"/>
            <path d="M0,12 C24,2 34,24 52,20 C70,16 76,32 100,28 L100,44 C76,48 68,32 52,36 C34,40 22,20 0,28 Z" fill="${V.water}" stroke="${V.black}" stroke-width="2"/>`,
          camera: { position: [4.5, 4.5, 15], gaze: [5, 0.3, -1] },
          show: (o, motion) => stopAtBank(o, motion, brook(o, 9)),
        },
      ],
    },
  },
};

// ---------- Lesson panel: the width of a brook ----------
// On the map a brook or ditch under 2 m wide is a thin line, a brook 2–5 m wide a thicker line
// and a river over 5 m wide a blue area with shorelines (MML).
function lineIcon(thickness: number, color = '#0077C0', dash?: string) {
  return `<rect width="100" height="50" fill="#fff"/>
    <path d="M6,14 C24,6 32,30 50,26 C68,22 72,42 94,38" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="${dash ? 'butt' : 'round'}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

// On the 3D stage the brook flows from far in the north towards the viewer. Its west bank is in
// front of the fox at x = 0, and further away the brook meanders. The fox is about a metre tall.
// label = the width label (null = no label). puddles: there is water only in puddles at the bottom
// of a dry ditch.
const FOX_Z = 3;
function brook(
  o: LessonStage,
  width: number,
  label: string | null = null,
  { puddles = false } = {},
) {
  const { strip, group } = o.models;
  const center = (z: number) => width / 2 + (z < 0 ? Math.sin(z / 7) * 1.5 : 0);
  const water = new THREE.MeshPhongMaterial({
    color: '#3F92C8',
    specular: '#D6ECF6',
    shininess: 70,
  });
  // The banks. The bottom of a dry ditch is narrow and grassy.
  const g = group(
    puddles
      ? strip(center, width + 0.3, -120, 30, '#6F6A40', 0.012)
      : strip(center, width + 0.8, -120, 30, '#7A5E3E', 0.012),
  );
  if (puddles) {
    // The puddles are oval, and there is no water where the fox is.
    const r = o.models.seeded(3);
    for (let z = -120; z < 30; ) {
      const length = 0.8 + r() * 2;
      const kz = z + length / 2;
      if (Math.abs(kz - FOX_Z) > 2) {
        const puddle = new THREE.Mesh(
          new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2),
          water,
        );
        puddle.scale.set(width * (0.6 + r() * 0.3), 1, length);
        puddle.position.set(center(kz), 0.03, kz);
        g.add(puddle);
      }
      z += length + 1.2 + r() * 2.5;
    }
  } else g.add(strip(center, width, -120, 30, null, 0.03, water));
  // The streaks of the current: light stripes move with the current towards the viewer.
  const streaks: THREE.Mesh[] = [];
  const r = o.models.seeded(5);
  const streakMaterial = new THREE.MeshBasicMaterial({
    color: '#D6ECF6',
    transparent: true,
    opacity: 0.8,
  });
  for (let i = 0; i < (puddles ? 0 : 18); i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.9).rotateX(-Math.PI / 2),
      streakMaterial,
    );
    streak.userData = { side: (r() - 0.5) * width * 0.6, offset: r() * 40 };
    streaks.push(streak);
    g.add(streak);
  }
  o.add(g);
  // A measuring arrow and the width in front of the fox. The position is computed on every frame,
  // so that it stays in place even if the screen size changes.
  let annotation = '';
  o.everyFrame((time) => {
    for (const j of streaks) {
      const z = -30 + ((j.userData.offset + time * 1.6) % 40);
      j.position.set(center(z) + j.userData.side, 0.04, z);
    }
    if (!label) return;
    const [a, b] = [o.toScreen(0, 0.05, FOX_Z + 1.2), o.toScreen(width, 0.05, FOX_Z + 1.2)];
    if (!a || !b) return;
    const y = (a[1] + b[1]) / 2;
    const next = `<g stroke="#23382B" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M${a[0] + 2},${y} H${b[0] - 2} M${a[0] + 9},${y - 6} L${a[0] + 2},${y} L${a[0] + 9},${y + 6} M${b[0] - 9},${y - 6} L${b[0] - 2},${y} L${b[0] - 9},${y + 6}"/>
      </g>
      <g transform="translate(${(a[0] + b[0]) / 2} ${y + 18})">
        <rect x="-36" y="-13" width="72" height="26" rx="13" fill="#fff" stroke="#23382B" stroke-width="2"/>
        <text y="6" text-anchor="middle" font-size="16" font-weight="800" fill="#23382B">${label}</text>
      </g>`;
    if (next !== annotation) {
      annotation = next;
      measureGroup.innerHTML = next;
    }
  });
  const measureGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  o.overlay.appendChild(measureGroup);
  return { width };
}

// The fox jumps over a narrow brook.
async function jumpOver(o: LessonStage, motion: number, { width }: { width: number }) {
  const { fox } = o;
  const [x0, x1] = [-1.2, width + 1.2];
  if (!motion) return o.foxTo(x1, FOX_Z);
  fox.poses.set('curious');
  await o.pause(700);
  fox.poses.set();
  await o.animate(750, (t) =>
    o.foxTo(x0 + (x1 - x0) * t, FOX_Z, 1.1 * Math.sin(Math.PI * t), -25 + 50 * t),
  );
  o.foxTo(x1, FOX_Z);
  fox.poses.set('facingViewer', 'cheering');
}

// At the bank of a wide brook or a river the fox stops.
// The third parameter is only a side effect of the call (the brook is built before the stop).
async function stopAtBank(o: LessonStage, motion: number, _brook?: unknown) {
  const { fox } = o;
  if (!motion) return;
  fox.poses.set('walking');
  await o.animate(500, (t) => o.foxTo(-1.2 + 0.6 * t, FOX_Z));
  fox.poses.set('curious');
  await o.pause(1000);
  fox.poses.set('facingViewer');
}

// The fox wades through a wide brook: it sinks into the water up to its ankles, and rings form in
// the water.
async function wade(o: LessonStage, motion: number, { width }: { width: number }) {
  const { fox } = o;
  const [x0, x1] = [-1.2, width + 1.2];
  const depth = (x: number) =>
    -0.35 * Math.min(1, Math.max(0, Math.min(x + 0.2, width + 0.2 - x) / 0.8));
  if (!motion) return o.foxTo(x1, FOX_Z);
  fox.poses.set('curious');
  await o.pause(600);
  const rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  const material = new THREE.MeshBasicMaterial({ color: '#EAF6FC', transparent: true });
  o.everyFrame((time) => {
    for (const r of rings) {
      const age = time - r.userData.born;
      r.scale.setScalar(1 + age * 2.2);
      r.material.opacity = Math.max(0, 0.9 - age * 0.9);
    }
  });
  let previous = 0;
  fox.poses.set('walking');
  await o.animate(3000, (t) => {
    const x = x0 + (x1 - x0) * t;
    o.foxTo(x, FOX_Z, depth(x));
    const now = performance.now() / 1000;
    if (depth(x) < -0.05 && now - previous > 0.35) {
      previous = now;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.32, 28).rotateX(-Math.PI / 2),
        material.clone(),
      );
      ring.position.y = 0.04;
      ring.userData.born = now;
      rings.push(o.add(ring, [x, FOX_Z]));
    }
  });
  o.foxTo(x1, FOX_Z);
  fox.poses.set('pawUp');
  await o.pause(700);
  fox.poses.set('facingViewer', 'cheering');
}

// The fox walks over an indistinct brook (an almost dry ditch).
async function walkAcross(o: LessonStage, motion: number, _brook?: unknown) {
  const { fox } = o;
  const [x0, x1] = [-1.2, 3];
  if (!motion) return o.foxTo(x1, FOX_Z);
  await o.pause(400);
  fox.poses.set('walking');
  await o.animate(1600, (t) => o.foxTo(x0 + (x1 - x0) * t, FOX_Z));
  fox.poses.set('facingViewer');
}

export { scene as stream };
