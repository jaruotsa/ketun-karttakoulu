// The small 3D creatures of the scenes: cat, lizard, squirrel, cone, vole, tuft of grass, fish,
// leaf, mud, the flames and sparks of the campfire, splash rings, bird, electric spark and the
// orienteering control flag and finish gate. They are in the world of Foxwood like the fox, so they
// can be behind a tree and have a shadow.
//
// The sizes are in metres in the exaggerated scale of Foxwood: the fox is about 5 m tall, so the
// cat is about half of that. The creatures look towards +X, and the bottom edge is on the ground
// (y = 0) as with the fox.
//
//   const cat = Creatures.cat();   // a THREE.Group with its own helpers (e.g. cat.hiss(p))
import * as THREE from 'three';
import { World } from './world';
import type { Vec3 } from './types';

// Soft shading like the fox, so that the animals look fluffy.
const materials = new Map<string, THREE.MeshLambertMaterial>();
const material = (color: string) => {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color)!;
};
const glossy = (color: string) =>
  new THREE.MeshPhongMaterial({ color, specular: '#ffffff', shininess: 80 });

// A stretched sphere at (x, y, z), radii (rx, ry, rz).
function ball(color: string | THREE.Material, [x, y, z]: Vec3, [rx, ry, rz]: Vec3, detail = 18) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75)),
    typeof color === 'string' ? material(color) : color,
  );
  m.position.set(x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}
function coneMesh(
  color: string,
  [x, y, z]: Vec3,
  r: number,
  k: number,
  rotation: Vec3 = [0, 0, 0],
  sides = 10,
) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, k, sides), material(color));
  m.position.set(x, y, z);
  m.rotation.set(...rotation);
  return m;
}
// A tube through points (tail, leg).
function tube(color: string, points: Vec3[], r: number, endR = r) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 24, 1, 8, false);
  // The tube narrows towards the end.
  const p = geo.attributes.position;
  const centre = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = Math.floor(i / 9) / 24;
    curve.getPointAt(Math.min(u, 1), centre);
    const radius = r + (endR - r) * u;
    p.setXYZ(
      i,
      centre.x + (p.getX(i) - centre.x) * radius,
      centre.y + (p.getY(i) - centre.y) * radius,
      centre.z + (p.getZ(i) - centre.z) * radius,
    );
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material(color));
}
// A group; E lists the helper functions that the creature adds to it afterwards (e.g. group<{
// hiss(p: number): void }>).
const group = <E extends object = object>(...parts: THREE.Object3D[]) => {
  const g = new THREE.Group();
  if (parts.length) g.add(...parts);
  return g as THREE.Group & E;
};
const castShadows = <T extends THREE.Object3D>(g: T): T => {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
};
// Eye: a black glossy sphere and a highlight like the fox.
function eye([x, y, z]: number[], r: number, color = '#1A120E') {
  const g = group(
    ball(glossy(color), [0, 0, 0], [r, r, r], 12),
    ball(
      new THREE.MeshBasicMaterial({ color: '#fff' }),
      [r * 0.55, r * 0.45, 0],
      [r * 0.3, r * 0.3, r * 0.3],
      8,
    ),
  );
  g.position.set(x, y, z);
  return g;
}

