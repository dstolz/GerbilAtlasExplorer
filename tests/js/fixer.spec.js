// tools/atlasfix.py and the page it serves: the plate comes up, a mark can be made on
// it, and what the extraction says about the mark is the pipeline's own answer.
//
// The server is started by playwright.config.js on plate 19 with S1DZ chosen -- the
// case of #77, whose correction file is also tests/python/fixtures. Nothing here
// commits: the marks are made, read against the extraction, and thrown away with the
// browser. `Recut` builds the plate again in a scratch tree, which takes about ten
// seconds, so it has a test of its own rather than a line in another one.
const { test, expect, devices } = require('@playwright/test');

const APP = 'http://127.0.0.1:8771/';
// the same page as build_app.py builds it into the site, with no server behind it
const PUBLISHED = 'http://127.0.0.1:8765/fixer.html?plate=19&abbr=S1DZ';
const SEED = [1079, 955];                 // page px inside the left S1DZ strip
const GAP = [[1162, 1043], [1186, 1061]]; // the run of dashed boundary the tracing missed

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(APP);
  await page.waitForFunction(() => document.title.includes('atlas region fixer'));
  page.errors = errors;
  return page;
}

// page px -> a click on the canvas, through the view the page is holding
async function clickAt(page, pt) {
  const box = await page.evaluate(([x, y]) => {
    const r = document.getElementById('cv').getBoundingClientRect();
    return [r.left + S.view.x + x * S.view.k, r.top + S.view.y + y * S.view.k];
  }, pt);
  await page.mouse.click(box[0], box[1]);
}

test('the plate comes up as it was asked for, with the region chosen', async ({ page }) => {
  await open(page);
  await expect(page.locator('#where')).toContainText('plate 19, bregma +1.50 mm');
  await expect(page.locator('#where')).toContainText('3296 × 2481');
  await expect(page.locator('#regfact')).toContainText('0.6143 mm² in 2 rings');
  await expect(page.locator('#regfact')).toContainText('printed 2 times: S1DZ[0], S1DZ[1]');
  await expect(page.locator('#regions .row.on .ab')).toHaveText('S1DZ');
  expect(page.errors).toEqual([]);
});

test('picking a point reads the face the extraction cut there', async ({ page }) => {
  await open(page);
  await clickAt(page, SEED);
  const r = page.locator('#report');
  await expect(r).toContainText('ML -4.130  DV -2.877 mm');
  await expect(r).toContainText('seeded by S1DZ');
  await expect(r).toContainText('today: inside S1DZ');
});

test('a seed and a boundary become the correction, in the page frame with mm beside it',
  async ({ page }) => {
    await open(page);
    await page.fill('#problem', 'S1DZ on the left is a scrap; S1J bulges through the gap.');
    await page.click('[data-t="seed"]');
    await clickAt(page, SEED);
    await page.click('[data-t="boundary"]');
    await clickAt(page, GAP[0]);
    await clickAt(page, GAP[1]);
    await page.keyboard.press('Enter');
    await expect(page.locator('#marks .mark')).toHaveCount(2);
    await expect(page.locator('#marks')).toContainText('S1DZ positive');
    await expect(page.locator('#marks')).toContainText('solid boundary');

    const doc = await page.evaluate(async () => {
      const r = await fetch('/api/document', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({draft: S.draft}),
      });
      return (await r.json()).doc;
    });
    expect(doc.schema).toBe('gerbil-atlas-correction/1');
    expect(doc.plate).toBe(19);
    expect(doc.abbr).toBe('S1DZ');
    expect(doc.hemisphere).toBe('left');
    expect(doc.id).toMatch(/^\d{8}T\d{6}Z-p19-S1DZ$/);
    // the click landed on the pixel it was aimed at, and the two frames agree
    expect(doc.seeds[0].page_px[0]).toBeCloseTo(SEED[0], 0);
    expect(doc.seeds[0].mm[0]).toBeCloseTo(-4.13, 2);
    expect(doc.boundaries[0].page_px).toHaveLength(2);
    expect(doc.boundaries[0].style).toBe('solid');

    await page.keyboard.press('z');                 // undo drops the last mark
    await expect(page.locator('#marks .mark')).toHaveCount(1);
  });

