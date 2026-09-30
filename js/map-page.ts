// The "What is a map?" page (Three.js). Foxwood is a 3D world (world.ts).
//
// One number p drives everything:
//   p = 0..1  the camera rises into the air and turns to look straight down
//   p = 1..2  the terrain turns into a map part by part (trees sink, hill flattens, water goes)
// With the buttons of the legend a single part can be switched between the terrain and the map.
import * as FoxSvg from './fox-svg';
import * as Pawprints from './pawprints';
import * as MapType from './map-type';
import { Symbols } from './symbols';
import { Foxwood } from './foxwood';
import { Orienteering } from './orienteering';
import { animate } from './animation';
import { Stage } from './stage';
import { Fox } from './fox';
import { World } from './world';
import { t, formatNumber } from './i18n';

import { $ } from './dom';
import type { Point } from './types';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { HEIGHT } = World;

// The map type (map-type.ts): the same page shows the MML topographic map or the orienteering map
// (orienteering.ts). Switching the toggle changes the map, the texts and the legend at once. The
// parts are the same in both (the mask of the world).
let mapType = MapType.current();
const orienteering = () => mapType === 'orienteering';
// The pawprint ids of this page are stored on devices, so they stay Finnish.
const PAWPRINT_IDS = { topo: 'map', orienteering: 'orienteering-map' };
const pageTexts = (type: string) => ({
  title: t(`mapPage.${type}.title`),
  sentence: t(`mapPage.${type}.sentence`),
  ending: t(`mapPage.${type}.ending`),
});
type Part = { id: string; name: string; onMap: string; bubble: string; button?: HTMLButtonElement };
const PART_IDS = ['forest', 'field', 'mire', 'hill', 'lake', 'trail'];
const partsFor = (type: string): Part[] =>
  PART_IDS.map((id) => ({
    id,
    name: t(`mapPage.parts.${type}.${id}.name`),
    onMap: t(`mapPage.parts.${type}.${id}.onMap`),
    bubble: t(`mapPage.parts.${type}.${id}.bubble`),
  }));
const PARTS_BY_TYPE: Record<string, Part[]> = {
  topo: partsFor('topo'),
  orienteering: partsFor('orienteering'),
};
let PARTS = PARTS_BY_TYPE[mapType];

function showTitle() {
  const texts = pageTexts(mapType);
  $('.page-title h1').textContent = texts.title;
  $('.page-title .sentence').textContent = texts.sentence;
  document.title = t('signPage.title', { name: texts.title });
}
showTitle();

const world = await World.create({ orienteering: true });
let blend = orienteering() ? 1 : 0; // the blend of the map: 0 = topographic map, 1 = orienteering map
world.setMapStyle(blend);

// ---------- View ----------
const flightEl = $('#flight');
const stage = Stage.create({ canvas: $<HTMLCanvasElement>('#canvas'), frame: flightEl, world });
const { camera, toScreen } = stage;

// ---------- Camera ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const DEG = Math.PI / 180;

// The camera orbits around the target point. Angle 0 = horizontal, 90 = straight down. The
// direction tells where the camera looks from: 0 = from the south to the north, so that from above
// the north of the map is at the top.
const START: { target: Point; angle: number; distance: number; direction: number; fov: number } = {
  target: [180, 225],
  angle: 7,
  distance: 263,
  direction: -51,
  fov: 50,
};
const END: typeof START = { target: [300, 190], angle: 89.8, distance: 0, direction: 0, fov: 24 };
// From above the whole map fits in the picture with a small margin.
END.distance = ((HEIGHT / 2) * 1.04) / Math.tan((END.fov / 2) * DEG);