// ---------- Cat (sitting, about 3.3 m) ----------
// cat.hiss(p): p = 0 sits calmly, 1 puffs up its fur, raises its tail and hisses.
type Hiss = { hiss(p: number): void };
function cat() {
  const COLOR = '#6B635C',
    LIGHT = '#D8D0C6'; // a grey cat, a light muzzle and paws
  const body = group(
    ball(COLOR, [0, 0.95, 0], [0.62, 0.9, 0.6]), // body
    ball(COLOR, [-0.25, 0.45, 0.4], [0.45, 0.42, 0.28]), // hind legs when sitting
    ball(COLOR, [-0.25, 0.45, -0.4], [0.45, 0.42, 0.28]),
    tube(
      COLOR,
      [
        [0.3, 1.1, 0.22],
        [0.36, 0.5, 0.24],
        [0.38, 0.06, 0.24],
      ],
      0.13,
      0.11,
    ), // front legs
    tube(
      COLOR,
      [
        [0.3, 1.1, -0.22],
        [0.36, 0.5, -0.24],
        [0.38, 0.06, -0.24],
      ],
      0.13,
      0.11,
    ),
    ball(LIGHT, [0.46, 0.08, 0.24], [0.16, 0.08, 0.12]),
    ball(LIGHT, [0.46, 0.08, -0.24], [0.16, 0.08, 0.12]),
  );
  const head = group(
    ball(COLOR, [0, 0, 0], [0.5, 0.44, 0.52]),
    ball(LIGHT, [0.38, -0.1, 0], [0.18, 0.14, 0.24]), // muzzle
    ball(glossy('#E0928A'), [0.53, -0.04, 0], [0.05, 0.04, 0.06], 10), // nose
    eye([0.36, 0.1, 0.19], 0.085, '#8FB23A'),
    eye([0.36, 0.1, -0.19], 0.085, '#8FB23A'),
  );
  const ears = [0.27, -0.27].map((z) => {
    const ear = group(
      coneMesh(COLOR, [0, 0.22, 0], 0.17, 0.44, [0, 0, 0], 4),
      coneMesh('#C9868A', [0.05, 0.18, 0], 0.1, 0.3, [0, 0, 0], 4),
    );
    ear.position.set(-0.05, 0.3, z);
    ear.rotation.x = z > 0 ? 0.3 : -0.3;
    head.add(ear);
    return ear;
  });
  // The mouth opens when hissing.
  const mouth = ball('#8A2A2A', [0.42, -0.22, 0], [0.1, 0.001, 0.12], 12);
  head.add(mouth);
  head.position.set(0.3, 2.0, 0);
  // The tail hangs from its joint: when sitting it curls to the ground, when hissing it rises
  // upright.
  const tail = group(
    tube(
      COLOR,
      [
        [0, 0, 0],
        [-0.1, 0.5, 0],
        [0.05, 1.0, 0.05],
        [0.25, 1.3, 0.1],
      ],
      0.13,
      0.1,
    ),
  );
  tail.position.set(-0.55, 0.25, 0);
  const cat = castShadows(group<Hiss>(body, head, tail));
  cat.hiss = (p: number) => {
    body.scale.set(1 + 0.15 * p, 1 + 0.12 * p, 1 + 0.2 * p); // the fur puffs up
    body.position.y = 0.15 * p;
    head.position.y = 2.0 + 0.1 * p;
    head.rotation.z = -0.2 * p; // the head sinks slightly
    for (const k of ears) k.rotation.z = 0.9 * p; // the ears laid back
    mouth.scale.y = 0.001 + 0.12 * p;
    tail.rotation.z = Math.PI / 2 - 1.45 * p; // the tail from the ground to upright
    tail.scale.set(1 + 0.8 * p, 1 + 0.2 * p, 1 + 0.8 * p);
  };
  cat.hiss(0);
  // The cat is slightly exaggerated like the fox, so that its expressions are visible.
  const g = group<Hiss>(cat);
  g.scale.setScalar(1.4);
  g.hiss = cat.hiss;
  return g;
}

