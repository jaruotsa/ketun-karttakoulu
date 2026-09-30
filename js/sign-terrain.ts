// The terrain of a sign page in the 3D world of Foxwood (scene.terrain).
//
// The fox walks along the route of the map (#route), so the map and the terrain show exactly the
// same journey. The camera follows the fox from behind and looks slightly ahead of it; direction 0
// = the camera is in the south, looking north, as in the old SVG scenes. The fox and the animals of
// the scenes (creatures.ts) are 3D models in the world, so they can be behind a tree and have a
// shadow. The SVG overlay only has annotations (e.g. the cat's "Sss!" and the map sign of the
// hill): they are pinned to points of the world, and their size is given in metres.
import * as THREE from 'three';
import * as MapType from './map-type';
import { Stage } from './stage';
import { Fox } from './fox';
import type { Point } from './types';
import { Creatures } from './creatures';
import { World } from './world';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const DEG = Math.PI / 180;
// The size of the (SVG) overlay is the same as in the old landscapes.
const L = 600,
  K = 380;

// The camera settings of a scene (scene.terrain.camera); see A in create() for the meanings and the
// defaults.
export interface CameraSettings {
  behind?: number;
  height?: number;
  ahead?: number;
  direction?: [number, number];
  turnAt?: number;
  gaze?: { point: Point; start: number } | null;
  fox?: number;
  fov?: number;
}
type Position3 = [number, number, number];

export type Terrain = Awaited<ReturnType<typeof create>>;

