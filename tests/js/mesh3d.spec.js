// The two mesh settings: how opaque the structure meshes are drawn, and what decides their
// color. Both belong to a pane, both sit in the folded half of the panel, and both ride in
// the link. The coloring claim -- that a mesh wears the color the plate paints that region --
// is exact rather than a matter of pixels, so it is checked against the very table the
// section is painted from.
const { test, expect } = require('./gae');
const path = require('path');

/* the controls these specs drive live in the view's panel, and the two new ones in the
   folded half of it, so both are opened by hand */
const panel = p => p.evaluate(() => window.__gae.vpan(true));
const adv   = p => p.evaluate(() => window.__gae.adv(true));
const panes = p => p.evaluate(() => window.__gae.panes());
const range = (p, id, v) => p.evaluate(([id, v]) => {
  const s = document.getElementById(id);
  s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, v]);

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');
const SITE = 'http://127.0.0.1:8765/index.html';

// The meshes need the 20 MB volumes file, which only the served page can fetch.
async function meshes(page, hash) {
  await page.goto(SITE + hash);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  await panel(page);
  if (!await page.locator('#v3m').isChecked()) await page.click('#v3m');
  await page.waitForFunction(() => window.__gae.mesh(), null, { timeout: 120000 });
  await page.waitForTimeout(1200);
}
// v3render() draws and returns in the one task, so the buffer is still there to read
const shot = page => page.evaluate(() => { v3render(); return document.getElementById('v3c').toDataURL(); });

// One color per region over all 62 plates, and it is the plate's own: the coloring was
// solved once so that no two regions that touch are alike, and lifting it into the third
// dimension is lifting exactly that table -- not a second solve that could disagree with
// the section under it. No canvas needed, so this one runs against the bundle.
test('a mesh in Plate colors wears the color the plate paints that region', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BUNDLE + '#p30');
  const out = await page.evaluate(() => {
    const G = window.__gae;
    const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const wrong = [], held = {};
    let n = 0;
    for (let p = 1; p <= 62; p++) {
      const M = G.mcBuild(p);
      for (const o of G.regBuild(p).regs) {
        if (M.by[o.ab] === undefined) continue;
        n++;
        const want = G.MCPAL[M.by[o.ab]].toLowerCase();
        const got = hex(G.meshColor(o.ab, { mcol: 'plate' }));
        if (got !== want) wrong.push(`p${p} ${o.ab}: ${got} not ${want}`);
        held[o.ab] = got;
      }
    }
    // a hue off the name is the other mode, and it is neither random nor the plate's
    const each = ab => hex(G.meshColor(ab, { mcol: 'each' }));
    return { wrong: wrong.slice(0, 5), n,
             colors: new Set(Object.values(held)).size,
             stable: each('CPu') === each('CPu'),
             apart: each('CPu') !== hex(G.meshColor('CPu', { mcol: 'plate' })),
             own: each('CPu') !== each('MSO') };
  });
  expect(out.wrong).toEqual([]);
  expect(out.n).toBeGreaterThan(3000);
  expect(out.colors).toBe(8);            // the eight the plate uses, and no ninth
  expect(out.stable).toBe(true);
  expect(out.apart).toBe(true);
  expect(out.own).toBe(true);
});

// A division is the case the modes exist for: a hue apiece is what the view opens on, and
// Selection is the mode that puts its members in one color because they are parts of a
// thing -- which is exactly the picture that will not say which of three hundred structures
// you are looking at, and why it is no longer the default. The selection color comes off the
// stylesheet when the view starts, so this one waits for the view rather than reading it
// out of a page that has never drawn.
test('a division draws in one color, or in as many as it has structures', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BUNDLE + '#p28/%40ctx&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  const out = await page.evaluate(() => {
    const G = window.__gae;
    const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const pal = G.MCPAL.map(h => h.toLowerCase());
    const mem = G.byAb['@ctx'].members.slice(0, 40);
    const n = m => new Set(mem.map(ab => hex(G.meshColor(ab, { mcol: m })))).size;
    const plate = mem.map(ab => hex(G.meshColor(ab, { mcol: 'plate' })));
    return { sel: n('sel'), each: n('each'), members: mem.length,
             // A1 and AAF are printed inside Au1's label and have no region of their own,
             // so the plate colors none of them and the view never asks: their mesh is
             // filed under Au1 and wears Au1's color. Asking anyway is what the fallback
             // answers, and what it answers is the name's own hue -- not nothing.
             off: mem.filter((ab, i) => !pal.includes(plate[i])),
             fallback: hex(G.meshColor('A1', { mcol: 'plate' })) === hex(G.meshColor('A1', { mcol: 'each' })),
             painted: new Set(plate.filter(c => pal.includes(c))).size };
  });
  expect(out.members).toBe(40);
  expect(out.sel).toBe(1);                       // the division's own color, and nothing else
  expect(out.off).toEqual(['A1', 'AAF']);
  expect(out.fallback).toBe(true);
  expect(out.painted).toBeGreaterThan(4);        // as many as the plate gives them
  expect(out.painted).toBeLessThanOrEqual(8);
  // a hue apiece, near enough: the name is hashed into 360 degrees, so out of forty a
  // couple of names land on the same one. What the mode promises is that they are told
  // apart, not that a hue is unique -- Plate colors is where a guarantee lives.
  expect(out.each).toBeGreaterThan(30);
});