// ---------- Lizard (about 2 m) ----------
function lizard() {
  const COLOR = '#6E7A3A',
    DARK = '#4E5A2A';
  const legs: THREE.Group[] = [];
  const g = group<{ run(time: number): void }>(
    ball(COLOR, [0, 0.14, 0], [0.34, 0.1, 0.14]),
    ball(COLOR, [0.4, 0.16, 0], [0.15, 0.08, 0.1]),
    tube(
      COLOR,
      [
        [-0.28, 0.14, 0],
        [-0.55, 0.1, 0.06],
        [-0.8, 0.06, 0],
      ],
      0.08,
      0.015,
    ),
    eye([0.47, 0.2, 0.07], 0.022),
    eye([0.47, 0.2, -0.07], 0.022),
  );
  for (const [x, z] of [
    [0.2, 1],
    [0.2, -1],
    [-0.18, 1],
    [-0.18, -1],
  ] as [number, number][]) {
    const leg = group(
      tube(
        DARK,
        [
          [0, 0, 0],
          [0.02, -0.04, 0.12 * z],
          [0.06, -0.1, 0.16 * z],
        ],
        0.03,
        0.02,
      ),
    );
    leg.position.set(x, 0.14, 0.08 * z);
    legs.push(leg);
    g.add(leg);
  }
  // The legs flick when running (time in seconds).
  g.run = (time: number) =>
    legs.forEach((j, i) => (j.rotation.y = Math.sin(time * 30 + (i % 3 ? Math.PI : 0)) * 0.5));
  g.scale.setScalar(1.6); // exaggerated, so that the lizard is visible on the stone
  return castShadows(g);
}

// ---------- Squirrel (sitting, about 2 m) ----------
function squirrel() {
  const COLOR = '#C4652F',
    DARK = '#B5562A',
    BELLY = '#F3DEC0';
  const tail = group(
    ball(DARK, [-0.35, 0.45, 0], [0.26, 0.32, 0.22]),
    ball(DARK, [-0.5, 0.85, 0], [0.28, 0.34, 0.24]),
    ball(DARK, [-0.38, 1.22, 0], [0.26, 0.26, 0.22]),
    ball(DARK, [-0.15, 1.38, 0], [0.2, 0.16, 0.18]),
  );
  const head = group(
    ball(COLOR, [0, 0, 0], [0.24, 0.22, 0.22]),
    ball(BELLY, [0.16, -0.06, 0], [0.1, 0.08, 0.12]),
    ball(glossy('#2A1C18'), [0.25, -0.02, 0], [0.035, 0.03, 0.035], 8),
    eye([0.15, 0.06, 0.11], 0.045),
    eye([0.15, 0.06, -0.11], 0.045),
    coneMesh(DARK, [-0.05, 0.25, 0.1], 0.07, 0.2, [0.25, 0, 0], 5),
    coneMesh(DARK, [-0.05, 0.25, -0.1], 0.07, 0.2, [-0.25, 0, 0], 5),
  );
  head.position.set(0.12, 0.92, 0);
  const g = group<{ tail: THREE.Group }>(
    ball(COLOR, [0, 0.45, 0], [0.24, 0.36, 0.22]),
    ball(BELLY, [0.1, 0.42, 0], [0.16, 0.28, 0.16]),
    ball(COLOR, [0.18, 0.62, 0.1], [0.08, 0.12, 0.06]), // front paws
    ball(COLOR, [0.18, 0.62, -0.1], [0.08, 0.12, 0.06]),
    ball(DARK, [0.05, 0.08, 0.14], [0.2, 0.08, 0.08]),
    ball(DARK, [0.05, 0.08, -0.14], [0.2, 0.08, 0.08]),
    head,
    tail,
  );
  g.tail = tail;
  g.scale.setScalar(1.4); // exaggerated like the fox, so that the squirrel is visible next to the spruce
  return castShadows(g);
}

// Cone (about 1 m long): a scaly shape, upright.
function cone() {
  const g = group();
  for (let i = 0; i < 5; i++) {
    const y = -0.4 + i * 0.2;
    const r = 0.28 * Math.sin(Math.PI * (0.15 + 0.7 * (i / 4))) + 0.06;
    g.add(coneMesh(i % 2 ? '#7A5230' : '#6A4424', [0, y, 0], r, 0.28, [Math.PI, i * 0.6, 0], 7));
  }
  return castShadows(g);
}

