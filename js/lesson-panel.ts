// The 3D stage of the lesson panel: a small landscape of its own where the 3D fox stands in a
// meadow and the pressed item (brook, road, house, stone, trees) is built next to it. The lesson
// field of the scene tells what to show.
//
// The coordinates are in metres: the ground is in the plane y = 0, the camera usually looks north
// (-z) and the fox looks to the right (+x). On top there is an SVG (viewBox 400 x 220) for
// annotations and for the map sign card.
//
//   const o = await LessonPanel.create({ frame, overlay, settings: lesson.stage });
//   o.clear();                            // items away, the fox to its starting place
//   o.add(o.models.rock(1.5), [3, -2]);   // an item at (x, z)
//   await o.grow([item], motion);         // the item rises from the ground
//   await o.animate(800, (t) => ...);     // an animation; the stage is drawn on every frame
import * as THREE from 'three';
import { animate as tween } from './animation';
import { t } from './i18n';
import { Stage } from './stage';
import { Fox } from './fox';
import { World } from './world';
import type { Point, Vec3 } from './types';

const DEG = Math.PI / 180;
const L = 400,
  K = 220; // the size of the overlay
const FOG = '#D6EEF3'; // the same as the lower edge of the sky (.sky)

// ---------- Models ----------
// Trees, bushes and stones are in the same low-poly style as the world of Foxwood.
const M = () => World.models;
const material = (color: string, extra?: object) => M().material(color, extra);
const castShadows = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) m.castShadow = m.receiveShadow = true;
  });
  return o;
};
const group = (...children: THREE.Object3D[]) => {
  const g = new THREE.Group();
  if (children.length) g.add(...children);
  return g;
};
const mesh = (geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material(color));
  m.position.set(x, y, z);
  return m;
};
// A seeded random number, so that the pictures are always the same.
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Spruce: height in metres.
let spruceMaterial: THREE.MeshLambertMaterial | null = null;
function spruce(height = 8) {
  spruceMaterial ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Mesh(M().SPRUCE, spruceMaterial);
  m.scale.setScalar(height);
  return castShadows(group(m));
}

// Pine: a long red-brown trunk and a flat crown at the top.
function pine(height = 9) {
  const g = group(
    mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.8, 6).translate(0, 0.4, 0), '#B0643A'),
  );
  (
    [
      [0, 0.86, 0, 0.2],
      [0.12, 0.78, 0.05, 0.15],
      [-0.12, 0.8, -0.04, 0.14],
      [0.04, 0.95, -0.06, 0.12],
    ] as [number, number, number, number][]
  ).forEach(([x, y, z, r], i) => {
    const crown = mesh(new THREE.DodecahedronGeometry(r), i % 2 ? '#355F3A' : '#2F5A36', x, y, z);
    crown.scale.y = 0.55;
    g.add(crown);
  });
  g.scale.setScalar(height);
  return castShadows(g);
}

// Birch: a white trunk with black patches and a round, light-green crown.
function birch(height = 7) {
  const g = group(
    mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.7, 6).translate(0, 0.35, 0), '#F4F1E8'),
  );
  for (const y of [0.12, 0.24, 0.36, 0.48])
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), '#2E2A26', 0.004, y, 0));
  (
    [
      [0, 0.8, 0, 0.2, '#7DB356'],
      [0.13, 0.66, 0.04, 0.15, '#6FA64C'],
      [-0.13, 0.68, -0.03, 0.15, '#6FA64C'],
      [0.02, 0.66, 0.13, 0.13, '#8CBF62'],
    ] as [number, number, number, number, string][]
  ).forEach(([x, y, z, r, color]) =>
    g.add(mesh(new THREE.IcosahedronGeometry(r, 0), color, x, y, z)),
  );
  g.scale.setScalar(height);
  return castShadows(g);
}

// Shrub: low and dense, a few balls of leaves.
function shrub(height = 1.3) {
  const g = group();
  (
    [
      [-0.45, 0.4, 0, 0.45, '#4F8240'],
      [0.45, 0.4, 0.05, 0.45, '#4F8240'],
      [0, 0.6, -0.05, 0.55, '#5E9148'],
      [-0.1, 0.45, 0.35, 0.4, '#6A9C50'],
    ] as [number, number, number, number, string][]
  ).forEach(([x, y, z, r, color]) =>
    g.add(mesh(new THREE.IcosahedronGeometry(r, 0), color, x, y, z)),
  );
  g.scale.setScalar(height);
  return castShadows(g);
}

