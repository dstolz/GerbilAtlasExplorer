// The section colored as a map: the invariant the coloring exists for, on all 62 plates,
// and the control, the link and the exports that carry it.
const { test, expect } = require('@playwright/test');
const path = require('path');
/* the plate's overlays live in the view's panel now, and it opens closed */
const panel = p => p.evaluate(() => window.__gae.vpan(true));

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');

test('no two regions that touch are given the same color, on any plate', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BUNDLE + '#p30');
  const out = await page.evaluate(() => {
    const G = window.__gae, bad = [], counts = [];
    let regions = 0;
    for (let p = 1; p <= 62; p++) {
      const M = G.mcBuild(p), R = G.regBuild(p).regs;
      regions += R.length;
      for (const o of R) {
        if (M.by[o.ab] === undefined) bad.push(`p${p} ${o.ab} uncolored`);
        for (const n of (M.adj[o.ab] || [])) {
          // the names the atlas draws no boundary between share a patch, and a patch is
          // one color by construction; every other pair that touches must differ
          if (M.unit[o.ab] !== M.unit[n] && M.by[o.ab] === M.by[n])
            bad.push(`p${p} ${o.ab}/${n} both color ${M.by[o.ab]}`);
        }
      }
      counts.push(M.n);
    }
    return { bad, counts, regions, pal: G.MCPAL.length };
  });
  expect(out.bad).toEqual([]);
  expect(out.regions).toBeGreaterThan(3000);
  // it never asks for more colors than the palette has, and never needs many
  expect(Math.max(...out.counts)).toBeLessThanOrEqual(out.pal);
});

// The invariant again, from the geometry rather than from the app's own adjacency: any two
// regions whose boundaries come within the tolerance the coloring calls touching must wear
// different colors. Brute force over the pairs whose boxes are close enough to matter.
test('two regions that all but touch are never the same color', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BUNDLE + '#p30');
  const bad = await page.evaluate(() => {
    const G = window.__gae, out = [];
    const near = 0.05 * 57;                       // 0.05 mm at 57 px/mm, as the app has it
    const d2 = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
      const ex = p[0] - (a[0] + t * dx), ey = p[1] - (a[1] + t * dy);
      return ex * ex + ey * ey;
    };
    for (const pl of [1, 20, 27, 30, 45, 54, 62]) {
      const M = G.mcBuild(pl), R = G.regBuild(pl).regs;
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
        const o = R[i], q = R[j];
        if (M.unit[o.ab] === M.unit[q.ab] || M.by[o.ab] !== M.by[q.ab]) continue;
        if (o.x0 - q.x1 > near || q.x0 - o.x1 > near || o.y0 - q.y1 > near || q.y0 - o.y1 > near) continue;
        let hit = false;
        for (const g of o.gs) { for (const p of g) {
          for (const h of q.gs) for (let k = 0; k + 1 < h.length; k++)
            if (d2(p, h[k], h[k + 1]) <= near * near) { hit = true; break; }
          if (hit) break;
        } if (hit) break; }
        if (hit) out.push(`p${pl} ${o.ab}/${q.ab}`);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('a region asks for the same color on every plate it is drawn on', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  const keep = await page.evaluate(() => {
    const G = window.__gae;
    let held = 0, seen = 0, prev = null;
    for (let p = 1; p <= 62; p++) {
      const M = G.mcBuild(p);
      if (prev) for (const ab in M.by) if (ab in prev) { seen++; if (prev[ab] === M.by[ab]) held++; }
      prev = M.by;
    }
    return held / seen;
  });
  // without the hashed preference a greedy pass holds about a quarter of them; with it,
  // about half. The threshold is the guard on the preference still being applied.
  expect(keep).toBeGreaterThan(0.4);
});

test('the same plate is the same picture in a second session', async ({ page }) => {
  await page.goto(BUNDLE + '#p27');
  const first = await page.evaluate(() => window.__gae.mcBuild(27).by);
  await page.goto(BUNDLE + '#p30');            // a different plate visited first
  const second = await page.evaluate(() => { window.__gae.mcBuild(45); return window.__gae.mcBuild(27).by; });
  expect(second).toEqual(first);
});

test('the toggle paints every region of the plate and clears it again', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  expect(await page.locator('#mc path').count()).toBe(0);
  expect(await page.locator('#mcw').isVisible()).toBe(false);
  await panel(page); await page.click('#ckmc');
  const n = await page.evaluate(() => window.__gae.regBuild(30).regs.length);
  expect(await page.locator('#mc path').count()).toBe(n);
  expect(await page.locator('#mcw').isVisible()).toBe(true);
  await expect(page.locator('#vinfo')).toContainText('colors');
  // every path is filled, and its stroke is that same fill: the stroke closes the
  // antialiasing seam along a shared edge, it is not a line of its own
  const paths = await page.$$eval('#mc path', ps => ps.map(p => [p.getAttribute('fill'), p.getAttribute('stroke')]));
  expect(paths.every(([f, s]) => /^#[0-9a-f]{6}$/.test(f) && f === s)).toBe(true);
  // it steps with the plate
  await panel(page); await page.click('#ckmc');
  expect(await page.locator('#mc path').count()).toBe(0);
});

test('the second pane is colored on its own plate', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&v=C&cmp=next');
  await expect(page.locator('#mc2 path')).not.toHaveCount(0);
  const [a, b] = await page.evaluate(() => [
    document.querySelectorAll('#mc path').length,
    document.querySelectorAll('#mc2 path').length]);
  const [r30, r31] = await page.evaluate(() => [
    window.__gae.regBuild(30).regs.length, window.__gae.regBuild(31).regs.length]);
  expect(a).toBe(r30);
  expect(b).toBe(r31);
});

test('the link carries the colors and the wash', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&v=C&cw=70');
  const st = await page.evaluate(() => window.__gae.state());
  expect(st.mcOn).toBe(true);
  expect(st.mcWash).toBe(70);
  expect(await page.evaluate(() => document.getElementById('ckmc').checked)).toBe(true);
  expect(await page.evaluate(() => +document.getElementById('mc').style.opacity)).toBeCloseTo(0.7);
  const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h).toContain('v=C');
  expect(h).toContain('cw=70');
  // the wash rides only when it has been moved: the plain toggle writes the short link
  await page.goto(BUNDLE + '#p30&v=C');
  const h2 = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h2).toContain('v=C');
  expect(h2).not.toContain('cw=');
});

