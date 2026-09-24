// The "In frame" toggle: the projection and the 3-D view drawn in the working frame
// rather than the atlas's. What is checked here is that the turn is opt-in, that it is
// the rotation and nothing else, that the two views share the one setting, and that the
// skull and landmark overlays are redrawn at the frame's angle rather than just moved.
const { test, expect } = require('./gae');
/* the controls these specs drive live in the view's panel, which opens closed */
const panel = p => p.evaluate(() => window.__gae.vpan(true));

const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');
// FKEYS order: pitch, roll, yaw, pivot AP/ML/DV, shift AP/ML/DV, origin AP/ML/DV
const TURNED = '&fr=17,4,3,0,0,-5,0,0,0,0,0,0';
const MOVED = '&fr=0,0,0,0,0,0,0,0,0,1,0,-0.3&fo=2';   // an origin, no angle

const dots = page => page.evaluate(() => document.getElementById('pjl').innerHTML);

test('the In frame box is offered only once an angle is set', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj');
  await page.waitForTimeout(600);
  expect(await page.locator('#pjfw').isVisible()).toBe(false);
  expect(await page.locator('#v3fw').isVisible()).toBe(false);

  // an origin moves no point, so there is still nothing for the box to do
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + MOVED);
  await page.waitForTimeout(600);
  expect(await page.locator('#pjfw').isVisible()).toBe(false);

  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED);
  await page.waitForTimeout(600);
  expect(await page.locator('#pjfw').isVisible()).toBe(true);
  expect(await page.evaluate(() => document.getElementById('ckpf').checked)).toBe(false);
});

test('ticking it turns the cloud, and unticking it puts the cloud back', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED);
  await page.waitForTimeout(800);
  const atlas = await dots(page);
  expect(atlas).toContain('<circle');

  await page.click('#pjfw');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__gae.state().fvOn)).toBe(true);
  const turned = await dots(page);
  expect(turned).not.toBe(atlas);

  await page.click('#pjfw');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__gae.state().fvOn)).toBe(false);
  expect(await dots(page)).toBe(atlas);       // the turn is rigid and exactly undone
});

test('the two views share the one setting', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED);
  await page.waitForTimeout(800);
  await page.click('#pjfw');                          // ticked on the projection
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('v3f').checked)).toBe(true);

  await page.click('#vseg button[data-t="v3d"]');     // and untickable from the 3-D view
  await page.waitForTimeout(600);
  await panel(page); await page.click('#v3fw');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ckpf').checked)).toBe(false);
  expect(await page.evaluate(() => window.__gae.state().fvOn)).toBe(false);
});

test('the skull and landmark overlays turn with the view', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj&v=KL' + TURNED);
  await page.waitForTimeout(800);
  const sk = () => page.evaluate(() => document.getElementById('pjk').innerHTML);
  const atlas = await sk();
  expect(atlas).toContain('<path');
  await page.click('#pjfw');
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({
    sk: document.getElementById('ckpk').disabled,
    lm: document.getElementById('ckplm').disabled,
    names: [...document.querySelectorAll('#pjlm text')].map(t => t.textContent),
  }));
  expect(st).toEqual({ sk: false, lm: false,
    names: ['bregma', 'lambda', 'interaural', 'occipital crest'] });
  // the outline is flattened again at the frame's angle, not the stored one moved
  const turned = await sk();
  expect(turned).toContain('<path');
  expect(turned).not.toBe(atlas);
  // The vault marks are the fitted skull's own heights, turned as points; the outline is
  // the same skull turned and flattened. So each mark has to sit on the outline -- within
  // 0.3 mm (12 plot units), the grid and thinning tolerance of the trace.
  const miss = await page.evaluate(() => {
    const pts = [...document.querySelectorAll('#pjk path')].map(p =>
      p.getAttribute('d').slice(1, -1).split('L').map(q => q.split(' ').map(Number)));
    const seg = (c, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / l));
      return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]); };
    const cs = [...document.querySelectorAll('#pjlm circle')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    return cs.slice(0, -2).map(c => Math.min(...pts.flatMap(L =>
      L.map((a, i) => seg(c, a, L[(i + 1) % L.length])))));
  });
  expect(miss.length).toBe(3);                 // bregma, lambda, occipital crest
  for (const d of miss) expect(d).toBeLessThan(12);
  await page.click('#pjfw');
  await page.waitForTimeout(400);
  expect(await sk()).toBe(atlas);              // and the stored outline is back
});

test('fv=1 rides in the link only beside a rotation', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED);
  await page.waitForTimeout(800);
  await page.click('#pjfw');
  await page.waitForTimeout(300);
  const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h).toContain('&fv=1');

  // the link reopens turned
  await page.goto(BUNDLE + h);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__gae.state().fvOn)).toBe(true);
  expect(await page.evaluate(() => document.getElementById('ckpf').checked)).toBe(true);
  expect(await page.evaluate(() => { window.__gae.writeHash(); return location.hash; })).toBe(h);
});