// Rock: an angular lump whose lower edge is on the ground. size = height in metres.
const ROCK_COLORS = ['#8E8A80', '#9A968C', '#7E7A72', '#A5A197'];
function rock(size = 1, seed = 1) {
  const r = seeded(seed * 7919);
  const m = mesh(new THREE.DodecahedronGeometry(1, 0), ROCK_COLORS[seed % ROCK_COLORS.length]);
  m.scale.set(0.7 + r() * 0.5, 0.5, 0.6 + r() * 0.5);
  m.rotation.set(r() * 0.4, r() * Math.PI, r() * 0.4);
  m.position.y = 0.3;
  const g = group(m);
  g.scale.setScalar(size * 1.25);
  return castShadows(g);
}

// A road or brook: a straight strip from the north (z = start) to the south (z = end), width in
// metres. x(z) gives the centre line, so that the strip can curve.
function strip(
  x: (z: number) => number,
  width: number,
  start: number,
  end: number,
  color: string | null,
  height = 0.02,
  extra?: THREE.Material,
) {
  const positions: number[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const z = start + ((end - start) * i) / n;
    positions.push(x(z) - width / 2, height, z, x(z) + width / 2, height, z);
  }
  const triangles: number[] = [];
  for (let i = 0; i < n; i++)
    triangles.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(triangles);
  geo.computeVertexNormals();
  const m: THREE.Mesh = new THREE.Mesh(
    geo,
    extra ?? new THREE.MeshLambertMaterial({ color: color ?? undefined }),
  );
  m.receiveShadow = true;
  return m;
}

// A patch of ground (meadow, mire, field): an irregular area around the point (0, 0), radii rx and
// rz in metres.
function patch(rx: number, rz: number, color: string, seed = 1, height = 0.015) {
  const r = seeded(seed * 131);
  const [v1, v2] = [r() * 6, r() * 6];
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    const k = 1 + 0.06 * Math.sin(3 * a + v1) + 0.04 * Math.sin(5 * a + v2);
    points.push(new THREE.Vector2(Math.cos(a) * rx * k, Math.sin(a) * rz * k));
  }
  const material = new THREE.MeshLambertMaterial({
    color: color,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const m: THREE.Mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(points)).rotateX(-Math.PI / 2),
    material,
  );
  m.position.y = height;
  m.receiveShadow = true;
  return m;
}

// A car at real size (the car of Foxwood is exaggerated to double). The front points towards +x.
function car(color: string) {
  const a = castShadows(M().car(color));
  a.scale.setScalar(0.5);
  return group(a);
}

// Buildings: the Foxwood models (house, barn, cabin, sauna) and the shop and the church.
const building = (name: string, l: number, k: number) => M().building(name, l, k);