let angle = START.angle;
function updateCamera(p: number) {
  const t = smoothstep(0, 1, p);
  angle = lerp(START.angle, END.angle, t);
  const distance = lerp(START.distance, END.distance, t);
  const direction = lerp(START.direction, END.direction, t) * DEG;
  const kx = lerp(START.target[0], END.target[0], t);
  const ky = lerp(START.target[1], END.target[1], t);
  const target = world.toWorld(kx, ky);
  target.y *= 1 - t;
  camera.fov = lerp(START.fov, END.fov, t);
  camera.position.set(
    target.x + Math.sin(direction) * Math.cos(angle * DEG) * distance,
    target.y + Math.sin(angle * DEG) * distance,
    target.z + Math.cos(direction) * Math.cos(angle * DEG) * distance,
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  // The fog hides the distant forest on the ground, but not when looking from above.
  world.fog.near = lerp(260, 4000, t);
  world.fog.far = lerp(950, 6000, t);
}

// ---------- Fox ---------- The fox is a 3D model (fox.ts) at the start of the path. It looks at
// the camera and fades when the camera rises.
const FOX_SPOT: [number, number] = [30, 345];
const FOX_HEIGHT = 6; // the height to the ears in metres (the fox is exaggerated in size so that it can be seen)
const fox = Fox.create();
fox.group.position.copy(world.toWorld(...FOX_SPOT));
fox.group.scale.setScalar(FOX_HEIGHT / fox.height);
fox.group.rotation.y = -1.4; // the fox stands with its side to the camera (looks south)
fox.viewer = camera.position;
fox.poses.set('facingViewer');
world.scene.add(fox.group);
const foxOnMap = $<SVGSVGElement>('#fox-on-map');
foxOnMap.innerHTML = FoxSvg.mapMarker();

function updateFox() {
  fox.visibility(1 - smoothstep(50, 80, angle));
  // From above the fox is shown as a map sign (diameter 38 m as on the SVG map).
  const centre = toScreen(world.toWorld(...FOX_SPOT, 0.5));
  foxOnMap.style.opacity = String(smoothstep(60, 85, angle));
  if (centre) {
    const size = 42 * centre[2];
    foxOnMap.style.width = foxOnMap.style.height = size + 'px';
    foxOnMap.style.transform = `translate(${centre[0] - size / 2}px, ${centre[1] - size / 2}px)`;
  }
}

// Before every draw the camera and the fox are set to the current state.
stage.beforeDraw.push(() => updateCamera(p), updateFox);
Fox.attachToStage(fox, stage);

// ---------- Updating the view ----------
const bubble = $('#fox-says');
const slider = $<HTMLInputElement>('#altitude');
const BUBBLES: [number, string | null][] = [
  [0.05, t('mapPage.bubbles.here')],
  [0.95, t('mapPage.bubbles.rising')],
  [1.08, t('mapPage.bubbles.above')],
  [1.97, t('mapPage.bubbles.becoming')],
  [2.01, null], // the ending text depends on the map type (pageTexts)
];

let p = 0;
// The parts chosen with the buttons: id -> 0 (terrain) .. 1 (map). The slider clears the choices.
const choices = new Map<string, number>();
let chosen: string | null = null;

function share(i: number, id: string): number {
  if (choices.has(id)) return choices.get(id)!;
  return clamp01((p - 1 - i * 0.14) / 0.2);
}

function draw() {
  world.setParts(PARTS.map((o, i) => share(i, o.id)));
  PARTS.forEach((o, i) => {
    o.button!.classList.toggle('ready', share(i, o.id) >= 0.5);
    o.button!.setAttribute('aria-pressed', String(o.id === chosen));
  });
  if (chosen) bubble.textContent = PARTS.find((o) => o.id === chosen)!.bubble;
  else bubble.textContent = BUBBLES.find(([limit]) => p < limit)?.[1] ?? pageTexts(mapType).ending;
  slider.value = String(Math.round(p * 100));
  if (p >= 2) Pawprints.add(PAWPRINT_IDS[mapType]);
  $('#pawprint-count').textContent = formatNumber(Pawprints.all().length);
  stage.draw();
}

// ---------- The buttons of the legend ----------
// The small pictures are the same as in the SVG version: aerial photo → map.
const patterns = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
patterns.style.cssText = 'position:absolute;width:0;height:0';
patterns.innerHTML = Foxwood.aerial.forest.match(/<defs>[\s\S]*<\/defs>/)![0];
document.body.appendChild(patterns);
const VIEWBOXES: Record<string, string> = {
  forest: '440 20 90 70',
  field: '40 30 110 90',
  mire: '230 296 150 70',
  hill: '200 120 150 110',
  lake: '390 70 200 270',
  trail: '20 230 390 130',
};
function smallAerial(id: string) {
  return `<svg x="0" width="52" height="40" viewBox="${VIEWBOXES[id]}">
    <rect x="-999" y="-999" width="2999" height="2999" fill="url(#canopies)"/>${id === 'forest' ? '' : (Foxwood.aerial as Record<string, string>)[id]}</svg>`;
}
function smallMap(id: string) {
  const partsMap: Record<string, string> = orienteering() ? Orienteering.parts : Foxwood.parts;
  const paper = orienteering() ? Orienteering.COLORS.paper : '#FBF8F0';
  if (id === 'mire') {
    const lines = [10, 18, 26, 34]
      .map((y) => `<line x1="4" x2="44" y1="${y}" y2="${y}"/>`)
      .join('');
    const [base, line] = orienteering()
      ? [Orienteering.COLORS.openForest, Orienteering.COLORS.water]
      : [Symbols.MIRE.treeless, Symbols.MIRE.lines];
    return `<svg x="72" width="48" height="40" viewBox="0 0 48 40"><rect width="48" height="40" fill="${paper}"/>
      <rect x="4" y="6" width="40" height="30" rx="8" fill="${base}"/><g stroke="${line}" stroke-width="2.5">${lines}</g></svg>`;
  }
  const part = id === 'forest' ? partsMap.grid + partsMap.forest : partsMap[id];
  // For the forest of the orienteering map the thicket is shown: white and green.
  const viewbox = id === 'forest' && orienteering() ? '64 190 96 74' : VIEWBOXES[id];
  return `<svg x="72" width="48" height="40" viewBox="${viewbox}"><rect x="-999" y="-999" width="2999" height="2999" fill="${paper}"/>${part}</svg>`;
}

const legend = $('#legend');
function buildLegend() {
  legend.replaceChildren();
  PARTS.forEach((o) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-pressed="false">
      <svg viewBox="0 0 120 40" aria-hidden="true">
        ${smallAerial(o.id)}
        <path d="M58,20 h10 m-4,-5 l5,5 l-5,5" stroke="#8A7B62" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        ${smallMap(o.id)}
      </svg>
      <span><b>${o.name}</b> → ${o.onMap}</span>
    </button>`;
    const button = (o.button = li.querySelector('button')!);
    button.addEventListener('click', () => choose(o.id));
    legend.appendChild(li);
  });
}
buildLegend();

// A button: fly up (if not yet up), switch the part between the terrain and the map and highlight
// it.
async function choose(id: string) {
  const i = PARTS.findIndex((o) => o.id === id);
  const token = (flight = Symbol());
  chosen = id;
  if (p < 1) {
    await animateP(p, 1, 2200 * (1 - p), token);
    if (flight !== token) return;
  }
  const start = share(i, id);
  const end = start >= 0.5 ? 0 : 1;
  pulsePart(id);
  // Switching a part is always carried to the end, even if another button is pressed in between.
  await animate(reducedMotion ? 1 : 1400, (t) => {
    choices.set(id, lerp(start, end, t));
    draw();
  });
}

// The highlight pulses three times.
let pulseToken: symbol | null = null;
async function pulsePart(id: string | null) {
  const token = (pulseToken = Symbol());
  world.highlight(id);
  await animate(reducedMotion ? 1 : 2400, (t) => {
    if (pulseToken !== token) return;
    world.highlightMaterial.opacity = Math.sin(t * Math.PI * 3) ** 2 * 0.9;
    stage.draw();
  });
  if (pulseToken === token) world.highlight(null);
}

// ---------- Flight and slider ----------
let flight: symbol | null = null;
function animateP(start: number, end: number, duration: number, token: symbol) {
  return animate(reducedMotion ? 1 : duration, (t) => {
    if (flight !== token) return;
    p = start + (end - start) * t;
    draw();
  });
}

async function fly() {
  const token = (flight = Symbol());
  choices.clear();
  chosen = null;
  if (p >= 2) p = 0;
  if (p < 1) {
    await animateP(p, 1, 5000 * (1 - p), token);
    if (flight !== token) return;
    await new Promise((r) => setTimeout(r, reducedMotion ? 0 : 900));
  }
  if (flight === token) await animateP(Math.max(p, 1), 2, 6000 * (2 - Math.max(p, 1)), token);
}

$('#fly-button').addEventListener('click', fly);

// ---------- Changing the map type from the switch of the top bar ----------
// The map changes smoothly, and the texts and the buttons of the legend change at once.
let blendToken: symbol | null = null;
MapType.listen(async (next) => {
  mapType = next;
  PARTS = PARTS_BY_TYPE[mapType];
  showTitle();
  buildLegend();
  draw();
  const token = (blendToken = Symbol());
  const start = blend;
  await animate(reducedMotion ? 1 : 1200, (t) => {
    if (blendToken !== token) return;
    blend = lerp(start, orienteering() ? 1 : 0, t);
    world.setMapStyle(blend);
    stage.draw();
  });
});

slider.addEventListener('input', () => {
  flight = null; // moving it by hand stops the flight
  choices.clear();
  chosen = null;
  p = Number(slider.value) / 100;
  draw();
});

// The checks of the map for the developer: the warnings are only shown in the console, not on the
// page.
for (const t of world.checks) if (t.level !== 'ok') console.warn(`Foxwood: ${t.text}`);

// The fox glances sideways now and then and back to the camera.
setInterval(() => {
  fox.poses.remove('facingViewer');
  setTimeout(() => fox.poses.add('facingViewer'), 1500);
}, 5000);

// For testing: requestAnimationFrame does not run in a background tab, so the state can be set and
// drawn directly.
window.MapPage = {
  set: (next: number) => {
    p = next;
    draw();
    stage.render();
  },
  camera,
  START,
  render: stage.render,
};

draw();
