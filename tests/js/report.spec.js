// The two report links in the footer. What is pinned here is not the wording -- that will
// drift -- but the three things the dialog is for: the drawing report carries the region and
// the plate in front of the reader, every row the reader was shown is a row of the issue and
// cannot drift from it, and the local path of a page opened from a file never leaves the
// browser for a public tracker.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');
const NEW_ISSUE = 'https://github.com/dstolz/GerbilAtlasExplorer/issues/new';

test('the drawing report names the region, the plate and the outline the plate quotes', async ({ page }) => {
  await page.goto(BUNDLE + '#p35/MGV');
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    document.getElementById('repdb').click();          // the footer link, not the handle
    const G = window.__gae;
    return {
      open: document.getElementById('rep').open,
      dts: [...document.querySelectorAll('#repkv dt')].map(e => e.textContent),
      dds: [...document.querySelectorAll('#repkv dd')].map(e => e.textContent),
      rows: G.repRows(),
      body: G.repBody(),
      href: document.getElementById('repgo').href,
      title: document.getElementById('repsum').value,
      note: document.getElementById('repnb').hidden,
    };
  });
  expect(out.open).toBe(true);
  expect(out.dts).toEqual(['Region', 'Plate', 'Shown as', 'Outline', 'This view', 'Build']);
  expect(out.dds[0]).toContain('(MGV)');
  expect(out.dds[1]).toContain('35 ');
  expect(out.dds[3]).toMatch(/mm² on this plate · boundary/);
  expect(out.note).toBe(true);                          // MGV is drawn on 35, so nothing to flag

  // shown is sent: every row on screen is a row of the issue body, verbatim and in order
  expect(out.rows.length).toBe(out.dts.length);
  out.rows.forEach(([k, v], i) => {
    expect(out.dts[i]).toBe(k);
    expect(out.dds[i]).toBe(v);
    expect(out.body).toContain(`- **${k}:** ${v}`);
  });

  expect(out.title).toBe('Drawing: MGV on plate 35');
  const u = new URL(out.href);
  expect(u.origin + u.pathname).toBe(NEW_ISSUE);
  expect(u.searchParams.get('title')).toBe('Drawing: MGV on plate 35');
  expect(u.searchParams.get('body')).toBe(out.body);
});

test('a page opened from a file sends the hosted link, not the local path', async ({ page }) => {
  await page.goto(BUNDLE + '#p35/MGV');
  await page.waitForTimeout(400);
  const body = await page.evaluate(() => {
    window.__gae.repOpen('draw');
    return window.__gae.repBody();
  });
  expect(body).toContain('- **This view:** https://dstolz.github.io/GerbilAtlasExplorer/#p35/MGV');
  expect(body).not.toContain('file://');
});

test('a feature request carries the view and the build, and none of the drawing report', async ({ page }) => {
  await page.goto(BUNDLE + '#p35/MGV');
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    document.getElementById('repdb').click();
    document.getElementById('repmsg').value = 'the ventral boundary is in the wrong place';
    document.getElementById('rep').close();
    document.getElementById('repfb').click();           // switching mode starts clean
    const G = window.__gae;
    return {
      heading: document.getElementById('reph').textContent,
      msg: document.getElementById('repmsg').value,
      summary: document.getElementById('repsum').value,
      dts: [...document.querySelectorAll('#repkv dt')].map(e => e.textContent),
      body: G.repBody(),
      href: document.getElementById('repgo').href,
    };
  });
  expect(out.heading).toBe('Request a feature');
  expect(out.msg).toBe('');
  expect(out.summary).toBe('Feature: ');
  expect(out.dts).toEqual(['This view', 'Build']);
  expect(out.body).toContain('### What would help');
  expect(out.body).not.toContain('- **Region:**');
  expect(out.body).not.toContain('the ventral boundary is in the wrong place');
  expect(new URL(out.href).origin + new URL(out.href).pathname).toBe(NEW_ISSUE);
});

test('with nothing selected the report still names the plate, and says what it cannot', async ({ page }) => {
  await page.goto(BUNDLE + '#p20');
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    window.__gae.clear();
    document.getElementById('repdb').click();
    return {
      dts: [...document.querySelectorAll('#repkv dt')].map(e => e.textContent),
      region: document.querySelector('#repkv dd').textContent,
      note: document.getElementById('repnb').hidden ? '' : document.getElementById('repnb').textContent,
      summary: document.getElementById('repsum').value,
      body: window.__gae.repBody(),
    };
  });
  expect(out.dts).toEqual(['Region', 'Plate', 'Shown as', 'This view', 'Build']);  // no Outline row
  expect(out.region).toBe('none selected');
  expect(out.note).toContain('No region is selected');
  expect(out.summary).toBe('Drawing: plate 20');
  expect(out.body).toContain('- **Plate:** 20 ·');
  // an undescribed report says so rather than arriving blank
  expect(out.body).toContain('_Not described yet._');
});
