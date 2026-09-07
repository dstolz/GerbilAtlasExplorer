// Runs against the built pages: the bundle from disk, and build/site over a local server.
// Build first: python3 tools/build_app.py --lean && python3 tools/build_app.py --site build/site
//
// The second server is the fixer, tools/atlasfix.py, which serves src/fixer.html and
// answers for it; tests/js/fixer.spec.js drives that page. It needs the pinned Python
// packages (pip install -r tools/requirements.txt), which the site server does not.
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
    // A red browser job is otherwise a line of text, and half of what is asserted here is
    // layout. A screenshot of the failing state costs a passing run nothing -- it is taken
    // only when a test fails -- and .github/workflows/ci.yml uploads test-results/ then.
    // (`trace: 'retain-on-failure'` records every test and throws most away: it measured
    // about 15% on this suite, which is not worth paying on every green run.)
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: [{
    command: 'python3 -m http.server 8765 --bind 127.0.0.1 --directory build/site',
    url: 'http://127.0.0.1:8765/index.html',
    // reused while developing, so a spec can be re-run against a server already up; never
    // in CI, where a port answering is a server nobody started -- and a run green against
    // whatever it happens to be serving
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  }, {
    command: 'python3 tools/atlasfix.py 19 --abbr S1DZ --port 8771 --no-browser',
    url: 'http://127.0.0.1:8771/api/boot',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  }],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