// ---------- Vole (about 2 m long) ----------
function vole() {
  const COLOR = '#8B7B6B',
    LIGHT = '#A8968A';
  const g = group(
    ball(COLOR, [0, 0.32, 0], [0.5, 0.33, 0.34]),
    ball(COLOR, [0.45, 0.45, 0], [0.26, 0.24, 0.24]),
    ball(LIGHT, [0.38, 0.68, 0.15], [0.1, 0.11, 0.05]),
    ball(LIGHT, [0.38, 0.68, -0.15], [0.1, 0.11, 0.05]),
    ball(glossy('#E88888'), [0.71, 0.45, 0], [0.05, 0.045, 0.05], 8),
    eye([0.6, 0.53, 0.12], 0.04),
    eye([0.6, 0.53, -0.12], 0.04),
    tube(
      COLOR,
      [
        [-0.45, 0.3, 0],
        [-0.75, 0.2, 0.1],
        [-0.95, 0.25, 0],
      ],
      0.04,
      0.02,
    ),
  );
  g.scale.setScalar(1.6); // exaggerated, so that the vole is visible in the field
  return castShadows(g);
}

// Tuft of grass (about 2.2 m): dry stalks at the edge of the field.
function grass() {
  const g = group();
  (
    [
      [-0.3, 0.25, 1.4],
      [0, -0.05, 1.6],
      [0.25, -0.3, 1.3],
      [0.1, 0.35, 1.5],
      [-0.15, -0.3, 1.2],
      [0.3, 0.1, 1.45],
      [-0.35, -0.1, 1.35],
    ] as Vec3[]
  ).forEach(([x, z, k], i) => {
    const stalk = coneMesh(
      i % 2 ? '#C9A441' : '#B8923A',
      [x, k / 2, z],
      0.06,
      k,
      [z * 0.5, 0, -x * 0.6],
      5,
    );
    g.add(stalk);
  });
  g.scale.setScalar(1.4);
  return castShadows(g);
}

// ---------- Fish (about 3 m, exaggerated) ----------
function fish() {
  const COLOR = '#8A9BA8';
  const g = group(
    ball(glossy(COLOR), [0, 0, 0], [1, 0.36, 0.22]),
    coneMesh(COLOR, [-1.15, 0, 0], 0.4, 0.5, [0, 0, Math.PI / 2], 4),
    coneMesh('#7A8B98', [0, 0.38, 0], 0.18, 0.4, [0, 0, -0.3], 4),
    eye([0.7, 0.08, 0.14], 0.07),
    eye([0.7, 0.08, -0.14], 0.07),
  );
  g.children[1].scale.z = 0.25; // the tail fin is flat
  g.scale.setScalar(1.5);
  return castShadows(g);
}

// Leaf (about 2.4 m, exaggerated), floats on the water.
function leaf() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, 0);
  shape.quadraticCurveTo(0, 0.55, 0.75, 0);
  shape.quadraticCurveTo(0, -0.55, -0.75, 0);
  const surface = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: '#E0A23A', side: THREE.DoubleSide }),
  );
  const vein = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.05), material('#A8701E'));
  vein.position.y = 0.01;
  const g = group(surface, vein);
  g.scale.setScalar(1.6); // exaggerated, so that the leaf is visible in the current
  return castShadows(g);
}

// Wet mud around the fox in the mire: a dark puddle with water in the middle.
function mud() {
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: '#6E6232', transparent: true }),
  );
  puddle.scale.set(4.6, 1, 3.4);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({
      color: '#7F9DA8',
      specular: '#ffffff',
      shininess: 60,
      transparent: true,
      opacity: 0.7,
    }),
  );
  water.scale.set(3.2, 1, 2.1);
  water.position.y = 0.02;
  const g = group<{ visibility(a: number): void }>(puddle, water);
  puddle.receiveShadow = water.receiveShadow = true;
  g.visibility = (a: number) => {
    puddle.material.opacity = a;
    water.material.opacity = 0.7 * a;
    g.visible = a > 0.01;
  };
  return g;
}

