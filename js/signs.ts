// All the signs. The colours and signs follow the legend of the National Land Survey's topographic
// map (Topographic map 1:10 000 – 1:25 000, 5.9.2025).
// ready: true = the sign has its own page and scene (js/scenes/<id>.ts).
// only: 'topo' / 'orienteering' = the sign belongs to one map type only (map-type.ts). For signs in
// both, the orienteering version goes in the field orienteering: { ready, name, sentence, bubble,
// hint, icon, quiz }. The texts are in js/locales/fi.json under signs.<id>. The ids (lake, field,
// ...) stay Finnish: they are in the page addresses (sign.html?id=...), the saved pawprints and
// the scene file names.
import { Symbols, type BuildingKind } from './symbols';
import { t } from './i18n';
import type { Sign } from './types';

const base = (content: string) =>
  `<svg viewBox="0 0 100 70" aria-hidden="true"><rect width="100" height="70" rx="6" fill="#fff"/>${content}</svg>`;

const mireLines = Array.from({ length: 8 }, (_, i) => 16 + i * 6)
  .map((y) => `<line x1="14" x2="86" y1="${y}" y2="${y}"/>`)
  .join('');

// Three nested contour lines of a hill.
const hillContours = (color: string) => `<g fill="none" stroke="${color}" stroke-width="2.5">
    <path d="M14,40 C12,20 36,10 56,12 C80,14 90,28 86,44 C82,60 58,62 38,60 C22,58 15,50 14,40 Z"/>
    <path d="M28,38 C27,26 42,20 56,22 C72,24 76,32 73,42 C70,52 54,52 42,51 C33,50 28,45 28,38 Z"/>
    <path d="M42,36 C42,30 50,28 56,29 C63,30 64,35 62,40 C60,44 52,45 47,44 C43,43 42,40 42,36 Z"/>
  </g>`;

