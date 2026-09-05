// tools/atlasfix.py and the page it serves: the plate comes up, a mark can be made on
// it, and what the extraction says about the mark is the pipeline's own answer.
//
// The server is started by playwright.config.js on plate 19 with S1DZ chosen -- the
// case of #77, whose correction file is also tests/python/fixtures. Nothing here
// commits: the marks are made, read against the extraction, and thrown away with the
// browser. `Recut` builds the plate again in a scratch tree, which takes about ten
// seconds, so it has a test of its own rather than a line in another one.
const { test, expect } = require('@playwright/test');

const APP = 'http://127.0.0.1:8771/';
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
    await expect(r).toContainText('recut plate 19: 39 regions');
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