async function create({
  frame,
  route,
  settings,
}: {
  frame: HTMLElement;
  terrainSvg: SVGSVGElement;
  route: SVGGeometryElement;
  settings?: CameraSettings;
}) {
  // On the orienteering map the terrain turns into an orienteering map (map-type.ts).
  const orienteering = MapType.current() === 'orienteering';
  const world = await World.create({ orienteering: orienteering });
  world.setMapStyle(orienteering ? 1 : 0);
  const fox = Fox.create();
  world.scene.add(fox.group);

  const sky = document.createElement('div');
  sky.className = 'sky';
  const canvas = document.createElement('canvas');
  frame.prepend(sky, canvas);
  frame.classList.add('three-d');
  const stage = Stage.create({ canvas, frame, world });
  const { camera } = stage;

  const A: Required<Omit<CameraSettings, 'gaze'>> & { gaze: CameraSettings['gaze'] } = {
    behind: 60, // the distance of the camera from the point looked at (m)
    height: 16, // the height of the camera above the ground (m)
    ahead: 20, // how far ahead of the fox the camera looks (m)
    direction: [0, 0] as [number, number], // [start, end] in degrees (0 = from the south); on the way the camera is behind the fox, at the end in the end direction
    turnAt: 0.6, // the point of the route (0..1) where the camera starts to turn to the end direction
    gaze: null as CameraSettings['gaze'], // { point: [x, y], start: 0..1 }: the gaze turns to this map point at the end
    fox: 4, // the height of the fox to the ears (m), exaggerated so that the fox stands out
    fov: 45,
    ...settings,
  };
  camera.fov = A.fov;
  // The campfire is out on the sign pages; the campfire scene lights it.
  world.flame(0);

  const length = route.getTotalLength();
  function pointAt(t: number): Point {
    const q = route.getPointAtLength(clamp01(t) * length);
    return [q.x, q.y];
  }
  // A narrow gap is left in the forest at the route, so that the fox is visible between the trees.
  // Trees are not cleared during the journey.
  world.clearing(
    Array.from({ length: Math.ceil(length / 3) + 1 }, (_, i) => pointAt((i * 3) / length)),
    6,
  );
  // The point t (0..1) of the route that is nearest to the map point [x, y].
  function routeProgress([x, y]: Point) {
    let best = 0,
      nearest = Infinity;
    for (let i = 0; i <= 1000; i++) {
      const [px, py] = pointAt(i / 1000);
      const d = Math.hypot(px - x, py - y);
      if (d < nearest) [best, nearest] = [i / 1000, d];
    }
    return best;
  }
  const toWorld = (x: number, y: number, lift = 0) =>
    new THREE.Vector3(x - L / 2, world.surface(x, y) + lift, y - K / 2);
  const toScreen = (x: number, y: number, lift?: number) =>
    stage.toScreen(toWorld(x, y, lift), L, K);

  let t = 0;
  let lift = 0;
  // The fox can leave the route (jumps, steps into the mire): own = [x, y] in map coordinates.
  let own: Point | null = null;
  let angle = 0;
  let direction: number | null = null; // the walking direction of the fox in the world (in radians around the Y axis)
  let previousOwn: Point | null = null;
  const foxPoint = () => own ?? pointAt(t);
  // The camera can rise to look straight down: up = { p (0..1), x, y, height }.
  let up: { p: number; x: number; y: number; height: number } | null = null;
  // The camera can fly freely: flight = { p (0..1), position: [x, y, height], gaze: [x, y, height]
  // }. The position and the gaze are map points, and the height is the world height (m), not the
  // height above the ground.
  let flight: { p: number; position: Position3; gaze: Position3 } | null = null;

  function updateCamera() {
    const [x, y] = pointAt(t);
    // The walking direction smoothed: the gaze is slightly ahead of the fox.
    const [ax, ay] = pointAt(t - 0.05);
    const [bx, by] = pointAt(t + 0.05);
    const d = Math.hypot(bx - ax, by - ay) || 1;
    let kx = x + ((bx - ax) / d) * A.ahead;
    let ky = y + ((by - ay) / d) * A.ahead;
    // At the end of the journey the gaze can turn to a target beside the route (gaze = { point: [x,
    // y], start }).
    if (A.gaze) {
      const u = clamp01((t - A.gaze.start) / (1 - A.gaze.start));
      const p = u * u * (3 - 2 * u);
      kx = lerp(kx, A.gaze.point[0], p);
      ky = lerp(ky, A.gaze.point[1], p);
    }
    // The camera moves behind the fox in the walking direction (the direction is smoothed over a
    // long stretch, so that the camera does not sway). At the end it turns to the scene's own end
    // direction (direction[1]), so that the final picture is the same every time.
    const [tx, ty] = pointAt(t - 0.1);
    const [ex, ey] = pointAt(t + 0.04);
    const behindAngle = Math.atan2(-(ex - tx), -(ey - ty));
    const turnProgress = clamp01((t - A.turnAt) / (1 - A.turnAt));
    const direction =
      behindAngle +
      angleDiff(behindAngle, A.direction[1] * DEG) *
        turnProgress *
        turnProgress *
        (3 - 2 * turnProgress);
    const cx = kx + Math.sin(direction) * A.behind;
    const cy = ky + Math.cos(direction) * A.behind;
    const target = toWorld(kx, ky, 2);
    camera.position.set(
      cx - L / 2,
      Math.max(target.y, world.heightAt(cx, cy)) + A.height,
      cy - K / 2,
    );
    if (flight && flight.p > 0) {
      const {
        p,
        position: [px, py, ph],
        gaze: [qx, qy, qh],
      } = flight;
      camera.position.lerp(new THREE.Vector3(px - L / 2, ph, py - K / 2), p);
      target.lerp(new THREE.Vector3(qx - L / 2, qh, qy - K / 2), p);
    }
    if (up && up.p > 0) {
      // The camera rises in an arc above the point (x, y). A small offset to the south keeps north
      // at the top.
      const p = up.p;
      const top = new THREE.Vector3(up.x - L / 2, up.height, up.y - K / 2 + 0.01);
      camera.position.lerp(top, p).y += Math.sin(Math.PI * p) * up.height * 0.15;
      target.lerp(new THREE.Vector3(up.x - L / 2, 0, up.y - K / 2), p);
    }
    // When looking from above the fog moves further away, so that the ground looks bright.
    world.fog.near = 220 + 500 * (up?.p ?? 0);
    world.fog.far = 900 + 900 * (up?.p ?? 0);
    camera.lookAt(target);
  }

  // The direction from a map vector (dx, dy): the fox looks towards +X in the model, and the y of
  // the map is the z of the world.
  const angleFromVector = (dx: number, dy: number) => Math.atan2(-dy, dx);
  // The shortest rotation from angle a to angle b.
  const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  function updateFox() {
    const [x, y] = foxPoint();
    // The fox looks in its walking direction. When it leaves the route the direction follows the
    // movement, except if the fox jumps backwards (e.g. away from a cat): then it still looks
    // forward.
    let goal = direction;
    if (!own) {
      const [ax, ay] = pointAt(t - 0.01);
      const [bx, by] = pointAt(t + 0.01);
      goal = angleFromVector(bx - ax, by - ay);
      previousOwn = null;
    } else if (previousOwn) {
      const dx = x - previousOwn[0],
        dy = y - previousOwn[1];
      if (Math.hypot(dx, dy) > 0.05) {
        const motion = angleFromVector(dx, dy);
        if (direction === null || Math.abs(angleDiff(direction, motion)) < Math.PI / 2)
          goal = motion;
      }
    }
    if (own) previousOwn = [x, y];
    if (goal !== null)
      direction =
        direction === null ? goal : direction + angleDiff(direction, goal) * (own ? 0.35 : 1);
    fox.group.position.copy(toWorld(x, y, lift));
    // The seedlings of the thicket bend out of the fox's way.
    world.bend(x, y);
    fox.group.scale.setScalar(A.fox / fox.height);
    // Tilt in jumps: a positive angle pushes the snout down, as with the SVG fox.
    fox.group.rotation.set(0, direction ?? 0, -angle * DEG);
  }

  stage.beforeDraw.push(updateCamera, updateFox);
  fox.viewer = camera.position;
  Fox.attachToStage(fox, stage);

  // An SVG group at a world point. The content of the group is drawn around the origin; metres =
  // metres per SVG unit. A pinned group stays in place in the world even if the camera moves.
  type Pin = [number, number, number, number, number];
  const pinned = new Map<Element, Pin>();
  function placeElement(el: Element, [x, y, height, metres, rotation]: Pin) {
    const r = toScreen(x, y, height);
    if (r)
      el.setAttribute(
        'transform',
        `translate(${r[0]} ${r[1]}) scale(${r[2] * metres}) rotate(${rotation})`,
      );
  }
  function pin(el: Element, x: number, y: number, height: number, metres: number, rotation = 0) {
    const position: Pin = [x, y, height, metres, rotation];
    pinned.set(el, position);
    placeElement(el, position);
  }
  stage.beforeDraw.push(() => pinned.forEach((position, el) => placeElement(el, position)));

  // SVG groups above the fox's head at a fixed size (the fox's speech bubble), drawn with the point
  // of the tail at the origin. The group stays inside the picture when the fox is at its edge, and
  // is hidden when the fox is outside the picture (at the top of the lookout tower).
  const aboveFox = new Set<Element>();
  const BUBBLE = { left: 12, right: 86, top: 80 }; // the size of the group around its origin
  function placeAboveFox(el: Element) {
    const [x, y] = foxPoint();
    const r = toScreen(x, y, lift + A.fox + 0.5);
    const inside = r && r[0] >= 0 && r[0] <= L && r[1] >= 0 && r[1] <= K;
    el.setAttribute('visibility', inside ? 'visible' : 'hidden');
    if (!inside) return;
    const sx = Math.min(Math.max(r[0], BUBBLE.left + 4), L - BUBBLE.right - 4);
    const sy = Math.min(Math.max(r[1], BUBBLE.top + 4), K - 4);
    el.setAttribute('transform', `translate(${sx} ${sy})`);
  }
  function followFox(el: Element) {
    aboveFox.add(el);
    placeAboveFox(el);
  }
  stage.beforeDraw.push(() => aboveFox.forEach(placeAboveFox));

  // Continuous movements (e.g. flames): f(time) before every draw. The stage is then drawn on every
  // frame. Returns a function that stops the movement.
  const continuous = new Set<(aika: number) => void>();
  stage.beforeDraw.push(() => {
    const aika = performance.now() / 1000;
    for (const f of continuous) f(aika);
  });
  (function loop() {
    if (continuous.size) stage.draw();
    requestAnimationFrame(loop);
  })();
  function everyFrame(f: (time: number) => void) {
    continuous.add(f);
    stage.draw();
    return () => continuous.delete(f);
  }

  // A 3D object (creatures.ts) at the map point (x, y). lift in metres above the ground, direction
  // as a map direction in radians (0 = east, π/2 = south) or a map point [x, y] that the object
  // looks towards.
  function place<T extends THREE.Object3D>(
    object: T,
    x: number,
    y: number,
    lift = 0,
    direction: number | Point | null = null,
  ): T {
    if (!object.parent) world.scene.add(object);
    object.position.copy(toWorld(x, y, lift));
    if (Array.isArray(direction))
      object.rotation.y = angleFromVector(direction[0] - x, direction[1] - y);
    else if (direction !== null) object.rotation.y = -direction;
    stage.draw();
    return object;
  }

  // Splash rings in water or mud at the point (x, y); the radius of a ring is about 2.5 m at the
  // end.
  function splash(x: number, y: number, color?: string) {
    const r = Creatures.splash(color);
    place(r, x, y, 0.15);
    const start = performance.now() / 1000;
    const stop = everyFrame((aika) => {
      if (!r.update(aika - start)) {
        r.removeFromParent();
        stop();
      }
    });
  }

  return {
    world,
    stage,
    fox,
    pin,
    followFox,
    place,
    everyFrame,
    splash,
    // The route point [x, y] at t (0..1).
    routePoint: pointAt,
    routeProgress,
    // The camera rises (p = 0..1) to look straight down at the point (x, y) from the height
    // `height` (m). p = 0 restores following.
    fromAbove(p: number, x = 0, y = 0, height = 0) {
      up = { p, x, y, height };
      stage.draw();
    },
    // The camera flies (p = 0..1) from following to the position [x, y, height] and looks at the
    // gaze [x, y, height]. p = 0 restores following. Looking from above (fromAbove) continues from
    // the position of the flight.
    fly(p: number, position: Position3 = [0, 0, 0], gaze: Position3 = [0, 0, 0]) {
      flight = { p, position, gaze };
      stage.draw();
    },
    draw: stage.draw,
    // The fox to the route point t (0..1). lift raises the fox in metres (jumps).
    setProgress(newT: number, newLift = 0) {
      t = newT;
      lift = newLift;
      own = null;
      angle = 0;
      up = null;
      flight = null;
      stage.draw();
    },
    // The fox outside the route to the map point (x, y). The camera stays at the route point.
    // lift in metres (up in a jump, down in a mire), angle tilts the picture in degrees.
    moveFox(x: number, y: number, newLift = 0, newAngle = 0) {
      own = [x, y];
      lift = newLift;
      angle = newAngle;
      stage.draw();
    },
    // The fox turns to look at the map point (x, y), e.g. the campfire.
    turnFox(x: number, y: number) {
      const [kx, ky] = foxPoint();
      direction = angleFromVector(x - kx, y - ky);
      previousOwn = null;
      stage.draw();
    },
    render: stage.render,
  };
}

export const SignTerrain = { create };