export const SIGNS: Sign[] = [
  {
    id: 'lake',
    name: t('signs.lake.name'),
    ready: true,
    sentence: t('signs.lake.sentence'),
    bubble: t('signs.lake.bubble'),
    hint: t('signs.lake.hint'),
    icon: base(
      '<path d="M22,20 C40,6 78,10 82,30 C86,52 60,62 40,58 C20,55 8,34 22,20Z" fill="#7FD3F7" stroke="#0077C0" stroke-width="2.5"/>',
    ),
    quiz: {
      question: t('signs.lake.quiz.question'),
      options: ['field', 'lake', 'mire'],
      correct: 'lake',
    },
    // Orienteering map: the lake is blue, and the black shoreline tells that you cannot cross the
    // water (ISOM 301).
    orienteering: {
      ready: true,
      sentence: t('signs.lake.orienteering.sentence'),
      bubble: t('signs.lake.orienteering.bubble'),
      hint: t('signs.lake.orienteering.hint'),
      icon: base(
        '<path d="M22,20 C40,6 78,10 82,30 C86,52 60,62 40,58 C20,55 8,34 22,20Z" fill="#00ACE0" stroke="#1a1a1a" stroke-width="2"/>',
      ),
    },
  },
  {
    id: 'field',
    name: t('signs.field.name'),
    ready: true,
    sentence: t('signs.field.sentence'),
    bubble: t('signs.field.bubble'),
    hint: t('signs.field.hint'),
    quiz: {
      question: t('signs.field.quiz.question'),
      options: ['lake', 'mire', 'field'],
      correct: 'field',
    },
    icon: base('<path d="M14,14 L86,10 L90,58 L10,60 Z" fill="#FCD592"/>'),
    // Orienteering map: yellow is open land (ISOM 401–403), and a field is cultivated land: yellow
    // with black dots (412).
    orienteering: {
      ready: true,
      sentence: t('signs.field.orienteering.sentence'),
      bubble: t('signs.field.orienteering.bubble'),
      hint: t('signs.field.orienteering.hint'),
      icon: base(`<defs><pattern id="icon-field" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#FCC868"/>
        <circle cx="3.5" cy="3.5" r="1" fill="#1a1a1a"/></pattern></defs><path d="M14,14 L86,10 L90,58 L10,60 Z" fill="url(#icon-field)"/>`),
    },
  },
  {
    id: 'mire',
    name: t('signs.mire.name'),
    ready: true,
    sentence: t('signs.mire.sentence'),
    bubble: t('signs.mire.bubble'),
    hint: t('signs.mire.hint'),
    quiz: {
      question: t('signs.mire.quiz.question'),
      options: ['mire', 'field', 'lake'],
      correct: 'mire',
    },
    icon: base(
      `<rect x="14" y="12" width="72" height="48" fill="${Symbols.MIRE.treeless}"/><g stroke="${Symbols.MIRE.lines}" stroke-width="2">${mireLines}</g>`,
    ),
    // Orienteering map: a mire is blue lines (ISOM 307–310). The mire of Foxwood is an open mire:
    // light yellow and blue lines.
    orienteering: {
      ready: true,
      sentence: t('signs.mire.orienteering.sentence'),
      bubble: t('signs.mire.orienteering.bubble'),
      hint: t('signs.mire.orienteering.hint'),
      icon: base(
        `<rect x="14" y="12" width="72" height="48" fill="#FCE0B4"/><g stroke="#00ACE0" stroke-width="2">${mireLines}</g>`,
      ),
    },
  },
  {
    id: 'stream',
    name: t('signs.stream.name'),
    ready: true,
    sentence: t('signs.stream.sentence'),
    bubble: t('signs.stream.bubble'),
    hint: t('signs.stream.hint'),
    quiz: {
      question: t('signs.stream.quiz.question'),
      options: ['lake', 'stream', 'hill'],
      correct: 'stream',
    },
    icon: base(
      '<path d="M10,14 C26,10 30,30 46,32 C62,34 60,50 76,52 C84,53 88,56 92,60" fill="none" stroke="#0077C0" stroke-width="3.5" stroke-linecap="round"/>',
    ),
    // Orienteering map: a brook or ditch is a blue line (ISOM 304–306). A wide brook is a thicker
    // line and an indistinct one a dashed line. A river is a blue area whose black edge tells that
    // you cannot cross (301).
    orienteering: {
      ready: true,
      sentence: t('signs.stream.orienteering.sentence'),
      bubble: t('signs.stream.orienteering.bubble'),
      hint: t('signs.stream.orienteering.hint'),
      icon: base(
        '<path d="M10,14 C26,10 30,30 46,32 C62,34 60,50 76,52 C84,53 88,56 92,60" fill="none" stroke="#00ACE0" stroke-width="3.5" stroke-linecap="round"/>',
      ),
    },
  },
  {
    id: 'forest',
    name: t('signs.forest.name'),
    ready: true,
    sentence: t('signs.forest.sentence'),
    bubble: t('signs.forest.bubble'),
    hint: t('signs.forest.hint'),
    quiz: {
      question: t('signs.forest.quiz.question'),
      options: ['field', 'forest', 'mire'],
      correct: 'forest',
    },
    icon: base(
      [
        [24, 22],
        [58, 16],
        [84, 30],
        [40, 48],
        [70, 52],
      ]
        .map(([x, y]) => Symbols.tree('conifer', x, y, 1.6, 2.4))
        .join(''),
    ),
    // Orienteering map: the colour tells how easy it is to run in the forest (ISOM 405 white, 406
    // slow, 408 difficult). Tree kinds are not shown. Foxwood has a thicket
    // (Foxwood.shapes.thicket).
    orienteering: {
      ready: true,
      sentence: t('signs.forest.orienteering.sentence'),
      bubble: t('signs.forest.orienteering.bubble'),
      hint: t('signs.forest.orienteering.hint'),
      icon: base(`<path d="M14,30 C12,14 34,8 52,10 C74,12 88,22 86,38 C84,56 62,62 42,60 C24,58 16,46 14,30 Z" fill="#CCE4D0"/>
        <path d="M34,34 C33,24 44,20 54,21 C66,22 70,30 68,38 C66,46 56,48 47,47 C39,46 35,41 34,34 Z" fill="#A0D4A4"/>`),
      quiz: {
        question: t('signs.forest.orienteering.quiz.question'),
        options: ['field', 'forest', 'mire'],
        correct: 'forest',
      },
    },
  },
  {
    id: 'trail',
    name: t('signs.trail.name'),
    ready: true,
    sentence: t('signs.trail.sentence'),
    bubble: t('signs.trail.bubble'),
    hint: t('signs.trail.hint'),
    quiz: {
      question: t('signs.trail.quiz.question'),
      options: ['stream', 'hill', 'trail'],
      correct: 'trail',
    },
    icon: base(
      `<g fill="none">
        <path d="M10,16 H90" stroke="#1a1a1a" stroke-width="2.4" stroke-dasharray="8 6"/>
        <path d="M10,34 H90" stroke="#1a1a1a" stroke-width="2.4"/>
        <path d="M10,53 H90" stroke="#1a1a1a" stroke-width="8"/><path d="M10,53 H90" stroke="#B0412E" stroke-width="5"/>
      </g>`,
    ),
    // Orienteering map: paths and roads are black (ISOM 503–507). The clearer the path, the longer
    // the dashes. A wide road is brown with black edges (502).
    orienteering: {
      ready: true,
      sentence: t('signs.trail.orienteering.sentence'),
      bubble: t('signs.trail.orienteering.bubble'),
      hint: t('signs.trail.orienteering.hint'),
      icon: base(
        `<g fill="none">
        <path d="M10,16 H90" stroke="#1a1a1a" stroke-width="2.4" stroke-dasharray="12 3"/>
        <path d="M10,34 H90" stroke="#1a1a1a" stroke-width="2.4"/>
        <path d="M10,53 H90" stroke="#1a1a1a" stroke-width="10"/><path d="M10,53 H90" stroke="#D88C3C" stroke-width="6"/>
      </g>`,
      ),
      quiz: {
        question: t('signs.trail.orienteering.quiz.question'),
        options: ['hill', 'trail', 'lake'],
        correct: 'trail',
      },
    },
  },
  {
    id: 'building',
    name: t('signs.building.name'),
    ready: true,
    sentence: t('signs.building.sentence'),
    bubble: t('signs.building.bubble'),
    hint: t('signs.building.hint'),
    quiz: {
      question: t('signs.building.quiz.question'),
      options: ['trail', 'campfire', 'building'],
      correct: 'building',
    },
    icon: base(
      [
        ['residential', 20, 22, 16, 11],
        ['residential', 22, 46, 10, 14],
        ['other', 40, 44, 12, 8],
        ['holiday', 46, 18, 10, 8],
        ['commercial', 70, 48, 26, 14],
        ['church', 78, 20, 20],
      ]
        .map((r) => Symbols.building(...(r as [BuildingKind, number, number, number, number])))
        .join(''),
    ),
    // Orienteering map: all buildings are black (ISOM 521), a yard is an olive-green forbidden area
    // (520) and a parking area or gravel field light brown (501). The icon is drawn here, because
    // orienteering.ts is not on the front page.
    orienteering: {
      ready: true,
      sentence: t('signs.building.orienteering.sentence'),
      bubble: t('signs.building.orienteering.bubble'),
      hint: t('signs.building.orienteering.hint'),
      icon: base(`<rect x="12" y="12" width="44" height="44" rx="4" fill="#B8B454" stroke="#1a1a1a" stroke-width="1.5"/>
        <g fill="#1a1a1a"><rect x="22" y="22" width="20" height="12"/><rect x="36" y="42" width="10" height="7"/>
        <rect x="66" y="18" width="12" height="9"/><rect x="70" y="42" width="18" height="12"/></g>`),
      quiz: {
        question: t('signs.building.orienteering.quiz.question'),
        options: ['trail', 'fences', 'building'],
        correct: 'building',
      },
    },
  },
  // Fences (MML: "fence, gate"; a stone wall is also a fence on the MML map). On the orienteering
  // map a fence, a high fence, a stone wall and a gate (ISOM 516–519). The icons are drawn here,
  // because orienteering.ts is not on the front page.
  {
    id: 'fences',
    name: t('signs.fences.name'),
    ready: true,
    sentence: t('signs.fences.sentence'),
    bubble: t('signs.fences.bubble'),
    hint: t('signs.fences.hint'),
    quiz: {
      question: t('signs.fences.quiz.question'),
      options: ['trail', 'fences', 'bridge'],
      correct: 'fences',
    },
    icon: base(`${Symbols.fence(
      [
        [22, 30],
        [22, 14],
        [78, 14],
        [78, 56],
        [22, 56],
        [22, 40],
      ],
      1.6,
    )}${Symbols.gate([22, 40], [22, 30], 1.6)}
      ${Symbols.building('residential', 52, 35, 16, 10)}`),
    orienteering: {
      ready: true,
      sentence: t('signs.fences.orienteering.sentence'),
      bubble: t('signs.fences.orienteering.bubble'),
      hint: t('signs.fences.orienteering.hint'),
      icon: base(`<g stroke="#1a1a1a" stroke-width="2"><path d="M12,24 H88" fill="none"/>
          <path d="M20,24 l-5,5 M38,24 l-5,5 M56,24 l-5,5 M74,24 l-5,5"/><path d="M12,50 H88" fill="none"/></g>
        <g fill="#1a1a1a"><circle cx="22" cy="50" r="3"/><circle cx="44" cy="50" r="3"/><circle cx="66" cy="50" r="3"/></g>`),
      quiz: {
        question: t('signs.fences.orienteering.quiz.question'),
        options: ['smallFeatures', 'fences', 'controls'],
        correct: 'fences',
      },
    },
  },
  // Power line (MML: "power line, pylon"; ISOM 510). In Foxwood the line runs along the road, and
  // branches go from it to the house of the farmyard and the summer cabin. The orienteering icon is
  // drawn here, because orienteering.ts is not on the front page.
  {
    id: 'powerLine',
    name: t('signs.powerLine.name'),
    ready: true,
    sentence: t('signs.powerLine.sentence'),
    bubble: t('signs.powerLine.bubble'),
    hint: t('signs.powerLine.hint'),
    quiz: {
      question: t('signs.powerLine.quiz.question'),
      options: ['fences', 'powerLine', 'trail'],
      correct: 'powerLine',
    },
    icon: base(
      Symbols.powerLine(
        [
          [8, 35],
          [30, 35],
          [70, 35],
          [92, 35],
        ],
        [
          [30, 35],
          [70, 35],
        ],
        2,
        4,
        2,
      ),
    ),
    orienteering: {
      ready: true,
      sentence: t('signs.powerLine.orienteering.sentence'),
      bubble: t('signs.powerLine.orienteering.bubble'),
      hint: t('signs.powerLine.orienteering.hint'),
      icon: base(
        `<g stroke="#1a1a1a" stroke-width="2"><path d="M8,35 H92"/><path d="M30,26 V44 M70,26 V44"/></g>`,
      ),
      quiz: {
        question: t('signs.powerLine.orienteering.quiz.question'),
        options: ['fences', 'powerLine', 'trail'],
        correct: 'powerLine',
      },
    },
  },
  {
    id: 'bridge',
    only: 'topo', // on the orienteering map a bridge is an ordinary road over the brook
    name: t('signs.bridge.name'),
    ready: true,
    sentence: t('signs.bridge.sentence'),
    bubble: t('signs.bridge.bubble'),
    hint: t('signs.bridge.hint'),
    quiz: {
      question: t('signs.bridge.quiz.question'),
      options: ['trail', 'stream', 'bridge'],
      correct: 'bridge',
    },
    icon: base(
      `<g fill="none">
        <path d="M50,4 C42,18 58,26 50,36 C44,44 54,54 50,66" stroke="#0077C0" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M10,35 H90" stroke="#1a1a1a" stroke-width="9"/><path d="M10,35 H90" stroke="#B0412E" stroke-width="5.4"/>
        <path d="M36,35 H64" stroke="#3D0F06" stroke-width="5.4"/>
      </g>`,
    ),
  },
  {
    id: 'hill',
    name: t('signs.hill.name'),
    ready: true,
    sentence: t('signs.hill.sentence'),
    bubble: t('signs.hill.bubble'),
    hint: t('signs.hill.hint'),
    quiz: {
      question: t('signs.hill.quiz.question'),
      options: ['mire', 'stream', 'hill'],
      correct: 'hill',
    },
    icon: base(hillContours('#B8652A')),
    // Orienteering map: the contour lines are brown like on the MML map (ISOM 101). The quiz has no
    // brook, because it does not have an orienteering icon yet.
    orienteering: {
      ready: true,
      sentence: t('signs.hill.orienteering.sentence'),
      bubble: t('signs.hill.orienteering.bubble'),
      hint: t('signs.hill.orienteering.hint'),
      icon: base(hillContours('#D88C3C')),
      quiz: {
        question: t('signs.hill.orienteering.quiz.question'),
        options: ['mire', 'lake', 'hill'],
        correct: 'hill',
      },
    },
  },
  {
    id: 'stones',
    name: t('signs.stones.name'),
    ready: true,
    sentence: t('signs.stones.sentence'),
    bubble: t('signs.stones.bubble'),
    hint: t('signs.stones.hint'),
    quiz: {
      question: t('signs.stones.quiz.question'),
      options: ['forest', 'stones', 'campfire'],
      correct: 'stones',
    },
    // Terrain map: a stone in a lake (⊥), stony ground and a cliff.
    icon: base(
      `<ellipse cx="30" cy="28" rx="22" ry="15" fill="#7FD3F7" stroke="#0077C0" stroke-width="1.5"/>${Symbols.stone(30, 28, 1.8)}${Symbols.triangles(56, 12, 32, 30, 8, 4.5)}${Symbols.cliff(14, 54, 86, 54, 1.6)}`,
    ),
    // Orienteering map: a stone is a black dot (ISOM 204–205), stony ground black triangles (208),
    // bare rock grey (214) and a cliff a black line (202), an impassable one a thick line with
    // spikes (201). The icon is drawn here, because orienteering.ts is not on the front page.
    orienteering: {
      ready: true,
      sentence: t('signs.stones.orienteering.sentence'),
      bubble: t('signs.stones.orienteering.bubble'),
      hint: t('signs.stones.orienteering.hint'),
      icon: base(
        `<circle cx="26" cy="26" r="4.5" fill="#1a1a1a"/><circle cx="44" cy="30" r="3" fill="#1a1a1a"/>${Symbols.triangles(56, 12, 32, 30, 10, 5.5)}
        <g stroke="#1a1a1a"><path d="M14,52 H86" stroke-width="3.2"/><path d="${Array.from({ length: 18 }, (_, i) => `M${16 + i * 4},52 v5.5`).join(' ')}" stroke-width="1.1"/></g>`,
      ),
      quiz: {
        question: t('signs.stones.orienteering.quiz.question'),
        options: ['forest', 'stones', 'mire'],
        correct: 'stones',
      },
    },
  },
  {
    id: 'campfire',
    only: 'topo', // there is no sign for it on the orienteering map
    name: t('signs.campfire.name'),
    ready: true,
    sentence: t('signs.campfire.sentence'),
    bubble: t('signs.campfire.bubble'),
    hint: t('signs.campfire.hint'),
    quiz: {
      question: t('signs.campfire.quiz.question'),
      options: ['campfire', 'hill', 'stream'],
      correct: 'campfire',
    },
    icon: base(Symbols.fire(50, 33, 2.6)),
  },
  {
    id: 'lookoutTower',
    only: 'topo', // there is no sign for it on the orienteering map
    name: t('signs.lookoutTower.name'),
    ready: true,
    sentence: t('signs.lookoutTower.sentence'),
    bubble: t('signs.lookoutTower.bubble'),
    hint: t('signs.lookoutTower.hint'),
    quiz: {
      question: t('signs.lookoutTower.quiz.question'),
      options: ['lookoutTower', 'campfire', 'stones'],
      correct: 'lookoutTower',
    },
    icon: base(Symbols.lookoutTower(50, 44, 3.4)),
  },
  // Signs of the orienteering map only. Colours: Orienteering.COLORS (orienteering.ts).
  // A course with ISOM course markings (701–706): start, numbered controls and finish in purple.
  {
    id: 'controls',
    name: t('signs.controls.name'),
    only: 'orienteering',
    ready: true,
    sentence: t('signs.controls.sentence'),
    bubble: t('signs.controls.bubble'),
    hint: t('signs.controls.hint'),
    quiz: {
      question: t('signs.controls.quiz.question'),
      options: ['hill', 'controls', 'lake'],
      correct: 'controls',
    },
    icon: base(`<g fill="none" stroke="#D848A0" stroke-width="3"><path d="M20,52 l10,-17 l10,17 Z"/><circle cx="72" cy="30" r="11"/></g>
      <path d="M34,40 L62,33" stroke="#D848A0" stroke-width="2"/>`),
  },
  // Small terrain features: ant nest, knoll and pit (brown, ISOM 112–116).
  {
    id: 'smallFeatures',
    name: t('signs.smallFeatures.name'),
    only: 'orienteering',
    ready: true,
    sentence: t('signs.smallFeatures.sentence'),
    bubble: t('signs.smallFeatures.bubble'),
    hint: t('signs.smallFeatures.hint'),
    quiz: {
      question: t('signs.smallFeatures.quiz.question'),
      options: ['hill', 'controls', 'smallFeatures'],
      correct: 'smallFeatures',
    },
    icon: base(`<g fill="none" stroke="#D88C3C" stroke-width="3" stroke-linejoin="round">
        <path d="M24,15 L33,30 H15 Z"/><ellipse cx="54" cy="23" rx="8" ry="6"/><path d="M71,17 L78,30 L85,17"/>
      </g>
      <path d="M62,52 C66,44 76,42 82,48 C86,54 76,60 68,58 C64,57 61,55 62,52 Z" fill="#D88C3C"/>`),
  },
];
