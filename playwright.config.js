// End-to-end tests: every page and every map symbol in both map types, at iPad size. The tests find
// elements by role and by texts from the language file (`js/locales/fi.json`), not by ids or class
// names, so they stay valid while the code is renamed and restructured.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1180, height: 820 },
    // The site skips animations when the device asks for reduced motion, so scenes finish at once.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1180, height: 820 },
        // Draw 3D with the Mac's GPU; the default software renderer is several times slower.
        launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] },
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1180, height: 820 } },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: false,
    stderr: 'ignore',
  },
});
