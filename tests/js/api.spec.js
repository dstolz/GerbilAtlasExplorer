// The pure parts of the app, through the window.__gae handle: the frame transform
// inverts, the deep link round-trips, and every structure solves to a bounded plan.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');

test('toFrame and fromFrame invert each other', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  const worst = await page.evaluate(() => {
    const G = window.__gae; let worst = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let k = 0; k < 100; k++) {
      G.frameSet({ on: true, pitch: rnd(-25, 25), roll: rnd(-10, 10), yaw: rnd(-10, 10),
        pap: rnd(-8, 8), pml: rnd(-2, 2), pdv: rnd(-9, 0), dap: rnd(-1, 1), dml: rnd(-1, 1), ddv: rnd(-1, 1),
        org: k % 2 === 0, oref: k % 4, oap: rnd(-1, 1), oml: 0, odv: rnd(-1, 1) });
      G.frameApply();
      const p = { ap: rnd(-13, 8), ml: rnd(-8, 8), dv: rnd(-10, 1) };
      const q = G.toFrame(p.ap, p.ml, p.dv), r = G.fromFrame(q.ap, q.ml, q.dv);
      worst = Math.max(worst, Math.abs(r.ap - p.ap), Math.abs(r.ml - p.ml), Math.abs(r.dv - p.dv));
    }
    G.frameSet({ on: false }); G.frameApply();
    return worst;
  });
  expect(worst).toBeLessThan(1e-9);
});

test('the frame is the identity when it is off', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  const q = await page.evaluate(() => window.__gae.toFrame(-7.95, 1.31, -8.3));
  expect(q).toEqual({ ap: -7.95, ml: 1.31, dv: -8.3 });
});

test('writeHash and readHash round-trip a full state', async ({ page }) => {
  const hash = '#p44/MSO&z=2.50&c=0.5200,0.6100&v=rgsky&ps=nissl&ct=140&pj=ml&tg=MSO,L,12,-5,7,46,0.1,0,0.2,3.84&ft=0.25&cmp=next&fr=17,0,0,0,0,0,0,0,0,1,0,0,0,0&fo=2';
  await page.goto(BUNDLE + hash);
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  await page.goto(BUNDLE + first);
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(second).toBe(first);
  const st = await page.evaluate(() => window.__gae.state());
  expect(st.cur).toBe(44); expect(st.sel).toBe('MSO'); expect(st.psrc).toBe('nissl');
  expect(st.tgProbe).toBe(3.84); expect(st.tgFoot).toBe(0.25); expect(st.targSide).toBe(-1);
  expect(st.tgTilt).toBe(12); expect(st.cmpOn).toBe(true);
});

test('every structure solves to a bounded plan or to no entry', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto(BUNDLE + '#p30');
  const out = await page.evaluate(() => {
    const G = window.__gae, bad = [], noEntry = [];
    let solved = 0;
    G.select('MSO');
    for (const s of G.S) {
      if (!G.ptsOf[s.abbr]) continue;
      G.select(s.abbr);
      G.tgSolve();
      const o = G.plan();
      if (!o) { bad.push(s.abbr + ':noplan'); continue; }
      if (o.len === undefined) { noEntry.push(s.abbr); continue; }
      solved++;
      if (!(o.len > 0 && o.len < 22 && Number.isFinite(o.deg) && Number.isFinite(o.head) && Number.isFinite(o.E.ap)))
        bad.push(s.abbr);
      if (!o.path || !o.path.segs.length || o.path.segs[o.path.segs.length - 1].to < o.len - 0.03)
        bad.push(s.abbr + ':path');
    }
    return { solved, bad, noEntry: noEntry.length };
  });
  expect(out.bad).toEqual([]);
  expect(out.solved).toBeGreaterThan(690);
  expect(out.noEntry).toBeLessThan(12);
});

test('the along-track path ends in the target and the probe tip is read at its depth', async ({ page }) => {
  await page.goto(BUNDLE + '#p46/MSO&tg=MSO,R,0,0,0,0,0,0,0,3');
  await page.waitForTimeout(400);
  const o = await page.evaluate(() => { const p = window.__gae.plan(); return { last: p.path.segs[p.path.segs.length - 1], tip: p.path.tip, len: p.len }; });
  expect(o.last.ab).toBe('MSO');
  expect(o.tip.from).toBeLessThanOrEqual(3);
  expect(o.tip.to).toBeGreaterThanOrEqual(3);
  const rows = await page.locator('#tpath .tprow').count();
  expect(rows).toBeGreaterThan(5);
});

test('the labels CSV has one row per located label of the list', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  await page.fill('#q', 'MSO');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#elab')]);
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(text.trim().split('\n').length).toBe(8);   // header + the seven MSO labels
});
