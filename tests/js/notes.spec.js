// Notes: your own markers on the plates, and the form that writes them.
//
// What is checked here is mostly one bug and its consequences. The plate wrapper takes
// pointer capture on pointerdown so that a drag which leaves the box still pans; capture
// retargets the click that follows to the wrapper, so a press on the form's own Save
// button never reached the button -- the click arrived at the plate instead and acted on
// whatever the form was covering. Nothing could be saved, so nothing was ever listed.
// The second half of it is geometry: the box clips what overhangs it, and a form placed
// against its right edge lost the very buttons you were trying to press.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');
const LEAN = 'http://127.0.0.1:8765/index.html';

/* a page with no notes in it, however the last test left the store. Emptying the store is
   not enough on its own: a link carries the notes while they fit, so the page must be come
   to again by a hash that has none in it rather than reloaded onto the one it wrote. */
async function open(page, url, hash) {
  await page.goto(url + hash);
  await page.evaluate(() => { try { localStorage.removeItem('gae-notes'); } catch (_) {} });
  await page.goto('about:blank');
  await page.goto(url + hash);
  await expect(page.locator('#pi')).toBeVisible();
  expect(await page.evaluate(() => window.__gae.notes().length)).toBe(0);
}

/* Notes on, Add armed, and a click at a fraction of the plate box. Adding the button
   rewraps the toolbar, which resizes the box a frame later, so the box is measured after
   that has settled rather than before. */
async function place(page, fx, fy) {
  await page.check('#ckan');
  await page.click('#anadd');
  await page.waitForTimeout(300);
  const b = await page.locator('#iw').boundingBox();
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
  await expect(page.locator('#anf')).toBeVisible();
}

/* counts the clicks that reach the plate wrapper, which is where a retargeted one lands */
const watchPlate = page => page.evaluate(() => {
  window.__plateClicks = 0;
  document.getElementById('iw').addEventListener('click', () => window.__plateClicks++);
});
const plateClicks = page => page.evaluate(() => window.__plateClicks);

test('Save writes the note, and the press does not reach the plate under it', async ({ page }) => {
  await open(page, BUNDLE, '#p30');
  await place(page, 0.44, 0.46);
  await page.fill('#ant', 'electrode tip');
  await watchPlate(page);
  await page.click('#anf button[type=submit]');
  await expect(page.locator('#anf')).toBeHidden();
  expect(await plateClicks(page)).toBe(0);
  expect(await page.evaluate(() => window.__gae.notes().map(n => [n.p, n.t])))
    .toEqual([[30, 'electrode tip']]);
});

test('Cancel drops the note, Delete removes a saved one, and neither reaches the plate',
  async ({ page }) => {
    await open(page, BUNDLE, '#p30');
    await place(page, 0.44, 0.46);
    await page.fill('#ant', 'never saved');
    await watchPlate(page);
    await page.click('#ancan');
    await expect(page.locator('#anf')).toBeHidden();
    expect(await page.evaluate(() => window.__gae.notes().length)).toBe(0);

    await place(page, 0.5, 0.5);
    await page.fill('#ant', 'lesion');
    await page.click('#anf button[type=submit]');
    await expect(page.locator('#an .note')).toHaveCount(1);
    await page.click('#an .note');                       /* the marker raises it again */
    await expect(page.locator('#ant')).toHaveValue('lesion');
    await expect(page.locator('#andel')).toBeVisible();  /* which a new note does not offer */
    await page.click('#andel');
    await expect(page.locator('#an .note')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gae.notes().length)).toBe(0);
    expect(await plateClicks(page)).toBe(0);
  });

/* the marker says a note is there and no more: its text belongs to the form it raises */
test('a note draws as a marker, not as its own text across the plate', async ({ page }) => {
  await open(page, BUNDLE, '#p30');
  await place(page, 0.44, 0.46);
  await page.fill('#ant', 'electrode tip');
  await page.click('#anf button[type=submit]');
  const g = page.locator('#an .note');
  await expect(g).toHaveCount(1);
  expect(await g.locator('title').textContent()).toBe('electrode tip');
  expect(await page.locator('#an').innerHTML()).not.toContain('<text');
  const box = await g.boundingBox();
  expect(box.width).toBeGreaterThan(6);       /* big enough to aim at */
  expect(box.width).toBeLessThan(60);         /* small enough not to bury the drawing */
});

test('the form stays inside the box that clips it, wherever the note is put',
  async ({ page }) => {
    await open(page, BUNDLE, '#p30');
    await place(page, 0.98, 0.97);            /* the far corner, where it would hang off */
    const f = await page.locator('#anf').boundingBox();
    const b = await page.locator('#iw').boundingBox();
    expect(f.x).toBeGreaterThanOrEqual(b.x - 0.5);
    expect(f.x + f.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
    expect(f.y + f.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
    /* and it follows the point when the view moves under it */
    await page.click('#zi');
    await page.waitForTimeout(200);
    const z = await page.locator('#anf').boundingBox();
    expect(z.x + z.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
    await page.click('#ancan');               /* every button still reachable */
    await expect(page.locator('#anf')).toBeHidden();
  });

test('a saved note is listed in the Notes pane, and the row raises it', async ({ page }) => {
  await open(page, BUNDLE, '#p44');
  await place(page, 0.5, 0.55);
  await page.fill('#ant', 'lesion, left MSO');
  await page.click('#anf button[type=submit]');

  await page.click('#mseg button[data-m="notes"]');
  const row = page.locator('#anlist .anrow');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('plate 44');
  await expect(row).toContainText('lesion, left MSO');
  await expect(page.locator('#ancnt')).toContainText('1 note');

  /* from another view the row comes back to the plate the note is on and opens it */
  await page.click('#vseg button[data-t="proj"]');
  await row.click();
  await expect(page.locator('#plateview')).toHaveClass(/\bon\b/);
  await expect(page.locator('#pn')).toHaveText('Plate 44');
  await expect(page.locator('#ant')).toHaveValue('lesion, left MSO');
});

test('a note kept in the browser is still there after a reload', async ({ page }) => {
  await open(page, LEAN, '#p30');
  await place(page, 0.44, 0.46);
  await page.fill('#ant', 'electrode tip');
  await page.click('#anf button[type=submit]');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gae-notes')).length)).toBe(1);
  await page.reload();
  await page.click('#mseg button[data-m="notes"]');
  await expect(page.locator('#anlist .anrow')).toHaveCount(1);
  await expect(page.locator('#an .note')).toHaveCount(1);
});
