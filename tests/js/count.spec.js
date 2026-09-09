// Where the visitor count phones home from, and where it does not.
//
// The block in `src/app.html`'s head loads GoatCounter, and two things gate it: a site
// code, which is empty as it ships, and the host the page is being served from. The empty
// code is why the built pages count nothing -- and why a spec that only opened them would
// pass for the wrong reason. So the block is lifted verbatim out of the built page and
// served here with a code filled in, once from a host that is not the site and once from
// the site itself. What that pins is the guard beside the code, and the guard is the whole
// reason this is settled in the browser: `gerbil_atlas_explorer.html` is the offline bundle
// as much as it is the page Pages serves, and a copy on somebody's disk, on a rig computer
// or on a fork's own site has no business counting.
//
// Nothing here reaches the network. gc.zgo.at is intercepted and answered with an empty
// script, and the two hosts serve the block itself rather than anything fetched.
const { test, expect } = require('./gae');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BUNDLE = 'file://' + path.join(ROOT, 'gerbil_atlas_explorer.html');
const LEAN = 'http://127.0.0.1:8765/index.html';
const SITE = 'https://dstolz.github.io/gerbil_atlas_explorer.html';
const ELSEWHERE = 'https://atlas.example/gerbil_atlas_explorer.html';

// the block as it was built, so this cannot drift from what ships
const BLOCK = /<script>\(function\(\)\{var CODE=[\s\S]*?\}\)\(\);<\/script>/
  .exec(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))[0];

/* every request to GoatCounter, answered without leaving the machine */
async function stub(page) {
  const hits = [];
  await page.route('https://gc.zgo.at/**', r => {
    hits.push(r.request().url());
    return r.fulfill({ contentType: 'application/javascript', body: '' });
  });
  return hits;
}

/* the block, with a site code filled in, served as a page of its own from `url` */
const serve = (page, url, code) => page.route(url, r => r.fulfill({
  contentType: 'text/html',
  body: '<!doctype html><meta charset="utf-8"><title>count</title>'
        + BLOCK.replace("var CODE=''", "var CODE='" + code + "'"),
}));

/* whether the block put the counter on the page: it decides while the head is parsed, so by
   the time the page has loaded the tag is either there or it was never going to be */
const tag = page => page.evaluate(() => {
  const s = document.querySelector('script[data-goatcounter]');
  return s && s.dataset.goatcounter;
});

test('a code, on the site: the count is fetched, from the site\'s own endpoint', async ({ page }) => {
  const hits = await stub(page);
  await serve(page, SITE, 'spec');
  const fetched = page.waitForRequest('https://gc.zgo.at/count.js');
  await page.goto(SITE);
  await fetched;
  expect(await tag(page)).toBe('https://spec.goatcounter.com/count');
  expect(hits).toEqual(['https://gc.zgo.at/count.js']);
});

test('a code, anywhere else: nothing is fetched', async ({ page }) => {
  const hits = await stub(page);
  await serve(page, ELSEWHERE, 'spec');
  await page.goto(ELSEWHERE);
  expect(await tag(page)).toBe(null);
  expect(hits).toEqual([]);
});

for (const [name, url] of [['bundle', BUNDLE], ['lean', LEAN]]) {
  test(`the ${name} as it ships counts nothing`, async ({ page }) => {
    const hits = await stub(page);
    await page.goto(url);
    expect(await tag(page)).toBe(null);
    expect(hits).toEqual([]);
  });
}
