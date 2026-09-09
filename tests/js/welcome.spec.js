// The note a reader gets on their first visit, and never again.
//
// This is the one spec that must not use tests/js/gae.js: every other spec opens the page as
// a reader who has already dismissed the note, and what is checked here is what happens when
// nobody has. Pinned are the four things the note exists to say, that it cannot be walked
// past by a click beside it, that dismissing it is remembered, and that the footer links it
// sends the reader to are really there under the names it uses.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');
const LEAN = 'http://127.0.0.1:8765/index.html';

/* a browser that has never been here: the store emptied, then the page come to afresh, since
   emptying it on a page already showing the note tells us nothing about the next visit */
async function first(page, url) {
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.removeItem('gae-welcome'); } catch (_) {} });
  await page.goto('about:blank');
  await page.goto(url);
}

for (const [name, url] of [['bundle', BUNDLE], ['lean', LEAN]]) {
  test.describe(name, () => {
    test('the first visit is met by the note, and the second is not', async ({ page }) => {
      await first(page, url);
      await expect(page.locator('#welc')).toBeVisible();
      expect(await page.evaluate(() => document.getElementById('welc').matches(':modal'))).toBe(true);

      // the four things it is for
      const txt = await page.locator('#welc .db').innerText();
      expect(txt).toContain('Radtke-Schuller');
      expect(txt).toContain('10.1007/s00429-016-1259-0');
      expect(txt).toMatch(/drawn wrong/i);
      expect(txt).toMatch(/still being built/i);
      expect(txt).toContain('Report a drawing error');
      expect(await page.locator('#welc a[href*="doi.org"]').count()).toBe(1);

      // the way out is the button, and it is what the reader arrives on
      const ok = page.locator('#welcok');
      await expect(ok).toHaveText('I understand');
      expect(await page.evaluate(() => document.activeElement.id)).toBe('welcok');

      // the page behind it is not reachable, and a stray click beside the note does not
      // stand in for pressing that button (the click lands on the dialog, so it also moves
      // the focus off it -- which is why it is checked after the focus and not before)
      await page.mouse.click(6, 6);
      await expect(page.locator('#welc')).toBeVisible();

      await ok.click();
      await expect(page.locator('#welc')).toBeHidden();
      expect(await page.evaluate(() => localStorage.getItem('gae-welcome'))).toBe('1');

      // the page is live again the moment it is gone
      await page.fill('#q', 'MSO');
      await page.locator('#list .row').first().click();
      await expect(page.locator('#pn')).toHaveText('Plate 44');

      // coming back is not being asked again
      await page.goto('about:blank');
      await page.goto(url);
      await expect(page.locator('#pi')).toBeVisible();
      await expect(page.locator('#welc')).toBeHidden();
      expect(await page.evaluate(() => window.__gae.welcSeen())).toBe(true);
    });
  });
}

test('escape is a way out too, and counts as having read it', async ({ page }) => {
  await first(page, BUNDLE);
  await expect(page.locator('#welc')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#welc')).toBeHidden();
  /* the note goes when close() is called and the close event that stores is a queued task
     after it, so this route is polled where the button's is read straight off: the button
     stores before it closes, and that is the difference being relied on */
  await expect.poll(() => page.evaluate(() => localStorage.getItem('gae-welcome'))).toBe('1');
  expect(await page.evaluate(() => window.__gae.welcOpen())).toBe(false);
});

test('the footer carries the links the note sends the reader to', async ({ page }) => {
  await first(page, BUNDLE);
  await page.locator('#welcok').click();
  const foot = await page.locator('footer').innerText();
  for (const label of ['Report a drawing error', 'Request a feature', 'Report an issue', 'About the data']) {
    expect(foot).toContain(label);
  }
  await page.locator('#repdb').click();
  await expect(page.locator('#rep')).toBeVisible();
});
