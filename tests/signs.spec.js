// Every symbol page in both map types: page content, the map, the fox's walk, the lesson box and
// the quiz.
import { test, expect } from '@playwright/test';
import { SYMBOLS, useMapType, watchConsole, describeSvg, text, textBefore } from './helpers.js';

const CORRECT = textBefore('signPage.correct');

for (const [mapType, ids] of Object.entries(SYMBOLS)) {
  test.describe(mapType, () => {
    for (const id of ids) {
      test(id, async ({ page }) => {
        const problems = watchConsole(page);
        await useMapType(page, mapType);
        await page.goto(`sign.html?id=${id}`);

        const main = page.getByRole('main');
        const quiz = page.getByRole('region', { name: text('signPage.quiz') });
        // The page is ready when the quiz (built last) has its question.
        await expect(quiz.getByRole('heading')).not.toBeEmpty();
        await expect(main).toMatchAriaSnapshot({ name: `${mapType}-${id}.aria.yml` });

        const map = page.getByRole('img', { name: text('signPage.mapLabel') });
        expect(await describeSvg(map)).toMatchSnapshot(`${mapType}-${id}-map-start.txt`);

        await test.step('the fox walks to the target', async () => {
          await page.getByRole('button', { name: text('signPage.go') }).click();
          await expect(page.getByRole('button', { name: text('signPage.again') })).toBeEnabled();
          expect(await describeSvg(map)).toMatchSnapshot(`${mapType}-${id}-map-end.txt`);
          const landscapeOverlay = page.getByRole('img', { name: text('signPage.landscapeLabel') });
          expect(await describeSvg(landscapeOverlay)).toMatchSnapshot(
            `${mapType}-${id}-landscape-overlay-end.txt`,
          );
        });

        await test.step('lesson box buttons', async () => {
          // The lesson box's buttons are the only list buttons on the page.
          const buttons = main.getByRole('listitem').getByRole('button');
          const shown = [];
          for (const button of await buttons.all()) {
            await button.click();
            await expect(button).toHaveAttribute('aria-pressed', 'true');
            const caption = page.locator('figcaption[aria-live]');
            await expect(caption).not.toBeEmpty();
            shown.push({
              button: (await button.innerText()).replace(/\s+/g, ' ').trim(),
              text: await caption.innerText(),
            });
          }
          expect(JSON.stringify(shown, null, 2) + '\n').toMatchSnapshot(
            `${mapType}-${id}-lesson.json`,
          );
        });

        await test.step('quiz: wrong answers, then the right one', async () => {
          const feedback = quiz.locator('[aria-live]');
          const answers = [];
          for (const option of await quiz.getByRole('button').all()) {
            await option.click();
            await expect(feedback).not.toBeEmpty();
            answers.push({
              option: await option.getAttribute('aria-label'),
              feedback: await feedback.innerText(),
            });
            if ((await feedback.innerText()).startsWith(CORRECT)) break;
          }
          expect(answers.filter((a) => a.feedback.startsWith(CORRECT))).toHaveLength(1);
          expect(JSON.stringify(answers, null, 2) + '\n').toMatchSnapshot(
            `${mapType}-${id}-quiz.json`,
          );
          // A right answer adds one fox track.
          await expect(page.getByTitle(text('common.pawprints'))).toHaveText('1');
        });

        problems.expectNoProblems();
      });
    }
  });
}