test('inspect reads the draft against the extraction', async ({ page }) => {
  await open(page);
  await page.fill('#problem', 'the case of #77.');
  await page.click('[data-t="seed"]');
  await clickAt(page, SEED);
  await page.click('#inspectb');
  const r = page.locator('#report');
  await expect(r).toContainText('plate 19 (bregma +1.50), S1DZ', {timeout: 30000});
  await expect(r).toContainText('S1DZ today: 0.6143 mm2');
  await expect(r).toContainText('seed 1 S1DZ positive');
});

test('recut applies the draft to a scratch tree and builds the plate again',
  async ({ page }) => {
    test.slow();
    await open(page);
    await page.fill('#problem', 'the case of #77.');
    await page.click('[data-t="seed"]');
    await clickAt(page, SEED);
    await page.click('#recutb');
    const r = page.locator('#report');
    await expect(r).toContainText('seed_overrides 19/S1DZ', {timeout: 60000});
    // 40 rather than 39: E is drawn on this plate now that MIN_AREA_PX matches
    // MIN_FACE_PX, so a face the extraction had accepted is published too.
    await expect(r).toContainText('recut plate 19: 40 regions');
    await expect(page.locator('#v-cut')).toBeChecked();          // and it is what is drawn
  });

test('commit shows the file it would write before it writes anything', async ({ page }) => {
  await open(page);
  await page.fill('#problem', 'the case of #77.');
  await page.click('[data-t="seed"]');
  await clickAt(page, SEED);
  await page.click('#commitb');
  const json = page.locator('#mjson');
  await expect(json).toContainText('"schema": "gerbil-atlas-correction/1"');
  await expect(json).toContainText('"page_px": [1079,955]');
  await expect(page.locator('#mbtns button:last-child')).toHaveText('Commit and push');
  await page.check('#m-dry');                      // and says what the dry run does instead
  await expect(page.locator('#mbtns button:last-child')).toHaveText('Write it');
  await expect(page.locator('#m-what')).toContainText('build/corrections/');
  await page.click('#mbtns button:first-child');   // cancel: nothing was sent
  await expect(page.locator('#modal')).toBeHidden();
});

test('a plate with no correction on it still draws, and the plate can be changed',
  async ({ page }) => {
    await open(page);
    await page.fill('#plate', '5');
    await page.locator('#plate').press('Enter');
    await expect(page.locator('#where')).toContainText('plate 5, bregma');
    await expect(page.locator('#marks')).toContainText('Nothing marked yet');
    expect(page.errors).toEqual([]);
  });


// ---------------------------------------------------------------------- a phone
//
// The plate is what a small screen has room for, so the panel starts shut and the
// chrome is held to one row each; and a finger has neither a wheel nor an Enter key,
// so a tap acts, a drag pans, two fingers pinch, and a shape being drawn is finished
// from the plate itself. Fingers are dispatched as pointer events, which is what the
// page listens for and what a touchscreen raises.

async function onPhone(browser, body) {
  const ctx = await browser.newContext({...devices['iPhone 13']});
  const page = await ctx.newPage();
  try {
    await open(page);
    await page.waitForTimeout(250);            // the sheet shuts on the first frame
    await body(page);
  } finally {
    await ctx.close();
  }
}

const view = (page) => page.evaluate(() => ({k: S.view.k, x: S.view.x, y: S.view.y}));

// a run of touch pointers on the canvas: [[id, x, y], ...] per step
function fingers(page, steps) {
  return page.evaluate((frames) => {
    const cv = document.getElementById('cv');
    for (const [type, id, x, y] of frames) {
      cv.dispatchEvent(new PointerEvent(type, {pointerId: id, clientX: x, clientY: y,
        pointerType: 'touch', isPrimary: id === 1, bubbles: true, button: 0,
        buttons: type === 'pointerup' ? 0 : 1}));
    }
  }, steps);
}