test('the SVG export carries the colors as one named group', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&v=C');
  await panel(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  const fs = require('fs');
  const svg = fs.readFileSync(await dl.path(), 'utf8');
  expect(svg).toContain('<g id="region-colors"');
  const pal = await page.evaluate(() => window.__gae.MCPAL);
  for (const c of pal) expect(svg).toContain(`fill="${c}"`);
  expect(svg).toContain('Regions colored so that no two that touch are alike');
  // and does not when the plate is not colored
  await page.goto(BUNDLE + '#p30');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  expect(fs.readFileSync(await dl2.path(), 'utf8')).not.toContain('region-colors');
});

test('the PNG export washes the same colors over the same plate', async ({ page }) => {
  const fs = require('fs');
  // a point that is certainly inside CPu, found the way the app answers a click
  await page.goto(BUNDLE + '#p30');
  const at = await page.evaluate(() => {
    const G = window.__gae, o = G.regBuild(30).by['CPu'];
    for (let y = o.y0; y <= o.y1; y += 2) for (let x = o.x0; x <= o.x1; x += 2)
      if (G.regIn(o, x, y)) return [x, y, G.MCPAL[G.mcBuild(30).by['CPu']]];
    return null;
  });
  expect(at).not.toBeNull();
  const [fx, fy, hex] = at;
  const pixel = async () => {
    await panel(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#epng')]);
    const b64 = fs.readFileSync(await dl.path()).toString('base64');
    return page.evaluate(async ([b64, x, y]) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data;
      return [d[0], d[1], d[2]];
    }, [b64, fx, fy]);
  };
  const plain = await pixel();
  await page.goto(BUNDLE + '#p30&v=C');
  const washed = await pixel();
  // the sheet is the plate with the region's own color laid over it at the wash the
  // toggle turns on at, which is what the screen shows
  const pal = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < 3; i++)
    expect(Math.abs(washed[i] - (0.45 * pal[i] + 0.55 * plain[i]))).toBeLessThan(12);
});
