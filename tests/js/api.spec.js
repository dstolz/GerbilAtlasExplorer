// The pure parts of the app, through the window.__gae handle: the frame transform
// inverts, the deep link round-trips, and every structure solves to a bounded plan.
const { test, expect } = require('./gae');
/* the controls these specs drive live in the view's panel, which opens closed */
const panel = p => p.evaluate(() => window.__gae.vpan(true));
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
  const hash = '#p44/MSO&z=2.50&c=0.5200,0.6100&v=rgsky&ps=nissl&ct=140&pj=ml&tg=MSO,L,12,-5,7,46,0.1,0,0.2,3.84&ft=0.25&cmp=next&fr=17,0,0,0,0,0,0,0,0,1,0,0&fo=2';
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
  // the frame rode along: twelve values, pitch first, and the origin on lambda
  const fr = await page.evaluate(() => ({ ...window.__gae.FRAME }));
  expect(fr.on).toBe(true); expect(fr.pitch).toBe(17); expect(fr.org).toBe(true); expect(fr.oref).toBe(1);
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

test('the track is mirrored onto the comparison plate, ghosted against its own plane', async ({ page }) => {
  await page.goto(BUNDLE + '#p46/MSO&tg=MSO,R,0,0,0,0,0,0,0,3');
  await page.waitForTimeout(400);
  const tk = () => page.evaluate(() => document.getElementById('tk').innerHTML);
  const tk2 = () => page.evaluate(() => document.getElementById('tk2').innerHTML);
  expect(await tk2()).toBe('');                        // compare is off: nothing to mirror it onto

  await panel(page);                                    // compare lives in the view's panel
  await page.check('#ckcmp');                           // default: the same plate, another stain
  expect(await tk2()).toBe(await tk());                 // so the same plane, the same drawing

  await page.selectOption('#cmpsel', 'next');            // now a different plate is beside it
  const [a, b] = [await tk(), await tk2()];
  expect(b).not.toBe('');
  expect(b).not.toBe(a);                                // its own ghosting, not a copy of the first
  expect(b).toContain('class="gh"');                     // this track never touches plate 47

  await page.uncheck('#ckcmp');
  expect(await tk2()).toBe('');                          // and it clears when compare goes off
});

test('the labels CSV has one row per located label of the list', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  await page.fill('#q', 'MSO');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#elab')]);
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(text.trim().split('\n').length).toBe(8);   // header + the seven MSO labels
});

// ---------- the gross divisions ----------
// A division has no geometry of its own: its outline is its members' outlines with the
// walls between them dropped. The test that matters is that what gets drawn covers the
// same ground as the members do, since a bug in the edge cancellation would show up as a
// missing lobe or a filled ventricle rather than as an error.

test('a division outlines exactly the ground its members cover', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const G = window.__gae;
    let seed = 20240101;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let checked = 0, worst = 0, worstAt = '', empty = [];
    for (const g of G.GRP) {
      let drawn = 0;
      for (const pl of g.plates) {
        const rg = G.regBuild(pl).by[g.key];
        if (!rg) continue;
        drawn++;
        let bad = 0;
        for (let i = 0; i < 400; i++) {
          const x = rg.x0 + rnd() * (rg.x1 - rg.x0), y = rg.y0 + rnd() * (rg.y1 - rg.y0);
          if (G.regIn(rg, x, y) !== rg.parts.some(p => G.regIn(p, x, y))) bad++;
        }
        checked++;
        if (bad / 400 > worst) { worst = bad / 400; worstAt = g.id + '/p' + pl; }
      }
      if (!drawn) empty.push(g.id);
    }
    return { checked, worst, worstAt, empty };
  });
  expect(out.empty).toEqual([]);
  expect(out.checked).toBeGreaterThan(400);
  // the residue is points landing on a shared boundary, where "inside one region" is a
  // coin toss; anything structural would be orders of magnitude worse than this
  expect(out.worst).toBeLessThan(0.02);
});

