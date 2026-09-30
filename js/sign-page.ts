// The page of one sign: builds the page from the data of signs.ts and runs the scene.
// The terrain is the 3D world of Foxwood (scene.terrain, sign-terrain.ts).
import * as FoxSvg from './fox-svg';
import * as Pawprints from './pawprints';
import * as MapType from './map-type';
import { SIGNS } from './signs';
import { Foxwood } from './foxwood';
import * as Scenes from './scenes';
import { animate } from './animation';
import type { Sign } from './types';
import type { Scene } from './scene-types';
import { $ } from './dom';
import { t, formatNumber } from './i18n';
import { SignTerrain } from './sign-terrain';
import { LessonPanel } from './lesson-panel';

const SVG_NS = 'http://www.w3.org/2000/svg';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : ms));

// The page shows the sign according to the chosen map type (map-type.ts). If the sign has not been
// made yet for the chosen type, we return to the front page, which shows the signs of this type.
async function start() {
  const id = new URLSearchParams(location.search).get('id') || 'lake';
  const ready = SIGNS.filter((m) => MapType.isReady(m));
  const found = ready.find((m) => m.id === id);
  MapType.listen(() =>
    MapType.isReady(found ?? ({} as Sign)) ? location.reload() : location.assign('index.html'),
  );
  if (!found) {
    location.replace('index.html');
    return;
  }
  const sign = MapType.details(found);
  // On the orienteering map a sign is learned under its own id (the same as on the front page).
  const learnedId = MapType.current() === 'orienteering' ? `orienteering-${sign.id}` : sign.id;
  const scene = (Scenes as Record<string, Scene>)[sign.id];

  document.title = t('signPage.title', { name: sign.name });
  $('#sign-name').textContent = sign.name;
  $('#sign-sentence').textContent = sign.sentence;
  $('#sign-icon').innerHTML = sign.icon;
  $('#hint-text').textContent = sign.hint;
  $('#bubble').textContent = sign.bubble;
  $('#bubble').style.left = scene.bubblePosition.x + '%';
  $('#bubble').style.top = scene.bubblePosition.y + '%';

  // Map and terrain
  const mapSvg = $<SVGSVGElement>('#map');
  const terrainSvg = $<SVGSVGElement>('#terrain');
  mapSvg.innerHTML = scene.map;
  // The SVG of the terrain is an overlay: small events (cat, squirrel, flames) on top of the 3D
  // picture. The fox is a 3D model.
  terrainSvg.innerHTML = scene.terrain.overlay;

  const route = $<SVGGeometryElement>('#route', mapSvg);
  const routeLength = route.getTotalLength();

  // A pulsing highlight at the edge of the feature when the fox has arrived. A scene can give its
  // own shape (scene.highlight).
  const highlight = document.createElementNS(SVG_NS, 'path');
  const shape =
    scene.highlight ?? (Foxwood.shapes as Record<string, string | string[]>)[scene.feature];
  highlight.setAttribute('d', Array.isArray(shape) ? shape[0] : shape);
  highlight.setAttribute('class', 'feature-highlight');
  $('.feature-name', mapSvg).before(highlight);
  // A line-like feature (brook, road) is drawn on top of the highlight, so that its own colour is
  // visible. The features that cross the feature (scene.drawOver, e.g. a road on a bridge over a
  // brook) are drawn on top of it.
  if (!/z\s*$/i.test(highlight.getAttribute('d')!)) {
    const copies = [scene.feature, ...(scene.drawOver ?? [])].map((k) =>
      $(`.feature-${k}`, mapSvg).cloneNode(true),
    );
    highlight.after(...copies);
  }

  // An orange trail is drawn on the map behind the fox.
  const trail = route.cloneNode() as SVGGeometryElement;
  trail.removeAttribute('id');
  trail.setAttribute('class', 'fox-track');
  trail.style.strokeDasharray = String(routeLength);
  route.after(trail);

  const mapMarker = document.createElementNS(SVG_NS, 'g');
  mapMarker.innerHTML = FoxSvg.mapMarker();
  mapSvg.appendChild(mapMarker);

  const terrain = await SignTerrain.create({
    frame: $('.terrain-frame'),
    terrainSvg,
    route,
    settings: scene.terrain.camera,
  });
  // The 3D fox (fox.ts); the poses are facingViewer, curious, pawUp, walking and cheering.
  const fox = terrain.fox;

  // A scene can raise the fox at a point of the route (a jump over an obstacle): terrain.lift(x, y)
  // in metres.
  function setProgress(t: number) {
    const p = route.getPointAtLength(t * routeLength);
    mapMarker.setAttribute('transform', `translate(${p.x} ${p.y})`);
    trail.style.strokeDashoffset = String(routeLength * (1 - t));
    terrain.setProgress(t, scene.terrain.lift?.(p.x, p.y) ?? 0);
  }

  function reset() {
    setProgress(0);
    fox.poses.set('facingViewer');
    scene.terrain.reset?.(terrainSvg, terrain, mapSvg);
    document.body.classList.remove('arrived', 'hint-open');
  }

  // The fox walks the route. A scene can stop on the way (e.g. at controls): terrain.stops = map
  // points [[x, y], ...], and at each one terrain.atStop(n, { ... }) is called.
  const stops = (scene.terrain.stops ?? []).map((p) => terrain.routeProgress(p));
  // A scene can slow down walking: terrain.speed(x, y, world) = 1 normally, smaller slower
  // (thicket). times[i] = the elapsed time at route point i / N (times[N] = the whole journey), so
  // the duration of walking is divided according to the speed.
  const N = 400;
  const times = [0];
  for (let i = 1; i <= N; i++) {
    const p = route.getPointAtLength(((i - 0.5) / N) * routeLength);
    times.push(times[i - 1] + 1 / (scene.terrain.speed?.(p.x, p.y, terrain.world) ?? 1));
  }
  // The route point u (0..1) → the share of the walking time (0..1) and back.
  function timeFraction(u: number) {
    const i = Math.min(N - 1, Math.floor(u * N));
    return (times[i] + (times[i + 1] - times[i]) * (u * N - i)) / times[N];
  }
  function progressAt(a: number) {
    const goal = a * times[N];
    let i = 0;
    while (i < N - 1 && times[i + 1] < goal) i++;
    return (i + (goal - times[i]) / (times[i + 1] - times[i])) / N;
  }
  async function walk(duration: number) {
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    let start = 0;
    for (const [n, end] of [...stops, 1].entries()) {
      const [a0, a1] = [timeFraction(start), timeFraction(end)];
      fox.poses.add('walking');
      await animate(duration * (a1 - a0), (t) => setProgress(progressAt(a0 + (a1 - a0) * t)));
      fox.poses.remove('walking');
      if (n < stops.length)
        await scene.terrain.atStop?.(n, { terrainSvg, mapSvg, fox, wait, terrain });
      start = end;
    }
  }

  const button = $<HTMLButtonElement>('#start-button');
  let running = false;
  button.addEventListener('click', async () => {
    if (running) return;
    running = true;
    button.disabled = true;
    reset();
    await wait(500);
    fox.poses.remove('facingViewer');
    await wait(250);
    await walk(scene.terrain.duration ?? 4500);
    document.body.classList.add('arrived');
    if (!reducedMotion) await scene.terrain.arrive({ terrainSvg, mapSvg, fox, wait, terrain });
    fox.poses.remove('pawUp', 'curious');
    fox.poses.add('facingViewer', 'cheering');
    document.body.classList.add('hint-open');
    $('span', button).textContent = t('signPage.again');
    button.disabled = false;
    running = false;
  });

  // On a phone and in the portrait orientation of an iPad the map and the terrain are switched with
  // tabs.
  document.querySelectorAll('[data-view]').forEach((v) =>
    v.addEventListener('click', () => {
      document.body.dataset.view = (v as HTMLElement).dataset.view;
      document
        .querySelectorAll('[data-view]')
        .forEach((b) => b.setAttribute('aria-selected', String(b === v)));
    }),
  );

  // The lesson box: with the buttons the leader shows one item at a time (scene.lesson). On the
  // orienteering map the orienteering version of the scene (scene.orienteering.lesson) is used, if
  // there is one. The picture is a 3D stage (lesson-panel.ts) where the 3D fox stands. The pressed
  // item builds its objects there (item.show), and finally a card with the map sign of the item
  // appears in the corner.
  const lesson = MapType.current() === 'orienteering' ? scene.orienteering?.lesson : scene.lesson;
  if (lesson) {
    $('#lesson').hidden = false;
    $('#lesson-title').textContent = lesson.title;
    $('#lesson-text').textContent = lesson.instruction;
    const frame = $('#lesson-frame');
    frame.setAttribute('aria-label', lesson.title);
    const overlay = $<SVGSVGElement>('#lesson-overlay');
    const o = await LessonPanel.create({ frame, overlay, settings: lesson.stage });
    const buttons = lesson.items.map((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" aria-pressed="false">
        <svg viewBox="0 0 100 50" aria-hidden="true">${item.icon}</svg>
        <span><b>${item.name}</b><br>${item.summary}</span>
      </button>`;
      $('#lesson-items').appendChild(li);
      return $<HTMLButtonElement>('button', li);
    });
    async function showItem(n: number, motion = reducedMotion ? 0 : 1) {
      const item = lesson!.items[n];
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === n)));
      $('#lesson-text').textContent = '';
      // A new press interrupts the old show (LessonPanel.Interrupted).
      o.clear(item.camera);
      try {
        await item.show(o, motion);
        const card = document.createElementNS(SVG_NS, 'g');
        card.innerHTML = `<rect x="316" y="10" width="76" height="52" rx="8" fill="#fff" stroke="#E7DCC5" stroke-width="2"/>
          <svg x="318" y="12" width="72" height="48" viewBox="0 0 100 50">${item.icon}</svg>`;
        card.setAttribute('opacity', '0');
        o.overlay.appendChild(card);
        await o.animate(motion ? 350 : 0, (t) => card.setAttribute('opacity', String(t)));
        $('#lesson-text').textContent = item.text;
      } catch (error) {
        if (!(error instanceof LessonPanel.Interrupted)) throw error;
      }
    }
    buttons.forEach((button, n) => button.addEventListener('click', () => showItem(n)));
    // For testing (animations do not advance in a background tab): SignPage.showItem(n, 0) +
    // SignPage.lesson.render().
    window.SignPage = { ...window.SignPage, showItem, lesson: o };
  }

  // Minivisa
  const quiz = sign.quiz!;
  $('#quiz-question').textContent = quiz.question;
  const options = $('#quiz-options');
  quiz.options.forEach((optionId) => {
    const m = MapType.details(SIGNS.find((x) => x.id === optionId)!);
    const b = document.createElement('button');
    b.className = 'quiz-card';
    b.innerHTML = m.icon;
    b.setAttribute('aria-label', m.name);
    b.addEventListener('click', () => {
      if (optionId === quiz.correct) {
        b.classList.add('correct');
        $('#quiz-feedback').textContent = t('signPage.correct', { name: m.name.toLowerCase() });
        options.classList.add('solved');
        Pawprints.add(learnedId);
        updatePawprints();
      } else {
        b.classList.remove('wrong');
        void b.offsetWidth; // restarts the shake
        b.classList.add('wrong');
        $('#quiz-feedback').textContent = t('signPage.wrong', { name: m.name.toLowerCase() });
      }
    });
    options.appendChild(b);
  });

  // Previous / next. The first sign is preceded by the "What is a map?" page.
  const i = ready.indexOf(found);
  const previous = ready[i - 1];
  const next = ready[i + 1];
  $<HTMLAnchorElement>('#previous').href = previous
    ? `sign.html?id=${previous.id}`
    : 'what-is-a-map.html';
  if (next) $<HTMLAnchorElement>('#next').href = `sign.html?id=${next.id}`;
  else $('#next').hidden = true;
  $('#progress').textContent = `${formatNumber(i + 1)} / ${formatNumber(ready.length)}`;

  function updatePawprints() {
    $('#pawprint-count').textContent = formatNumber(Pawprints.all().length);
  }

  updatePawprints();
  reset();
  // For testing: animations do not advance in a background tab, so the point can be set and drawn
  // directly.
  window.SignPage = { ...window.SignPage, setProgress, terrain };
}

start();