// its own page: a hash-only goto is a same-document navigation, so a frame set by an
// earlier link in the same test would still be standing
test('fv=1 asked for with no angle to apply stays off and writes nothing', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu&t=proj&fv=1');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__gae.state().fvOn)).toBe(false);
  expect(await page.evaluate(() => document.getElementById('pjfw').hidden)).toBe(true);
  expect(await page.evaluate(() => { window.__gae.writeHash(); return location.hash; })).not.toContain('fv=1');
});

test('the turn is the rotation alone: an origin does not slide the cloud', async ({ page }) => {
  // R(p-C)+A splits as Rp + (A-RC). Only Rp goes on the picture, so moving zero -- which
  // moves no point -- must leave every dot exactly where the rotation alone put it.
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED + '&fv=1');
  await page.waitForTimeout(800);
  const noOrigin = await dots(page);
  await page.goto(BUNDLE + '#p30/CPu&t=proj&fr=17,4,3,0,0,-5,0,0,0,0,0,0&fo=2&fv=1');
  await page.waitForTimeout(800);
  expect(await dots(page)).toBe(noOrigin);
});

test('the plate guide stays clickable when the view is turned', async ({ page }) => {
  // turned, a plate is a plane rather than a single AP, so the guide is a tilted line --
  // and reading a click back through the rotation must still land on that plate
  await page.goto(BUNDLE + '#p30/CPu&t=proj' + TURNED + '&fv=1');
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => document.getElementById('pjg').innerHTML);
  const [, x1, y1, x2, y2] = g.match(/x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/).map(Number);
  expect(Math.abs(x1 - x2)).toBeGreaterThan(1);        // a real tilt, not the old rule
  expect(Math.abs(y1 - y2)).toBeGreaterThan(1);
  const box = await page.locator('#pjw').boundingBox();
  const svg = await page.evaluate(() => {
    const s = document.getElementById('pjs');
    const v = s.getAttribute('viewBox').split(' ').map(Number);
    return { w: v[2], h: v[3], r: s.getBoundingClientRect() };
  });
  await page.mouse.click(svg.r.x + (x1 + x2) / 2 / svg.w * svg.r.width,
                         svg.r.y + (y1 + y2) / 2 / svg.h * svg.r.height);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__gae.state().cur)).toBe(30);
  expect(box).toBeTruthy();
});

test('the 3-D view turns too, and says which orientation it is standing in', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BUNDLE + '#p30/CPu&t=v3d' + TURNED);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  // Render and read in the one task: the drawing buffer is not preserved across frames, so
  // this has to be v3render(), which draws now -- v3frame() only schedules one for the next
  // animation frame, and reading straight after it returns an empty buffer every time.
  const shot = () => page.evaluate(() => { v3render(); return document.getElementById('v3c').toDataURL(); });
  const note = () => page.evaluate(() => document.getElementById('v3n').textContent);

  // In frame sits in the panel at this width, and the panel is in the flow: opening it
  // re-fits the canvas. So it is opened before the first shot, or the two pictures being
  // compared would differ by the resize rather than by the turn.
  await panel(page);
  await page.waitForTimeout(400);
  const atlas = await shot();
  expect(await note()).not.toContain('Standing in your frame');

  await page.click('#v3fw');
  await page.waitForTimeout(500);
  const turned = await shot();
  expect(await note()).toContain('Standing in your frame');
  expect(turned).not.toBe(atlas);
  expect(turned.length).toBeGreaterThan(100000);    // a rendered frame, not a blank buffer

  await page.click('#v3fw');
  await page.waitForTimeout(500);
  expect(await shot()).toBe(atlas);                 // and exactly back, pixel for pixel
  expect(errors).toEqual([]);
});

// Meshes need the 20 MB volumes file, so this one runs against the served page. The mesh
// shader lights from dot(N, cam - p) with p a model-space vertex, the same as the skull
// shell's: the camera it is handed has to be the one restated in model space, or a turned
// view lights every mesh from the wrong side.
test('meshes come along when the view is turned', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8765/index.html#p30/CPu&t=v3d' + TURNED);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  await panel(page); await page.click('#v3m');                                    // fetch and switch on meshes
  await page.waitForFunction(() => window.__gae.mesh(), null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const shot = () => page.evaluate(() => { v3render(); return document.getElementById('v3c').toDataURL(); });

  const atlas = await shot();
  await page.click('#v3fw');                          // panel already open, for #v3m above
  await page.waitForTimeout(800);
  const turned = await shot();
  expect(turned).not.toBe(atlas);

  await page.click('#v3fw');
  await page.waitForTimeout(800);
  expect(await shot()).toBe(atlas);
  expect(errors).toEqual([]);
});
