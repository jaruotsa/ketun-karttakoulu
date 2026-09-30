# Ketun karttakoulu (Fox's Map School)

A static site that teaches map symbols and scale to children aged about 7–10, at home, at school or in a group such as Cub Scouts. It is designed for a tablet first. It installs as a PWA, so it also works offline. Open work and open questions are GitHub issues (`gh issue list`).

## Language

- Code, comments, identifiers, file names, commit messages and docs are in English.
- Every text a child sees is in `js/locales/fi.json`, the source locale whose keys and structure every other locale follows. Read it in code with `t('key')` (`js/i18n.ts`), in HTML with `data-i18n`, `data-i18n-html` or `data-i18n-attr`, and format user-visible numbers with `formatNumber`. Numbers inside SVG always use a decimal point.
- Keep Finnish text in the locale file only, and add new keys there when you add a text.

## Product rules

- **Audience:** big buttons and short sentences, with more pictures and animation than words, so a child can follow along and an adult can read the texts aloud. There is no speech synthesis.
- **Style:** light paper background. The fox is cute but not babyish: a big round head, shiny black eyes with highlights, a thin line for a mouth, and a blue scarf. It sometimes turns to look at the viewer (`facingViewer`).
- **Map standards:** topo symbols and colours follow the [MML terrain map legend 2025](https://www.maanmittauslaitos.fi/sites/maanmittauslaitos.fi/files/attachments/2025/09/maastokartta_karttamerkkien_selite_2025.pdf). Orienteering symbols follow ISOM 2017 ([Suunnistusliitto: Yleisimmät karttamerkit](https://www.suunnistusliitto.fi/system/wp-content/uploads/2024/04/YleisimmatKarttamerkit_suunnistus.pdf)).
- **One map type at a time:** the top-bar switch (`js/map-type.ts`, `topo` or `orienteering`) sets every sign, map and text on the site. Never show the two map types side by side, because their colours mean different things: on an orienteering map, colour tells how easy it is to run.
- **The landscape matches the map:** the 3D world (`js/world.ts`) is built from the map data (`js/foxwood.ts`), so every feature sits where the map puts it. The landscape shows only what the map has. The camera faces north, and when the landscape turns into the map, the camera rises into the air.
- **Sign scenes:** the camera follows the fox from behind and fairly high up. Trees stay visible along the way. The speech bubble sits at the top left so it never covers the fox or the feature.
- **Group related signs:** signs about the same subject share one sign page with a lesson panel, such as water (thin line, thick line, area) or roads (trail, track, car roads). Keep a sign separate when it has its own story, like the lookout tower. Before adding a sign, check whether it belongs in an existing group.
- **Lesson panel buttons name the feature** ("Pieni puro", "Kivikko", "Portti"), and the icon shows the symbol. Describe the symbol's look in `summary` and `text`. Every panel's instruction is "Paina merkkiä!". Add `&shy;` to long words so they fit the button.

## Structure

- Pages: `index.html` (home and the sign grid), `what-is-a-map.html` (`js/map-page.ts`) and `sign.html?id=<sign>` (`js/sign-page.ts`). Entry points are in `js/pages/`.
- A sign is data in `js/signs.ts` plus a scene in `js/scenes/<id>.ts`, registered in `js/scenes/index.ts`. The scene ↔ engine contract is typed in `js/scene-types.ts`. The orienteering version of a sign sits in the sign's `orienteering` field and the scene's `orienteering.lesson`.
- Map coordinates (x, y) become world coordinates (x − 300, height, y − 190), with 1 unit = 1 m. Place things on the ground through the world's `heightAt`/`toWorld`. The world's `checks` warn in the console about misplaced features (a building in the lake, a stream flowing uphill); keep it quiet.
- `public/` holds `sw.js`, the manifest and `kuvat/`. `npm run build` generates the service worker's file list and version.

## Workflow

- Run `npm run typecheck`, `npm run lint`, `npm run format` and `npm test` (Playwright, Chromium and WebKit, against the built site) before every commit. Run `npm run test:update` only when a visual change is intentional.
- Test at iPad size, 1180 × 820 (`npm run dev`, port 8765).
- A background browser tab does not run `requestAnimationFrame`. Drive scenes in tests through the hooks `window.SignPage`, `window.MapPage` and `window.HomeFox`, or replace `animate` so it calls `f(t)` directly.
- The Chrome extension can disconnect during waits longer than about 10 seconds. Start a scene in one call and read the result in the next.
- To read symbols from a legend PDF, render its pages at high resolution with a small Swift script (PDFKit, 3–4× size) and read colours from the pixels. `sips` alone gives too small an image.
