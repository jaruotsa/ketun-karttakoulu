// Layout at every screen size (issue #8): the pages fit the screen without sideways scrolling,
// buttons stay big enough to tap, their labels fit, and a screenshot shows the whole page. Runs in
// the iPad projects and in the phone and desktop projects (playwright.config.js).
import { test, expect } from '@playwright/test';
import { useMapType, watchConsole, text } from './helpers.js';

// Apple's smallest comfortable tap target.
const MIN_TAP = 44;

// Problems with the page layout, as short readable lines.
async function layoutProblems(page) {
  return page.evaluate((minTap) => {
    const problems = [];
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width) {
      problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${width}`);
    }
    const visible = (e) => {
      const box = e.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const name = (e) =>
      (e.getAttribute('aria-label') || e.textContent || e.tagName).replace(/\s+/g, ' ').trim();
    // Links inside running text (the footer) are not tap targets of their own.
    const targets = [
      ...document.querySelectorAll('button, a, [role="tab"], input[type="range"]'),
    ].filter((e) => visible(e) && !e.closest('p'));
    for (const e of targets) {
      const box = e.getBoundingClientRect();
      if (box.width < minTap || box.height < minTap) {
        problems.push(
          `too small to tap: "${name(e)}" ${Math.round(box.width)}×${Math.round(box.height)}`,
        );
      }
      if (box.right > width + 1 || box.left < -1) {
        problems.push(`outside the screen: "${name(e)}"`);
      }
      if (e.scrollWidth > e.clientWidth + 1 && e.tagName !== 'INPUT') {
        problems.push(`label does not fit: "${name(e)}"`);
      }
    }
    return problems;
  }, MIN_TAP);
}

async function checkLayout(page, screenshot, mask = []) {
  // Soft, so a failing page still gets its screenshot to look at.
  expect.soft(await layoutProblems(page), 'layout problems').toEqual([]);
  await expect(page).toHaveScreenshot(screenshot, {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
    mask,
  });
}

for (const mapType of ['topo', 'orienteering']) {
  test(`front page: ${mapType}`, async ({ page }) => {
    const problems = watchConsole(page);
    await useMapType(page, mapType);
    await page.goto('index.html');
    await expect(page.getByRole('heading', { level: 2 })).not.toBeEmpty();
    // The 3D fox on the front page looks around on its own, so its picture changes between runs.
    await checkLayout(page, `front-${mapType}.png`, [page.locator('canvas')]);
    problems.expectNoProblems();
  });

  test(`sign page: ${mapType}`, async ({ page }) => {
    const problems = watchConsole(page);
    await useMapType(page, mapType);
    await page.goto('sign.html?id=stream');
    const quiz = page.getByRole('region', { name: text('signPage.quiz') });
    await expect(quiz.getByRole('heading')).not.toBeEmpty();
    await checkLayout(page, `sign-${mapType}-start.png`);

    await page.getByRole('button', { name: text('signPage.go') }).click();
    await expect(page.getByRole('button', { name: text('signPage.again') })).toBeEnabled();
    await checkLayout(page, `sign-${mapType}-end.png`);
    problems.expectNoProblems();
  });

  test(`what is a map: ${mapType}`, async ({ page }) => {
    const problems = watchConsole(page);
    await useMapType(page, mapType);
    await page.goto('what-is-a-map.html');
    await expect(page.getByRole('main').getByRole('figure').first()).not.toBeEmpty();
    await checkLayout(page, `map-page-${mapType}.png`);
    problems.expectNoProblems();
  });
}