// ---------- The flames and sparks of the campfire ----------
// flames.size(n): 0 = out, 1 = burning. flames.update(time) flickers and sends sparks flying.
function flames() {
  const basic = (color: string) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
  const tongueData: [THREE.Material, number, number, Vec3][] = [
    [basic('#F07B22'), 0.75, 2.6, [0, 0, 0]],
    [basic('#F07B22'), 0.45, 1.8, [0.45, 0, 0.3]],
    [basic('#F07B22'), 0.45, 1.9, [-0.4, 0, -0.3]],
    [basic('#FFC23A'), 0.5, 1.7, [0.05, 0, 0.05]],
    [basic('#FFF3B0'), 0.28, 0.9, [0.05, 0, 0.1]],
  ];
  const tongues = tongueData.map(([a, r, k, [x, y, z]]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, k, 7).translate(0, k / 2, 0), a);
    m.position.set(x, y, z);
    return m;
  });
  const light = new THREE.PointLight('#FFA040', 0, 30, 1.5);
  light.position.y = 1.5;
  // Sparks: a small group of balls that rise and go out.
  const sparkMaterials = [basic('#FFC23A'), basic('#F07B22')];
  const sparkMeshes = Array.from({ length: 18 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), sparkMaterials[i % 2]);
    m.userData = {
      start: Math.random() * 1.6,
      x: (Math.random() - 0.5) * 1.2,
      z: (Math.random() - 0.5) * 1.2,
      sway: (Math.random() - 0.5) * 2,
    };
    return m;
  });
  const g = group<{ size(n: number): void; sparks: boolean; update(time: number): void }>(
    ...tongues,
    light,
    ...sparkMeshes,
  );
  let size = 0;
  g.size = (n: number) => {
    size = n;
    g.visible = n > 0.001;
    light.intensity = 60 * n;
    g.scale.setScalar(Math.max(n, 0.001));
  };
  // sparks: whether the sparks fly (the fire has just been lit).
  g.sparks = true;
  g.update = (time: number) => {
    tongues.forEach((m, i) => {
      const v = Math.sin(time * (11 + i * 3) + i * 1.7);
      m.scale.set(1 - 0.08 * v, 1 + 0.14 * v, 1 - 0.08 * v);
      m.rotation.z = 0.06 * Math.sin(time * 7 + i);
    });
    light.intensity = 60 * size * (0.9 + 0.1 * Math.sin(time * 17));
    for (const k of sparkMeshes) {
      const u = ((time + k.userData.start) % 1.6) / 1.6;
      k.visible = g.sparks;
      k.position.set(k.userData.x + k.userData.sway * u, 1.5 + 5 * u, k.userData.z);
      k.scale.setScalar(1 - u);
    }
  };
  g.size(0);
  return g;
}

