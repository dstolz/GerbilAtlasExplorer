// Two 3-D panes on one canvas: what each pane holds of its own, and what the lock shares.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');

// The stack is built on first sight of the view and takes a few seconds under swiftshader.
// v3ready is a module-scope `let` in a classic script, so it is not a property of window:
// the bare identifier is what resolves to it, the same way the other 3-D specs wait.
async function open(page, hash) {
  await page.goto(BUNDLE + hash);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
}

// A drag on the canvas, in the middle of the pane's own rectangle. The handlers read
// clientX/clientY and nothing else, so this is the same path a mouse takes.
async function drag(page, pane, dx, dy) {
  await page.evaluate(([pane, dx, dy]) => {
    const cv = document.getElementById('v3c'), b = document.getElementById('v3w').getBoundingClientRect();
    const r = window.__gae.v3rects()[pane];
    const x = b.left + r[0] + r[2] * 0.5, y = b.top + r[1] + r[3] * 0.5;
    const o = { pointerId: 11, bubbles: true, button: 0, pointerType: 'mouse' };
    cv.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x, clientY: y }));
    cv.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x + dx, clientY: y + dy }));
    cv.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x + dx, clientY: y + dy }));
  }, [pane, dx, dy]);
}

const panes = page => page.evaluate(() => window.__gae.panes());
const st = page => page.evaluate(() => window.__gae.state());

test.describe('the second 3-D pane', () => {
  test('splits into two rectangles that tile the view, and folds back to one', async ({ page }) => {
    await open(page, '#p30&t=v3d');
    expect((await page.evaluate(() => window.__gae.v3rects())).length).toBe(1);
    expect(await page.locator('#v3pn').isVisible()).toBe(false);
    expect(await page.locator('#v3pseg').isVisible()).toBe(false);

    await page.click('#v3sp');
    const r = await page.evaluate(() => window.__gae.v3rects());
    const w = await page.evaluate(() => document.getElementById('v3w').clientWidth);
    const h = await page.evaluate(() => document.getElementById('v3w').clientHeight);
    expect(r.length).toBe(2);
    expect(r[0][2] + r[1][2]).toBe(w);          // side by side in a landscape view,
    expect(r[0][3]).toBe(h);                    // and each the full height of it
    expect(await page.locator('#v3pn').isVisible()).toBe(true);
    expect(await page.locator('#v3pseg').isVisible()).toBe(true);
    expect(await page.locator('#v3lkw').isVisible()).toBe(true);

    await page.click('#v3sp');                  // and back
    expect((await page.evaluate(() => window.__gae.v3rects())).length).toBe(1);
    expect(await page.locator('#v3pn').isVisible()).toBe(false);
    expect((await st(page)).v3ed).toBe(0);
  });

  test('the second pane opens as a copy, then holds its own properties', async ({ page }) => {
    await open(page, '#p30&t=v3d');
    // set the one pane away from the defaults first, so a copy is visibly a copy
    await page.click('#m3seg button[data-r="volume"]');
    await page.click('#v3h');
    await page.click('#v3sp');
    let p = await panes(page);
    expect(p[1].mode).toBe('volume');
    expect(p[1].half).toBe(true);

    // now B alone goes back to contours over a slab; A must not move
    await page.click('#v3pseg button[data-p="1"]');
    await page.click('#m3seg button[data-r="contour"]');
    // the slab ends are range inputs, so the value is set and the event sent by hand
    await page.evaluate(() => {
      const s = document.getElementById('v3a');
      s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    p = await panes(page);
    expect(p[0].mode).toBe('volume');
    expect(p[0].a).toBe(0);
    expect(p[1].mode).toBe('contour');
    expect(p[1].a).toBe(19);

    // and the toolbar reads back whichever pane it is on
    await page.click('#v3pseg button[data-p="0"]');
    expect(await page.locator('#m3seg button[data-r="volume"]').getAttribute('class')).toContain('on');
    expect(await page.locator('#v3a').inputValue()).toBe('1');
  });

  test('unlocked the panes turn separately; locked they turn together and hold their angle', async ({ page }) => {
    await open(page, '#p30&t=v3d');
    await page.click('#v3sp');
    await page.click('#v3lk');                          // lock off
    expect((await st(page)).v3lock).toBe(false);

    const a0 = (await panes(page)).map(p => p.az);
    await drag(page, 0, 60, 0);
    const a1 = (await panes(page)).map(p => p.az);
    expect(a1[0]).not.toBe(a0[0]);
    expect(a1[1]).toBe(a0[1]);                          // B stayed exactly where it was
    expect((await st(page)).v3ed).toBe(0);              // and the drag chose the pane

    await page.click('#v3lk');                          // lock on
    const gap = a1[1] - a1[0];
    await drag(page, 1, -80, 40);
    const a2 = (await panes(page)).map(p => p.az);
    expect(a2[1]).not.toBe(a1[1]);
    expect(a2[0]).not.toBe(a1[0]);                      // both turned
    expect(a2[1] - a2[0]).toBeCloseTo(gap, 9);          // by the same amount

    // neither pane can be driven past the pole, whichever one is dragged
    await drag(page, 1, 0, 4000);
    for (const p of await panes(page)) expect(Math.abs(p.el)).toBeLessThanOrEqual(1.5531);

    // reset is the one that converges them: back to the one default
    await page.click('#v3r');
    const p3 = await panes(page);
    expect(p3[0].az).toBe(p3[1].az);
    expect(p3[0].el).toBe(p3[1].el);
    expect(p3[1].view).toBe('obl');
  });

  test('a link carries both panes, and a one-pane link is the link it always was', async ({ page }) => {
    await open(page, '#p30&t=v3d&r2=volume&sl2=20,45&hf2=1&vp2=dors&sp=2&lk=0');
    const s = await st(page), p = await panes(page);
    expect(s.v3two).toBe(true);
    expect(s.v3ed).toBe(1);                             // sp=2: the toolbar was on B
    expect(s.v3lock).toBe(false);
    expect(p[0]).toMatchObject({ mode: 'contour', a: 0, b: 61, half: false, view: 'obl' });
    expect(p[1]).toMatchObject({ mode: 'volume', a: 19, b: 44, half: true, view: 'dors' });
    // the toolbar is showing B, not A
    expect(await page.locator('#v3b').inputValue()).toBe('45');
    expect(await page.locator('#v3h').isChecked()).toBe(true);

    await page.evaluate(() => window.__gae.writeHash());
    expect(await page.evaluate(() => location.hash))
      .toBe('#p30&t=v3d&r2=volume&sl2=20,45&hf2=1&vp2=dors&sp=2&lk=0');

    // fold the second pane away and the link is the one pane it has always been
    await page.click('#v3sp');
    await page.evaluate(() => window.__gae.writeHash());
    const h = await page.evaluate(() => location.hash);
    expect(h).not.toContain('sp=');
    expect(h).not.toContain('2=');
  });

  test('each pane draws its own picture', async ({ page }) => {
    await open(page, '#p30&t=v3d');
    // v3render() draws and returns in the one task, so the buffer is still there to read
    const shot = () => page.evaluate(() => { v3render(); return document.getElementById('v3c').toDataURL(); });
    await page.click('#v3sp');
    const both = await shot();
    await page.click('#v3pseg button[data-p="1"]');
    await page.click('#m3seg button[data-r="volume"]');
    const mixed = await shot();
    expect(mixed).not.toBe(both);                       // B changed, so the canvas did

    await page.click('#v3sp');                          // one pane again, one picture
    const single = await shot();
    expect(single).not.toBe(mixed);
  });
});