test('a division behaves like a structure: card, link, projection, meshes', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/%40hipp');
  await page.waitForTimeout(500);
  const o = await page.evaluate(() => {
    const G = window.__gae, s = G.state();
    G.writeHash();
    return { sel: s.sel, hash: location.hash, name: document.querySelector('.det .dn').textContent,
             label: document.querySelector('.det .da').textContent,
             members: document.querySelectorAll('#gmem .pbtn').length,
             outlined: document.querySelectorAll('#om path.grp').length,
             dots: document.querySelectorAll('#pjl circle').length,
             inCA1: G.grpsOf['CA1'].map(g => g.id) };
  });
  expect(o.sel).toBe('@hipp');
  expect(o.hash).toBe('#p30/%40hipp');
  expect(o.name).toBe('hippocampal formation');
  expect(o.label).toBe('HIPP');
  expect(o.members).toBe(24);
  expect(o.outlined).toBe(1);
  expect(o.dots).toBeGreaterThan(100);
  expect(o.inCA1).toEqual(['hipp']);
});

test('listing a division filters the structure list to its members', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/%40tcx');
  await page.waitForTimeout(400);
  await page.click('#glist');
  await expect(page.locator('#cnt')).toContainText('temporal cortex');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ecsv')]);
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(text.trim().split('\n').length).toBe(9);   // header + the eight temporal fields
  await page.click('#gunf');
  // 724 rather than the published index's 723: SHy is drawn, named and lettered on
  // plates 22-25 and neither printed index lists it. See known_source_discrepancies.
  await expect(page.locator('#cnt')).toContainText('724 of 724');
});

test('a whole says what the atlas draws it as, and a part says whose part it is', async ({ page }) => {
  // plate 20 prints DCl and VCl and no Cl, and the index lists Cl there
  await page.goto(BUNDLE + '#p20/Cl');
  await page.waitForTimeout(400);
  const o = await page.evaluate(() => {
    const G = window.__gae;
    return { nine: G.PARTS.length,
             drawnAs: [...document.querySelectorAll('#det .pp')].map(b => b.dataset.a),
             standIn: G.partsOf['Cl'].stand_in_plates,
             whole: G.wholeOf['DCl'].whole,
             hint: document.querySelector('#vht').textContent,
             outlined: document.querySelectorAll('#om path').length };
  });
  expect(o.nine).toBe(9);
  expect(o.drawnAs).toEqual(['DCl', 'VCl']);
  expect(o.standIn).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
  expect(o.whole).toBe('Cl');
  // not "its printed label was not located": the atlas printed the parts instead
  expect(o.hint).toContain('the atlas draws Cl as DCl and VCl');
  expect(o.hint).not.toContain('not located');
  expect(o.outlined).toBe(0);                       // and with no fold, nothing is outlined
  // the part's card has one Part of button; it selects the whole and stays on the plate
  await page.click('#det .pp[data-a="DCl"]');
  await page.waitForTimeout(200);
  const p = await page.evaluate(() => ({ ...window.__gae.state(),
    partOf: [...document.querySelectorAll('#det .pp')].map(b => b.dataset.a) }));
  expect(p.sel).toBe('DCl'); expect(p.cur).toBe(20); expect(p.partOf).toEqual(['Cl']);
  await page.click('#det .pp[data-a="Cl"]');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__gae.state().sel)).toBe('Cl');
});

test('where the atlas prints the whole itself, the plate is as it was', async ({ page }) => {
  // plate 13 prints Cl and draws its boundary whole: outlined in blue, as before, with the
  // parts' names nowhere on it (12 prints it too, but circled: its labels sit inside a
  // boundary the atlas draws round more than one name, which is another sentence)
  await page.goto(BUNDLE + '#p13/Cl');
  await page.waitForTimeout(400);
  const o = await page.evaluate(() => ({ outlined: document.querySelectorAll('#om path').length,
                                        info: document.querySelector('#vinfo').textContent,
                                        warn: document.querySelector('#vhint').hidden }));
  expect(o.outlined).toBe(1);
  expect(o.info).toContain('outlined');
  expect(o.warn).toBe(true);
});

// ---------- the fold ----------
// Fold parts into wholes reads a whole as its parts together on the plates the atlas draws
// it as them. Like a division, the whole then has no geometry of its own there: its outline
// is the parts' outlines with the wall between them dropped, its labels are theirs pooled
// with its own. What has to hold is the same thing that has to hold for a division -- that
// what is drawn covers exactly the ground the parts do -- and that nothing the plate prints
// is touched: a click on plate 20 still lands on DCl or VCl, and a printed label is still
// one row of the Labels CSV.