// A red sign with white text (the texture is drawn on a canvas).
function sign(text: string, l: number, k: number, x: number, y: number, z: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * k) / l);
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#D9463A';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#fff';
  c.font = `800 ${canvas.height * 0.62}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, canvas.width / 2, canvas.height * 0.54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const edge = material('#D9463A');
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, k, 0.3), [
    edge,
    edge,
    edge,
    edge,
    new THREE.MeshLambertMaterial({ map: texture }),
    edge,
  ]);
  m.position.set(x, y + k / 2, z);
  return m;
}

// Shop: a big low building, a flat roof, big windows and a red sign.
function shop() {
  const { box } = M();
  const g = group(
    box(16.4, 3.4, 10.4, '#9A968C', 0, -3, 0),
    box(16, 4.6, 10, '#E9E1D1', 0, 0.4, 0),
    box(16.4, 0.6, 10.4, '#9A938A', 0, 5, 0),
    sign(t('lessonPanel.shopSign'), 8, 1.6, 0, 5.6, 5.1),
    box(2, 3, 0.14, '#8FC3DA', 0, 0.4, 5.05),
    box(4.4, 2.6, 0.14, '#8FC3DA', -5, 1.2, 5.05),
    box(4.4, 2.6, 0.14, '#8FC3DA', 5, 1.2, 5.05),
  );
  return castShadows(g);
}

// Church: a white nave and a tower with a golden cross at the top.
function church() {
  const { box } = M();
  const hall = building('church', 14, 8);
  hall.position.x = 3;
  const spire = mesh(
    new THREE.ConeGeometry(2.6, 6, 4).rotateY(Math.PI / 4).translate(0, 3, 0),
    '#7A3A2E',
    -6.5,
    13,
    0,
  );
  const g = group(
    hall,
    box(3.8, 13, 3.8, '#FBF8F0', -6.5, 0, 0),
    box(1.2, 1.8, 0.14, '#4A4644', -6.5, 9.5, 1.95),
    box(1.4, 2.4, 0.14, '#8C5A3A', -6.5, 0, 1.95),
    spire,
    box(0.3, 2.6, 0.3, '#C9A441', -6.5, 19, 0),
    box(1.6, 0.3, 0.3, '#C9A441', -6.5, 20.3, 0),
  );
  return castShadows(g);
}

const models = {
  spruce,
  pine,
  birch,
  shrub,
  rock,
  strip,
  patch,
  car,
  building,
  shop,
  church,
  mesh,
  group,
  material,
  castShadows,
  seeded,
};

// ---------- Stage ----------
// The stage settings of a lesson (lesson.stage); the defaults are in A in create().
export interface StageSettings {
  camera?: Vec3;
  gaze?: Vec3;
  fov?: number;
  fox?: number;
  foxPosition?: Point;
  foxDirection?: number;
  background?: boolean;
}
// A view for one item (e.g. a tall church).
export interface ViewSettings {
  position?: Vec3;
  gaze?: Vec3;
  fov?: number;
}
export type LessonStage = Awaited<ReturnType<typeof create>>;

async function create({
  frame,
  overlay,
  settings = {},
}: {
  frame: HTMLElement;
  overlay: SVGSVGElement;
  settings?: StageSettings;
}) {
  const A: Required<StageSettings> = {
    camera: [0, 3, 12], // the position of the camera
    gaze: [0, 1, 0], // where the camera looks
    fov: 40,
    fox: 1.5, // the height of the fox to the ears (m)
    foxPosition: [-3, 2], // (x, z)
    foxDirection: -15, // in degrees; 0 = to the right, negative turns towards the viewer
    background: true, // the spruce forest in the background
    ...settings,
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 40, 130);
  scene.add(new THREE.HemisphereLight('#D8ECF5', '#5E6E3E', 1.15));
  const sun = new THREE.DirectionalLight('#FFF1D8', 2.6);
  sun.position.set(-30, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -35,
    right: 35,
    top: 35,
    bottom: -35,
    near: 1,
    far: 150,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  // Meadow: the ground is slightly lighter in front and darkens towards the forest.
  const groundGeo = new THREE.PlaneGeometry(400, 400, 40, 40).rotateX(-Math.PI / 2);
  const colors: number[] = [];
  const r = seeded(11);
  const c = new THREE.Color();
  for (let i = 0; i < groundGeo.attributes.position.count; i++) {
    const z = groundGeo.attributes.position.getZ(i);
    c.set('#94BE6E')
      .lerp(new THREE.Color('#7FAA5C'), Math.min(1, Math.max(0, -z / 40)))
      .multiplyScalar(0.95 + r() * 0.1);
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // The spruce forest of the background: a couple of irregular rows far away.
  const background = group();
  for (let row = 0; row < 3; row++) {
    for (let x = -70; x <= 70; x += 4.5) {
      const z = -32 - row * 5 - r() * 3;
      const tree = spruce(8 + r() * 5);
      tree.position.set(x + r() * 3, 0, z);
      background.add(tree);
    }
  }
  background.visible = A.background;
  scene.add(background);

  const targets = group();
  scene.add(targets);

  // Fox
  const fox = Fox.create();
  scene.add(fox.group);

  const sky = document.createElement('div');
  sky.className = 'sky';
  const canvas = document.createElement('canvas');
  frame.prepend(sky, canvas);
  const stage = Stage.create({ canvas, frame, world: { scene } });
  const { camera } = stage;
  camera.near = 0.3;
  camera.far = 400;
  fox.viewer = camera.position;
  // Continuous movements (e.g. flowing water): f(time) before every draw, until the stage is
  // cleared.
  const continuous: ((time: number) => void)[] = [];
  stage.beforeDraw.push(() => {
    const time = performance.now() / 1000;
    fox.update(time);
    for (const f of continuous) f(time);
  });

  function setCamera(position: Vec3 = A.camera, gaze: Vec3 = A.gaze, fov = A.fov) {
    camera.position.set(...position);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...gaze);
    stage.draw();
  }

  // Drawn on every frame when something moves, otherwise about 15 times a second (the tail and the
  // blinking). Nothing is drawn outside the screen.
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(frame);
  let running = 0;
  let last = 0;
  (function loop(now: number) {
    if (visible && (running > 0 || continuous.length > 0 || fox.moving() || now - last > 66)) {
      last = now;
      stage.draw();
    }
    requestAnimationFrame(loop);
  })(0);

  // A new press (clear) interrupts the old show: its animations stop and the next
  // await throws an Interrupted error, so the old show no longer moves the fox.
  let round = 0;
  const check = (own: number) => {
    if (own !== round) throw new Interrupted();
  };
  async function animate(duration: number, f: (t: number) => void) {
    const own = round;
    if (!duration) {
      f(1);
      stage.draw();
      return;
    }
    running++;
    try {
      await tween(duration, (t: number) => own === round && f(t));
    } finally {
      running--;
      stage.draw();
    }
    check(own);
  }
  async function pause(ms: number) {
    const own = round;
    await new Promise((resolve) => setTimeout(resolve, ms));
    check(own);
  }

  // The fox to (x, z). lift in metres (jumps), angle tilts in degrees (positive pushes the snout
  // down).
  function foxTo(x: number, z: number, lift = 0, angle = 0) {
    fox.group.position.set(x, lift, z);
    fox.group.rotation.z = -angle * DEG;
    stage.draw();
  }
  // The fox turns: direction in degrees (0 = to the right i.e. east, 90 = away from the viewer).
  function turn(direction: number) {
    fox.group.rotation.y = direction * DEG;
    stage.draw();
  }

  // camera = { position, gaze, fov } changes the view for this item (e.g. a tall church).
  function clear(camera?: ViewSettings) {
    round++;
    targets.clear();
    continuous.length = 0;
    overlay.replaceChildren();
    fox.group.scale.setScalar(A.fox / fox.height);
    fox.lookAt(null);
    fox.poses.set('facingViewer');
    foxTo(A.foxPosition[0], A.foxPosition[1]);
    turn(A.foxDirection);
    background.visible = A.background;
    setCamera(camera?.position, camera?.gaze, camera?.fov);
  }

  // An item at (x, z). Returns the item.
  function add<T extends THREE.Object3D>(object: T, [x, z]: Point = [0, 0], rotation = 0): T {
    object.position.set(x, object.position.y, z);
    object.rotation.y = rotation * DEG;
    targets.add(object);
    stage.draw();
    return object;
  }

  // The items rise from the ground in turn (slightly over and back). motion = 0 sets the final
  // state.
  async function grow(list: THREE.Object3D[], motion = 1, duration = 800, stagger = 0.12) {
    const sizes = list.map((k) => k.scale.clone());
    const setScale = (k: THREE.Object3D, i: number, s: number) => {
      const width = Math.min(1, 0.6 + 0.4 * s);
      k.scale.set(sizes[i].x * width, sizes[i].y * Math.max(s, 0.001), sizes[i].z * width);
      k.visible = s > 0.001;
    };
    if (!motion) return list.forEach((k, i) => setScale(k, i, 1));
    list.forEach((k, i) => setScale(k, i, 0));
    const total = 1 + stagger * (list.length - 1);
    await animate(duration * total, (t) =>
      list.forEach((k, i) => {
        const own = Math.min(1, Math.max(0, t * total - i * stagger));
        setScale(k, i, own * (1 + 0.25 * Math.sin(Math.PI * own)));
      }),
    );
  }

  // A world point on the overlay: [x, y] (viewBox 400 x 220) or null if the point is behind the
  // camera.
  function toScreen(x: number, y: number, z: number): Point | null {
    const p = stage.toScreen(new THREE.Vector3(x, y, z), L, K);
    return p && [p[0], p[1]];
  }

  clear();
  return {
    scene,
    camera,
    fox,
    models,
    clear,
    add,
    grow,
    animate,
    pause,
    everyFrame: (f: (time: number) => void) => continuous.push(f),
    foxTo,
    turn,
    toScreen,
    overlay,
    draw: stage.draw,
    render: stage.render,
  };
}

class Interrupted extends Error {}

export const LessonPanel = { create, models, Interrupted };
