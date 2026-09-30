// Shared helpers for the end-to-end tests.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

// Texts come from the language file, so the tests find elements by the same keys as the site and do
// not contain any language of their own. (The aria snapshots and .json snapshots still hold the
// Finnish output.)
const LANGUAGE = JSON.parse(
  readFileSync(new URL('../js/locales/fi.json', import.meta.url), 'utf8'),
);
export function text(key) {
  const value = key.split('.').reduce((object, part) => object?.[part], LANGUAGE);
  if (typeof value !== 'string') throw new Error(`No text for key ${key}`);
  return value;
}
// The start of a text that continues with a {{placeholder}}.
export const textBefore = (key) => text(key).split('{{')[0];

// Symbols per map type, in the order of the front page grid (checked by pages.spec.js).
export const SYMBOLS = {
  topo: [
    'lake',
    'field',
    'mire',
    'stream',
    'forest',
    'trail',
    'building',
    'fences',
    'powerLine',
    'bridge',
    'hill',
    'stones',
    'campfire',
    'lookoutTower',
  ],
  orienteering: [
    'lake',
    'field',
    'mire',
    'stream',
    'forest',
    'trail',
    'building',
    'fences',
    'powerLine',
    'hill',
    'stones',
    'controls',
    'smallFeatures',
  ],
};
export const MAP_TYPES = Object.keys(SYMBOLS);

// The map type stored in the browser by the site (map-type.ts).
export async function useMapType(page, mapType) {
  await page.addInitScript((t) => localStorage.setItem('ketun-karttakoulu.mapType', t), mapType);
}

// Performance notes from the browser's own graphics driver, not from the site.
const BROWSER_NOISE = /GL Driver Message|GPU stall due to ReadPixels/;

// Collects console errors, warnings and uncaught exceptions. Call expectNoProblems() at the end of
// the test.
export function watchConsole(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    if (BROWSER_NOISE.test(m.text())) return;
    problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
  return {
    expectNoProblems: () => expect(problems, 'console errors or warnings').toEqual([]),
  };
}

// Text form of an SVG drawing: element tree, geometry and the colours the browser actually uses.
// Class names and ids are left out (they change when the code is renamed); references to other
// elements (fill="url(#pattern)", <use href="#symbol">) point to the element's position instead.
export async function describeSvg(locator) {
  return locator.evaluate((svg) => {
    const style = document.createElement('style');
    style.textContent =
      '*, *::before, *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(style);

    const elements = [svg, ...svg.querySelectorAll('*')];
    const position = new Map(elements.map((e, i) => [e, i]));
    const reference = (value) =>
      value.replace(/url\((["']?)[^)"']*#([^)"']+)\1\)|^#(.+)$/g, (_all, _q, urlId, hrefId) => {
        const target = document.getElementById(urlId ?? hrefId);
        const where = target
          ? position.has(target)
            ? `@${position.get(target)}`
            : '@outside'
          : '@missing';
        return urlId ? `url(${where})` : where;
      });
    const SKIP = /^(class|id|data-.*|aria-.*|role)$/;
    const COMPUTED = [
      'display',
      'visibility',
      'opacity',
      'fill',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'stroke-dasharray',
      'font-size',
      'font-weight',
    ];
    const round = (v) =>
      v.replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(Number(n) * 100) / 100));

    const depth = (e) => {
      let d = 0;
      for (let p = e; p !== svg; p = p.parentElement) d++;
      return d;
    };
    const lines = elements.map((e) => {
      const attributes = [...e.attributes]
        .filter((a) => !SKIP.test(a.name))
        .map((a) => `${a.name}="${round(reference(a.value))}"`)
        .sort();
      const computed = getComputedStyle(e);
      const colours = COMPUTED.map((p) => `${p}:${round(reference(computed.getPropertyValue(p)))}`);
      const text =
        ['text', 'tspan', 'textPath', 'title'].includes(e.tagName) && !e.children.length
          ? ` "${e.textContent.trim()}"`
          : '';
      return `${'  '.repeat(depth(e))}<${e.tagName} ${attributes.join(' ')}> {${colours.join(' ')}}${text}`;
    });
    style.remove();
    return lines.join('\n') + '\n';
  });
}
