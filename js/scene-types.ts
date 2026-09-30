// The contract between a scene (js/scenes/<id>.ts) and the engine of the sign page (sign-page.ts).
import type { Fox } from './fox';
import type { CameraSettings, Terrain } from './sign-terrain';
import type { LessonStage, StageSettings, ViewSettings } from './lesson-panel';
import type { World } from './world';
import type { Point } from './types';

// What the engine gives to arrive() and atStop(): the SVGs of the map and the terrain overlay, the
// 3D fox and the terrain.
export interface SceneContext {
  terrainSvg: SVGSVGElement;
  mapSvg: SVGSVGElement;
  fox: Fox;
  wait: (ms: number) => Promise<void>;
  terrain: Terrain;
}

// One button of the lesson box. show(o, motion) builds the item on the 3D stage; motion = 0 sets
// the final state at once.
export interface LessonItem {
  name: string;
  summary: string;
  text: string;
  icon: string;
  camera?: ViewSettings;
  show: (o: LessonStage, motion: number) => void | Promise<void>;
}

export interface Lesson {
  title: string;
  instruction: string;
  stage?: StageSettings;
  items: LessonItem[];
}

export interface TerrainScene {
  camera?: CameraSettings;
  // The duration of the walk in milliseconds (default 4500).
  duration?: number;
  // Map points where the walk pauses; atStop(n, ...) is called at each one.
  stops?: Point[];
  // SVG annotations on top of the 3D picture.
  overlay: string;
  arrive: (context: SceneContext) => void | Promise<void>;
  atStop?: (n: number, context: SceneContext) => void | Promise<void>;
  reset?: (terrainSvg: SVGSVGElement, terrain: Terrain, mapSvg: SVGSVGElement) => void;
  // The walking speed at a map point (1 = normal, smaller = slower).
  speed?: (x: number, y: number, world: World) => number;
  // Raises the fox in metres at a map point (jumps over obstacles).
  lift?: (x: number, y: number) => number;
}

export interface Scene {
  map: string;
  // The id of the map part that the fox walks to (Foxwood.shapes / the class feature-<id> on the
  // map).
  feature: string;
  bubblePosition: { x: number; y: number };
  // Own shape for the pulsing highlight (default: the shape of the feature).
  highlight?: string | string[];
  // Features drawn on top of the highlight (e.g. a road on a bridge).
  drawOver?: string[];
  terrain: TerrainScene;
  lesson?: Lesson;
  // The orienteering map uses its own lesson if there is one.
  orienteering?: { lesson?: Lesson };
}