// ---------- Splash rings ---------- Three rings expand and fade. Returns a group whose
// update(elapsed) returns false when the splash is over.
function splash(color = '#ffffff') {
  const rings = [0, 1, 2].map(
    () =>
      new THREE.Mesh(
        new THREE.RingGeometry(0.88, 1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
      ),
  );
  const g = group<{ update(elapsed: number): boolean }>(...rings);
  g.update = (elapsed: number) => {
    rings.forEach((r, i) => {
      const u = Math.min(1, Math.max(0, (elapsed - i * 0.25) / 1.1));
      const eased = 1 - (1 - u) * (1 - u);
      r.scale.setScalar(0.1 + 2.4 * eased);
      r.material.opacity = u > 0 ? 1 - u : 0;
    });
    return elapsed < 1.6;
  };
  g.update(0);
  return g;
}

// ---------- Control flag (orienteering) ---------- A three-sided flag: each side is divided
// diagonally into a white (upper left) and an orange (lower right) half. The flag hangs on a post
// that has a punch. Exaggerated like the fox: a side of 1.6 m, the top edge of the flag at 3.6 m.
// flag.stamp(p): p = 1 lights the light of the punch (the fox punches), 0 puts it out.
function controlFlag() {
  const SIDE = 1.6,
    TOP = 3.6,
    R = SIDE / Math.sqrt(3);
  const corner = (i: number, y: number): Vec3 => [
    R * Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 6),
    y,
    R * Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 6),
  ];
  const whitePoints: number[] = [],
    orangePoints: number[] = [];
  for (let i = 0; i < 3; i++) {
    const [a, b] = [i, (i + 1) % 3];
    const [aTop, bTop, aBottom, bBottom] = [
      corner(a, TOP),
      corner(b, TOP),
      corner(a, TOP - SIDE),
      corner(b, TOP - SIDE),
    ];
    whitePoints.push(...aTop, ...bTop, ...aBottom);
    orangePoints.push(...bTop, ...bBottom, ...aBottom);
  }
  const cloth = (points: number[], color: string) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  };
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, TOP + 0.2, 8).translate(0, (TOP + 0.2) / 2, 0),
    material('#8A6A48'),
  );
  const puncher = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.22), material('#3A3A3E'));
  puncher.position.set(0.14, 1.3, 0);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#5A1A1A' }),
  );
  light.position.set(0.32, 1.42, 0);
  const g = castShadows(
    group<{ stamp(p: number): void }>(
      post,
      puncher,
      light,
      cloth(whitePoints, '#FFFFFF'),
      cloth(orangePoints, '#F26B21'),
    ),
  );
  g.stamp = (p: number) => {
    light.material.color.set(p > 0.5 ? '#FF3B30' : '#5A1A1A');
  };
  return g;
}