test('on a phone the plate keeps the screen and the panel is a sheet', async ({ browser }) => {
  await onPhone(browser, async (page) => {
    const box = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return {vh: window.innerHeight, cv: r('#cv').height, status: r('.statusbar').height,
        bar: r('.sheetbar').bottom, shut: document.body.classList.contains('shut')};
    });
    expect(box.shut).toBe(true);
    expect(box.cv).toBeGreaterThan(box.vh * 0.6);      // the plate, not the chrome
    expect(box.status).toBeLessThan(40);               // one row, scrolled not wrapped
    expect(box.bar).toBeLessThanOrEqual(box.vh + 1);   // and nothing runs off the bottom
    await expect(page.locator('#sheetwhat')).toContainText('S1DZ · Pick');

    await page.click('#sheetbar');                     // the tools, when they are wanted
    await expect(page.locator('#problem')).toBeVisible();
    await page.click('#sheetbar');
    await expect(page.locator('#problem')).toBeHidden();
  });
});

test('a tap reads the plate, a drag pans it, two fingers pinch it', async ({ browser }) => {
  await onPhone(browser, async (page) => {
    const v0 = await view(page);
    await clickAt(page, SEED);                          // tap: the same probe as a click
    await expect(page.locator('#report')).toContainText('today: inside S1DZ');
    expect(await view(page)).toEqual(v0);               // and it did not move the plate

    const drag = [['pointerdown', 1, 200, 300]];
    for (let i = 1; i <= 8; i++) drag.push(['pointermove', 1, 200 - 8 * i, 300 + 4 * i]);
    drag.push(['pointerup', 1, 136, 332]);
    await fingers(page, drag);
    const v1 = await view(page);
    expect(v1.k).toBeCloseTo(v0.k, 6);                  // a drag pans and does not zoom
    expect(v1.x).toBeLessThan(v0.x);
    expect(v1.y).toBeGreaterThan(v0.y);

    const pinch = [['pointerdown', 1, 150, 300], ['pointerdown', 2, 250, 300]];
    for (let i = 1; i <= 6; i++) {
      pinch.push(['pointermove', 1, 150 - 10 * i, 300], ['pointermove', 2, 250 + 10 * i, 300]);
    }
    pinch.push(['pointerup', 1, 90, 300], ['pointerup', 2, 310, 300]);
    await fingers(page, pinch);
    expect((await view(page)).k).toBeGreaterThan(v1.k * 1.5);
  });
});

test('a boundary is drawn by tapping and finished from the plate', async ({ browser }) => {
  await onPhone(browser, async (page) => {
    await page.click('#sheetbar');
    await page.click('[data-t="boundary"]');
    await page.click('#sheetbar');                      // shut again: draw on the plate
    await expect(page.locator('#drawbar')).toBeHidden();
    await clickAt(page, GAP[0]);
    await expect(page.locator('#drawbar')).toBeVisible();
    await expect(page.locator('#dfinish')).toBeDisabled();   // one point is not a run
    await clickAt(page, GAP[1]);
    await expect(page.locator('#drawcount')).toHaveText('2 points');
    await page.click('#dfinish');
    await expect(page.locator('#drawbar')).toBeHidden();
    await expect(page.locator('#sheetwhat')).toContainText('1 mark');
  });
});


// --------------------------------------------------------------- the published page
//
// The copy GitHub Pages serves is the same file with nothing behind it. It draws from
// what the site publishes and answers Pick from data/facemaps/, which
// tools/build_facemaps.py cut with the pipeline -- so that answer has to be the one the
// pipeline gave, to the character. What it cannot do is run build_region_extents, so
// Inspect and Recut are off and say why.

async function published(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(PUBLISHED);
  await page.waitForFunction(() => document.title.includes('atlas region fixer'));
  page.errors = errors;
  return page;
}

// the correction as either backend would write it, with what cannot match taken out
async function documentOf(page) {
  const doc = await page.evaluate(async () => (await SRC.document(S.draft)).doc);
  for (const k of ['id', 'created', 'author', 'source']) delete doc[k];
  return doc;
}

async function markTheCase(page) {
  await page.fill('#problem', 'S1DZ on the left is a scrap; S1J bulges through the gap.');
  await page.click('[data-t="seed"]');
  await clickAt(page, SEED);
  await page.click('[data-t="boundary"]');
  await page.click('#opts [data-s="dashed"]');
  await clickAt(page, GAP[0]);
  await clickAt(page, GAP[1]);
  await page.keyboard.press('Enter');
}

