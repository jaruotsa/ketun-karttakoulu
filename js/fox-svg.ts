// The drawing of the fox. The fox walks to the right, and in the viewBox coordinates the paws are
// on the ground at y = 132. The class facing-viewer turns the head to the camera. The SVG fox is in
// the hint box and is the fallback picture of the front page; in the terrain the fox is 3D.
import { t } from './i18n';

const FUR = '#E8742A';
const SHADE = '#C25A1C';
const CREAM = '#FFF6EA';
const DARK = '#2E211B';
const CHEEK = '#F29C8E';

function leg(x: number, y: number, color: string) {
  return `<g transform="translate(${x} ${y})"><g>
    <rect x="-5.5" y="-4" width="11" height="44" rx="5.5" fill="${color}"/>
    <rect x="-5.5" y="22" width="11" height="18" rx="5.5" fill="${DARK}"/>
  </g></g>`;
}

function eye(x: number, y: number, rx: number, ry: number) {
  return `<g transform="translate(${x} ${y})"><g class="fox-eye">
    <ellipse rx="${rx}" ry="${ry}" fill="${DARK}"/>
    <circle cx="${rx * 0.35}" cy="${-ry * 0.4}" r="${rx * 0.42}" fill="#fff"/>
    <circle cx="${-rx * 0.3}" cy="${ry * 0.4}" r="${rx * 0.18}" fill="#fff"/>
  </g></g>`;
}

const headSide = `<g class="fox-head-side">
  <path d="M-18,-10 L-14,-46 L0,-20 Z" fill="${SHADE}"/>
  <path d="M-6,-18 L6,-52 L19,-14 Z" fill="${FUR}"/>
  <path d="M0,-19 L6,-42 L13,-16 Z" fill="${DARK}"/>
  <path d="M2,-19 L5,-28 L9,-18 Z" fill="${CREAM}"/>
  <circle r="25" fill="${FUR}"/>
  <path d="M10,-8 C24,-6 34,0 41,6 C35,14 22,17 8,15 Z" fill="${FUR}"/>
  <path d="M-17,6 C-8,20 20,22 39,10 C33,20 18,26 4,25 L-5,24 L-1,20 L-11,20 L-7,16 L-18,14 Z" fill="${CREAM}"/>
  <ellipse cx="40" cy="6" rx="5.2" ry="4.4" fill="${DARK}"/>
  <circle cx="-2" cy="9" r="4.5" fill="${CHEEK}" opacity=".5"/>
  ${eye(11, -4, 5.5, 7)}
</g>`;

const headFront = `<g class="fox-head-front">
  <path d="M-27,-6 L-24,-50 L-5,-22 Z" fill="${FUR}"/>
  <path d="M-22,-13 L-21,-40 L-10,-20 Z" fill="${DARK}"/>
  <path d="M27,-6 L24,-50 L5,-22 Z" fill="${FUR}"/>
  <path d="M22,-13 L21,-40 L10,-20 Z" fill="${DARK}"/>
  <path d="M-31,-4 C-31,-24 -16,-30 0,-30 C16,-30 31,-24 31,-4 C31,12 16,27 0,31 C-16,27 -31,12 -31,-4 Z" fill="${FUR}"/>
  <path d="M-31,0 C-27,15 -13,26 0,31 C-6,22 -8,14 -4,8 C-12,7 -23,5 -31,0 Z" fill="${CREAM}"/>
  <path d="M31,0 C27,15 13,26 0,31 C6,22 8,14 4,8 C12,7 23,5 31,0 Z" fill="${CREAM}"/>
  <circle cx="-19" cy="6" r="4.5" fill="${CHEEK}" opacity=".5"/>
  <circle cx="19" cy="6" r="4.5" fill="${CHEEK}" opacity=".5"/>
  ${eye(-11, -6, 5.2, 6.8)}
  ${eye(11, -6, 5.2, 6.8)}
  <ellipse cx="0" cy="10" rx="5.5" ry="4" fill="${DARK}"/>
  <path d="M-6,16 Q-3,20 0,16 Q3,20 6,16" stroke="${DARK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</g>`;

function content() {
  return `
  <ellipse cx="100" cy="133" rx="60" ry="6" fill="#3B3A1E" opacity=".28"/>
  <g>
    <g transform="translate(60 82)"><g class="fox-tail">
      <path d="M8,-4 C-6,-26 -40,-40 -68,-32 C-80,-28 -80,-12 -68,-4 C-52,8 -20,12 8,8 Z" fill="${FUR}"/>
      <path d="M6,-6 C-8,-22 -36,-32 -60,-29 C-40,-24 -18,-16 6,-6 Z" fill="${SHADE}" opacity=".6"/>
      <path d="M-68,-32 C-80,-28 -80,-12 -68,-4 L-66,-10 L-60,-11 L-64,-17 L-57,-21 L-62,-25 L-56,-31 Z" fill="${CREAM}"/>
    </g></g>
    ${leg(74, 92, SHADE)}
    ${leg(124, 92, SHADE)}
    <ellipse cx="97" cy="84" rx="46" ry="24" fill="${FUR}"/>
    <ellipse cx="105" cy="98" rx="28" ry="8" fill="${CREAM}"/>
    ${leg(84, 94, FUR)}
    ${leg(134, 94, FUR)}
    <path class="fox-scarf" d="M120,64 L150,74 L130,100 Z"/>
    <circle class="fox-scarf-knot" cx="137" cy="73" r="5"/>
    <g transform="translate(148 54)"><g>
      ${headSide}
      ${headFront}
    </g></g>
  </g>`;
}

// A standalone fox SVG, e.g. for the front page.
export function svg(states = '') {
  return `<svg class="fox ${states}" viewBox="-30 -4 240 144" role="img" aria-label="${t('common.fox')}">${content()}</svg>`;
}

// The fox turns its head to the viewer now and then and back.
export function glance(el: Element, interval = 4000) {
  return setInterval(() => {
    el.classList.add('facing-viewer');
    setTimeout(() => el.classList.remove('facing-viewer'), 1800);
  }, interval);
}

// A fox face for the map (the map is seen from above, so the fox is a sign).
export function mapMarker() {
  return `<g class="fox-map-marker">
    <circle r="19" fill="#fff" stroke="${FUR}" stroke-width="3.5"/>
    <path d="M-13,-2 L-11,-17 L-3,-8 L3,-8 L11,-17 L13,-2 C12,6 6,12 0,13 C-6,12 -12,6 -13,-2 Z" fill="${FUR}"/>
    <path d="M-13,-2 C-12,6 -6,12 0,13 L-3,4 Z M13,-2 C12,6 6,12 0,13 L3,4 Z" fill="${CREAM}"/>
    <circle cx="-5" cy="-2" r="2.2" fill="${DARK}"/>
    <circle cx="5" cy="-2" r="2.2" fill="${DARK}"/>
    <circle cx="0" cy="9" r="2.3" fill="${DARK}"/>
  </g>`;
}
