// Map type: a site-wide switch between the MML topographic map and the orienteering map (ISOM).
// Children focus on one map type at a time: every sign, map and text on the page follows the chosen
// type. The choice is stored in this browser. The switch is added to the page's top bar.
//
// Signs (signs data): `only: 'topo'` or `only: 'orienteering'` = the sign belongs to one type only.
// For signs in both, the orienteering version lives in the `orienteering` field (name, icon, texts,
// ready).
import type { Sign } from './types';
import { t } from './i18n';

const STORAGE_KEY = 'ketun-karttakoulu.mapType';
export type Type = 'topo' | 'orienteering';
export const TYPES: Type[] = ['topo', 'orienteering'];

function stored(): Type {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return TYPES.find((type) => type === value) ?? 'topo';
  } catch {
    return 'topo';
  }
}

// If the browser does not store, the choice stays in memory for the lifetime of this page.
let memory: Type | null = null;
export const current = (): Type => memory ?? stored();

const listeners: ((type: Type) => void)[] = [];
export const listen = (f: (type: Type) => void) => listeners.push(f);

export function set(type: Type) {
  if (type === current()) return;
  try {
    localStorage.setItem(STORAGE_KEY, type);
  } catch {
    // Private browsing etc.: the choice only lasts for this page.
    memory = type;
  }
  updateButtons();
  listeners.forEach((f) => f(type));
}

// A sign is shown in the current type unless it belongs to the other type only.
export const belongsTo = (sign: Sign, type: Type = current()) => !sign.only || sign.only === type;
// Is the sign's page made for the current type?
export function isReady(sign: Sign, type: Type = current()) {
  if (!belongsTo(sign, type)) return false;
  if (type === 'topo' || sign.only === 'orienteering') return !!sign.ready;
  return !!sign.orienteering?.ready;
}
// The sign's details in the current type: the orienteering version overrides the topographic
// fields.
export const details = (sign: Sign, type: Type = current()): Sign =>
  type === 'orienteering' && sign.orienteering ? { ...sign, ...sign.orienteering } : sign;

// ---------- Switch in the top bar ----------
let buttons: HTMLButtonElement[] = [];
function updateButtons() {
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === current())));
}
function addSwitch() {
  const bar = document.querySelector('.top-bar');
  if (!bar) return;
  const group = document.createElement('div');
  group.className = 'type-switch';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('mapType.label'));
  group.innerHTML = TYPES.map((type) => {
    const long = t(`mapType.${type}.long`);
    const short = t(`mapType.${type}.short`);
    return `<button type="button" data-type="${type}" aria-pressed="false" aria-label="${long}">
      <i class="type-switch-${type}"></i><span class="long">${long}</span><span class="short">${short}</span></button>`;
  }).join('');
  bar.insertBefore(group, bar.querySelector('.pawprints'));
  buttons = [...group.querySelectorAll('button')];
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.type as Type)));
  updateButtons();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addSwitch);
else addSwitch();