test('with the fold on, a whole outlines exactly the ground its parts cover', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&v=F');
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const G = window.__gae;
    let seed = 20260921;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let drawn = 0, worst = 0, worstAt = '', missing = [], inRegs = [];
    for (const r of G.PARTS) {
      for (const pl of r.stand_in_plates.concat(r.shared_plates)) {
        const b = G.regBuild(pl), rg = b.by[r.whole];
        if (!rg || !rg.fold) { missing.push(r.whole + '/p' + pl); continue; }
        drawn++;
        // the union is for the selection only: what is under the pointer is still the part
        if (r.stand_in_plates.includes(pl) && b.regs.some(o => o.ab === r.whole)) inRegs.push(r.whole + '/p' + pl);
        let bad = 0;
        for (let i = 0; i < 400; i++) {
          const x = rg.x0 + rnd() * (rg.x1 - rg.x0), y = rg.y0 + rnd() * (rg.y1 - rg.y0);
          if (G.regIn(rg, x, y) !== rg.parts.some(p => G.regIn(p, x, y))) bad++;
        }
        if (bad / 400 > worst) { worst = bad / 400; worstAt = r.whole + '/p' + pl; }
      }
    }
    return { fold: G.state().foldOn, drawn, worst, worstAt, missing, inRegs,
             cl20: G.regBuild(20).by['Cl'].drawn, cu55: G.regBuild(55).by['Cu'].own };
  });
  expect(out.fold).toBe(true);
  expect(out.missing).toEqual([]);
  expect(out.inRegs).toEqual([]);
  // the 24 stand-in pairs, and the two plates a whole is drawn beside its part on (Cu on
  // 55, La on 27), where the union takes the whole's own outline in as well
  expect(out.drawn).toBe(26);
  expect(out.cl20).toEqual(['DCl', 'VCl']);
  expect(out.cu55).toBe(true);
  expect(out.worst).toBeLessThan(0.02);          // the shared-boundary residue, as for a division
});

test('the fold rides in the link as F, and state() reports it', async ({ page }) => {
  await page.goto(BUNDLE + '#p20/Cl&v=F');
  await page.waitForTimeout(500);
  const o = await page.evaluate(() => {
    const G = window.__gae; G.writeHash();
    return { hash: location.hash, fold: G.state().foldOn, box: document.getElementById('ckfold').checked,
             outlined: document.querySelectorAll('#om path').length,
             badge: document.getElementById('vctln').textContent };
  });
  expect(o.hash).toBe('#p20/Cl&v=F');
  expect(o.fold).toBe(true);
  expect(o.box).toBe(true);
  expect(o.outlined).toBe(1);
  expect(o.badge).toBe('1');                       // the controls button counts it as a setting
  // and a link without the letter arriving by hashchange turns it off again
  await page.evaluate(() => { location.hash = '#p20/Cl'; });
  await page.waitForTimeout(500);
  const p = await page.evaluate(() => ({ fold: window.__gae.state().foldOn,
                                        outlined: document.querySelectorAll('#om path').length }));
  expect(p.fold).toBe(false);
  expect(p.outlined).toBe(0);
});