test('the published page draws the plate with no server behind it', async ({ page }) => {
  await published(page);
  expect(await page.evaluate(() => SRC.pipeline)).toBe(false);
  await expect(page.locator('#where')).toContainText('plate 19, bregma +1.50 mm');
  await expect(page.locator('#regfact')).toContainText('0.6143 mm² in 2 rings');
  await expect(page.locator('#regions .row.on .ab')).toHaveText('S1DZ');
  expect(page.errors).toEqual([]);            // and nothing 404s on the way
});

test('Pick on the published page is the answer the pipeline gave', async ({ page }) => {
  const probed = (p) => p.waitForFunction(
    () => document.getElementById('report').textContent.startsWith('ML '), null, {timeout: 20000});

  await published(page);
  await clickAt(page, SEED);
  await probed(page);
  const there = await page.textContent('#report');

  const local = await page.context().newPage();
  await open(local);
  await clickAt(local, SEED);
  await probed(local);
  const here = await local.textContent('#report');
  await local.close();

  expect(there).toBe(here);                   // to the character, not merely close
  expect(there).toContain('face #55 of 4608 px (0.227 mm²), seeded by S1DZ');
});

test('the two backends write one correction', async ({ page }) => {
  await published(page);
  await markTheCase(page);
  const there = await documentOf(page);

  const local = await page.context().newPage();
  await open(local);
  await markTheCase(local);
  const here = await documentOf(local);
  await local.close();

  expect(there).toEqual(here);
  expect(there.seeds[0].page_px).toEqual([1079, 955]);
  expect(there.boundaries[0].style).toBe('dashed');
  expect(there.hemisphere).toBe('left');
});

test('what needs the pipeline is off, and says so', async ({ page }) => {
  await published(page);
  for (const id of ['#inspectb', '#recutb', '#qcb']) {
    await expect(page.locator(id)).toBeDisabled();
    expect(await page.locator(id).getAttribute('title')).toContain('build_region_extents');
  }
  await expect(page.locator('#report')).toContainText('no pipeline behind it');
  await expect(page.locator('#report')).toContainText('data/facemaps/');
});

test('committing from the published page asks for a token and sends nothing without one',
  async ({ page }) => {
    await published(page);
    await markTheCase(page);
    await page.evaluate(() => localStorage.removeItem('atlasfix.token'));
    await page.click('#commitb');
    await expect(page.locator('#mjson')).toContainText('"schema": "gerbil-atlas-correction/1"');
    await page.click('#mbtns button:last-child');           // Commit and push
    await expect(page.locator('#mtitle')).toHaveText('A token to push with');
    await expect(page.locator('#mbody')).toContainText('Contents: read and write');
    await page.click('#mbtns button:first-child');          // Cancel
    await expect(page.locator('#report')).toContainText('no token: nothing was sent');
    expect(page.errors.filter((e) => !String(e).includes('no token'))).toEqual([]);
  });

test('Save on the published page hands over the file itself', async ({ page }) => {
  await published(page);
  await markTheCase(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#saveb').then(() => page.click('#mbtns button:last-child')),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  const fs = require('fs');
  const doc = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(doc.schema).toBe('gerbil-atlas-correction/1');
  expect(doc.plate).toBe(19);
  expect(doc.seeds).toHaveLength(1);
});


// -------------------------------------------------------------- the stale worker
//
// sw.js caches everything under data/ cache-first, names the cache for the build it was
// filled for, and drops the old one when a new worker activates -- but only index.html
// registers it. So a reader who opens fixer.html and not the atlas can be held on a
// worker from an older build, and would be handed that build's database under this
// build's face maps: one plate drawn from two cuts, with nothing to say so.
//
// The page asks for data/ with the build in the query, which a cache filled for another
// build has never seen. This puts that in front of a real worker with a real poisoned
// cache, and checks the worker is still controlling the page while it fails to serve it
// -- otherwise the test would pass for the wrong reason.

const STALE = 'a-previous-build';

// the worker an older build left behind, controlling this page, with that build's
// database still in its cache. Started from fixer.html because it registers no worker
// of its own -- from index.html the current build's worker keeps control and the
// premise never holds.
async function underAnOldWorker(page) {
  await page.goto(PUBLISHED);
  await page.waitForFunction(() => document.title.includes('atlas region fixer'));
  const active = await page.evaluate(async (v) => {
    await navigator.serviceWorker.register('sw.js?v=' + v);
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener('controllerchange', r, {once: true}));
    }
    const c = await caches.open('gae-' + v);
    await c.put(new Request(new URL('data/gerbil_atlas.json', location.href).href),
      new Response('{"stale":true}', {headers: {'Content-Type': 'application/json'}}));
    const reg = await navigator.serviceWorker.getRegistration();
    return reg.active.scriptURL;
  }, STALE);
  expect(active).toContain('sw.js?v=' + STALE);          // it, and not the current one
}

