// The 3D fox (Three.js). The same fox as in fox-svg.ts: a round head, big eyes, a fluffy tail and a
// blue scout scarf. The fox is assembled from simple shapes, and the parts are moved from code.
//
// Coordinates: the fox looks towards +X, up is +Y, and the paws are on the ground (y = 0). The
// height to the tips of the ears is about 1.2 units; scale the group to fit.
//
//   const fox = Fox.create();
//   scene.add(fox.group);
//   fox.lookAt(camera.position);   // the head turns to the viewer (null = forward)
//   fox.jump();                    // a happy jump
//   fox.walking = true;            // the legs move
//   fox.update(time);              // on every frame, time in seconds
import * as THREE from 'three';
import type { Stage } from './stage';

const COLORS = {
  fur: '#E9782C',
  shade: '#C95E1E',
  cream: '#FCEBD5', // cream white, softer than pure white
  dark: '#3A2418',
  brow: '#5A2A12', // eyebrows and the tips of the ears
  earInner: '#F7D9BC',
  scarf: '#2E6FB7',
  knot: '#1F4F86',
};

// The poses of the fox (see poses below).
export type Pose = 'facingViewer' | 'curious' | 'pawUp' | 'walking' | 'cheering';
export type Fox = ReturnType<typeof create>;

function create() {
  // Soft shading (no edges), so that the fox looks fluffy.
  const materials: Record<string, THREE.Material> = {};
  for (const [name, color] of Object.entries(COLORS))
    materials[name] = new THREE.MeshLambertMaterial({ color: color });
  // The eyes and the nose are glossy, so that the fox looks alive.
  const glossy = (color: string) =>
    new THREE.MeshPhongMaterial({ color: color, specular: '#ffffff', shininess: 90 });
  materials.eye = glossy('#1A120E');
  materials.nose = glossy('#2A1C18');
  materials.shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  // A sphere that can be stretched into an oval (radii rx, ry, rz).
  const ball = (
    rx: number,
    ry: number,
    rz: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    detail = 24,
  ) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75)),
      material,
    );
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    return m;
  };
  const group = (x = 0, y = 0, z = 0, ...lapset: THREE.Object3D[]) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (lapset.length) g.add(...lapset);
    return g;
  };

  const root = new THREE.Group(); // this is moved in the world
  const body = group(); // jumps and breathes
  root.add(body);

  // ---------- Torso ----------
  const torso = ball(0.42, 0.22, 0.2, materials.fur, 0, 0.44, 0);
  const neck = ball(0.16, 0.2, 0.15, materials.fur, 0.3, 0.58, 0);
  neck.rotation.z = -0.6;
  const chest = ball(0.15, 0.17, 0.15, materials.cream, 0.32, 0.46, 0);
  const belly = ball(0.28, 0.08, 0.14, materials.cream, 0.04, 0.3, 0);
  body.add(torso, neck, chest, belly);

  // ---------- Legs: they rotate from the hip, the paws are dark ----------
  const legs: THREE.Group[] = [];
  for (const [x, z, phase] of [
    [0.24, 0.11, 0],
    [0.24, -0.11, Math.PI],
    [-0.24, 0.11, Math.PI],
    [-0.24, -0.11, 0],
  ]) {
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056, 0.24, 4, 10),
      z > 0 ? materials.fur : materials.shade,
    );
    thigh.position.y = -0.18;
    const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.08, 4, 10), materials.dark);
    paw.position.y = -0.3;
    const hip = group(x, 0.36, z, thigh, paw);
    hip.userData.phase = phase;
    legs.push(hip);
    body.add(hip);
  }

  // ---------- Tail: big and fluffy, with a white tip ---------- The outline of the tail is rotated
  // into a solid (LatheGeometry): a narrow base, a thick middle, a round tip.
  const tailShape = (start: number, end: number) => {
    const pisteet: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = start + ((end - start) * i) / 12;
      const r = 0.2 * Math.sin(Math.PI * Math.min(t, 0.999) ** 0.75) ** 0.55 * (0.5 + 0.5 * t);
      pisteet.push(new THREE.Vector2(Math.max(r, 0.001), t * 0.72));
    }
    return new THREE.LatheGeometry(pisteet, 14);
  };
  const tailAngle = group();
  tailAngle.rotation.z = -0.55; // backwards and up
  const tailFur = new THREE.Mesh(tailShape(0, 0.72), materials.fur);
  const tailTip = new THREE.Mesh(tailShape(0.72, 1), materials.cream);
  for (const m of [tailFur, tailTip]) {
    m.rotation.z = Math.PI / 2; // the lathe is on the Y axis, the tail points backwards (-X)
    tailAngle.add(m);
  }
  const tail = group(-0.34, 0.5, 0, tailAngle);
  body.add(tail);

  // ---------- Scarf: a ring around the neck and a triangle on the chest ----------
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 20), materials.scarf);
  ring.position.set(0.32, 0.6, 0);
  ring.lookAt(ring.position.clone().add(new THREE.Vector3(0.62, 0.78, 0)));
  const triangle = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 3), materials.scarf);
  triangle.rotation.z = Math.PI;
  triangle.scale.z = 0.4;
  triangle.position.set(0.49, 0.4, 0);
  const knot = ball(0.045, 0.045, 0.045, materials.knot, 0.44, 0.56, 0, 10);
  body.add(ring, triangle, knot);

  // ---------- Head: turns from the neck ----------
  const head = group(0.36, 0.7, 0);
  body.add(head);
  const face = group(0.06, 0.07, 0); // the centre of the head
  face.scale.setScalar(1.18); // a big head is cute
  head.add(face);
  // The shape of the head: a sphere from which a narrowing snout is stretched forward and widening
  // cheeks to the sides. shape(n) gives the point of the surface of the head in the direction n (a
  // unit vector from the centre of the head).
  const smooth = (a: number, b: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const SNOUT = new THREE.Vector3(1, -0.28, 0).normalize();
  const CHEEKS = [1, -1].map((side) => new THREE.Vector3(-0.05, -0.4, 0.92 * side).normalize());
  function shape(n: THREE.Vector3) {
    const p = new THREE.Vector3(n.x * 0.24, n.y * 0.22, n.z * 0.25);
    // Snout: the surface stretches forward and narrows towards the tip.
    const k = smooth(0.62, 1, n.dot(SNOUT));
    p.addScaledVector(SNOUT, 0.17 * k * k);
    p.z *= 1 - 0.45 * k;
    p.y += 0.03 * k; // the bridge of the snout stays straight
    // Cheeks: a soft widening down and to the sides, slightly pointed at the tip.
    for (const c of CHEEKS) {
      const w = smooth(0.72, 1, n.dot(c));
      p.addScaledVector(c, 0.07 * w * w);
    }
    return p;
  }

  // The cream-white area: the chin, the cheeks and the underside of the snout. The forehead, the
  // bridge of the snout and the back of the head are orange.
  const orange = new THREE.Color(COLORS.fur);
  const cream = new THREE.Color(COLORS.cream);
  const creaminess = (n: THREE.Vector3) =>
    smooth(
      0.06,
      0.16,
      -n.y + 0.2 * Math.abs(n.z) - 0.45 * Math.max(0, -n.x) - 0.12 * Math.max(0, n.x),
    );

  const headGeometry = new THREE.SphereGeometry(1, 72, 54);
  const positions = headGeometry.attributes.position;
  const colors = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    n.fromBufferAttribute(positions, i).normalize();
    const v = orange.clone().lerp(cream, creaminess(n));
    colors.push(v.r, v.g, v.b);
    const q = shape(n);
    positions.setXYZ(i, q.x, q.y, q.z);
  }
  headGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  headGeometry.computeVertexNormals();
  face.add(new THREE.Mesh(headGeometry, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // A point on the surface of the head in the direction (x, y, z) and the surface normal. depth < 1
  // presses the point into the surface.
  const onSurface = (x: number, y: number, z: number, depth = 0.93) => {
    const direction = new THREE.Vector3(x, y, z).normalize();
    const point = shape(direction);
    const t1 = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const t2 = direction.clone().cross(t1);
    const a = shape(direction.clone().addScaledVector(t1, 0.01).normalize()).sub(point);
    const b = shape(direction.clone().addScaledVector(t2, 0.01).normalize()).sub(point);
    const normal = a.cross(b).normalize();
    if (normal.dot(point) < 0) normal.negate();
    point.addScaledVector(normal, -(1 - depth) * 0.24);
    return { point, normal };
  };
  const outward = new THREE.Vector3(1, 0, 0);

  // The nose at the tip of the snout.
  const nosePoint = onSurface(1, -0.2, 0, 1).point;
  face.add(ball(0.045, 0.036, 0.05, materials.nose, nosePoint.x, nosePoint.y, nosePoint.z));

  // The mouth is a thin line as with the SVG fox: down from the nose and two small arcs from it
  // (ω).
  const mouth = onSurface(0.93, -0.5, 0, 1);
  const mouthGroup = group(mouth.point.x, mouth.point.y, mouth.point.z);
  mouthGroup.quaternion.setFromUnitVectors(outward, mouth.normal);
  for (const side of [1, -1]) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0055, 6, 14, Math.PI),
      materials.dark,
    );
    arc.rotation.z = Math.PI; // the lower arc
    const arcGroup = group(0, 0, 0.022 * side, arc);
    arcGroup.rotation.y = Math.PI / 2; // the plane of the arc along the surface
    mouthGroup.add(arcGroup);
  }
  face.add(mouthGroup);
  const belowNose = nosePoint.clone().add(new THREE.Vector3(-0.01, -0.03, 0));
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, belowNose.distanceTo(mouth.point), 6),
    materials.dark,
  );
  line.position.copy(belowNose).lerp(mouth.point, 0.5);
  line.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    belowNose.clone().sub(mouth.point).normalize(),
  );
  face.add(line);

  // Eyes: black and glossy as with the SVG fox, with two highlights. They are thin and pressed into
  // the surface of the head, so that the eyes do not bulge (bulging ones looked like fish eyes).
  // The eyes are at the front of the face, not at the sides. The +X of the eye group points out of
  // the surface of the head.
  const eyes: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const { point, normal } = onSurface(0.72, 0.26, 0.44 * side, 0.98);
    const eye = group(
      point.x,
      point.y,
      point.z,
      ball(0.019, 0.058, 0.05, materials.eye),
      ball(0.004, 0.012, 0.012, materials.shine, 0.02, 0.018, 0.012 * side, 10),
      ball(0.003, 0.006, 0.006, materials.shine, 0.019, -0.025, -0.011 * side, 8),
    );
    eye.quaternion.setFromUnitVectors(outward, normal);
    eyes.push(eye);
    face.add(eye);

    // Eyebrow: a dark arc above the eye, attached to the surface of the head.
    // Its own group, so that the brow does not flatten when the eye blinks.
    const arc = 0.55 * Math.PI;
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.009, 8, 16, arc), materials.brow);
    brow.rotation.z = (Math.PI - arc) / 2 - 0.15 * side; // the arc pointing up in the middle, the inner end slightly higher (friendly)
    const browGroup = group(0, -0.048, 0, brow); // the top of the arc is at the surface point
    browGroup.rotation.y = Math.PI / 2; // the plane of the arc along the surface
    const browPoint = onSurface(0.64, 0.62, 0.44 * side, 1);
    const browSlot = group(browPoint.point.x, browPoint.point.y, browPoint.point.z, browGroup);
    browSlot.quaternion.setFromUnitVectors(outward, browPoint.normal);
    face.add(browSlot);
  }

  // Ears: big and wide, with a dark tip and a cream-white inside. The base of the ear is pressed
  // into the head and closer to the crown, so that the corners of the base do not stick out at the
  // sides of the head.
  const ears: THREE.Group[] = [];
  const EAR = { width: 0.13, height: 0.33, sink: 0.05 };
  for (const side of [1, -1]) {
    const { width, height, sink } = EAR;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(width, height, 16), materials.fur);
    outer.position.y = height / 2;
    outer.scale.x = 0.35;
    // The dark tip: the same slope as the ear, slightly thicker, so that it covers the tip.
    const tipHeight = 0.1;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry((width * tipHeight) / height, tipHeight, 16),
      materials.brow,
    );
    tip.position.y = height - tipHeight / 2;
    tip.scale.set(0.37, 1, 1.04);
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.66, height * 0.7, 16),
      materials.earInner,
    );
    inner.position.set(0.028, height * 0.35 + 0.01, 0);
    inner.scale.x = 0.25;
    const shape = group(0, -sink, 0, outer, tip, inner);
    const ear = group(-0.02, 0.18, 0.1 * side, shape);
    ear.rotation.x = 0.36 * side;
    ear.rotation.y = -0.15 * side; // the inside turns slightly forward
    ear.userData.tilt = ear.rotation.x;
    ears.push(ear);
    face.add(ear);
  }

  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== materials.shine) o.castShadow = true;
  });

  // Visibility 0..1 (e.g. the fox fades when the camera rises). All the materials belong to this
  // fox.
  const materialSet = new Set<THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) materialSet.add(o.material);
  });
  function visibility(a: number) {
    for (const m of materialSet) {
      m.transparent = a < 1;
      m.opacity = a;
      m.depthWrite = a >= 1;
    }
    root.visible = a > 0;
  }

  // ---------- Poses ----------
  //   facingViewer  the head (and if needed the whole fox) turns to the viewer (fox.viewer)
  //   curious       the head tilts and rises curiously
  //   pawUp         the nearer front paw rises, and the fox looks at it
  //   walking       the legs move
  //   cheering      three happy jumps
  const active = new Set<Pose>();
  let changed = -10; // when the pose last changed (time in seconds)
  const poses = {
    add(...names: Pose[]) {
      for (const n of names) {
        if (n === 'cheering' && !active.has(n)) jump(3);
        active.add(n);
      }
      changed = previous;
    },
    remove(...names: Pose[]) {
      for (const n of names) active.delete(n);
      changed = previous;
    },
    contains: (n: Pose) => active.has(n),
    // Removes all the poses and sets new ones (like setAttribute('class', ...)).
    set(...names: Pose[]) {
      active.clear();
      poses.add(...names);
    },
  };

  // ---------- Movement ----------
  let gazeTarget: THREE.Vector3 | null = null; // a world point or null
  const gaze = { turn: 0, nod: 0, tilt: 0, bodyTurn: 0 };
  let jumpStart = -1;
  let jumps = 2;
  let previous = 0;
  let nextBlink = 2;
  let nextEarTwitch = 3;
  const tmp = new THREE.Vector3();

  function lookAt(point?: THREE.Vector3 | null) {
    gazeTarget = point ? point.clone() : null;
  }

  function jump(count = 2) {
    jumpStart = previous;
    jumps = count;
  }

  const JUMP = 0.5; // the duration of one jump in seconds

  function update(time: number) {
    const dt = THREE.MathUtils.clamp(time - previous, 0, 0.1);
    previous = time;
    const smooth = (now: number, target: number, speed: number) =>
      now + (target - now) * Math.min(1, dt * speed);

    // Gaze: the head turns towards the target (at most about 70°). If the viewer is behind the fox,
    // the whole fox turns enough for the head to reach.
    const target = active.has('facingViewer') && fox.viewer ? fox.viewer : gazeTarget;
    let turn = 0,
      nod = 0,
      tilt = 0,
      bodyTurn = 0;
    if (target) {
      root.updateMatrixWorld();
      const position = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
      tmp.copy(target);
      root.worldToLocal(tmp).sub(position);
      // The direction is computed relative to the previous gaze. When the viewer is directly behind
      // the fox, atan2 would jump between +π and −π, and the fox would turn alternately left and
      // right (it would shake).
      const previous = gaze.bodyTurn + gaze.turn;
      const raw = Math.atan2(-tmp.z, tmp.x);
      let direction = previous + Math.atan2(Math.sin(raw - previous), Math.cos(raw - previous));
      // A direction beyond the reach of the fox (body 2.4 + head 1.25) is turned the other way
      // around.
      if (Math.abs(direction) > 3.65) direction -= Math.sign(direction) * 2 * Math.PI;
      bodyTurn = THREE.MathUtils.clamp(
        direction - THREE.MathUtils.clamp(direction, -1, 1),
        -2.4,
        2.4,
      );
      turn = THREE.MathUtils.clamp(direction - gaze.bodyTurn, -1.25, 1.25);
      nod = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.5, 0.4);
      tilt = 0.14; // a slight tilt looks curious
    }
    if (active.has('curious')) {
      nod += 0.3;
      tilt += 0.25;
    }
    if (active.has('pawUp') && !target) nod -= 0.35; // looks at its paw
    gaze.bodyTurn = smooth(gaze.bodyTurn, bodyTurn, 4);
    gaze.turn = smooth(gaze.turn, turn, 7);
    gaze.nod = smooth(gaze.nod, nod, 7);
    gaze.tilt = smooth(gaze.tilt, tilt, 5);
    body.rotation.y = gaze.bodyTurn;
    head.rotation.set(gaze.tilt, gaze.turn, gaze.nod);

    // Breathing and the swaying of the tail.
    const breathing = Math.sin(time * 2.4);
    torso.scale.y = 0.22 * (1 + breathing * 0.025);
    tail.rotation.y = Math.sin(time * 3.2) * (walkingNow() ? 0.45 : 0.3);
    tail.rotation.z = Math.sin(time * 1.6) * 0.08;

    // The eyes blink now and then.
    if (time > nextBlink) nextBlink = time + 2.5 + Math.random() * 3;
    const blink = nextBlink - time < 0.14 ? 0.12 : 1;
    for (const s of eyes) s.scale.y = blink;

    // An ear twitches now and then.
    if (time > nextEarTwitch) nextEarTwitch = time + 3 + Math.random() * 4;
    const twitch = nextEarTwitch - time < 0.25 ? Math.sin((nextEarTwitch - time) * 25) * 0.25 : 0;
    ears[0].rotation.x = ears[0].userData.tilt + twitch;

    // Jump: the body rises in an arc, the legs bend in the air.
    let lift = 0,
      bend = 0;
    if (jumpStart >= 0) {
      const elapsed = time - jumpStart;
      if (elapsed > JUMP * jumps) jumpStart = -1;
      else {
        const u = (elapsed % JUMP) / JUMP;
        lift = Math.sin(Math.PI * u) * 0.32;
        bend = Math.sin(Math.PI * u);
      }
    }
    body.position.y = lift;

    // Walking: the legs swing in turn, the body rocks. In the paw pose the nearer front paw rises.
    const isWalking = walkingNow();
    legs.forEach((j, i) => {
      const swing = isWalking ? Math.sin(time * 10 + j.userData.phase) * 0.55 : 0;
      const hindLeg = j.position.x < 0;
      const paw = i === 0 && active.has('pawUp') ? 1.25 : 0;
      j.rotation.z = smooth(j.rotation.z, swing + paw + bend * (hindLeg ? -0.7 : 0.7), 14);
    });
    if (isWalking) body.position.y += Math.abs(Math.sin(time * 10)) * 0.025;
  }

  // Does the fox need every frame right now (walking, jumping or a pose change in progress)?
  const moving = () => walkingNow() || jumpStart >= 0 || previous - changed < 1.5;

  const fox = {
    group: root,
    head,
    lookAt,
    jump,
    update,
    visibility,
    poses,
    moving,
    walking: false,
    viewer: null as THREE.Vector3 | null,
    height: 0,
  };
  const walkingNow = () => fox.walking || active.has('walking');
  // The height of the fox to the tips of the ears (in model units), so that it can be scaled to
  // metres.
  fox.height = new THREE.Box3().setFromObject(root).max.y;
  return fox;
}

// Attaches the fox to the 3D stage (stage.ts): the fox is updated before every draw, and the stage
// is drawn on every frame when the fox moves, otherwise about 15 times a second (the tail and the
// blinking). Add this only after the beforeDraw function that sets the position of the fox.
function attachToStage(fox: Fox, stage: Stage) {
  stage.beforeDraw.push(() => fox.update(performance.now() / 1000));
  let last = 0;
  (function loop(now) {
    if (fox.group.visible && (fox.moving() || now - last > 66)) {
      last = now;
      stage.draw();
    }
    requestAnimationFrame(loop);
  })(0);
}

export const Fox = { create, attachToStage, COLORS };