test('with the fold off the plate says what the atlas drew; with it on the whole is outlined, counted and plotted as its parts', async ({ page }) => {
  await page.goto(BUNDLE + '#p20/Cl');
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => {
    const G = window.__gae;
    return { hint: document.querySelector('#vht').textContent, offer: !!document.getElementById('foldgo'),
             outlined: document.querySelectorAll('#om path').length, by: G.regBuild(20).by['Cl'] === undefined,
             dots: document.querySelectorAll('#pjl circle').length, own: G.PTSA['Cl'].length,
             card: document.querySelector('#det .kv').textContent };
  });
  expect(off.hint).toContain('the atlas draws Cl as DCl and VCl');
  expect(off.offer).toBe(true);
  expect(off.outlined).toBe(0);
  expect(off.by).toBe(true);
  expect(off.dots).toBe(10);                       // Cl's own labels: 12-15 and 27
  expect(off.own).toBe(10);
  expect(off.card).not.toContain('folded');
  await page.click('#foldgo');
  await page.waitForTimeout(500);
  const on = await page.evaluate(() => {
    const G = window.__gae; G.writeHash();
    return { fold: G.state().foldOn, hash: location.hash, warn: document.querySelector('#vhint').hidden,
             info: document.querySelector('#vinfo').textContent,
             outlined: document.querySelectorAll('#om path').length,
             dots: document.querySelectorAll('#pjl circle').length, pooled: G.ptsOf['Cl'].length,
             card: document.querySelector('#det .kv').textContent,
             center: G.coordsOf('Cl'),
             notes: (G.tgSolve(), G.tgNotes().split('\n').find(l => l.startsWith('target'))),
             // the plate is as printed: what is under the pointer on plate 20 is a part
             regs: G.regBuild(20).regs.filter(o => ['Cl', 'DCl', 'VCl'].includes(o.ab)).map(o => o.ab).sort() };
  });
  expect(on.fold).toBe(true);
  expect(on.hash).toBe('#p20/Cl&v=F');
  expect(on.warn).toBe(true);
  expect(on.info).toContain('Cl outlined');
  expect(on.info).toContain('drawn on plate 20 as DCl and VCl, folded into it');
  expect(on.info).toContain('0.256 mm² on this plate');   // DCl's and VCl's areas summed
  expect(on.outlined).toBe(1);
  expect(on.dots).toBe(54);                        // 10 of its own and 22 of each part's
  expect(on.pooled).toBe(54);
  expect(on.card).toContain('folded · 54 labels, 10 of them Cl');
  expect(on.card).toContain('unfolded');
  expect(on.center.n).toBe(54);
  expect(on.notes).toBe('target        Cl (folded: DCl, VCl)  (claustrum)');
  expect(on.regs).toEqual(['DCl', 'VCl']);
  // the fold is the reader's ask, and taking it back puts everything back -- through the
  // box in the plate controls, which open closed
  await panel(page);
  await page.click('#ckfold');
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => ({ fold: window.__gae.state().foldOn,
    outlined: document.querySelectorAll('#om path').length, offer: !!document.getElementById('foldgo'),
    dots: document.querySelectorAll('#pjl circle').length, pooled: window.__gae.ptsOf['Cl'].length }));
  expect(back).toEqual({ fold: false, outlined: 0, offer: true, dots: 10, pooled: 10 });
});

test('the structures CSV carries the fold as five columns after the others, and the Labels CSV does not carry it at all', async ({ page }) => {
  await page.goto(BUNDLE + '#p20/Cl');
  await page.waitForTimeout(500);
  const grab = async id => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#' + id)]);
    return require('fs').readFileSync(await dl.path(), 'utf8');
  };
  const s0 = await grab('ecsv'), l0 = await grab('elab');
  await page.evaluate(() => window.__gae.foldSet(true));
  await page.waitForTimeout(300);
  const s1 = await grab('ecsv'), l1 = await grab('elab');
  const rows0 = s0.split('\r\n'), rows1 = s1.split('\r\n');
  expect(rows1.length).toBe(rows0.length);
  const FOLD = ',"folded_label_AP_bregma_mm","folded_label_ML_abs_mm","folded_label_DV_mm","folded_n_labels","folded_parts"';
  expect(rows1[0]).toBe(rows0[0] + FOLD);
  // every row starts with exactly the row it had: the atlas columns are read off the
  // atlas's own labels whether or not the fold is on
  let filled = 0;
  for (let i = 1; i < rows0.length; i++) {
    expect(rows1[i].startsWith(rows0[i])).toBe(true);
    const tail = rows1[i].slice(rows0[i].length);
    if (rows0[i] && tail !== ',"","","","",""') filled++;
  }
  expect(filled).toBe(9);
  const want = await page.evaluate(() => { const c = window.__gae.coordsOf('Cl');
    return `,"${c.ap.toFixed(2)}","${c.ml.toFixed(2)}","${c.dv.toFixed(2)}","54","DCl VCl"`; });
  const cl = rows1.find(r => r.startsWith('"Cl",')), dcl = rows1.find(r => r.startsWith('"DCl",'));
  expect(cl.endsWith(want)).toBe(true);
  expect(dcl.endsWith(',"","","","",""')).toBe(true);
  // a row of the Labels CSV is a printed label, and the plate prints DCl
  expect(l1).toBe(l0);
});