test('a worker from an older build cannot serve this page a stale database',
  async ({ page }) => {
    await underAnOldWorker(page);

    // the premise: that worker does serve its cached data/ to anything that asks plainly
    expect(await page.evaluate(async () =>
      (await (await fetch('data/gerbil_atlas.json')).text()).slice(0, 20))).toBe('{"stale":true}');

    const asked = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.includes('/data/')) asked.push(u.pathname + u.search);
    });
    await page.reload();
    await page.waitForFunction(() => document.title.includes('atlas region fixer'));

    // the page read past it -- this is what fails when the build is not in the query
    await expect(page.locator('#regfact')).toContainText('0.6143 mm² in 2 rings');
    await clickAt(page, SEED);
    await expect(page.locator('#report')).toContainText('face #55 of 4608 px');

    const build = await page.evaluate(() =>
      document.querySelector('meta[name="gae-build"]').content.trim().split(/\s+/)[0]);
    expect(build).toMatch(/^[0-9a-zA-Z-]{4,40}$/);
    expect(asked).toContain('/data/gerbil_atlas.json?v=' + build);
    expect(asked.filter((u) => u.includes('/facemaps/') && !u.endsWith('?v=' + build))).toEqual([]);
    // the plate images are the atlas's own scans, the same in every build, so they are
    // deliberately not versioned: 186 of them is not a download to spend on a stamp
    expect(asked.some((u) => /\/data\/plates\/.*\.jpg$/.test(u))).toBe(true);
  });


// ------------------------------------------------------------------ the guide
//
// The wiki page is where a reader who has never seen this before is told what a
// correction actually corrects. The link has to be on the page itself, and on a phone
// it has to be there without costing the plate a row of its screen -- which it did,
// until the title and the link gave up their words instead.

const GUIDE = 'https://github.com/dstolz/GerbilAtlasExplorer/wiki/Correcting-a-Region';

test('the guide is linked from the page, and opens away from the draft', async ({ page }) => {
  await open(page);
  const a = page.locator('#guide');
  await expect(a).toBeVisible();
  await expect(a).toHaveAttribute('href', GUIDE);
  await expect(a).toHaveAttribute('target', '_blank');       // a draft in hand is not lost
  // useInnerText: the narrow-screen span is in the markup and hidden, and textContent
  // would read both of them
  await expect(a).toHaveText('Guide', {useInnerText: true});
  // and again where a first-time reader is told what the tools are
  await expect(page.locator('#report a')).toHaveAttribute('href', GUIDE);
});

test('on a phone the guide costs the plate no room', async ({ browser }) => {
  await onPhone(browser, async (page) => {
    const a = page.locator('#guide');
    await expect(a).toBeVisible();
    await expect(a).toHaveAttribute('href', GUIDE);
    await expect(a).toHaveText('?', {useInnerText: true});    // the word does not fit
    const box = await page.evaluate(() => {
      const h = document.querySelector('header');
      const rows = new Set([...h.children].map((e) => Math.round(e.getBoundingClientRect().top)));
      return {header: h.getBoundingClientRect().height, rows: rows.size,
        cv: document.getElementById('cv').getBoundingClientRect().height,
        vh: window.innerHeight};
    });
    expect(box.header).toBeLessThan(100);          // two rows, not three
    expect(box.cv).toBeGreaterThan(box.vh * 0.7);  // and the plate keeps the screen
  });
});