// ---------- Finish gate (orienteering) ---------- Two white posts and an orange cloth that says
// MAALI (Finnish for "finish"). The gate runs along the z axis, so a fox coming from the +X
// direction runs under it. Width 11 m and the lower edge of the cloth 6 m (the fox is 5 m).
function finishGate() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#F26B21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#fff';
  c.font = `800 ${canvas.height * 0.66}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('MAALI', canvas.width / 2, canvas.height * 0.54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const text = new THREE.MeshLambertMaterial({ map: texture });
  const edge = material('#F26B21');
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.9, 10), [
    text,
    text,
    edge,
    edge,
    edge,
    edge,
  ]);
  cloth.position.y = 7;
  const post = (z: number) => {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 8.2, 10).translate(0, 4.1, 0),
      material('#F4F1E8'),
    );
    t.position.z = z;
    return t;
  };
  return castShadows(group(cloth, post(-5.5), post(5.5)));
}

// ---------- Ants (the ant nest of orienteering) ---------- Small black ants scurry on the surface
// of the ant nest (World.models.antNest). They are exaggerated in size so that they are visible.
// ants.update(time, amount): amount = 0..1 = how many are on the surface (they come out from the
// top of the nest).
function ants(count = 26) {
  const { NEST, nestSurface } = World;
  const g = group<{ update(time: number, amount?: number): void }>();
  const black = material('#16110E');
  const parts: { m: THREE.Group; a: number; speed: number; u: number }[] = [];
  for (let i = 0; i < count; i++) {
    const m = group(
      ball(black, [0.16, 0.07, 0], [0.1, 0.07, 0.08], 8),
      ball(black, [0, 0.06, 0], [0.07, 0.05, 0.06], 8),
      ball(black, [-0.18, 0.08, 0], [0.14, 0.09, 0.1], 8),
    );
    g.add(m);
    parts.push({
      m,
      a: (i / count) * 2 * Math.PI * 3.7,
      speed: (0.25 + (i % 5) * 0.08) * (i % 2 ? 1 : -1),
      u: 0.2 + ((i * 37) % 70) / 100,
    });
  }
  g.update = (time: number, amount = 1) => {
    parts.forEach(({ m, a, speed, u }, i) => {
      const own = Math.min(1, Math.max(0, amount * count - i));
      m.visible = own > 0;
      const radius = NEST.radius * (u * own + 0.12 * Math.sin(time * 1.3 + i)) * 0.9;
      const corner = a + time * speed;
      m.position.set(
        Math.cos(corner) * radius,
        nestSurface(Math.abs(radius)) + 0.02,
        Math.sin(corner) * radius,
      );
      m.rotation.y = -corner - (speed > 0 ? Math.PI / 2 : -Math.PI / 2);
    });
  };
  g.update(0, 0);
  return g;
}

// ---------- Bird (a wagtail, about 2 m exaggerated so that it is visible on the wire) ----------
// Sits on a wire: the feet are at y = 0. bird.wings(k): 0 = wings closed, 1 = open (in flight).
function bird() {
  const BLACK = '#2A2A2E',
    GREY = '#8C9096',
    WHITE = '#F4F2EC';
  const wing = (side: number) => {
    const s = group(
      ball(GREY, [-0.15, 0, 0.12 * side], [0.28, 0.06, 0.16]),
      ball(BLACK, [-0.38, 0, 0.14 * side], [0.12, 0.05, 0.12]),
    );
    s.position.set(0, 0.42, 0.14 * side);
    return s;
  };
  const [left, right] = [wing(1), wing(-1)];
  const head = group(
    ball(WHITE, [0, 0, 0], [0.15, 0.14, 0.13]),
    ball(BLACK, [-0.02, 0.07, 0], [0.13, 0.08, 0.12]), // black crown
    ball(BLACK, [0.06, -0.08, 0], [0.09, 0.07, 0.1]), // black throat
    coneMesh(BLACK, [0.18, 0, 0], 0.035, 0.12, [0, 0, -Math.PI / 2], 6),
    eye([0.1, 0.03, 0.09], 0.03),
    eye([0.1, 0.03, -0.09], 0.03),
  );
  head.position.set(0.2, 0.55, 0);
  const g = group<{ wings(k: number): void }>(
    ball(GREY, [0, 0.35, 0], [0.26, 0.16, 0.15]),
    ball(WHITE, [0.05, 0.3, 0], [0.18, 0.12, 0.13]),
    tube(
      BLACK,
      [
        [-0.2, 0.36, 0],
        [-0.45, 0.4, 0],
        [-0.7, 0.44, 0],
      ],
      0.06,
      0.05,
    ), // long tail
    tube(
      '#3A3A3A',
      [
        [0.02, 0.24, 0.05],
        [0.02, 0, 0.05],
      ],
      0.015,
    ),
    tube(
      '#3A3A3A',
      [
        [0.02, 0.24, -0.05],
        [0.02, 0, -0.05],
      ],
      0.015,
    ),
    head,
    left,
    right,
  );
  g.wings = (k: number) => {
    left.rotation.x = -1.2 * k;
    right.rotation.x = 1.2 * k;
  };
  g.scale.setScalar(2.4);
  return castShadows(g);
}

// Electric spark: a glowing yellow ball with its own light. spark.glow(n) = 0..1.
function spark() {
  const core = ball(
    new THREE.MeshBasicMaterial({ color: '#FFF6B0' }),
    [0, 0, 0],
    [0.4, 0.4, 0.4],
    12,
  );
  const shell = ball(
    new THREE.MeshBasicMaterial({
      color: '#FFD23A',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    [0, 0, 0],
    [1, 1, 1],
    12,
  );
  const light = new THREE.PointLight('#FFD23A', 0, 14, 2);
  const g = group<{ glow(n: number): void }>(core, shell, light);
  g.glow = (n: number) => {
    shell.scale.setScalar(0.4 + 0.5 * n);
    light.intensity = 40 * n;
  };
  return g;
}

export const Creatures = {
  cat,
  lizard,
  squirrel,
  cone,
  vole,
  grass,
  fish,
  leaf,
  mud,
  flames,
  splash,
  controlFlag,
  finishGate,
  ants,
  bird,
  spark,
};
