// Shared types.
export interface Quiz {
  question: string;
  // Sign ids whose icons are the answer options.
  options: string[];
  correct: string;
}

// The texts, icon and quiz of a sign. The orienteering version of a sign overrides the fields it
// has.
export interface SignVersion {
  ready?: boolean;
  name?: string;
  sentence: string;
  bubble: string;
  hint: string;
  icon: string;
  quiz?: Quiz;
}

export interface Sign extends SignVersion {
  id: string;
  name: string;
  // The sign belongs to one map type only.
  only?: 'topo' | 'orienteering';
  orienteering?: Partial<SignVersion>;
}

// A point [x, y] on the map.
export type Point = [number, number];

// A 3D point or vector [x, y, z].
export type Vec3 = [number, number, number];