test.describe('the controls', () => {
  test('opacity and color change the picture, count on Advanced and ride in the link', async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(SITE + '#p30/CPu&t=v3d');
    await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
    await panel(page); await adv(page);
    // nothing to set while there are no meshes, so the group is not there to be set
    expect(await page.locator('#adv3m').isVisible()).toBe(false);

    await page.click('#v3m');
    await page.waitForFunction(() => window.__gae.mesh(), null, { timeout: 120000 });
    await page.waitForTimeout(1200);
    expect(await page.locator('#adv3m').isVisible()).toBe(true);
    expect(await page.locator('#advn').isVisible()).toBe(false);   // both still at their defaults
    const solid = await shot(page);

    await range(page, 'v3mop', 30);
    expect((await panes(page))[0].mop).toBeCloseTo(.3, 5);
    expect(await page.locator('#v3mopl').textContent()).toBe('30%');
    const thin = await shot(page);
    expect(thin).not.toBe(solid);
    expect(await page.locator('#v3n').textContent()).toContain('30% opacity');
    // the folded section says how much of it is set, or the picture would change with
    // nothing on screen to say why
    expect(await page.locator('#advn').textContent()).toBe('1');

    await page.selectOption('#v3mcol', 'plate');
    expect((await panes(page))[0].mcol).toBe('plate');
    const painted = await shot(page);
    expect(painted).not.toBe(thin);
    expect(await page.locator('#v3n').textContent()).toContain('a color names nothing');

    const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
    expect(h).toContain('&mh=1');
    expect(h).toContain('&mo=30');
    expect(h).toContain('&mc=plate');

    // and back to the defaults: same link as before, same picture as before
    await range(page, 'v3mop', 92);
    await page.selectOption('#v3mcol', 'each');
    expect(await shot(page)).toBe(solid);
    const h0 = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
    expect(h0).toContain('&mh=1');
    expect(h0).not.toContain('&mo=');
    expect(h0).not.toContain('&mc=');
    expect(errors).toEqual([]);
  });

  test('a link carrying either one opens on it, with Advanced unfolded', async ({ page }) => {
    test.setTimeout(180000);
    await meshes(page, '#p30/CPu&t=v3d&mh=1&mo=45&mc=sel');
    const p = (await panes(page))[0];
    expect(p.mop).toBeCloseTo(.45, 5);
    expect(p.mcol).toBe('sel');
    // a folded section must not be the reason the picture looks like that
    expect((await page.evaluate(() => window.__gae.state())).advOn).toBe(true);
    expect(await page.locator('#v3mopl').textContent()).toBe('45%');
    expect(await page.locator('#v3mcol').inputValue()).toBe('sel');
  });

  // The short link: a picture at the default coloring names no color, so the parse has to
  // answer a missing `mc` with the default rather than with nothing.
  test('a link that names no color opens on the default', async ({ page }) => {
    test.setTimeout(180000);
    await meshes(page, '#p30/CPu&t=v3d&mh=1&mo=45');
    const p = (await panes(page))[0];
    expect(p.mop).toBeCloseTo(.45, 5);
    expect(p.mcol).toBe('each');
    expect(await page.locator('#v3mcol').inputValue()).toBe('each');
  });

  test('both settings belong to a pane', async ({ page }) => {
    test.setTimeout(180000);
    await meshes(page, '#p30/CPu&t=v3d');
    await adv(page);
    await page.click('#v3sp');                       // B opens as a copy of A
    await page.click('#v3pseg button[data-p="1"]');
    await range(page, 'v3mop', 20);
    await page.selectOption('#v3mcol', 'plate');
    let q = await panes(page);
    expect(q[0].mop).toBeCloseTo(.92, 5);
    expect(q[0].mcol).toBe('each');
    expect(q[1].mop).toBeCloseTo(.2, 5);
    expect(q[1].mcol).toBe('plate');

    // the toolbar reads back whichever pane it is on
    await page.click('#v3pseg button[data-p="0"]');
    expect(await page.locator('#v3mopl').textContent()).toBe('92%');
    expect(await page.locator('#v3mcol').inputValue()).toBe('each');

    const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
    expect(h).toContain('&mo2=20');
    expect(h).toContain('&mc2=plate');
    expect(h).not.toContain('&mo=');
    expect(h).not.toContain('&mc=');
  });
});
