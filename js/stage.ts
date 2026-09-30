// Stage: draws the world of Foxwood on a canvas and tells where a point of the world appears on the
// screen. The same stage is used on the "What is a map?" page and on the sign pages.
//
// Drawing is done only when something changed (draw()), and before drawing the beforeDraw functions
// are called (e.g. the position of the camera and the fox), so that the SVG layer and the 3D
// picture stay in step.
import * as THREE from 'three';

const DEG = Math.PI / 180;

export type Stage = ReturnType<typeof create>;

function create({
  canvas,
  frame,
  world,
}: {
  canvas: HTMLCanvasElement;
  frame: HTMLElement;
  world: { scene: THREE.Scene };
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const camera = new THREE.PerspectiveCamera(
    50,
    frame.clientWidth / frame.clientHeight || 600 / 380,
    1,
    6000,
  );
  const beforeDraw: (() => void)[] = [];

  let dirty = true;
  const draw = () => (dirty = true);
  function render() {
    dirty = false;
    for (const f of beforeDraw) f();
    renderer.render(world.scene, camera);
  }
  (function frameLoop() {
    if (dirty) render();
    requestAnimationFrame(frameLoop);
  })();

  function fit() {
    if (!frame.clientWidth || !frame.clientHeight) return; // hidden (e.g. a tab)
    renderer.setSize(frame.clientWidth, frame.clientHeight, false);
    camera.aspect = frame.clientWidth / frame.clientHeight;
    camera.updateProjectionMatrix();
    draw();
  }
  new ResizeObserver(fit).observe(frame);
  fit();

  // A world point on the screen in a coordinate system of size width x height (by default the
  // pixels of the frame). Returns [x, y, units per metre] or null if the point is behind the
  // camera.
  const tmp = new THREE.Vector3();
  function toScreen(point: THREE.Vector3, width = frame.clientWidth, height = frame.clientHeight) {
    camera.updateMatrixWorld();
    tmp.copy(point).applyMatrix4(camera.matrixWorldInverse);
    const depth = -tmp.z;
    if (depth <= 0) return null;
    tmp.copy(point).project(camera);
    const scale = height / 2 / Math.tan((camera.fov / 2) * DEG) / depth;
    return [((tmp.x + 1) / 2) * width, ((1 - tmp.y) / 2) * height, scale] as [
      number,
      number,
      number,
    ];
  }

  return { renderer, camera, draw, render, toScreen, beforeDraw };
}

export const Stage = { create };
