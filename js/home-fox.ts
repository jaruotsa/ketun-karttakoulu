// The 3D fox of the front page: the fox stands on a small grassy islet, looks mostly at the viewer
// and glances ahead now and then. When the fox is pressed, it jumps for joy.
import * as THREE from 'three';
import { Fox } from './fox';
import { t } from './i18n';
import { $ } from './dom';

const frame = $('#hero-fox');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'fox-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('common.fox'));
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch {
    return; // no WebGL: the SVG fox stays visible
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 440 / 340, 0.1, 50);
  camera.position.set(2.3, 1.5, 3.9);
  camera.lookAt(0, 0.34, 0);

  scene.add(new THREE.HemisphereLight('#E4F2FA', '#6E7E4A', 1.3));
  const sun = new THREE.DirectionalLight('#FFF1D8', 2.6);
  sun.position.set(2, 4, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 12 });
  sun.shadow.bias = -0.002;
  sun.shadow.radius = 4;
  scene.add(sun);

  // A grassy islet, a couple of spruces and a rock in the same low-poly style as the world of
  // Foxwood.
  const material = (vari: string) =>
    new THREE.MeshLambertMaterial({ color: vari, flatShading: true });
  const islet = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.3, 0.18, 30),
    material('#7FAE5A'),
  );
  islet.position.y = -0.09;
  islet.receiveShadow = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.1, 0.16, 30), material('#8A6A48'));
  soil.position.y = -0.26;
  scene.add(islet, soil);

  function spruce(x: number, z: number, size: number) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.25, 6),
      material('#6B4A32'),
    );
    trunk.position.y = 0.12;
    tree.add(trunk);
    [
      [0.42, 0.55, 0.45],
      [0.33, 0.45, 0.8],
      [0.22, 0.38, 1.1],
    ].forEach(([r, k, y], i) => {
      const layer = new THREE.Mesh(
        new THREE.ConeGeometry(r, k, 7),
        material(i % 2 ? '#3F7550' : '#2F6040'),
      );
      layer.position.y = y;
      tree.add(layer);
    });
    tree.position.set(x, 0, z);
    tree.scale.setScalar(size);
    tree.traverse((o) => (o.castShadow = true));
    scene.add(tree);
  }
  spruce(-0.95, -0.55, 1);
  spruce(-0.45, -0.95, 0.75);

  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), material('#9A968C'));
  rock.scale.set(1.2, 0.7, 1);
  rock.position.set(0.85, 0.05, 0.55);
  rock.castShadow = true;
  scene.add(rock);

  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const r = 0.7 + (i % 3) * 0.2;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), material('#5E9148'));
    tuft.position.set(Math.cos(angle) * r, 0.05, Math.sin(angle) * r);
    scene.add(tuft);
  }

  const fox = Fox.create();
  fox.group.rotation.y = 0.35; // slightly towards the viewer
  fox.group.position.set(0.05, 0, 0.1);
  scene.add(fox.group);
  fox.lookAt(camera.position);

  // The fox looks mostly at the viewer and glances ahead now and then (like the SVG fox).
  if (!reducedMotion) {
    setInterval(() => {
      fox.lookAt(null);
      setTimeout(() => fox.lookAt(camera.position), 1600);
    }, 4500);
  }

  canvas.addEventListener('pointerdown', () => {
    fox.lookAt(camera.position);
    if (!reducedMotion) fox.jump();
  });

  function fit() {
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  frame.replaceChildren(canvas);
  frame.classList.add('three-d');
  new ResizeObserver(fit).observe(frame);
  fit();

  // Without motion the fox settles to look at the viewer at once.
  if (reducedMotion) for (let t = 0; t < 2; t += 0.05) fox.update(t);

  const startTime = performance.now();
  (function draw() {
    if (!reducedMotion) fox.update((performance.now() - startTime) / 1000);
    renderer.render(scene, camera);
    if (!reducedMotion) requestAnimationFrame(draw);
  })();

  window.HomeFox = { fox, camera, renderer, draw: () => renderer.render(scene, camera) };
}

start();
