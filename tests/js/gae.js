// Playwright's test, with the reader already past the first-visit note.
//
// The note is a modal, and a modal over the page is a backdrop that swallows every click a
// spec makes -- so without this, adding it would have turned nine green spec files red for a
// reason that has nothing to do with what any of them is about. Every spec but the note's own
// therefore opens the page as a reader who has been here before: the acknowledgement is
// seeded before the page's own script runs, so the note never opens rather than opening and
// being dismissed.
//
// Two ways in, because the specs use both. Most take the `page` fixture, which comes from the
// `context` one; the phone and time-zone specs build a context of their own from `browser`,
// which does not pass through that fixture at all, so newContext is wrapped for as long as
// the test holds the browser and put back after.
//
// GAE_WELCOME must be the value app.js writes (its WELC). If the two ever drift the note
// comes back for every spec at once, and welcome.spec.js says so by name: it asserts the
// stored value, which is the one place that knows both.
const base = require('@playwright/test');

const GAE_WELCOME = '1';

const seen = ctx => ctx.addInitScript(v => {
  try { localStorage.setItem('gae-welcome', v); } catch (_) {}
}, GAE_WELCOME);

const test = base.test.extend({
  context: async ({ context }, use) => {
    await seen(context);
    await use(context);
  },
  browser: async ({ browser }, use) => {
    const make = browser.newContext.bind(browser);
    browser.newContext = async (...a) => { const c = await make(...a); await seen(c); return c; };
    await use(browser);
    browser.newContext = make;
  },
});

module.exports = { test, expect: base.expect, devices: base.devices, GAE_WELCOME };
