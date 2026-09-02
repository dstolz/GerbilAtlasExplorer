// Runs against the built pages: the bundle from disk, and build/site over a local server.
// Build first: python3 tools/build_app.py --lean && python3 tools/build_app.py --site build/site
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/js',
  timeout: 90000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1 --directory build/site',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
