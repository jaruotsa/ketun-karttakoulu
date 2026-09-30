// Front page, the "What is a map?" page and offline use.
import { test, expect } from '@playwright/test';
import { SYMBOLS, MAP_TYPES, useMapType, watchConsole, text } from './helpers.js';

const HEADINGS = { topo: text('home.topoHeading'), orienteering: text('home.orienteeringHeading') };

for (const mapType of MAP_TYPES) {
  test(`front page: ${mapType}`, async ({ page }) => {
    const problems = watchConsole(page);
    await useMapType(page, mapType);
    await page.goto('index.html');

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(HEADINGS[mapType]);
    await expect(page.getByRole('main')).toMatchAriaSnapshot({ name: `front-${mapType}.aria.yml` });
    // The start button and the "What is a map?" card, then the symbol cards in order.
    const links = await page
      .getByRole('main')
      .getByRole('link')
      .evaluateAll((a) => a.map((l) => l.getAttribute('href')));
    expect(links).toEqual([
      'what-is-a-map.html',
      'what-is-a-map.html',
      ...SYMBOLS[mapType].map((id) => `sign.html?id=${id}`),
    ]);

    problems.expectNoProblems();
  });

  test(`what is a map: ${mapType}`, async ({ page }) => {
    const problems = watchConsole(page);
    await useMapType(page, mapType);
    await page.goto('what-is-a-map.html');

    const slider = page.getByRole('slider', { name: text('mapPage.sliderLabel') });
    const bubble = page.getByRole('main').getByRole('figure').first();
    await expect(bubble).not.toBeEmpty();
    await expect(page.getByRole('main')).toMatchAriaSnapshot({
      name: `map-page-${mapType}.aria.yml`,
    });

    await test.step('legend buttons turn one part into map', async () => {
      const shown = [];
      for (const button of await page
        .getByRole('main')
        .getByRole('listitem')
        .getByRole('button')
        .all()) {
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        shown.push({
          button: (await button.innerText()).replace(/\s+/g, ' ').trim(),
          bubble: await bubble.innerText(),
        });
      }
      expect(JSON.stringify(shown, null, 2) + '\n').toMatchSnapshot(
        `map-page-${mapType}-legend.json`,
      );
    });

    await test.step('slider moves between terrain and map', async () => {
      const bubbles = [];
      for (const value of ['0', '50', '100', '150', '199']) {
        await slider.fill(value);
        bubbles.push({ slider: value, bubble: await bubble.innerText() });
      }
      expect(JSON.stringify(bubbles, null, 2) + '\n').toMatchSnapshot(
        `map-page-${mapType}-slider.json`,
      );
    });

    await test.step('flying up ends on the map and earns a fox track', async () => {
      await slider.fill('0');
      await page.getByRole('button', { name: text('mapPage.flyUp') }).click();
      await expect(slider).toHaveValue('200');
      await expect(page.getByTitle(text('common.pawprints'))).toHaveText('1');
    });

    problems.expectNoProblems();
  });
}

test('map type switch changes the whole front page', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(HEADINGS.topo);
  await page.getByRole('button', { name: text('mapType.orienteering.long') }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(HEADINGS.orienteering);
  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(HEADINGS.orienteering);
});

test('works offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit has no offline service worker support');
  await page.goto('index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);

  // A symbol page never opened before, and its 3D terrain.
  await page.goto('sign.html?id=mire');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(text('signs.mire.name'));
  await page.getByRole('button', { name: text('signPage.go') }).click();
  await expect(page.getByRole('button', { name: text('signPage.again') })).toBeEnabled();
  await page.goto('what-is-a-map.html');
  await expect(page.getByRole('slider', { name: text('mapPage.sliderLabel') })).toBeVisible();
});
