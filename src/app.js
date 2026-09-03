const DB = window.__ATLAS__, IMG = window.__IMG__;
/* ---------- which of the three plates a level is shown as ----------
   The atlas prints each level three times: the Nissl section, the Gallyas myelin section
   beside it, and the drawing traced over them. All three carry the atlas's own printed
   coordinate box and all three were cropped to it, so they are registered to each other
   by construction rather than by fitting -- the drawing's contours land on the cell and
   fibre boundaries they were drawn from. That is what makes the switch worth having:
   every overlay the app draws, and every printed label whose position it knows, is still
   in the right place on a plate with no labels printed on it at all.

   A build without the histology falls back to the drawing rather than showing a blank,
   and the buttons for the missing sources take themselves out of the toolbar. */
const SRC={drawing:IMG, nissl:window.__NISSL__, myelin:window.__MYELIN__};
const SRCN={drawing:'labelled drawing', nissl:'Nissl section', myelin:'myelin section'};
let psrc='drawing', pgrey=false, pctr=100;
const srcOK = k => !!(SRC[k] && SRC[k][1]);
const plateImg = n => ((srcOK(psrc)?SRC[psrc]:IMG)[n])||'';
/* grey and contrast are a display filter, not a second copy of the image: the same string
   goes on the <img> and on the canvas the PNG export draws through, so what is saved is
   what was on screen. */
const plateFilter = () =>
  ((pgrey?'grayscale(1) ':'')+(pctr!==100?`contrast(${pctr}%)`:'')).trim() || 'none';
const S = DB.structures, P = DB.plates, AL = DB.aliases, LB = window.__BOX__;
/* Where a printed label points. An abbreviation the atlas could not fit inside the
   region it names is set outside it, with a thin line drawn from the word back into
   the region -- 215 of the 6,266 labels. For those the box says where the word is and
   this says where the structure is; see `label_leaders` and tools/label_leaders.py.
   Keyed by plate, then abbreviation, as [i, x, y] against that abbreviation's list in
   __BOX__ on the same plate. Labels without a line are absent: their box is the
   position. */
const LD = window.__LEAD__ || {};
/* the box a label points from, and the point it points at, which for most is the box */
const ldAt = (p,ab,i) => (((LD[p]||{})[ab])||[]).find(v=>v[0]===i);
const ptAt = (p,ab,i,b) => { const v=ldAt(p,ab,i); return v?[v[1],v[2]]:[b[0],b[1]]; };
/* the outline of each plate's section, as image fractions like the label boxes. A build
   without it loses the track planner and nothing else. */
const OUTLINE = window.__OUTLINE__ || {};
const NW=1100, NH=703;
const byAb = Object.fromEntries(S.map(r=>[r.abbr,r]));
const plateOf = {}; P.forEach(p=>plateOf[p.plate]=p);
const SYSLIST = [...new Set(S.flatMap(r=>r.systems))].sort();

/* ---------- the names the atlas prints that name no region ----------
   A fissure or a sulcus is the cleft *between* two regions and is drawn as the line
   between them; `cbw` is the white matter core of whichever lobule it runs through and
   not a lobule beside them; a vessel is not brain. Twenty of the 723 names are one of
   those, and none of them has ground of its own. What they were being given was the
   lobule's -- `cbw` alone held 170 mm2 of cerebellum, which left `Crus2` a wedge of its
   own lobule -- so the extraction hands it back to the regions around them; see
   `features` and tools/build_region_extents.py.

   They are otherwise structures like any other: indexed, searched, filtered by system,
   located on every plate that prints them, plotted in the projection and in the label
   cloud, and written into the label table. What they have no claim on is area, so there
   is no outline to draw, no area to quote, no volume and no mesh, and hovering or
   selecting one marks every place the plate prints the name -- which is the whole of
   what the atlas says about where it is. */
const FEAT = DB.features||{}, FEATK = DB.feature_kinds||{};
const isFeat = a => !!FEAT[a];
/* the sentence one is read by: "a cleft between regions, not a region" */
const featTxt = a => FEATK[FEAT[a]]||'';
/* how many of the 723 are regions at all, which is the denominator every count of what
   has an outline, a volume or a mesh belongs over */
const NREG = S.length - S.filter(r=>isFeat(r.abbr)).length;

/* ---------- superstructures ----------
   The published atlas names structures and no containers for them: there is no
   "hippocampus" in the index, only CA1, CA2, CA3, DG and their layers. A superstructure
   is a named list of the atlas's own abbreviations and nothing else -- no geometry of its
   own. Its outline is the union of its members' outlines, its area the sum of their areas,
   its coordinates the median of their printed labels, its mesh their meshes. So anything
   it says can be traced back to something the atlas drew, and it cannot claim a boundary
   the atlas does not print. They are an addition here, not part of the atlas; groups
   overlap on purpose, so the brainstem holds everything the midbrain, pons and medulla do.

   A group is keyed `@id` so nothing can collide with an abbreviation, and its record is
   filed in byAb beside the structures': every reader of byAb[sel] -- the card, the plate
   strip, the deep link, the exports -- then works on one without knowing it is one. */
const GRP = DB.groups || [];
GRP.forEach(g=>{ g.grp=true; g.key='@'+g.id; byAb[g.key]=g; });
const GOK = GRP.length>0;
const isGrp = a => !!(a&&byAb[a]&&byAb[a].grp);
/* what to call the selection in a sentence, and what colour it is drawn in. `@ctx` is a
   key and not a name anybody would read, so a division is called by its name. */
const selName = () => !sel ? '' : isGrp(sel) ? byAb[sel].name : sel;
const selHue  = () => isGrp(sel) ? 'teal' : 'blue';
/* the same two colours the stylesheet gives --mark and --markg, spelled out for the
   canvas and the SVG, which are written to a file and cannot read a custom property */
const MARKC='#0a5cff', MARKG='#0097a7';
const markC = a => (a===undefined?isGrp(sel):isGrp(a)) ? MARKG : MARKC;
const markF = (a,o) => (markC(a)===MARKG?'rgba(0,151,167,':'rgba(10,92,255,')+o+')';
/* and the other way about: the divisions a structure is in, which is how its own card
   offers them. A structure can be in several -- the pons and the brainstem, the
   olfactory areas and the bulb -- so this is a list and not a parent. */
const grpsOf={};
GRP.forEach(g=>g.members.forEach(a=>(grpsOf[a]||(grpsOf[a]=[])).push(g)));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const $ = i => document.getElementById(i);

/* ---------- stereotaxic calibration ----------
   Every plate carries the atlas's own printed coordinate box, and the frame-relative
   cropping puts all 62 into one frame, so a single linear map serves the whole series.
   The map now lives in the database as plate_frame, least-squares fitted to the 1 mm
   tick lattice on all 62 plates (56.999 px/mm about x=520.0 for ML, 56.798 px/mm about
   y=95.81 for DV 0, worst tick residual 0.42 px), so it is stated in one place rather
   than carried in the code. Checked against anatomy, not just the fit: midline
   structures (3V, Aq, 4V, cc, MnR) land within 0.1 mm of ML 0 and bilateral pairs come
   out symmetric (MSO +/-1.33, LSO +/-1.67, Au1 +/-6.48). */
const FR=DB.plate_frame;
const ML_X0=FR.ml_zero_px, ML_PXMM=FR.ml_px_per_mm,
      DV_Y0=FR.dv_zero_px-FR.dv_px_per_mm, DV_PXMM=FR.dv_px_per_mm;
const toML = x => (x-ML_X0)/ML_PXMM,   fromML = m => m*ML_PXMM+ML_X0;
const toDV = y => 1-(y-DV_Y0)/DV_PXMM, fromDV = v => (1-v)*DV_PXMM+DV_Y0;
const BX0=10, BX1=1032, BY0=10.5, BY1=692.5;   /* the printed coordinate box */
const sgn = v => (v<0?'':'+')+v.toFixed(2);

/* The AP landmarks the atlas prints, taken off the plate table rather than copied out of
   the prose. Every plate carries its own bregma, lambda, interaural and occipital-crest
   coordinate, and the constant offset is just the difference, so this stays in step with
   the data the way plate_frame does. Each entry is [name, mm anterior of bregma]. */
const LM=[['Bregma','bregma'],['Lambda','lambda_'],
          ['Interaural','interaural'],['Occipital crest','occipital_crest']]
  .map(([n,k])=>[n, +(P[0][k]-P[0].bregma).toFixed(2)]);
const LMof = n => LM.find(t=>t[0]===n)[1];

/* A height to go with each of those APs. The atlas publishes none -- it prints an AP for
   all four landmarks and a DV for none -- so these come off the fitted skull the Skull
   overlays are drawn from, and carry its approximation while the APs stay exact.

   For bregma, lambda and the occipital crest that is the vault at the landmark's AP: the
   bone you touch down on, a couple of tenths either side of the atlas's DV zero. The
   interaural line is the one that is not a surface at all. It is the ear-bar axis, running
   between the ear canals about 9 mm ventral to the dorsal plane the atlas measures DV from,
   so a frame zeroed or pivoted on it with DV left at 0 is out by the whole of that -- which
   is the reason this table exists. Null where the skull data is missing, and the picker
   below then does not appear. */
const SKLM=(window.__SKULL__||{}).lm;
const LMDV=LM.map(([n])=>{ if(!SKLM) return null;
  const k=n.toLowerCase();
  if(k==='interaural') return SKLM.ear&&Number.isFinite(SKLM.ear.dv)
    ? {dv:SKLM.ear.dv, t:'ear-bar plane',
       w:'the ear-bar axis, roughly 9 mm ventral to the brain, from the skull fit'} : null;
  const v=SKLM.vault&&SKLM.vault[k];
  return Number.isFinite(v) ? {dv:v, t:'skull surface',
    w:'the vault at this landmark, from the skull fit -- a zero taken on bone'} : null;
});

/* ---------- the working stereotaxic frame ----------
   The atlas is cut perpendicular to the brainstem axis, which is not how a head sits in
   any particular stereotaxic frame. Given the orientation of the frame actually in use,
   the coordinates below can be restated in it. This is a rigid rotation of the published
   numbers about a pivot, plus a translation -- not a resectioning. The plate images stay
   exactly where they are and nothing here can show an oblique cut: sections are 350 um
   apart against about 17.5 um within a plate, so a cut at an angle would be interpolation
   rather than anatomy.

   Each rotation is named by what it does to the animal rather than by a sign rule, because
   (AP, ML, DV) in that order is left-handed and a handedness convention would invite the
   very error the dialog's preview exists to catch:
     pitch  about ML, + = nose down        roll  about AP, + = right ear down
     yaw    about DV, + = nose to the right
   Composed yaw, then pitch, then roll. Rotations do not commute, so the order is part of
   the definition -- though at a few degrees of roll and yaw it is far below anything that
   could be read off a manipulator.

   The matrix is orthogonal, so fromFrame() transposes rather than inverting: the round
   trip is exact and there is no second set of formulae to derive and keep in step.

   Two ways to say where zero is, because there are two ways a rig gets set up.
     org off -- zero is fixed in space where the atlas origin started, and the brain turns
       about the pivot under it. This is the reading you want if you zeroed before tilting.
     org on  -- zero is a named point of the animal: drive to lambda with the head already
       in the frame, zero there, and lambda reads 0/0/0 however the head is turned.
   The second makes the pivot irrelevant, and not by choice: R(P-piv)+piv - [R(O-piv)+piv]
   is R(P-O) for every piv, so re-zeroing on a point IS rotating about it. Hence fCen/fAdd
   rather than two copies of the formulae -- one centre to subtract, one vector to add
   back, and toFrame/fromFrame never learn which mode they are in. */
const FRAME={on:false,pitch:0,roll:0,yaw:0,pap:0,pml:0,pdv:0,dap:0,dml:0,ddv:0,
             org:false,oref:0,oap:0,oml:0,odv:0};
let FRM=null;
/* The origin is stored the way a rig is actually set up: a landmark the atlas prints an
   AP for, plus however far off it you really zeroed. oref names the landmark, oap/oml/odv
   are the offset from it. Bregma is entry 0 and its offset is 0, so a stored frame or a
   link written before oref existed reads back unchanged. The atlas prints no ML or DV for
   any of these landmarks, so on those two axes the offset is the whole story. */
const oAbs = () => [FRAME.oap-LM[FRAME.oref][1], FRAME.oml, FRAME.odv];
/* Whether any point actually moves. A re-zero does not: it renames where 0 is and leaves
   every distance and every angle exactly as the atlas printed them, which is why the
   views below can honour one by relabelling an axis rather than redrawing anything. A
   rotation does move points -- so the plate, which is an image, can only say so, while
   the two views that draw from coordinates can offer to be turned into it. */
const rotated = () => !!(FRAME.pitch||FRAME.roll||FRAME.yaw);
const shifted = () => FRAME.on && !rotated();
/* A frame with a rotation actually in it. Those views cannot draw one in atlas
   coordinates, but they can be turned into the frame instead -- which is what fview
   asks for. Off by default: the atlas orientation is the one every published figure is
   in, so a view only leaves it when told to, and only while there is a turn to make. */
const turned = () => FRAME.on && rotated();
let fview=false;
const fvOn = () => fview && turned();
const m3=(a,b)=>{ const o=new Array(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let t=0;
    for(let k=0;k<3;k++) t+=a[i*3+k]*b[k*3+j]; o[i*3+j]=t; } return o; };
function frmBuild(){
  const d=Math.PI/180;
  const cp=Math.cos(FRAME.pitch*d), sp=Math.sin(FRAME.pitch*d);
  const cr=Math.cos(FRAME.roll *d), sr=Math.sin(FRAME.roll *d);
  const cy=Math.cos(FRAME.yaw  *d), sy=Math.sin(FRAME.yaw  *d);
  FRM=m3([1,0,0, 0,cr,sr, 0,-sr,cr],
      m3([cp,0,sp, 0,1,0, -sp,0,cp],
         [cy,-sy,0, sy,cy,0, 0,0,1]));
}
frmBuild();
/* the point the rotation is taken about, and what is added back afterwards. With an origin
   the point is the origin and nothing is added back but the offset, so the origin reads
   0/0/0; without one it is the pivot, added back so the atlas origin keeps its old place. */
const fCen = () => FRAME.org ? oAbs()
                             : [FRAME.pap,FRAME.pml,FRAME.pdv];
const fAdd = () => FRAME.org ? [FRAME.dap,FRAME.dml,FRAME.ddv]
                             : [FRAME.pap+FRAME.dap,FRAME.pml+FRAME.dml,FRAME.pdv+FRAME.ddv];
function toFrame(ap,ml,dv){                     /* atlas millimetres -> working frame */
  if(!FRAME.on) return {ap,ml,dv};
  const M=FRM, C=fCen(), A=fAdd(), a=ap-C[0], m=ml-C[1], v=dv-C[2];
  return {ap:M[0]*a+M[1]*m+M[2]*v+A[0],
          ml:M[3]*a+M[4]*m+M[5]*v+A[1],
          dv:M[6]*a+M[7]*m+M[8]*v+A[2]};
}
function fromFrame(ap,ml,dv){                   /* and back, by the transpose */
  if(!FRAME.on) return {ap,ml,dv};
  const M=FRM, C=fCen(), A=fAdd(), a=ap-A[0], m=ml-A[1], v=dv-A[2];
  return {ap:M[0]*a+M[3]*m+M[6]*v+C[0],
          ml:M[1]*a+M[4]*m+M[7]*v+C[1],
          dv:M[2]*a+M[5]*m+M[8]*v+C[2]};
}
/* toFrame splits cleanly into a rotation about the atlas origin and a translation after
   it: R(p-C)+A is Rp + (A-RC). That split is what lets a view be turned without being
   moved -- the rotation goes into the picture, the translation stays a relabel of the
   axes, which is exactly how a re-zero has always been drawn. */
const fRot = (ap,ml,dv) => { const M=FRM;
  return {ap:M[0]*ap+M[1]*ml+M[2]*dv, ml:M[3]*ap+M[4]*ml+M[5]*dv, dv:M[6]*ap+M[7]*ml+M[8]*dv}; };
/* the same rotation undone, by the transpose the matrix's orthogonality allows */
const fUnrot = (ap,ml,dv) => { const M=FRM;
  return {ap:M[0]*ap+M[3]*ml+M[6]*dv, ml:M[1]*ap+M[4]*ml+M[7]*dv, dv:M[2]*ap+M[5]*ml+M[8]*dv}; };
const fTr = () => { const C=fCen(), A=fAdd(), r=fRot(C[0],C[1],C[2]);
  return {ap:A[0]-r.ap, ml:A[1]-r.ml, dv:A[2]-r.dv}; };
/* Whether the transform still commutes with ML -> -ML, i.e. whether the two hemispheres
   can be folded onto one +/- ML figure. Pitch preserves the symmetry: it leaves ML alone
   whatever the pivot -- and whatever the origin's AP or DV. Roll mixes DV into ML and yaw
   mixes AP into it, so neither does -- and neither does a mediolateral offset or an origin
   off the midline, both of which slide the hemispheres the same way in signed terms and so
   stop them being mirror images. (A pivot off the midline is the one that does cancel: it
   is subtracted and added straight back.) Miss any of these and a structure whose labels
   are unevenly split between the sides folds to a median that is not a place on either
   side of the brain. */
const bilat = () => !FRAME.on ||
  (!FRAME.roll && !FRAME.yaw && !FRAME.dml && !(FRAME.org&&FRAME.oml));
/* One axis of the transform, for the views that plot positions and only relabel their
   axes. Honest in exactly two cases, and they are the same case twice: a re-zero is all
   translation, so each axis stands on its own; and once a view is turned into the frame
   the rotation is already in the dots, so a translation is again all that is left to
   label. Either way it is fTr(), which with no rotation is the old toFrame() on one
   axis to the last decimal place. */
const axTo   = (k,v) => (shifted()||fvOn()) ? v+fTr()[k] : v;
const axFrom = (k,v) => (shifted()||fvOn()) ? v-fTr()[k] : v;

/* what the origin is called, for the readouts, the button, the CSV and the dialog. The
   landmark is matched on where zero ended up rather than on which one was picked, so an
   origin reached by typing an offset from bregma still names itself lambda if that is
   where it landed -- the same trick frameMarks() plays on the pivot presets. */
function orgName(){
  if(!FRAME.org || FRAME.oml) return FRAME.org ? 'origin' : '';
  const ap=oAbs()[0];
  const i=LM.findIndex(([,off])=>Math.abs(ap+off)<1e-9);
  return i>=0 ? LM[i][0].toLowerCase() : 'origin';
}
/* the same origin spelled out in full -- the landmark and the offset from it -- for the
   places with room to say it: the button's tooltip, the dialog and the CSV's frame spec */
function orgFull(){
  if(!FRAME.org) return 'the atlas origin';
  const b=LM[FRAME.oref][0].toLowerCase();
  const d=[['AP',FRAME.oap],['ML',FRAME.oml],['DV',FRAME.odv]]
    .filter(t=>t[1]).map(t=>sgn(t[1])+' '+t[0]);
  return d.length ? b+' '+d.join(' ') : b;
}
/* AP stops meaning "from bregma" the moment an origin is named, so every readout that
   quotes one labels it with what it is really measured from -- exactly as the off-frame
   plate readout has always said "bregma" rather than "AP". */
const apLab = F => (F && FRAME.on && FRAME.org) ? orgName() : 'AP';
/* the frame in one line, for the button, the CSV and the deep link */
function frameTxt(){
  const a=[['pitch',FRAME.pitch],['roll',FRAME.roll],['yaw',FRAME.yaw]].filter(t=>t[1])
    .map(t=>t[0]+' '+(t[1]>0?'+':'')+t[1]+'°');
  if(FRAME.org) a.push('from '+orgFull());
  return a.length ? a.join(' · ') : 'no rotation';
}

/* every located label as a stereotaxic point, for the reverse lookup: read at the end of
   its line where the atlas draws one, which is where the structure is */
const PTS=[];
for(const p in LB){ const ap=plateOf[+p].bregma;
  for(const ab in LB[p]) LB[p][ab].forEach((b,i)=>{
    const [x,y]=ptAt(p,ab,i,b);
    PTS.push({ab,p:+p,i,ap,ml:toML(x*NW),dv:toDV(y*NH),ld:!!ldAt(p,ab,i)});
  });
}
/* the build this page came from, for the files it writes */
const BUILD=((document.querySelector('meta[name="gae-build"]')||{}).content||'').trim();
const ptsOf={};
PTS.forEach(q=>(ptsOf[q.ab]||(ptsOf[q.ab]=[])).push(q));
/* A superstructure's labels are its members', pooled -- and only on the plates the group
   is on, which for the pons and the medulla is narrower than where their members reach.
   Filed under the group's own key, so the card's centre and spread, the projection, the
   reverse lookup and the planner all read a group the way they read a structure. Not
   pushed into PTS: the background cloud plots each printed label once. */
GRP.forEach(g=>{ const pl=new Set(g.plates), v=[];
  for(const a of g.members) for(const q of (ptsOf[a]||[])) if(pl.has(q.p)) v.push(q);
  if(v.length) ptsOf[g.key]=v;
});

let active = new Set(), cur = 30, sel = null, results = S;
let zoom=1, tx=0, ty=0;                        /* view transform, applied to #pan */
let showXY=false, showGrid=false, showSB=false, measMode=false;
let showSK=false, pjsk=false;      /* the skull outline, on the plate and the projections */
let showLM=false, pjlm=false;      /* stereotaxic landmarks, likewise */
let mA=null, mB=null, mHover=null, lastPt=null, pickArm=false;
/* the track being planned: which side of the brain, and the three angles of the approach.
   All three default to 0, which is the vertical dorsal approach. */
let targSide=1, tgTilt=0, tgRoll=0, tgYaw=0, tgLegs=false;
/* and what the target is, which is not always the label itself. tgPlate is the one plate
   to read the abbreviation from -- 0 for all of them, which is the median the planner has
   always taken -- and tgOff moves the aim off the label in millimetres. Both default to
   the old behaviour, so a plan made before either existed still means what it meant. */
let tgPlate=0, tgOff={ap:0,ml:0,dv:0};
const tgOffOn = () => !!(tgOff.ap||tgOff.ml||tgOff.dv);
/* and how long the probe is, if the whole shank is to be read rather than the tip alone.
   0 means no probe: the plan then stops at the target as it always did. */
let tgProbe=0;
const TG_PROBEMAX=20;
/* and the radius of a sphere about the target, for reading what an injection of that
   volume would sit in. 0 for none. */
let tgFoot=0;
const TG_FOOTMAX=3;
const footVol = r => 4/3*Math.PI*r*r*r*1000;    /* mm^3 -> nL */
const footVolTxt = r => { const v=footVol(r); return v>=1000 ? (v/1000).toFixed(2)+' µL' : v.toFixed(0)+' nL'; };

/* ---------- filter chips ---------- */
const sysEl = $('sys');
SYSLIST.forEach(t=>{
  const c=document.createElement('span'); c.className='chip'; c.textContent=t.replace(/_/g,' ');
  c.setAttribute('role','button'); c.tabIndex=0; c.setAttribute('aria-pressed','false');
  c.onclick=()=>{
    const on=!active.has(t);
    on?active.add(t):active.delete(t);
    c.classList.toggle('on',on); c.setAttribute('aria-pressed',on?'true':'false');
    c.style.order=on?-1:0;      /* an active filter is never hidden by the two-row clamp */
    run();
  };
  c.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); c.click(); } };
  sysEl.appendChild(c);
});

/* ---------- search ---------- */
function aliasHits(q){
  const n=norm(q); const out=new Map();       /* abbr -> the alias that brought it in */
  for(const [k,v] of Object.entries(AL)) if(norm(k).includes(n)&&n.length>1) v.forEach(a=>{ if(!out.has(a)) out.set(a,k); });
  return out;
}
/* edit distance, capped: "medial geniculte" should find its structure and nothing two
   letters off should */
function editDist(a,b,max){
  if(Math.abs(a.length-b.length)>max) return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i]; let rowMin=i;
    for(let j=1;j<=b.length;j++){
      const c=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
      cur.push(c); if(c<rowMin) rowMin=c;
    }
    if(rowMin>max) return max+1;
    prev=cur;
  }
  return prev[b.length];
}
/* what a query that matched nothing exactly was probably reaching for: an abbreviation
   one letter off, or every word of it a prefix of, or one letter off, a word of a name */
function fuzzyHits(n){
  const toks=n.split(' ').filter(Boolean), flat=n.replace(/ /g,''), out=[];
  if(!toks.length) return out;
  for(const r of S){
    const ab=r.abbr.toLowerCase(), words=norm(r.name).split(' ');
    let sc=null;
    if(flat.length>=2 && editDist(flat,ab,1)<=1) sc=1;
    else if(toks.every(t=>words.some(w=>w.startsWith(t)||(t.length>=4&&editDist(t,w,1)<=1)))) sc=2;
    if(sc!==null) out.push({r,sc});
  }
  return out.sort((a,b)=>a.sc-b.sc||a.r.name.localeCompare(b.r.name)).map(x=>x.r);
}
let fuzzy=false, via={}, gresults=GRP, gopen=true;
/* the list narrowed to one division's structures, which is what makes the CSV, the
   label table and the 3-D filter work on a division without any of them learning what
   one is. Set from the division's card and dropped the moment the box or a chip is
   used, since either of those is a new question. */
let gfilter=null;
try{ gopen=localStorage.getItem('gae-divs')!=='0'; }catch(_){}
/* refine() only re-filters; run() also reads the box for a plate or a bregma to jump
   to. Keeping the two apart lets go() refresh a plate-scoped list without the pair of
   them calling each other in a circle. */
function refine(){
  const raw=$('q').value.trim(), n=norm(raw), al=aliasHits(raw);
  fuzzy=false; via={};
  const gf=gfilter&&byAb[gfilter] ? new Set(byAb[gfilter].members) : null;
  const inScope=r=>!(scope==='plate' && !r.plates.includes(cur)) && !(active.size && !r.systems.some(t=>active.has(t)));
  /* the divisions answer the same box and the same chips, on their own names and the
     other names people call them by -- "hippocampus" for the hippocampal formation,
     "basal ganglia" for the striatum and pallidum. Not on their members' names: typing
     CA1 is a question about CA1, and answering it with the whole hippocampus as well
     would bury the row that was asked for. */
  gresults = GRP.filter(g=>{
    /* narrowed to one division's structures, the other nineteen are not the question */
    if(gf) return g.key===gfilter;
    if(!inScope(g)) return false;
    if(!n) return true;
    const flat=n.replace(/ /g,'');
    return norm(g.name).includes(n) || g.id===flat || g.abbr.toLowerCase().includes(flat) ||
      (g.alias||[]).some(t=>norm(t).includes(n));
  });
  results = S.filter(r=>{
    if(gf && !gf.has(r.abbr)) return false;
    if(!inScope(r)) return false;
    if(!n) return true;
    const direct = r.abbr.toLowerCase()===n.replace(/ /g,'') || norm(r.name).includes(n) ||
      r.abbr.toLowerCase().includes(n.replace(/ /g,'')) || r.systems.some(t=>t.replace(/_/g,' ').includes(n));
    if(direct) return true;
    if(al.has(r.abbr)){ via[r.abbr]=al.get(r.abbr); return true; }
    return false;
  });
  /* nothing exact: offer what was probably meant, and say that it is a guess */
  if(n.length>=3 && !results.length){ results=fuzzyHits(n).filter(inScope); fuzzy=!!results.length; }
  draw();
}
function run(){
  gfilter=null;
  const raw=$('q').value.trim();
  // "plate 30" / "p30"
  const mp = raw.match(/^(?:plate\s*|p)(\d{1,2})$/i);
  if(mp){ const k=+mp[1]; if(k>=1&&k<=62){ go(k); } }
  // "bregma -2.3"
  const mb = raw.match(/bregma\s*(-?\d+(?:[.,]\d+)?)/i);
  if(mb){ const v=parseFloat(mb[1].replace(',','.'));
    let best=P[0]; P.forEach(p=>{if(Math.abs(p.bregma-v)<Math.abs(best.bregma-v))best=p}); go(best.plate); }
  refine();
}
function draw(){
  pj(); v3flags();
  const L=$('list');
  const gf=gfilter&&byAb[gfilter];
  $('cnt').innerHTML = gf
    ? `${results.length} structure${results.length===1?'':'s'} of <b>${esc(gf.name)}</b>`+
      (scope==='plate'?' on plate '+cur:'')+
      ` <button type="button" class="unf" id="gunf" title="Back to every structure">clear</button>`
    : esc((scope==='plate'
        ? results.length+' of '+nHere+' on plate '+cur
        : results.length+' of '+S.length+' structures')
      + (GOK&&gresults.length ? ' · '+gresults.length+' division'+(gresults.length>1?'s':'') : ''));
  if($('gunf')) $('gunf').onclick=()=>{ gfilter=null; refine(); };
  $('sortl').textContent = results.length? 'plates '+Math.min(...results.map(r=>r.first_plate))+'–'+Math.max(...results.map(r=>r.last_plate)) : '';
  $('ecsv').disabled = !results.length; $('elab').disabled = !results.length;
  recentDraw();
  /* one row shape for both, so a division reads as a thing you can pick and not as a
     control: the same three columns, with the label where an abbreviation goes and the
     count of what it is made of where the plate range goes for a structure. */
  /* a name that is no region says so on hover, because the row is otherwise identical to
     one that will outline itself on the plate and this one never will */
  const row=(r,k)=>
    `<div class="row${r.grp?' grp':''}${sel===k?' sel':''}" data-a="${esc(k)}" role="option" tabindex="0" aria-selected="${sel===k?'true':'false'}"${isFeat(k)?` title="${esc(featTxt(k))} \u2014 no outline, no mesh"`:''}>
       <span class="ab">${esc(r.abbr)}</span>
       <span class="nm">${esc(r.name)}${via[k]?` <span class="via">via ${esc(via[k])}</span>`:''}</span>
       <span class="pl">${r.grp?r.n_members+' str':
          (r.first_plate===r.last_plate?r.first_plate:r.first_plate+'–'+r.last_plate)}</span>
     </div>`;
  /* The divisions sit above the structures under a header that folds them away, because
     they are twenty rows in front of seven hundred and somebody who never wants them
     should be able to say so once. Folded, the header still says how many matched. */
  const gh = gresults.length
    ? `<div class="ghead${gopen?' open':''}" id="ghead" role="button" tabindex="0" aria-expanded="${gopen?'true':'false'}"
         title="Gross divisions of the brain — added here, not part of the published atlas">
         <span class="gcar">▸</span>Divisions<b>${gresults.length}</b></div>`
    : '';
  const gl = gh + (gopen?gresults.map(g=>row(g,g.key)).join(''):'');
  if(!results.length){
    L.innerHTML = gl + '<p class="empty">Nothing matched. Try an abbreviation (MGV), a name '+
      '(medial geniculate), a division (hippocampus), a system chip, or “plate 42”.</p>';
  } else {
    L.innerHTML = gl + (fuzzy?'<p class="empty fz">Nothing matched exactly. Close matches:</p>':'')
      + results.slice(0,400).map(r=>row(r,r.abbr)).join('')
      + (results.length>400?'<p class="empty">…and '+(results.length-400)+' more. Narrow the search.</p>':'');
  }
  const hd=$('ghead');
  if(hd){ const flip=()=>{ gopen=!gopen;
      try{ localStorage.setItem('gae-divs',gopen?'1':'0'); }catch(_){}
      draw(); reveal(); };
    hd.onclick=flip;
    hd.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); flip(); } }; }
  [...L.querySelectorAll('.row')].forEach(el=>el.onclick=()=>{
    const a=el.dataset.a; select(a);
    /* a structure opens on the first plate that carries it; a division spans dozens and
       is drawn on all of them, so picking one where you already are stays where you are */
    if(!isGrp(a) || !byAb[a].plates.includes(cur)) go(byAb[a].first_plate);
  });
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
/* the last few structures looked at, kept in this browser, offered while the box is empty */
let RECENT=[];
try{ RECENT=(JSON.parse(localStorage.getItem('gae-recent')||'[]')||[]).filter(a=>byAb[a]).slice(0,8); }catch(_){}
function recentAdd(a){
  RECENT=[a,...RECENT.filter(x=>x!==a)].slice(0,8);
  try{ localStorage.setItem('gae-recent',JSON.stringify(RECENT)); }catch(_){}
}
function recentDraw(){
  const el=$('recent'); if(!el) return;
  const show=RECENT.length && !$('q').value.trim() && !active.size && scope==='all';
  el.hidden=!show; if(!show) return;
  el.innerHTML='<span>Recent</span>'+RECENT.map(a=>`<button type="button" class="pbtn${isGrp(a)?' pg':''}" data-a="${esc(a)}" title="${esc(byAb[a].name)}">${esc(byAb[a].abbr)}</button>`).join('');
  [...el.querySelectorAll('.pbtn')].forEach(b=>b.onclick=()=>{ const a=b.dataset.a; select(a);
    if(!isGrp(a) || !byAb[a].plates.includes(cur)) go(byAb[a].first_plate); });
}

/* ---------- detail ---------- */
/* the printed label positions give a structure a stereotaxic centre; ML is folded to
   one side first, because the two hemispheres would otherwise average to the midline.
   Pass F to read the centre in the working frame. Every label is transformed before the
   medians are taken, not after: a median is not linear, so rotating the median of the
   atlas positions is not the median of the rotated ones. The atlas itself is always
   bilaterally symmetric, so only the transformed reading can need splitting by side. */
const med=arr=>{const s=[...arr].sort((x,y)=>x-y),h=s.length>>1;
  return s.length%2?s[h]:(s[h-1]+s[h])/2;};
function coordsOf(a,F){
  const v=ptsOf[a]; if(!v||!v.length) return null;
  const T=F&&FRAME.on, at=q=>T?toFrame(q.ap,q.ml,q.dv):q;
  const cen=w=>({ap:med(w.map(q=>q.ap)),ml:med(w.map(q=>q.ml)),dv:med(w.map(q=>q.dv))});
  if(!T||bilat()){
    const w=v.map(at).map(q=>({ap:q.ap,ml:Math.abs(q.ml),dv:q.dv}));
    return Object.assign(cen(w),{n:v.length,fold:true});
  }
  const side=k=>{ const w=v.filter(q=>k*q.ml>0).map(at); return w.length?cen(w):null; };
  return {n:v.length,fold:false,L:side(-1),R:side(1)};
}
/* the spread of those same labels, which is what the projection plots */
function extentOf(a,F){
  const v=ptsOf[a]; if(!v) return null;
  const T=F&&FRAME.on, fold=!T||bilat();
  const w=T?v.map(q=>toFrame(q.ap,q.ml,q.dv)):v;
  const ml=w.map(q=>fold?Math.abs(q.ml):q.ml), dv=w.map(q=>q.dv);
  return {fold,ml0:Math.min(...ml),ml1:Math.max(...ml),
          dv0:Math.min(...dv),dv1:Math.max(...dv),n:v.length};
}
/* a centre as one line, or a line per hemisphere once the frame has broken the atlas's
   symmetry and folding the two sides onto one figure would be a fiction */
function ctrTxt(o,F){
  const L=apLab(F);
  const one=q=>`${L} ${sgn(q.ap)} · ML ${o.fold?'±'+Math.abs(q.ml).toFixed(2):sgn(q.ml)} · DV ${sgn(q.dv)} mm`;
  if(o.fold) return one(o);
  return [o.R?'right '+one(o.R):'', o.L?'left '+one(o.L):''].filter(Boolean).join('<br>');
}
function extTxt(x){
  const ml=x.fold
    ? '±'+x.ml0.toFixed(2)+(x.ml1-x.ml0<.005?'':'–'+x.ml1.toFixed(2))
    : sgn(x.ml0)+(x.ml1-x.ml0<.005?'':' to '+sgn(x.ml1));
  return `ML ${ml} · DV ${sgn(x.dv0)}${x.dv1-x.dv0<.005?'':' to '+sgn(x.dv1)} mm`;
}
function select(a){
  sel=a; const r=byAb[a]; const D=$('det'); D.hidden=false;
  const g=r.grp?r:null;
  const c=coordsOf(a), x=extentOf(a);
  const fc=FRAME.on?coordsOf(a,1):null, fx=FRAME.on?extentOf(a,1):null;
  D.innerHTML=`<p class="dn">${esc(r.name)}</p><span class="da${g?' dg':''}">${esc(r.abbr)}</span>
   ${g?`<p class="gnote">${esc(g.note)}</p>`
      :isFeat(a)?`<p class="gnote">${esc(featTxt(a))}. The atlas draws it no boundary of its own, so `+
        `it has no outline, no area and no mesh here \u2014 the ground it lies in belongs to the `+
        `regions around it. Every plate that prints the name still says where.</p>`:''}
   <dl class="kv">
     <dt>Plates</dt><dd>${r.first_plate}–${r.last_plate} <span style="color:var(--muted)">(${r.n_plates})</span></dd>
     <dt>Bregma</dt><dd>${r.bregma_anterior.toFixed(2)} to ${r.bregma_posterior.toFixed(2)} mm</dd>
     <dt>Lambda</dt><dd>${(r.bregma_anterior+LMof('Lambda')).toFixed(2)} to ${(r.bregma_posterior+LMof('Lambda')).toFixed(2)} mm</dd>
     <dt>Interaural</dt><dd>${(r.bregma_anterior+LMof('Interaural')).toFixed(2)} to ${(r.bregma_posterior+LMof('Interaural')).toFixed(2)} mm</dd>
     ${c?`<dt title="${g?'Median position of the printed labels of every structure in this division — a centre of the division, not its centroid':"Median position of this structure's printed labels — near, but not identical to, its centroid"}">Label centre</dt>
        <dd>${ctrTxt(fc||c,fc)}${fc?`<span class="atl">atlas ${ctrTxt(c)}</span>`:''}</dd>`:''}
     ${x?`<dt title="The full spread of those labels — what the projection below plots. Not the ${g?'division':'structure'}'s extent: for that, ${g?'select it on a plate':'hover or select it on a plate'}">Label spread</dt>
        <dd>${extTxt(fx||x)}${fx?`<span class="atl">atlas ${extTxt(x)}</span>`:''}</dd>`:''}
     ${g?`<dt title="Every atlas structure this division is made of. Divisions may overlap: a structure can be in more than one.">Structures</dt>
        <dd>${g.n_members} <span style="color:var(--muted)">(${c?c.n:0} located labels)</span>
          <button type="button" class="glist" id="glist">${gfilter===g.key?'listed below':'List them'}</button></dd>`:
        `<dt>Systems</dt><dd>${r.systems.map(t=>esc(t.replace(/_/g,' '))).join(', ')}</dd>`}
     ${!g&&(grpsOf[a]||[]).length?`<dt title="The gross divisions this structure is part of. They overlap, so it can be in several.">Divisions</dt>
        <dd class="gin">${grpsOf[a].map(q=>
          `<button type="button" class="pbtn pg" data-g="${esc(q.key)}" title="${esc(q.note)}">${esc(q.name)}</button>`).join('')}</dd>`:''}
   </dl>
   <div class="plines">${r.plates.map(p=>`<span class="pbtn" data-p="${p}" role="button" tabindex="0">${p}</span>`).join('')}</div>
   ${g?`<div class="gmem" id="gmem"><span>Made of</span>${g.members.map(m=>
        `<button type="button" class="pbtn" data-a="${esc(m)}" title="${esc((byAb[m]||{}).name||m)}">${esc(m)}</button>`).join('')}</div>`:''}
   <div class="gal" id="gal" aria-label="The ${g?'division':'structure'} on each of its plates"></div>
   <button class="detx" id="detx" type="button" title="Drop the selection" aria-label="Drop the selection">&times;</button>`;
  [...D.querySelectorAll('.plines .pbtn')].forEach(el=>{ el.onclick=()=>go(+el.dataset.p);
    el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } }; });
  [...D.querySelectorAll('.gmem .pbtn')].forEach(el=>el.onclick=()=>{
    select(el.dataset.a); if(!byAb[el.dataset.a].plates.includes(cur)) go(byAb[el.dataset.a].first_plate); });
  [...D.querySelectorAll('.gin .pbtn')].forEach(el=>el.onclick=()=>{
    const k=el.dataset.g; select(k); if(!byAb[k].plates.includes(cur)) go(byAb[k].first_plate); });
  if($('glist')) $('glist').onclick=()=>{
    gfilter = gfilter===g.key ? null : g.key;
    $('q').value=''; active.clear();
    [...sysEl.children].forEach(c=>{ c.classList.remove('on'); c.setAttribute('aria-pressed','false'); c.style.order=0; });
    refine(); select(g.key);
  };
  $('detx').onclick=clear;
  D.scrollTop=0;
  recentAdd(a);
  draw();
  mark(); fit(); reveal(); tgSync(); queueHash();
  galBuild(a);
}

/* ---- the structure on every plate it is on, as a strip of thumbnails ----
   The card's plate buttons say which plates; this shows them. Each thumbnail is the plate
   cropped around the structure, with its extent outlined or its label circled.
   Drawn only once a thumbnail is actually on screen. A structure can be printed on fifty
   plates, and decoding fifty full-resolution plates to fill a strip that shows three of
   them at a time costs a phone hundreds of milliseconds of its main thread -- inside the
   tap that selected the structure, which is exactly where a delay is felt. */
let galTok=0, galIO=null; const GALC=new Map(), GALMAX=120, GW=132, GH=84;
function galBuild(a){
  const el=$('gal'), r=byAb[a]; if(!el||!r) return;
  const tok=++galTok;
  if(galIO){ galIO.disconnect(); galIO=null; }
  el.innerHTML=r.plates.map(p=>`<div class="gitem${p===cur?' cur':''}" data-p="${p}" title="Plate ${p} · bregma ${sgn(plateOf[p].bregma)}" role="button" tabindex="0">`+
    `<canvas class="gth" width="${GW}" height="${GH}"></canvas><span class="gcap">${p}</span></div>`).join('');
  [...el.children].forEach(d=>{ d.onclick=()=>go(+d.dataset.p);
    d.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); d.click(); } }; });
  /* against the viewport rather than the strip, so a card scrolled out of sight draws
     nothing either; the margin fills the neighbours in before they are scrolled to */
  if(typeof IntersectionObserver==='function'){
    galIO=new IntersectionObserver((es,io)=>{
      for(const e of es) if(e.isIntersecting){ io.unobserve(e.target); galThumb(e.target,a,tok); }
    },{rootMargin:'150px'});
    [...el.children].forEach(d=>galIO.observe(d));
  } else [...el.children].forEach(d=>galThumb(d,a,tok));
}
async function galThumb(d,a,tok){
  if(tok!==galTok||!d.isConnected) return;
  const p=+d.dataset.p, key=a+'|'+p+'|'+psrc, cv=d.firstElementChild;
  const hit=GALC.get(key);
  if(hit){ cv.getContext('2d').drawImage(hit,0,0); return; }
  /* the plate on screen is decoded already; anything else has to be read in */
  let im=$('pi');
  if(p!==cur||!im.complete||!im.naturalWidth){
    im=new Image(); im.decoding='async'; im.src=plateImg(p);
    try{ await im.decode(); }catch(_){ return; }
  }
  if(tok!==galTok||!d.isConnected) return;
  const R0=regBuild(p).by[a], R=R0&&!regUnd(R0)?R0:null, bs=(LB[p]||{})[a]||[];
  let x0,y0,x1,y1;
  if(R){ x0=R.x0; y0=R.y0; x1=R.x1; y1=R.y1; }
  else if(bs.length){
    const at=bs.map((b,i)=>ptAt(p,a,i,b));
    x0=Math.min(...at.map(q=>q[0]))*NW-24; x1=Math.max(...at.map(q=>q[0]))*NW+24;
    y0=Math.min(...at.map(q=>q[1]))*NH-24; y1=Math.max(...at.map(q=>q[1]))*NH+24;
  } else { x0=0; y0=0; x1=NW; y1=NH; }
  /* the crop keeps the thumbnail's aspect and never zooms past about 8x */
  let w=Math.max(x1-x0,GW/8)*1.5, h=Math.max(y1-y0,GH/8)*1.5;
  if(w/h<GW/GH) w=h*GW/GH; else h=w*GH/GW;
  const cx=(x0+x1)/2, cy=(y0+y1)/2, sx=cx-w/2, sy=cy-h/2;
  const g=cv.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,GW,GH);
  g.drawImage(im, sx,sy,w,h, 0,0,GW,GH);
  const X=x=>(x-sx)/w*GW, Y=y=>(y-sy)/h*GH;
  g.strokeStyle=markC(a); g.lineWidth=1.4;
  if(R){
    g.beginPath();
    R.gs.forEach(gg=>{ gg.forEach(([x,y],i)=>i?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y))); g.closePath(); });
    g.fillStyle=markF(a,'.12'); g.fill('evenodd');
    if(regEst(R)) g.setLineDash([4,3]);
    g.stroke(); g.setLineDash([]);
  } else bs.forEach((b,i)=>{ const [qx,qy]=ptAt(p,a,i,b), Rr=Math.max(b[2]*NW,b[3]*NH);
    g.beginPath(); g.ellipse(X(qx*NW),Y(qy*NH),(Rr*0.85+7)*GW/w,(Rr*0.55+6)*GH/h,0,0,6.2832); g.stroke(); });
  const c2=document.createElement('canvas'); c2.width=GW; c2.height=GH;
  c2.getContext('2d').drawImage(cv,0,0);
  GALC.set(key,c2);
  /* oldest out first, so a long session does not keep every thumbnail it ever drew */
  while(GALC.size>GALMAX) GALC.delete(GALC.keys().next().value);
}
function galMark(){ const el=$('gal'); if(el) [...el.children].forEach(d=>d.classList.toggle('cur',+d.dataset.p===cur)); }
function clear(){
  if(!sel) return;
  sel=null; gfilter=null; $('det').hidden=true; refine();
  mark(); fit(); tgSync(); queueHash();
}
/* draw() rebuilds the list, so the selected row lands wherever it lands; bring it
   back into view by scrolling the list alone, never the page under the plate */
function reveal(){
  const L=$('list'), el=L.querySelector('.row.sel');
  if(!el) return;                                   /* filtered out, or past the 400-row cap */
  const lb=L.getBoundingClientRect(), eb=el.getBoundingClientRect();
  if(eb.top>=lb.top && eb.bottom<=lb.bottom) return;
  L.scrollTop += (eb.top-lb.top) - (lb.height-eb.height)/2;
}

/* ---------- plate viewer ---------- */
function go(k){
  cur=Math.max(1,Math.min(62,k));
  const p=plateOf[cur];
  $('pn').textContent='Plate '+cur;
  $('pc').textContent=
    `bregma ${p.bregma.toFixed(2)} · lambda ${p.lambda_.toFixed(2)} · interaural ${p.interaural.toFixed(2)} · occ. crest ${p.occipital_crest.toFixed(2)} mm`;
  $('rng').value=cur;
  srcShow();
  /* what the chip cloud used to be: the results list scoped to this plate, where the
     names are already spelled out and the selection already highlights */
  nHere=S.filter(r=>r.plates.includes(cur)).length;
  $('scP').innerHTML='On plate '+cur+' <b>'+nHere+'</b>';
  if(scope==='plate') refine();
  labels(); galMark(); anDraw(); anClose(); preload();
  mark(); fit(); drawSK(); drawLM(); tgDraw(); pjGuide(); v3note(); v3frame(); revSync(); queueHash();
}

/* the plates either side, decoded ahead of the arrow key that will ask for them */
const PRE=new Set();
function preload(){
  for(const p of [cur-1,cur+1]){
    if(!plateOf[p]) continue;
    const src=plateImg(p), k=psrc+'|'+p;
    if(!src||PRE.has(k)) continue;
    PRE.add(k); const im=new Image(); im.decoding='async'; im.src=src;
  }
}

/* ---------- selection marker, and saying so when it is not on this plate ---------- */
/* On the histology the abbreviations are not printed, but their positions are known and
   registered, so hovering still names what is there -- which is more use on an unlabelled
   section than on the drawing, not less. The hint says which of the two you are on.
   With extents loaded the whole area answers, not just the printed name, so say that
   instead: it is the difference between reading a legend and pointing at a structure. */
const hintTxt = () => 'Click a result to outline it here \u00b7 '+
  (ROK
    ? 'hover anywhere on a structure to read it, click it to select it'
    : psrc==='drawing'
      ? 'hover a printed label to read it, click it to select it'
      : 'hover where the drawing prints an abbreviation to read it, click it to select it')+
  ' \u00b7 <kbd>\u2190</kbd> <kbd>\u2192</kbd> step through plates';
/* while the plate is armed for a pick it has one job, so it says so and nothing else */
function mark(){
  markSel();
  if(anArm){
    const vh=$('vhint'); vh.className='vhint';
    vh.innerHTML='Click a point on the plate to place the <b>note</b>.';
    return;
  }
  if(pickArm){
    const vh=$('vhint'); vh.className='vhint';
    vh.innerHTML='Click a point on the plate to set <b>ML</b> and <b>DV</b>, '+
      'and <b>AP</b> from plate '+cur+'.';
    return;
  }
  /* A pure tilt moves the track in AP and not in ML, so on a coronal plate it draws as a
     vertical line and could be read as a vertical approach. The dashing says otherwise;
     this says what the dashing means. The projections are where a tilt reads true.
     Appended here rather than in tgDraw() because this line has one owner: written from
     two places it would double up, and go stale the moment the planner was put away. */
  if(tgOffPlate())
    $('vhint').innerHTML+=' · <b>track</b> dashed where it passes in front of or'+
      ' behind this plate';
}
function markSel(){
  const ov=$('om'), vh=$('vhint');
  ov.innerHTML=''; vh.className='vhint';
  cmpMark();
  if(!sel){ vh.innerHTML=hintTxt(); return; }
  const r=byAb[sel];
  /* a superstructure is outlined in its own colour and never circled: it has no printed
     name to circle, and where its members are drawn it always has an outline */
  if(isGrp(sel)){ markGrp(r); return; }
  const bs=(LB[cur]||{})[sel]||[];
  /* An outline and a circle are two different claims. The circle says where the name
     falls; the outline says what the name covers. The outline is the better answer
     wherever there is one, and drawing both only invites the circle to be read as part
     of the shape -- so the circle is the fallback, for the structures no extent could be
     cut for. It goes round the end of the label's line where the atlas draws one: a
     circle round the word would be a circle round white paper beside the section, which
     is where the atlas sets a name it cannot fit inside the region. The circle is also
     the answer where there is an extent but no boundary the atlas draws round it -- see
     regUnd() -- because there the outline would be a line this atlas does not have, and
     for the names that are no region -- see isFeat() -- where it would be a line round
     ground that is somebody else's. */
  const rg=regOut(sel), und=regBy[sel];
  const at=bs.map((b,i)=>{ const [x,y]=ptAt(cur,sel,i,b); return [x,y,b[2],b[3]]; });
  const ell=at.map(([cx,cy,w,h])=>{
    const R=Math.max(w*NW,h*NH), rx=(R*0.85+7).toFixed(1), ry=(R*0.55+6).toFixed(1);
    return `<ellipse cx="${(cx*NW).toFixed(1)}" cy="${(cy*NH).toFixed(1)}" rx="${rx}" ry="${ry}"></ellipse>`;
  }).join('');
  if(rg){
    ov.innerHTML=`<path d="${regD(rg)}"${regEst(rg)?' class="est"':''}></path>`;
    vh.innerHTML=`<b>${esc(sel)}</b> outlined${blkTxt(rg)} \u00b7 ${regTxt(rg)}`;
    ensureVisible(bs.length?bs:[[(rg.x0+rg.x1)/2/NW,(rg.y0+rg.y1)/2/NH,
                                 (rg.x1-rg.x0)/NW,(rg.y1-rg.y0)/NH]]);
    return;
  }
  if(bs.length){
    ov.innerHTML=ell;
    const led=bs.filter((_b,i)=>ldAt(cur,sel,i)).length;
    const how=led===bs.length?(bs.length>1?'each ':''):`${led} of them `;
    vh.innerHTML=`<b>${esc(sel)}</b> circled \u00b7 ${bs.length} label${bs.length>1?'s':''} printed on plate ${cur}`
      +(led?` \u00b7 ${how}circled at the end of the line the atlas draws from the word`:'')
      +(isFeat(sel)?` \u00b7 ${featTxt(sel)}, so the atlas draws it no boundary and none is `+
            `drawn here \u2014 the ground it lies in belongs to the regions around it`:'')
      +(und?` \u00b7 ${und.mm2.toFixed(und.mm2<1?3:2)} mm\u00b2 of section here, but every label of it `+
            `is printed inside a boundary the atlas draws round more than one name, so it has `+
            `no outline of its own to draw`:'');
    ensureVisible(at);
    return;
  }
  if(!r){ vh.innerHTML=hintTxt(); return; }
  vh.className='vhint warn';
  if(r.plates.includes(cur)){
    vh.innerHTML=`<b>${esc(sel)}</b> is at this level, but its printed label was not located on plate ${cur}.`;
    return;
  }
  /* off this plate: say which way to go, how far, and offer to go there */
  const near=r.plates.reduce((a,b)=>Math.abs(b-cur)<Math.abs(a-cur)?b:a);
  const d=Math.abs(near-cur), dir=near<cur?'anterior':'posterior';
  vh.innerHTML=`<b>${esc(sel)}</b> is not on plate ${cur} \u2014 ${d} plate${d===1?'':'s'} ${dir},`+
    ` ${(d*0.35).toFixed(2)} mm away; it spans plates ${r.first_plate}\u2013${r.last_plate}.`+
    `<button type="button" id="oobgo">Go to plate ${near}</button>`;
  $('oobgo').onclick=()=>go(near);
}
/* the same job for a superstructure, which answers differently in every branch: it is
   never circled, its area is a sum over the members drawn here, and being off the plate
   means the division is not at this level rather than that a name was not printed. */
function markGrp(g){
  const ov=$('om'), vh=$('vhint'), rg=regBy[g.key];
  if(rg){
    ov.innerHTML=`<path class="grp${regEst(rg)?' est':''}" d="${regD(rg)}"></path>`;
    vh.innerHTML=`<b>${esc(g.name)}</b> outlined · ${grpTxt(rg,g)}`;
    ensureVisible([[(rg.x0+rg.x1)/2/NW,(rg.y0+rg.y1)/2/NH,
                    (rg.x1-rg.x0)/NW,(rg.y1-rg.y0)/NH]]);
    return;
  }
  vh.className='vhint warn';
  if(!ROK){ vh.innerHTML=`<b>${esc(g.name)}</b> selected. This build carries no regional `+
    `outlines, so there is nothing to draw it from.`; return; }
  if(g.plates.includes(cur)){
    vh.innerHTML=`<b>${esc(g.name)}</b> is at this level, but none of its structures `+
      `has an outline on plate ${cur}.`;
    return;
  }
  const near=g.plates.reduce((a,b)=>Math.abs(b-cur)<Math.abs(a-cur)?b:a);
  const d=Math.abs(near-cur), dir=near<cur?'anterior':'posterior';
  vh.innerHTML=`<b>${esc(g.name)}</b> is not on plate ${cur} — ${d} plate${d===1?'':'s'} `+
    `${dir}, ${(d*PSTEP).toFixed(2)} mm away; it spans plates ${g.first_plate}–${g.last_plate}.`+
    `<button type="button" id="oobgo">Go to plate ${near}</button>`;
  $('oobgo').onclick=()=>go(near);
}
/* when zoomed in, bring the thing that was just selected into the viewport */
function ensureVisible(bs){
  if(zoom<=1.01) return;
  const b=iwRect(); if(!b.width) return;
  const vis=bs.some(([cx,cy])=>{ const [x,y]=f2s(cx*NW,cy*NH);
    return x>=0&&x<=b.width&&y>=0&&y<=b.height; });
  if(vis) return;
  const cx=bs.reduce((s,q)=>s+q[0],0)/bs.length, cy=bs.reduce((s,q)=>s+q[1],0)/bs.length;
  centreOn(cx*NW,cy*NH);
}
function centreOn(fx,fy){
  const b=iwRect(); if(!b.width) return;
  tx=b.width/2 - zoom*fx/NW*b.width;
  ty=b.height/2 - zoom*fy/NH*b.height;
  applyView();
}

/* ---------- zoom and pan ----------
   #pan carries the translate+scale; everything else maps through f2s / s2f, so the
   overlays, the label hit testing and the tooltip all stay registered to the image. */
const IW=$('iw'), PAN=$('pan'), TIP=$('tip'), HL=$('hl'), HR=$('hr');
const IW2=$('iw2'), PAN2=$('pan2'), HR2=$('hr2');
const ZMIN=1, ZMAX=10;
function iwRect(){ return IW.getBoundingClientRect(); }
function f2s(fx,fy){ const b=iwRect(); return [tx+zoom*fx/NW*b.width, ty+zoom*fy/NH*b.height]; }
function s2f(e){ const b=iwRect(); if(!b.width||!b.height) return null;
  return [((e.clientX-b.left)-tx)/zoom/b.width*NW, ((e.clientY-b.top)-ty)/zoom/b.height*NH]; }
function clampView(){
  const b=iwRect(); if(!b.width) return;
  const W=b.width*zoom, H=b.height*zoom;
  tx = W<=b.width ? (b.width-W)/2 : Math.min(0,Math.max(b.width-W,tx));
  ty = H<=b.height ? (b.height-H)/2 : Math.min(0,Math.max(b.height-H,ty));
}
function applyView(){
  clampView();
  PAN.style.transform=`translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${zoom.toFixed(4)})`;
  PAN2.style.transform=PAN.style.transform;
  $('zl').textContent=Math.round(zoom*100)+'%';
  $('zo').disabled = zoom<=ZMIN+1e-6;
  $('zi').disabled = zoom>=ZMAX-1e-6;
  IW.classList.toggle('zoomed', zoom>1.01);
  drawSB(); queueHash();
}
function zoomAt(k,cx,cy){
  const nk=Math.max(ZMIN,Math.min(ZMAX,k));
  if(Math.abs(nk-zoom)<1e-6) return;
  tx = cx-(cx-tx)*(nk/zoom); ty = cy-(cy-ty)*(nk/zoom);
  zoom=nk; hideTip(); applyView();
}
function zoomCentre(k){ const b=iwRect(); zoomAt(k,b.width/2,b.height/2); }
$('zi').onclick=()=>zoomCentre(zoom*1.6);
$('zo').onclick=()=>zoomCentre(zoom/1.6);
$('zf').onclick=()=>{ zoom=1; tx=ty=0; hideTip(); applyView(); };

/* the page scrolls under the wheel until you have opted into the viewer by zooming;
   ctrl/cmd+wheel and double-click zoom from any state */
IW.addEventListener('wheel',e=>{
  /* filling the window there is no page to scroll, so the wheel is the viewer's;
     stacked, it stays the page's until you have opted in by zooming */
  if(!SHELL.matches && !e.ctrlKey && !e.metaKey && zoom<=1.01) return;
  e.preventDefault();
  const b=iwRect();
  zoomAt(zoom*Math.exp(-e.deltaY*0.0016), e.clientX-b.left, e.clientY-b.top);
},{passive:false});
IW.addEventListener('dblclick',e=>{
  const b=iwRect();
  zoomAt(zoom<ZMAX?zoom*2:1, e.clientX-b.left, e.clientY-b.top);
});

/* ---------- compare: a second plate beside the first, under the same transform ----------
   The three plates of a level are registered by construction and neighbouring levels
   share the frame, so a second image can sit beside the first with the same zoom, the
   same pan and the same crosshair: what is at a point on the left is at that point on
   the right. It shows the other histology of this level, the drawing, or the plate
   before or after. The overlays stay on the left; the right carries the selection's
   outline where it is the same level, and the crosshair. */
let cmpOn=false, cmpWhat='nissl';
const CMPWHAT=['nissl','myelin','drawing','prev','next'];
function cmpPlate(){ return cmpWhat==='prev'?Math.max(1,cur-1):cmpWhat==='next'?Math.min(62,cur+1):cur; }
function cmpSrc(){ return (cmpWhat==='prev'||cmpWhat==='next')?psrc:cmpWhat; }
function cmpShow(){
  IW2.hidden=!cmpOn; IMGBOX.classList.toggle('cmp',cmpOn); $('cmpsel').hidden=!cmpOn;
  hr2Hide();
  if(cmpOn){
    const p=cmpPlate(), k=cmpSrc(), el=$('pi2');
    el.src=((srcOK(k)?SRC[k]:IMG)[p])||'';
    el.style.filter=plateFilter();
    el.alt=`Atlas plate ${p}, ${SRCN[srcOK(k)?k:'drawing']}`;
    $('cmplab').textContent=`Plate ${p} · ${SRCN[srcOK(k)?k:'drawing']}`+
      (p!==cur?` · bregma ${sgn(plateOf[p].bregma)}`:'');
    cmpMark();
  } else { $('xh2').innerHTML=''; }
  fitW=0; fit(); applyView();
}
/* the selection, outlined on the second pane too where it is the same level */
function cmpMark(){
  const g=$('om2'); if(!cmpOn||!sel){ g.innerHTML=''; return; }
  const rg=regBuild(cmpPlate()).by[sel];
  if(!rg || regUnd(rg)){ g.innerHTML=''; return; }
  g.innerHTML = `<path class="${isGrp(sel)?'grp':''}${regEst(rg)?' est':''}" d="${regD(rg)}"></path>`;
}
/* ---------- compare: the region under the pointer, highlighted on both panes ----------
   The two plates share a frame but not a region index -- each is cut on its own level --
   so a hover on either side is answered by name: outline what the pointer is over on the
   plate it is over, and outline that same abbreviation, if this other plate has it, on
   the plate beside it. That is the only sense in which "the same structure" survives a
   plate that may not be the one the section came from. */
let hot2=null;
function hr2Hide(){ HR2.style.display='none'; hot2=null; IW2.classList.remove('hot'); }
/* the mirror onto pane one: driven by pane two, not by pane one's own pointer, so it
   clears pane one's own hover bookkeeping too -- otherwise a hover that never moved
   while the pointer was over pane two would be mistaken for one already shown */
function cmpMirror1(ab){
  hot=null; TIP.hidden=true; IW.classList.remove('hot'); HL.style.display='none';
  const rg=ab?regBy[ab]:null;
  if(!rg){ HR.style.display='none'; return; }
  const hi=regHi(rg);
  HR.setAttribute('d',hi.d); HR.setAttribute('class',hi.c);
  HR.style.display='';
}
/* the mirror onto pane two: driven by pane one's own hover() */
function cmpMirror2(ab){
  if(!cmpOn) return;
  const rg=ab?regBuild(cmpPlate()).by[ab]:null;
  if(!rg){ HR2.style.display='none'; return; }
  const hi=regHi(rg,cmpPlate());
  HR2.setAttribute('d',hi.d); HR2.setAttribute('class',hi.c);
  HR2.style.display='';
}
function hover2(f){
  if(pickArm||anArm||measMode){ if(hot2) hr2Hide(); return; }
  const o=regAtOn(cmpPlate(),f[0],f[1]), ab=o?o.ab:null;
  if(ab===hot2) return;
  hot2=ab;
  if(!o){ hr2Hide(); cmpMirror1(null); return; }
  const hi=regHi(o,cmpPlate());
  HR2.setAttribute('d',hi.d); HR2.setAttribute('class',hi.c);
  HR2.style.display=''; IW2.classList.add('hot');
  cmpMirror1(ab);
}
function setCmp(on,what){
  cmpOn=!!on; if(what&&CMPWHAT.includes(what)) cmpWhat=what;
  $('ckcmp').checked=cmpOn; $('cmpsel').value=cmpWhat;
  cmpShow(); queueHash();
}
$('ckcmp').onchange=e=>setCmp(e.target.checked);
$('cmpsel').onchange=e=>setCmp(true,e.target.value);
/* the second pane answers the pointer the way the first does: the crosshair and the
   readout, the wheel and a drag. A click on a neighbouring plate goes to it. */
function s2f2(e){ const b=IW2.getBoundingClientRect(); if(!b.width||!b.height) return null;
  return [((e.clientX-b.left)-tx)/zoom/b.width*NW, ((e.clientY-b.top)-ty)/zoom/b.height*NH]; }
IW2.addEventListener('pointermove',e=>{
  if(cmpDrag){ tx+=e.clientX-cmpDrag.x; ty+=e.clientY-cmpDrag.y; cmpDrag={x:e.clientX,y:e.clientY,moved:true}; applyView(); return; }
  const f=s2f2(e); if(!f) return;
  lastPt=f; if(showXY) drawXH(f,cmpPlate());
  hover2(f);
});
let cmpDrag=null;
IW2.addEventListener('pointerdown',e=>{ if(zoom>1.01){ cmpDrag={x:e.clientX,y:e.clientY,moved:false}; try{ IW2.setPointerCapture(e.pointerId); }catch(_){} } });
IW2.addEventListener('pointerup',e=>{ const d=cmpDrag; cmpDrag=null;
  if(d&&d.moved) return;
  if(cmpWhat==='prev'||cmpWhat==='next') go(cmpPlate()); });
IW2.addEventListener('pointercancel',()=>{ cmpDrag=null; });
IW2.addEventListener('pointerleave',()=>{ $('xh2').innerHTML=''; if(hot2) { hr2Hide(); cmpMirror1(null); } });
IW2.addEventListener('wheel',e=>{
  if(!SHELL.matches && !e.ctrlKey && !e.metaKey && zoom<=1.01) return;
  e.preventDefault();
  const b=IW2.getBoundingClientRect();
  zoomAt(zoom*Math.exp(-e.deltaY*0.0016), e.clientX-b.left, e.clientY-b.top);
},{passive:false});
IW2.addEventListener('dblclick',e=>{ const b=IW2.getBoundingClientRect();
  zoomAt(zoom<ZMAX?zoom*2:1, e.clientX-b.left, e.clientY-b.top); });

/* one pointer drags, two pinch; a press that barely moves is a tap, not a drag */
const ptrs=new Map();
let moved=0, startXY=null, lastXY=null, pinch=null, noClick=false;
IW.addEventListener('pointerdown',e=>{
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){
    moved=0; startXY=lastXY={x:e.clientX,y:e.clientY};
    try{ IW.setPointerCapture(e.pointerId); }catch(_){}
    if(zoom>1.01) IW.classList.add('grab');
    if(e.pointerType==='touch') hover(e);        /* tap to read on touch */
  } else if(ptrs.size===2){
    const [a,b]=[...ptrs.values()];
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:zoom}; hideTip();
  }
});
IW.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2 && pinch){
    const [a,b]=[...ptrs.values()];
    const d=Math.hypot(a.x-b.x,a.y-b.y); if(!d) return;
    const r=iwRect();
    zoomAt(pinch.z*d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);
    moved=99; return;
  }
  if(ptrs.size===1 && lastXY){
    const dx=e.clientX-lastXY.x, dy=e.clientY-lastXY.y;
    if(startXY) moved=Math.hypot(e.clientX-startXY.x,e.clientY-startXY.y);
    lastXY={x:e.clientX,y:e.clientY};
    if(zoom>1.01){ tx+=dx; ty+=dy; hideTip(); applyView(); }
    return;
  }
  if(e.pointerType!=='touch') hover(e);
});
function endPtr(e){
  const was=ptrs.size;
  ptrs.delete(e.pointerId);
  if(ptrs.size<2) pinch=null;
  if(ptrs.size===0){
    IW.classList.remove('grab');
    if(moved>8) noClick=true;                     /* that was a drag, so swallow the click */
    startXY=lastXY=null;
  } else if(was===2){                             /* one finger lifted from a pinch */
    const p=[...ptrs.values()][0]; lastXY={x:p.x,y:p.y}; moved=99;
  }
}
IW.addEventListener('pointerup',endPtr);
IW.addEventListener('pointercancel',endPtr);
IW.addEventListener('pointerleave',e=>{ if(e.pointerType!=='touch'&&!ptrs.size) hideTip(); });

/* ---------- what a structure covers, as opposed to where its name is printed ----------
   `label_positions` locates an abbreviation; this locates the thing it names. The atlas
   publishes no segmentation, so the areas were cut from the drawing's own lines -- see
   METHODS -- and each carries the share of its boundary that the atlas actually prints.
   Stored as fractions of this same 1100 x 703 frame, so pip() below reads them unchanged.

   They tile the section: every boundary between two regions is one polyline stored twice,
   so a point is inside exactly one region, or inside none where the atlas seals a face and
   declines to name it. That is what lets a click be answered by containment rather than by
   nearest-thing, which is what the printed labels could only ever support.

   RBLK is the labels the atlas typeset out of more than one abbreviation -- "S1Tr/ LPtA",
   "Au1 (A1)". Those name one region between them, not one each, so the area is filed under
   the name the label leads with, and every other name on the label points at it. */
const RGN=window.__REGION__||{}, RDAT=RGN.r||{}, RUNA=RGN.u||{},
      RGRD=RGN.k||{traced:.9,estimated:.5}, RBLK=RGN.b||{};
const ROK=Object.keys(RDAT).length>0;

let regs=[], regBy={};
/* The index of one plate, built once and kept: the plate on screen reads it on every
   pointer move, and the track planner reads the plates a track passes through. */
const REGC={};
function regBuild(pl){
  if(REGC[pl]) return REGC[pl];
  const out={regs:[],by:{}};
  if(!ROK) return REGC[pl]=out;
  const b=RDAT[pl]||{};
  for(const ab in b){
    const v=b[ab], gs=v.g.map(g=>g.map(([x,y])=>[x*NW,y*NH]));
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9, wt=0, tf=0;
    for(let i=0;i<gs.length;i++){
      for(const [x,y] of gs[i]){
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      }
      /* area-weighted, so a long inferred arc counts for as much of the answer as it is
         of the boundary, and a scrap of a second hemisphere does not swing it */
      const w=Math.abs(shoe(gs[i])); wt+=w; tf+=v.s[i]*w;
    }
    const o={ab,gs,x0,y0,x1,y1,mm2:v.a,n:v.n,tf:wt?tf/wt:0,w:!!v.w};
    out.regs.push(o); out.by[ab]=o;
  }
  /* every name of a joined label resolves to that label's one entry -- into regBy, which
     answers "what did I select", and not into regs, which answers "what is under the
     pointer": there is one area there and it is named once. The entry keeps the other
     names too, so pointing at it can say what the plate actually prints. */
  for(const g of (RBLK[pl]||[])){
    const o=out.by[g[0]]; if(!o) continue;
    o.also=g; for(const n of g) out.by[n]=o;
  }
  /* smallest first: a structure drawn inside another has to stay reachable, which is the
     tie-break pick() already makes between two printed labels */
  out.regs.sort((p,q)=>p.mm2-q.mm2);
  /* the superstructures of this plate, unioned out of the members drawn on it. Into
     out.by, so selecting one finds it; never into out.regs, which answers "what is under
     the pointer" -- a click has to land on the structure the atlas named, not on the
     division containing it. */
  for(const g of GRP){ const o=grpRegion(g,pl,out.by); if(o) out.by[g.key]=o; }
  return REGC[pl]=out;
}
/* ---- a superstructure's outline: the union of its members', with the walls between
   them taken out ----
   The extents tile the section, so every boundary between two regions is stored twice --
   once in each -- and every boundary with the outside is stored once. Count the edges of
   the members and drop the ones that came up twice, and what is left is exactly the
   outer boundary of the union, holes included: a wall between two members cancels, a wall
   between a member and something outside the group does not. No geometry is invented and
   nothing is smoothed; every surviving edge is an edge the atlas drew.

   The survivors are then walked into closed rings. Every vertex of a region boundary has
   even degree, so the walk always closes, and where the union pinches to a point it
   simply comes back to that vertex twice. */
function grpRing(parts){
  const cnt=new Map(), pt=new Map();
  const key=p=>{ const k=p[0]+','+p[1]; if(!pt.has(k)) pt.set(k,p); return k; };
  for(const o of parts) for(const g of o.gs){
    const n=(g.length>1 && g[0][0]===g[g.length-1][0] && g[0][1]===g[g.length-1][1])
      ? g.length-1 : g.length;
    for(let i=0;i<n;i++){
      const a=key(g[i]), b=key(g[(i+1)%n]);
      if(a===b) continue;                       /* a repeated vertex is not an edge */
      const e=a<b?a+'|'+b:b+'|'+a;
      cnt.set(e,(cnt.get(e)||0)+1);
    }
  }
  const ends=[], adj=new Map();
  for(const [e,n] of cnt) if(n&1){
    const i=ends.length, k=e.split('|'); ends.push(k);
    for(const v of k){ const l=adj.get(v); l?l.push(i):adj.set(v,[i]); }
  }
  const used=new Uint8Array(ends.length), out=[];
  for(let i=0;i<ends.length;i++){
    if(used[i]) continue;
    used[i]=1; const a=ends[i][0]; let cur=ends[i][1];
    const ring=[pt.get(a),pt.get(cur)];
    while(cur!==a){
      let nx=null;
      for(const j of (adj.get(cur)||[])) if(!used[j]){
        used[j]=1; nx=ends[j][0]===cur?ends[j][1]:ends[j][0]; break;
      }
      if(nx===null) break;                      /* cannot happen on a closed boundary */
      ring.push(pt.get(nx)); cur=nx;
    }
    if(ring.length>2) out.push(ring);
  }
  return out;
}
function grpRegion(g,pl,by){
  if(!ROK || !g.plates.includes(pl)) return null;
  const parts=[], seen=new Set();
  for(const a of g.members){ const o=by[a];
    if(o && !seen.has(o.ab)){ seen.add(o.ab); parts.push(o); } }
  if(!parts.length) return null;
  const gs=grpRing(parts);
  if(!gs.length) return null;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9, wt=0, tf=0, mm2=0;
  for(const p of parts){
    if(p.x0<x0)x0=p.x0; if(p.x1>x1)x1=p.x1; if(p.y0<y0)y0=p.y0; if(p.y1>y1)y1=p.y1;
    mm2+=p.mm2; wt+=p.mm2; tf+=p.tf*p.mm2;      /* area-weighted, as within one region */
  }
  return {ab:g.key,grp:g,gs,x0,y0,x1,y1,mm2,n:gs.length,tf:wt?tf/wt:0,parts};
}
/* rebuilt per plate beside labels(), and for the same reason: only one plate is on screen */
function regIndex(){ const r=regBuild(cur); regs=r.regs; regBy=r.by; }
/* the same question of any plate, for a track that runs through several */
function regAtOn(pl,x,y){ for(const o of regBuild(pl).regs) if(regIn(o,x,y)) return o; return null; }
/* a colour per structure, the same every time, for the bars that name several at once */
function regColor(ab){
  let h=0; for(let i=0;i<ab.length;i++) h=(h*31+ab.charCodeAt(i))>>>0;
  return `hsl(${h%360} 55% 62%)`;
}
function shoe(g){
  let a=0;
  for(let i=0,j=g.length-1;i<g.length;j=i++) a+=g[j][0]*g[i][1]-g[i][0]*g[j][1];
  return a/2;
}
/* even-odd across a region's rings: the two hemispheres union, a hole subtracts, and no
   winding order has to be kept right for that to hold */
function regIn(o,x,y){
  if(x<o.x0||x>o.x1||y<o.y0||y>o.y1) return false;
  let c=false; for(const g of o.gs) if(pip(g,x,y)) c=!c;
  return c;
}
function regAt(x,y){ for(const o of regs) if(regIn(o,x,y)) return o; return null; }
function regD(o){
  return o.gs.map(g=>'M'+g.map(([x,y])=>x.toFixed(1)+' '+y.toFixed(1)).join('L')+'Z').join('');
}
/* selected by one name of a label that prints several: say so, rather than leave the
   outline looking like it belongs to the one name alone */
function blkTxt(o){
  return o.also ? ` · printed <b>${esc(o.also.join('/'))}</b>, one region` : '';
}
/* how the boundary got there, said plainly rather than as a number nobody can place */
function regTxt(o){
  const q=o.w ? 'printed inside a boundary the atlas draws round more than one name — '+
                'it draws none of its own here'
        : o.tf>=RGRD.traced ? `boundary ${(100*o.tf).toFixed(0)}% drawn`
        : o.tf>=RGRD.estimated ? `boundary ${(100*o.tf).toFixed(0)}% drawn, the rest inferred`
        : 'boundary mostly inferred — the atlas does not print one here';
  return `${o.mm2.toFixed(o.mm2<1?3:2)} mm² on this plate · ${q}`;
}
const regEst = o => o.tf < RGRD.estimated;
/* ---- the names the atlas draws no boundary around ----
   `w` marks an entry that lies only inside bounds the atlas draws around more than one
   name and prints nothing within: the cerebellar lobules against each other are the
   largest of them, and the mediodorsal thalamus and the lateral hypothalamic zones most
   of the rest. Not a lobule against `cbw` any more -- that is not a boundary the atlas
   omits, it is a name that is no region, and isFeat() above is where it is answered.
   The extraction still cuts these apart,
   because a section has to be partitioned before a track or a volume can be read off it,
   but the cut is its own. Drawing it would put a line on the plate this atlas does not
   have, and a dashed one still reads as a boundary. So none is drawn: what is highlighted
   instead is every place the name is printed, which is the whole of what the plate says
   about where the structure is. */
const regUnd = o => !!o.w;
/* the extent to outline for a name, which is none where the atlas draws none */
const regOut = ab => { const o=regBy[ab]; return o && !regUnd(o) ? o : null; };
/* every box the plate prints this name in -- both names of a joined label, since one
   region carries them both */
function labBoxes(o,pl){
  const b=LB[pl===undefined?cur:pl]||{}, out=[];
  for(const n of (o.also||[o.ab])) for(const [cx,cy,w,h] of (b[n]||[]))
    out.push([cx*NW-w*NW/2-2, cy*NH-h*NH/2-2, cx*NW+w*NW/2+2, cy*NH+h*NH/2+2]);
  return out;
}
const boxD = bs => bs.map(([x0,y0,x1,y1])=>`M${x0.toFixed(1)} ${y0.toFixed(1)}`+
  `H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`).join('');
/* what a highlight draws for a region: its outline, or the printed names where there is
   no outline to draw. A `w` region with no located label on the plate falls back to the
   outline, because a highlight that draws nothing at all answers nothing. */
function regHi(o,pl){
  const bs = regUnd(o) ? labBoxes(o,pl) : null;
  return bs && bs.length ? {d:boxD(bs), c:'lab'}
                         : {d:regD(o), c:regEst(o)?'est':''};
}
/* the same sentence for a union, which cannot borrow regTxt(): most of what the members
   draw is interior wall that the union throws away, so a share of *their* boundary is not
   a share of the outline on screen. What can be said exactly is the area -- the atlas's
   own numbers, added up -- and how many of the members are drawn from a boundary the
   atlas mostly does not print, which is where an edge of this outline could be invented. */
function grpTxt(o,g){
  const n=o.parts.length, est=o.parts.filter(regEst).length;
  return `${o.mm2.toFixed(o.mm2<1?3:2)} mm² on this plate, over ${n} of its ${g.n_members} `+
    `structure${g.n_members>1?'s':''}`+
    (est?` · ${est} of them ${est>1?'have boundaries':'has a boundary'} the atlas mostly `+
         `does not print, so parts of this edge are inferred`:'');
}

/* ---------- hover a printed label to read it, click it to select ---------- */
const TOL=6;                       /* viewBox units of slop around a printed label */
let labs=[], hot=null;

/* flat index of every located label on the current plate */
function labels(){
  const b=LB[cur]||{}; labs=[];
  for(const ab in b) for(const [cx,cy,w,h] of b[ab]){
    const bw=w*NW, bh=h*NH;
    labs.push({ab,x0:cx*NW-bw/2,y0:cy*NH-bh/2,x1:cx*NW+bw/2,y1:cy*NH+bh/2,a:bw*bh});
  }
  regIndex();
  hideTip();
}
/* containment beats proximity; among equally good hits the smaller label wins */
function pick(px,py,tol){
  const T=tol===undefined?TOL:tol;
  let best=null,bs=Infinity;
  for(const L of labs){
    const dx=Math.max(L.x0-px,0,px-L.x1), dy=Math.max(L.y0-py,0,py-L.y1);
    if(dx>T||dy>T) continue;
    const s=dx*dx+dy*dy;
    if(s<bs-1e-9 || (s<bs+1e-9 && best && L.a<best.a)){ best=L; bs=s; }
  }
  return best;
}
/* A hit on the printed abbreviation itself is unambiguous and wins outright -- but what it
   identifies is a structure, and a structure is an area, so it is answered with the area.
   Highlighting the word instead answers "where is this printed", which is not the question
   anyone asks of a brain atlas. Failing a hit on a name, the region answers by containment,
   which is what the extents were extracted for. The box is the answer only where there is
   no area to give it: the names that are no region -- `cbw`, the fissures, the vessels;
   see isFeat() -- and the structures no extent could be cut for. Those stay live, and they
   are the ones that most need the tip, since nothing about them is otherwise readable off
   the plate. `cbw` is the case to keep in mind: point at the word and it answers `cbw`,
   move a few pixels off it and the answer is the lobule whose white matter that is, which
   is exactly the two questions being asked. The near-miss slop stays last for the same
   reason. */
function pickAny(px,py){
  const at = L => L && (regBy[L.ab] ? {k:'r',ab:L.ab,o:regBy[L.ab]} : {k:'l',ab:L.ab,L});
  return at(pick(px,py,0)) || (o => o && {k:'r',ab:o.ab,o})(regAt(px,py))
      || at(pick(px,py)) || null;
}
/* keyed by the name pointed at and the region it resolved to, so moving from a label
   onto the area it names still registers as a move */
const hotKey = h => h ? h.k+'|'+h.ab+'|'+(h.o?h.o.ab:'') : '';
function hideTip(){
  TIP.hidden=true; HL.style.display='none'; HR.style.display='none';
  IW.classList.remove('hot'); hot=null;
  cmpMirror2(null);
}
function tipBody(ab,extra){
  const r=byAb[ab];
  TIP.innerHTML=`<span class="ta">${esc(ab)}</span>`+
    `<span class="tn">${esc(r?r.name:'not in the published index')}</span>`+
    (r?`<span class="tx">plates ${r.first_plate===r.last_plate?r.first_plate:r.first_plate+'–'+r.last_plate}`+
       ` · bregma ${r.bregma_anterior.toFixed(2)} to ${r.bregma_posterior.toFixed(2)} mm</span>`:'')+
    (extra?`<span class="tx">${esc(extra)}</span>`:'');
  TIP.hidden=false; IW.classList.add('hot');
}
/* hovering the area rather than the printed name: outline what is under the pointer, and
   say how much of that outline the atlas actually draws */
function showTipR(o,ab){
  tipBody(ab||o.ab, regTxt(o) + (o.also ? ' · printed '+o.also.join('/') : ''));
  const hi=regHi(o);
  HR.setAttribute('d',hi.d); HR.setAttribute('class',hi.c);
  HR.style.display=''; HL.style.display='none';
  const b=iwRect(), tw=TIP.offsetWidth, th=TIP.offsetHeight;
  const [x0,y0]=f2s(o.x0,o.y0), [x1,y1]=f2s(o.x1,o.y1);
  let x=(x0+x1)/2-tw/2; x=Math.max(2,Math.min(b.width-tw-2,x));
  let y=y0-th-7;        if(y<2) y=Math.min(y1+7,b.height-th-2);
  TIP.style.left=x.toFixed(1)+'px'; TIP.style.top=y.toFixed(1)+'px';
}
/* the box is the answer: either the name is no region -- and then the tip says which kind
   of thing it is, because "cbw has no outline" is not an answer, "cbw is the white matter
   of the lobules it runs through" is -- or no extent could be cut, and there is nothing
   more to say than the name and its plates */
function showTip(L){
  tipBody(L.ab, featTxt(L.ab));
  HL.setAttribute('x',(L.x0-2).toFixed(1));
  HL.setAttribute('y',(L.y0-2).toFixed(1));
  HL.setAttribute('width',(L.x1-L.x0+4).toFixed(1));
  HL.setAttribute('height',(L.y1-L.y0+4).toFixed(1));
  HL.style.display=''; HR.style.display='none';
  const b=iwRect(), tw=TIP.offsetWidth, th=TIP.offsetHeight;
  const [x0,y0]=f2s(L.x0,L.y0), [x1,y1]=f2s(L.x1,L.y1);
  let x=(x0+x1)/2-tw/2; x=Math.max(2,Math.min(b.width-tw-2,x));
  let y=y0-th-7;        if(y<2) y=y1+7;
  TIP.style.left=x.toFixed(1)+'px'; TIP.style.top=y.toFixed(1)+'px';
}
function hover(e){
  const f=s2f(e); if(!f) return;
  lastPt=f;
  if(showXY) drawXH(f);
  /* armed for a pick, the plate is a surface to aim at, not a legend to read */
  if(pickArm||anArm){ if(hot) hideTip(); return; }
  if(measMode){ if(mA&&!mB){ mHover=f; drawMeas(); } if(hot) hideTip(); return; }
  const h=pickAny(f[0],f[1]);
  /* compared by key, not identity: pickAny wraps a fresh object each call, so `h===hot`
     would never hold and the tip would be rebuilt on every mousemove */
  if(hotKey(h)===hotKey(hot)) return;
  hot=h;
  if(!h) hideTip(); else if(h.k==='r') showTipR(h.o,h.ab); else showTip(h.L);
  if(h) cmpMirror2(h.ab);
}
IW.addEventListener('click',e=>{
  if(noClick){ noClick=false; return; }          /* the pointer was dragged, not tapped */
  const f=s2f(e); if(!f) return;
  const nt=anShow&&anAt(e); if(nt){ anOpen(nt); return; }
  if(anArm){ anPlace(f); return; }
  if(pickArm){ takePick(f); return; }
  if(measMode){
    if(!mA||mB){ mA=f; mB=null; mHover=null; } else { mB=f; }
    drawMeas(); return;
  }
  const h=pickAny(f[0],f[1]);
  if(!h) clear();                     /* bare plate, or a face the atlas leaves unnamed */
  else if(byAb[h.ab]) select(h.ab);   /* every printed label is indexed, but guard as showTip() does */
});
addEventListener('scroll',()=>{ if(hot) hideTip(); if(phot) pjHide(); },{passive:true,capture:true});
let rszT=null;
addEventListener('resize',()=>{ hideTip(); pjHide();
  if(rszT) return; rszT=requestAnimationFrame(()=>{ rszT=null; fit(); applyView(); }); });
/* a warning where the hint line is, in place of a modal alert; it goes when the plate
   is next redrawn or after a moment, whichever is first */
let hintT=null;
function hintWarn(msg){
  const vh=$('vhint'); vh.className='vhint warn'; vh.textContent=msg;
  clearTimeout(hintT); hintT=setTimeout(()=>{ hintT=null; mark(); },4000);
}

/* ---------- notes: your own markers on the plates ----------
   A note is a point on a plate with a line of text: an electrode tip found in the
   histology afterwards, a lesion, a place to come back to. Kept in this browser,
   exported and imported as JSON, and carried in a link while there are few enough to
   fit in one. Stored on its plate and in atlas millimetres, so it draws on the plate,
   the projections and the 3-D view alike, and reads out in whatever frame is set. */
let NOTES=[], anShow=false, anArm=false, anEdit=null, anClrT=null;
const anOK = n => n && plateOf[n.p] && Number.isFinite(n.x) && Number.isFinite(n.y) &&
  n.x>=0 && n.x<=1 && n.y>=0 && n.y<=1 && typeof n.t==='string';
try{ NOTES=(JSON.parse(localStorage.getItem('gae-notes')||'[]')||[]).filter(anOK).map(n=>anMake(n.p,n.x,n.y,n.t,n.id)); }catch(_){}
function anSave(){ try{ localStorage.setItem('gae-notes',JSON.stringify(NOTES)); }catch(_){} }
function anMake(p,x,y,t,id){
  return {id:id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6)), p:+p,
          x:+(+x).toFixed(4), y:+(+y).toFixed(4), ap:plateOf[p].bregma,
          ml:+toML(x*NW).toFixed(2), dv:+toDV(y*NH).toFixed(2), t:String(t||'').slice(0,200)};
}
function anDraw(){
  const g=$('an');
  g.innerHTML = anShow ? NOTES.filter(n=>n.p===cur).map(n=>
    `<g class="note" data-id="${esc(n.id)}"><circle cx="${(n.x*NW).toFixed(1)}" cy="${(n.y*NH).toFixed(1)}" r="6"/>`+
    `<text x="${(n.x*NW+9).toFixed(1)}" y="${(n.y*NH-8).toFixed(1)}">${esc(n.t)}</text></g>`).join('') : '';
  anPJ(); if(typeof v3frame==='function') v3frame();
}
/* the note under a click, if any. The wrapper takes pointer capture on pointerdown, so
   the click is retargeted to it and a handler on the marker would never fire; asked of
   the point instead, which is what the marker is under. */
function anAt(e){
  const el=document.elementFromPoint(e.clientX,e.clientY), g=el&&el.closest&&el.closest('#an .note');
  return g ? NOTES.find(x=>x.id===g.dataset.id) : null;
}
/* the form sits by the point, like the tip does */
function anOpen(n){
  anEdit=n; const f=$('anf'); f.hidden=false;
  $('ant').value=n.t||''; $('andel').hidden=!NOTES.includes(n);
  const [sx,sy]=f2s(n.x*NW,n.y*NH), b=iwRect();
  f.style.left=Math.max(2,Math.min(b.width-f.offsetWidth-2,sx+12)).toFixed(1)+'px';
  f.style.top=Math.max(2,Math.min(b.height-f.offsetHeight-2,sy+12)).toFixed(1)+'px';
  $('ant').focus();
}
function anClose(){ anEdit=null; $('anf').hidden=true; }
function anChanged(){ anSave(); anDraw(); anList(); queueHash(); }
$('anf').onsubmit=e=>{ e.preventDefault(); if(!anEdit) return;
  anEdit.t=$('ant').value.trim().slice(0,200);
  if(!NOTES.includes(anEdit)) NOTES.push(anEdit);
  anClose(); anChanged(); };
$('andel').onclick=()=>{ NOTES=NOTES.filter(n=>n!==anEdit); anClose(); anChanged(); };
$('ancan').onclick=anClose;
function anArmSet(on){
  anArm=!!on; $('anadd').classList.toggle('armed',anArm); IW.classList.toggle('pick',anArm);
  $('anadd').setAttribute('aria-pressed',anArm?'true':'false');
  if(anArm){ setPick(false); if(measMode){ $('ckm').checked=false; setMeas(false); } }
  hideTip(); mark();
}
function anPlace(f){ anArmSet(false); anOpen(anMake(cur,f[0]/NW,f[1]/NH,'')); }
function anShowSet(on){
  anShow=!!on; $('ckan').checked=anShow; $('anadd').hidden=!anShow;
  if(!anShow){ anArmSet(false); anClose(); }
  anDraw(); queueHash();
}
$('ckan').onchange=e=>anShowSet(e.target.checked);
$('anadd').onclick=()=>anArmSet(!anArm);
/* the same notes on the projections, and listed in their pane */
function anPJ(){
  const g=$('pjan'); if(!g) return;
  if(!anShow||!NOTES.length){ g.innerHTML=''; return; }
  const V=VIEWS[pview];
  /* a note is a point like any other, so it turns with the cloud rather than staying
     behind in atlas coordinates while the dots it was placed against move */
  g.innerHTML=NOTES.map(n=>{ const c=pjq(n);
    return `<circle cx="${pjx(c.ap).toFixed(1)}" cy="${pjy(V,c[V.k]).toFixed(1)}" r="4.5"><title>${esc(n.t)} (plate ${n.p})</title></circle>`; }).join('');
}
function anList(){
  const el=$('anlist'); if(!el) return;
  $('ancnt').textContent=NOTES.length?`${NOTES.length} note${NOTES.length>1?'s':''}, kept in this browser`:'';
  if(!NOTES.length){ el.innerHTML='<p class="empty">No notes yet. Tick <b>Notes</b> over the plate, press <b>Add</b>, and click where the note belongs.</p>'; return; }
  const F=FRAME.on?1:0;
  el.innerHTML=[...NOTES].sort((a,b)=>a.p-b.p).map(n=>{ const q=toFrame(n.ap,n.ml,n.dv);
    return `<div class="rrow anrow" data-id="${esc(n.id)}" role="button" tabindex="0">`+
      `<span class="pl">plate ${n.p}</span><span class="nm">${n.t?esc(n.t):'<i>untitled</i>'}</span><span></span>`+
      `<span class="rd2">${apLab(F)} ${sgn(q.ap)} · ML ${sgn(q.ml)} · DV ${sgn(q.dv)} mm</span></div>`; }).join('');
  [...el.querySelectorAll('.anrow')].forEach(r=>{
    const act=()=>{ const n=NOTES.find(x=>x.id===r.dataset.id); if(!n) return;
      if(!anShow) anShowSet(true); setTab('plate'); go(n.p); anOpen(n); };
    r.onclick=act; r.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } };
  });
}
$('anexp').onclick=()=>{
  const j={app:'Gerbil Atlas Explorer', build:BUILD||null, generated:new Date().toISOString(),
    coordinates:'atlas: ap = bregma of the plate, ml and dv in mm; x, y are fractions of the 1100 x 703 plate frame',
    notes:NOTES};
  const u=URL.createObjectURL(new Blob([JSON.stringify(j,null,2)],{type:'application/json'}));
  dl('gerbil_atlas_notes.json',u,u);
};
$('animp').onchange=e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  f.text().then(t=>{
    let j; try{ j=JSON.parse(t); }catch(_){ hintWarn('That file is not JSON.'); return; }
    const arr=Array.isArray(j)?j:(j&&Array.isArray(j.notes)?j.notes:[]);
    const have=new Set(NOTES.map(n=>n.id)); let k=0;
    for(const n of arr) if(anOK(n)&&!have.has(n.id)){ NOTES.push(anMake(n.p,n.x,n.y,n.t,n.id)); k++; }
    anChanged(); hintWarn(k?`${k} note${k>1?'s':''} imported.`:'Nothing new in that file.');
  });
  e.target.value='';
};
$('anclr').onclick=()=>{
  const b=$('anclr');
  if(anClrT){ clearTimeout(anClrT); anClrT=null; NOTES=[]; anClose(); anChanged(); b.textContent='Clear all'; return; }
  b.textContent='Click again to clear'; anClrT=setTimeout(()=>{ anClrT=null; b.textContent='Clear all'; },3000);
};
/* a link carries the notes while they fit: plate, the two fractions and the text */
function anHash(){
  if(!anShow||!NOTES.length||NOTES.length>8) return '';
  return '&an='+NOTES.map(n=>`${n.p}~${n.x}~${n.y}~${encodeURIComponent(n.t)}`).join('~~');
}
function anFromHash(v){
  if(!v) return;
  const have=new Set(NOTES.map(n=>`${n.p}|${n.x}|${n.y}|${n.t}`)); let k=0;
  for(const part of v.split('~~')){
    const f=part.split('~'); if(f.length<4) continue;
    const p=+f[0], x=+f[1], y=+f[2]; let t=''; try{ t=decodeURIComponent(f.slice(3).join('~')); }catch(_){}
    if(!plateOf[p]||!(x>=0&&x<=1&&y>=0&&y<=1)) continue;
    if(!have.has(`${p}|${x}|${y}|${t}`)){ NOTES.push(anMake(p,x,y,t)); k++; }
  }
  if(k) anSave();
  anShowSet(true);
}

/* ---------- coordinate readout, grid, scale bar ---------- */
function drawXH(f,pl){
  if(!showXY){ $('xh').innerHTML=''; $('xh2').innerHTML=''; return; }
  const x=f[0].toFixed(1), y=f[1].toFixed(1);
  $('xh').innerHTML=`<line x1="${BX0}" y1="${y}" x2="${BX1}" y2="${y}"/>`+
                    `<line x1="${x}" y1="${BY0}" x2="${x}" y2="${BY1}"/>`;
  $('xh2').innerHTML=cmpOn?$('xh').innerHTML:'';
  const p=plateOf[pl||cur];
  const ml=toML(f[0]), dv=toDV(f[1]);
  if(FRAME.on){
    /* AP is no longer a property of the plate: tilt the frame and it drifts down the
       section, by sin(pitch) per millimetre of DV -- about 2.5 mm across the brain at
       17 degrees. So the readout gives the AP of this point, not of the plate. */
    const q=toFrame(p.bregma,ml,dv);
    $('rd').innerHTML=`${apLab(1)} <b>${sgn(q.ap)}</b> · ML <b>${sgn(q.ml)}</b> · DV <b>${sgn(q.dv)}</b> mm`+
      `<span class="atl">atlas bregma ${sgn(p.bregma)} · ML ${sgn(ml)} · DV ${sgn(dv)}</span>`;
  } else {
    $('rd').innerHTML=`bregma <b>${sgn(p.bregma)}</b> · ML <b>${sgn(ml)}</b> · DV <b>${sgn(dv)}</b> mm`+
      `<span style="color:var(--muted)"> · interaural ${sgn(p.interaural)}</span>`;
  }
}
function drawGrid(){
  const g=$('grid');
  if(!showGrid){ g.innerHTML=''; return; }
  let s='';
  for(let m=-8;m<=8;m++){ const x=fromML(m).toFixed(1);
    s+=`<line class="${m?'':'ax'}" x1="${x}" y1="${BY0}" x2="${x}" y2="${BY1}"/>`; }
  for(let v=1;v>=-10;v--){ const y=fromDV(v).toFixed(1);
    s+=`<line class="${v?'':'ax'}" x1="${BX0}" y1="${y}" x2="${BX1}" y2="${y}"/>`; }
  g.innerHTML=s;
}
function drawSB(){
  const el=$('sb');
  if(!showSB){ el.hidden=true; return; }
  const b=iwRect(); if(!b.width) return;
  const pxmm=ML_PXMM*(b.width/NW)*zoom;
  let mm=0.25; for(const c of [0.25,0.5,1,2,5,10]) if(c*pxmm<=b.width*0.34) mm=c;
  el.hidden=false;
  $('sbb').style.width=(mm*pxmm).toFixed(1)+'px';
  $('sbl').textContent=(mm<1? mm*1000+' µm' : mm+' mm');
}

/* ---------- measure between two points on the plate ---------- */
function drawMeas(){
  const g=$('ms'), out=$('rm'), was=out.hidden;
  const done=()=>{ if(out.hidden!==was) fit(); };
  if(!mA){ g.innerHTML=''; out.hidden=true; done(); return; }
  const B=mB||mHover;
  const dot=p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"/>`;
  g.innerHTML=(B?`<line class="${mB?'':'gh'}" x1="${mA[0].toFixed(1)}" y1="${mA[1].toFixed(1)}"`+
                 ` x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}"/>`:'')+dot(mA)+(mB?dot(mB):'');
  if(!B){ out.hidden=false; out.textContent='Click a second point to measure.'; done(); return; }
  const dml=toML(B[0])-toML(mA[0]), ddv=toDV(B[1])-toDV(mA[1]);
  const d=Math.hypot(dml,ddv), ang=Math.atan2(dml,-ddv)*180/Math.PI;
  out.hidden=false;
  out.innerHTML=`<b>${d.toFixed(2)} mm</b> in plane · ΔML ${sgn(dml)} · ΔDV ${sgn(ddv)}`+
    ` · ${Math.abs(ang).toFixed(1)}° from vertical`+
    /* a rotation preserves length, so the millimetres hold in any frame; the angle does
       not, and this tool was scoped to stay in the atlas, so it says which frame it is in.
       A re-zero changes neither -- both readings are differences -- so it says nothing. */
    (FRAME.on&&rotated()?` <span class="fnote" title="A rotation preserves length, so the millimetres`+
      ` hold in any frame. The angle does not — this tool was left in atlas coordinates.">`+
      `in the atlas frame</span>`:'')+
    (mB?` <button type="button" class="z" id="mclr">Clear</button>`:'');
  if(mB) $('mclr').onclick=()=>{ mA=mB=mHover=null; drawMeas(); };
  done();
}
function setMeas(on){
  measMode=on; IW.classList.toggle('meas',on);
  if(!on){ mA=mB=mHover=null; }
  if(on) setPick(false);            /* both want the next click; measuring just took it */
  drawMeas(); hideTip(); fit(); queueHash();
}

const RDHINT='Move the pointer over the plate to read its coordinates.';
$('ckc').onchange=e=>{ showXY=e.target.checked; $('rd').hidden=!showXY;
  if(!showXY) $('xh').innerHTML='';
  else if(lastPt) drawXH(lastPt); else $('rd').textContent=RDHINT;
  fit(); queueHash(); };
$('ckg').onchange=e=>{ showGrid=e.target.checked; drawGrid(); queueHash(); };
$('cks').onchange=e=>{ showSB=e.target.checked; drawSB(); queueHash(); };
$('ckm').onchange=e=>setMeas(e.target.checked);
$('cksk').onchange=e=>{ showSK=e.target.checked; drawSK(); queueHash(); };
$('cklm').onchange=e=>{ showLM=e.target.checked; drawLM(); queueHash(); };

/* ---------- planning a track ----------
   Where a track enters, what angles it needs, and how far it has to be driven. Three
   things make this different from the measure tool, which it does not replace: it is a
   line in space rather than one in a plane, it is measured from a surface rather than
   between two clicks, and it is stated in your working frame rather than the atlas's.

   That last one is the decision the rest follows from. The atlas is cut perpendicular to
   the brainstem axis; a head in a stereotaxic frame is not. An angle quoted in atlas
   coordinates is one nobody can dial into a manipulator, so the target is carried into
   the working frame by toFrame(), the track is built there, and fromFrame() is used only
   to put it back on the plates for drawing. With no frame set the two coincide.

   The drawing is therefore exact in any frame, which is why -- unlike the grid, the
   measure tool and the projections -- nothing here has to be hedged as "in the atlas
   frame". Every number below is a number for your rig. */

/* The brain surface, as the outline of each plate's section: one closed polygon on most
   plates, more where the drawing genuinely separates -- the interhemispheric fissure on
   plates 10-14, cortex from midbrain on 37-42, cerebellum from brainstem on 56-59.
   Extracted from the drawings by the same flood fill the 3-D view runs; see METHODS. */
const OUTL={};
for(const p in OUTLINE)
  OUTL[p]=OUTLINE[p].map(g=>g.map(([x,y])=>[toML(x*NW),toDV(y*NH)]));
const OUTOK = Object.keys(OUTL).length===P.length;

/* the AP step of the series, taken from the plates rather than assumed, so a build with a
   different sampling still resolves an AP to the right section */
const PSTEP = P.length>1 ? Math.abs(P[1].bregma-P[0].bregma) : .35;
/* Which section an AP falls on. Nothing interpolates between plates: the outlines are
   350 um apart and an interpolated surface would be arithmetic, not anatomy, the same
   objection the 3-D view's streaking already carries. So the surface is the nearest
   plate's, and an entry AP is quantised at the section spacing however smooth the drawn
   line looks. Beyond either end of the series there is no atlas, and so no brain. */
function plateAt(ap){
  let i=Math.round((P[0].bregma-ap)/PSTEP), best=-1, bd=1e9;
  for(let k=i-2;k<=i+2;k++){
    if(k<0||k>=P.length) continue;
    const d=Math.abs(P[k].bregma-ap); if(d<bd){ bd=d; best=k; }
  }
  return (best<0||bd>PSTEP/2+1e-9) ? null : P[best];
}
function pip(g,x,y){
  let c=false;
  for(let i=0,j=g.length-1;i<g.length;j=i++){
    const a=g[i], b=g[j];
    if((a[1]>y)!==(b[1]>y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c=!c;
  }
  return c;
}
/* atlas millimetres in, is this inside the section */
function inBrain(ap,ml,dv){
  const p=plateAt(ap); if(!p) return false;
  const gs=OUTL[p.plate]; if(!gs) return false;
  for(const g of gs) if(pip(g,ml,dv)) return true;
  return false;
}

/* ---- the probe direction ----
   Down, rolled about AP, tilted about ML, and the whole heading then turned about DV.
   Yaw goes outside the other two on purpose: a straight probe spun about its own axis
   points where it pointed before, so a yaw applied to the down vector first could never
   do anything at all. Outside, it turns whichever way the tilt and roll are aiming --
   and is still inert while both of those are zero, which the panel says rather than
   leaving a control that refuses to move.

   This is not the order the Frame dialog composes in, and deliberately: that one turns
   the animal, this one turns the probe, and the two are different objects. Each angle is
   named here by what it does to the tip, which is the same reason the frame names its own
   by what they do to the head. */
function tgDir(){
  const r=Math.PI/180, t=tgTilt*r, p=tgRoll*r, y=tgYaw*r;
  let a=0, m=0, v=-1, s, c;
  c=Math.cos(p); s=Math.sin(p); [m,v]=[m*c-v*s, m*s+v*c];      /* roll  about AP  */
  c=Math.cos(t); s=Math.sin(t); [a,v]=[a*c-v*s, a*s+v*c];      /* tilt  about ML  */
  c=Math.cos(y); s=Math.sin(y); [a,m]=[a*c-m*s, a*s+m*c];      /* yaw   about DV  */
  return [a,m,v];
}

/* which plates an abbreviation is actually printed on, in order. Not r.plates: that is
   the range the structure is listed for, and a structure present at a level is not
   necessarily labelled there. Only a plate carrying a label can be a plate to read one
   from. */
function tgPlates(a){
  const v=(a&&ptsOf[a])||[];
  return [...new Set(v.map(q=>q.p))].sort((x,y)=>x-y);
}

/* the target: the label centre of the selection, folded onto the chosen hemisphere.
   Folded in atlas coordinates, where the atlas really is mirror-symmetric and the fold is
   exact, and only then carried into the frame -- and each label separately, because a
   median is not linear and the median of the rotated points is not the rotation of the
   median. That makes this the same number the structure card prints.

   Two things narrow it. A plate, if one is named: a structure that spans a dozen sections
   has a label on each, and the median of all of them is a point in the middle of the
   structure rather than a point on the section anybody is aiming at. And an offset, which
   moves the aim off the label -- 0.2 mm dorsal to it, say. The offset goes on beside the
   fold, in atlas millimetres and before the carry into the frame, because it is part of
   naming the target and naming a target is anatomy: "dorsal" has to mean dorsal in the
   brain, not up the manipulator's own axis. Everything downstream of here -- the entry,
   the angles, the drive -- is still the rig's. The line between the two is exactly this
   function. ML is signed by the hemisphere so that "lateral" is lateral on both, and the
   two sides stay mirror images the way the side toggle promises.

   Both are affine, so folding label by label still commutes with the median: adding a
   constant to every point moves the median by that constant, whichever frame it is
   measured in. */
function tgTarget(){
  let v=sel&&ptsOf[sel];
  if(!v||!v.length) return null;
  let pick=0;
  if(tgPlate){ const u=v.filter(q=>q.p===tgPlate); if(u.length){ v=u; pick=tgPlate; } }
  const o={ap:tgOff.ap, ml:targSide*tgOff.ml, dv:tgOff.dv};
  const carry=f=>{
    const w=v.map(f).map(q=>FRAME.on?toFrame(q.ap,q.ml,q.dv):q);
    return {ap:med(w.map(q=>q.ap)), ml:med(w.map(q=>q.ml)), dv:med(w.map(q=>q.dv))};
  };
  const L=carry(q=>({ap:q.ap, ml:targSide*Math.abs(q.ml), dv:q.dv}));
  const T=carry(q=>({ap:q.ap+o.ap, ml:targSide*Math.abs(q.ml)+o.ml, dv:q.dv+o.dv}));
  T.n=v.length; T.pick=pick; T.L=L;
  return T;
}
const tgBack = q => FRAME.on ? fromFrame(q.ap,q.ml,q.dv) : q;
/* what to print the target as: an abbreviation, or a division's label rather than the
   `@id` it is keyed by */
const tgName = o => (byAb[o.abbr]||{}).abbr || o.abbr;

/* ---- where the track leaves the brain ----
   Marched from well outside back toward the target, taking the outermost point that is
   inside AND has a fifth of a millimetre of brain behind it. The guard is there because
   the outlines are honest: the drawing points at labels printed outside the section with
   leader lines a few pixels wide, and the contour runs out along them. A rule that took
   the first crossing outright would call one of those the brain surface. Coarse pass
   first, then a fine one inside the step it found, so this stays cheap enough to redraw
   on every keystroke. */
const TG_MAX=22, TG_C=.02, TG_F=.002, TG_GUARD=.20;
function tgWalk(T,d){
  const at=s=>({ap:T.ap-d[0]*s, ml:T.ml-d[1]*s, dv:T.dv-d[2]*s});
  const inb=s=>{ const q=tgBack(at(s)); return inBrain(q.ap,q.ml,q.dv); };
  const solid=(s,step)=>{                       /* brain all the way in for the guard */
    for(let k=1;k*step<=TG_GUARD;k++){ const s2=s-k*step; if(s2<0) return true; if(!inb(s2)) return false; }
    return true;
  };
  let hit=null;
  for(let s=Math.round(TG_MAX/TG_C)*TG_C; s>=0; s-=TG_C)
    if(inb(s)&&solid(s,TG_C)){ hit=s; break; }
  if(hit===null) return null;
  for(let s=hit+TG_C-TG_F; s>hit; s-=TG_F)      /* refine within the coarse step */
    if(inb(s)&&solid(s,TG_F)) return {s, p:at(s)};
  return {s:hit, p:at(hit)};
}
/* the dorsal surface straight above a point, in atlas millimetres -- what tells a track
   that entered on the flank of the section from one that came in through the top */
function tgSurf(ap,ml){
  const inb=dv=>inBrain(ap,ml,dv);
  for(let dv=1.2; dv>-10; dv-=TG_C){
    if(!inb(dv)) continue;
    let ok=true;
    for(let k=1;k*TG_C<=TG_GUARD;k++) if(!inb(dv-k*TG_C)){ ok=false; break; }
    if(ok) return dv;
  }
  return null;
}

let tgPlan=null;
function tgSolve(){
  tgPlan=null;
  if(!OUTOK||!sel) return;
  const T=tgTarget(); if(!T) return;
  const Ta=tgBack(T), pl=plateAt(Ta.ap);
  const La=tgBack(T.L), lpl=plateAt(La.ap);
  const o={abbr:sel, side:targSide, T, Ta, plate:pl?pl.plate:null,
           pick:T.pick, La, lplate:lpl?lpl.plate:null,
           inside:inBrain(Ta.ap,Ta.ml,Ta.dv), d:tgDir()};
  const w=tgWalk(T,o.d);
  if(w){
    o.len=w.s; o.E=w.p; o.Ea=tgBack(w.p);
    o.deg=Math.acos(Math.max(-1,Math.min(1,-o.d[2])))*180/Math.PI;
    o.head=Math.atan2(o.d[1],o.d[0])*180/Math.PI;
    o.down=o.E.dv-T.dv;
    o.across=Math.hypot(o.E.ap-T.ap, o.E.ml-T.ml);
    const s=tgSurf(o.Ea.ap,o.Ea.ml);
    o.flank = s!==null && s-o.Ea.dv>.5;
  }
  const v=tgWalk(T,[0,0,-1]);                   /* the comparison everyone wants */
  if(v) o.vert=v.s;
  o.path=tgPath(o);
  o.foot=tgFootprint(o);
  tgPlan=o;
}

/* ---- an injection's footprint ----
   A sphere of a given radius about the target, read against the same extents: the share
   of its volume that falls in each structure, and the share outside the section. A bolus
   is not a sphere and does not stop at a boundary, so this says where a sphere of that
   volume sits, not where an injection goes. Read on a lattice fine enough for about
   sixteen samples across, each resolved on its nearest plate. */
function tgFootprint(o){
  if(!tgFoot||!ROK) return null;
  const r=tgFoot, c=o.Ta, h=Math.max(.03,r/8), tally=new Map(); let n=0;
  for(let x=-r;x<=r+1e-9;x+=h) for(let y=-r;y<=r+1e-9;y+=h) for(let z=-r;z<=r+1e-9;z+=h){
    if(x*x+y*y+z*z>r*r) continue;
    n++;
    const ap=c.ap+x, ml=c.ml+y, dv=c.dv+z, pl=plateAt(ap);
    let key, ab=null, name;
    if(!pl){ key='off'; name='beyond the plate series'; }
    else if(!inBrain(ap,ml,dv)){ key='out'; name='outside the section'; }
    else {
      const g=regAtOn(pl.plate, fromML(ml), fromDV(dv));
      if(g){ key='r:'+g.ab; ab=g.ab; name=byAb[g.ab]?byAb[g.ab].name:''; }
      else { key='un'; name='a face the atlas leaves unnamed'; }
    }
    const t=tally.get(key)||{ab,name,n:0}; t.n++; tally.set(key,t);
  }
  const rows=[...tally.values()].map(t=>({ab:t.ab,name:t.name,share:t.n/n})).sort((a,b)=>b.share-a.share);
  return {r,vol:footVol(r),rows,n};
}
function tgFootHTML(o){
  const el=$('tfootl'), F=o&&o.foot;
  $('tfootv').textContent = tgFoot ? '≈ '+footVolTxt(tgFoot) : '';
  if(!F){ el.hidden=true; el.innerHTML=''; return; }
  const rows=F.rows.filter(t=>t.share>=.005).slice(0,12).map(t=>
    `<div class="tprow${t.ab?'':' x'}" ${t.ab?`data-a="${esc(t.ab)}" role="button" tabindex="0"`:''}>`+
    `<span class="tpd">${(t.share*100).toFixed(0)}%</span>`+
    `<span class="tpa">${t.ab?`<span class="sw" style="background:${regColor(t.ab)}"></span>${esc(t.ab)}`:''}</span>`+
    `<span class="tpn">${esc(t.name)}</span></div>`).join('');
  el.innerHTML=`<p class="tlbl"><b>Footprint</b> &mdash; a ${F.r.toFixed(2)} mm sphere about the target, ≈ ${footVolTxt(F.r)}</p>`+
    rows+`<p class="tpc">The share of that sphere's volume in each structure, read on the nearest plate. `+
    `A bolus is not a sphere and does not stop at a boundary: this places a volume, it does not model spread.</p>`;
  el.hidden=false;
  [...el.querySelectorAll('.tprow[data-a]')].forEach(r=>{
    const act=()=>select(r.dataset.a);
    r.onclick=act; r.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } };
  });
}

/* ---- what the track passes through ----
   The extents tile every section by structure, so a track can be read off them the way
   a probe track is read off the histology afterwards: sample it every 20 um from the
   entry down, ask the nearest plate which region holds each sample, and merge the runs
   into a list of structures with the depths they span. A probe length reads the whole
   shank rather than the track to the tip, and says what the tip sits in.

   Two limits, both said in the panel. A sample resolves to the nearest 350 um section,
   so a boundary that runs obliquely between two plates lands on whichever plate is
   nearer; and where the atlas does not print a boundary the extent is an estimate, and
   the row says so. Depths are along the track from the surface, in the working frame,
   the same length the plan calls the drive. */
const TG_PS=.02;
function tgPath(o){
  if(o.len===undefined||!ROK) return null;
  const reach=Math.max(o.len, tgProbe||0), n=Math.round(reach/TG_PS), segs=[];
  let last=null;
  for(let i=0;i<=n;i++){
    const d=i*TG_PS, s=o.len-d;
    const q=tgBack({ap:o.T.ap-o.d[0]*s, ml:o.T.ml-o.d[1]*s, dv:o.T.dv-o.d[2]*s});
    const pl=plateAt(q.ap);
    let key, ab=null, est=false, name;
    if(!pl){ key='off'; name='beyond the plate series'; }
    else if(!inBrain(q.ap,q.ml,q.dv)){ key='out'; name='outside the section'; }
    else {
      const r=regAtOn(pl.plate, fromML(q.ml), fromDV(q.dv));
      if(r){ key='r:'+r.ab; ab=r.ab; est=regEst(r); name=byAb[r.ab]?byAb[r.ab].name:''; }
      else { key='un'; name='a face the atlas leaves unnamed'; }
    }
    if(last&&last.key===key){ last.to=d; if(pl) last.plates.add(pl.plate); }
    else { last={key,ab,est,name,from:d,to:d,plates:new Set(pl?[pl.plate]:[])}; segs.push(last); }
  }
  /* a sliver of nothing at an end is the entry sitting on the outline or the target on a
     boundary; two samples of it say nothing, so it goes to its neighbour, and two runs of
     one structure that it kept apart are joined again */
  for(let i=segs.length-1;i>=0&&segs.length>1;i--){
    const q=segs[i];
    if(q.ab || q.to-q.from>=.03) continue;
    if(segs[i+1]) segs[i+1].from=q.from; else segs[i-1].to=q.to;
    segs.splice(i,1);
  }
  for(let i=segs.length-1;i>0;i--)
    if(segs[i].key===segs[i-1].key){ segs[i-1].to=segs[i].to; segs[i].plates.forEach(x=>segs[i-1].plates.add(x)); segs.splice(i,1); }
  /* the tip: what the probe ends in, read at its own depth rather than at the end of the path */
  const tip = tgProbe ? (segs.find(q=>tgProbe>=q.from-1e-9&&tgProbe<=q.to+1e-9)||segs[segs.length-1]) : null;
  return {segs,reach,tip};
}
/* a point a given depth down the track from the entry, in atlas millimetres */
function tgAtDepth(o,d){
  const s=o.len-d;
  return tgBack({ap:o.T.ap-o.d[0]*s, ml:o.T.ml-o.d[1]*s, dv:o.T.dv-o.d[2]*s});
}
function tgPathHTML(o){
  const P=o.path, el=$('tpath');
  if(!P||P.segs.length<2&&!tgProbe){ el.hidden=true; el.innerHTML=''; return; }
  const w=s=>((s.to-s.from)/P.reach*100).toFixed(2)+'%';
  const bar=P.segs.map(s=>`<i class="${s.ab?'':'x'}${s.est?' est':''}" style="width:${w(s)};`+
    `${s.ab?`background:${regColor(s.ab)}`:''}" title="${esc(s.ab||s.name)} · ${s.from.toFixed(2)}–${s.to.toFixed(2)} mm"></i>`).join('');
  const rows=P.segs.map(s=>{
    const pl=[...s.plates].sort((a,b)=>a-b);
    return `<div class="tprow${s.ab?'':' x'}" ${s.ab?`data-a="${esc(s.ab)}" data-p="${pl[0]||''}" role="button" tabindex="0"`:''}>`+
      `<span class="tpd">${s.from.toFixed(2)}–${s.to.toFixed(2)}</span>`+
      `<span class="tpa">${s.ab?`<span class="sw" style="background:${regColor(s.ab)}"></span>${esc(s.ab)}`:''}</span>`+
      `<span class="tpn">${esc(s.name)}${s.est?' · boundary estimated':''}`+
      `${pl.length>1?` · plates ${pl[0]}–${pl[pl.length-1]}`:''}</span></div>`; }).join('');
  const mk=(d,cls,t)=>`<span class="tpm ${cls}" style="left:${(d/P.reach*100).toFixed(2)}%" title="${t}"></span>`;
  let tipTxt='';
  if(P.tip){
    const past=tgProbe-o.len;
    tipTxt=`<p class="tpc">A <b>${tgProbe.toFixed(2)} mm</b> probe from this entry ends in `+
      `<b>${esc(P.tip.ab||P.tip.name)}</b>, `+
      (Math.abs(past)<.005 ? 'at the target.' :
       past>0 ? `${past.toFixed(2)} mm past the target.` : `${(-past).toFixed(2)} mm short of the target.`)+'</p>';
  }
  el.innerHTML=`<p class="tlbl"><b>Along the track</b> &mdash; depth from the surface, mm</p>`+
    `<div class="tpbar" aria-hidden="true">${bar}${mk(o.len,'tgt','the target')}${tgProbe?mk(tgProbe,'tip','the probe tip'):''}</div>${rows}${tipTxt}`+
    `<p class="tpc">Read off the extents of the nearest plate at each 20 µm step: a boundary between two plates `+
    `lands on whichever is nearer, and a dashed extent is an estimate.</p>`;
  el.hidden=false;
  [...el.querySelectorAll('.tprow[data-a]')].forEach(r=>{
    const act=()=>{ const p=+r.dataset.p; if(p) go(p); select(r.dataset.a); };
    r.onclick=act; r.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } };
  });
}

/* ---- the panel ---- */
const tgDeg = v => (Math.round(v*10)/10).toFixed(1).replace(/\.0$/,'')+'°';
/* which way the tip is aimed, in words, because a signed heading in a left-handed triple
   is exactly the kind of thing that gets read backwards at three in the morning */
function tgHead(o){
  if(o.deg<.05) return 'straight down';
  const h=o.head, near=(a,b)=>Math.abs(((h-a+540)%360)-180)<b;
  const w = near(0,22.5)?'anterior' : near(180,22.5)?'posterior'
          : near(90,22.5)?'right'   : near(-90,22.5)?'left'
          : h>0&&h<90?'anterior and right' : h>90?'posterior and right'
          : h<0&&h>-90?'anterior and left' : 'posterior and left';
  return tgDeg(o.deg)+' from vertical, tip toward '+w;
}
function tgCoord(q,F){ return `${apLab(F)} ${sgn(q.ap)} · ML ${sgn(q.ml)} · DV ${sgn(q.dv)}`; }
/* the offset in words, dorsoventral first because that is the one anybody sets: a plan is
   usually so many millimetres above or below a label, and only then off it in the plane.
   Named by direction rather than by sign for the same reason the heading is. */
function tgOffTxt(){
  const a=[], say=(v,p,m)=>{ if(v) a.push(`${Math.abs(v).toFixed(2)} mm ${v>0?p:m}`); };
  say(tgOff.dv,'dorsal','ventral');
  say(tgOff.ml,'lateral','medial');
  say(tgOff.ap,'anterior','posterior');
  return a.join(' · ');
}
/* where the target came from, in one line: how many labels, off which plates, on which
   side. It is the sentence the plan is only as good as. */
function tgFrom(o){
  /* For a division this is the median of every label its members carry -- a centre of the
     division, and nothing the atlas prints a name at. Said in as many words, because the
     one thing that must not happen is somebody reading it as a nucleus. */
  const g=byAb[o.abbr]&&byAb[o.abbr].grp?byAb[o.abbr]:null;
  return `median of ${o.T.n} label${o.T.n===1?'':'s'}`+
         (g?` over its ${g.n_members} structures`:'')+' on '+
         (o.pick ? 'plate '+o.pick : tgPlates(o.abbr).length>1 ? 'all its plates' : 'its plate')+
         `, folded onto the ${o.side>0?'right':'left'}`;
}
/* the plate menu. Rebuilt only when the plates behind it change, so typing in an angle
   box does not reset a menu the pointer is sitting on. */
let tgPlSig=null;
function tgPlateSel(){
  const el=$('tplate'), ps=tgPlates(sel), sig=ps.length?sel+'|'+ps.join(','):null;
  $('tplatew').hidden=!sig;
  if(!sig){ tgPlSig=null; return; }
  if(sig!==tgPlSig){
    tgPlSig=sig;
    el.innerHTML=`<option value="0">every plate${ps.length>1?` · median of ${ps.length}`:''}</option>`+
      ps.map(p=>`<option value="${p}">plate ${p} · AP ${sgn(plateOf[p].bregma)}</option>`).join('');
  }
  el.value=String(tgPlate);
  el.disabled=ps.length<2;                    /* one plate is not a choice, but it is a fact */
}
function tgPanel(){
  const D=$('tplan'), N=$('twarn'), o=tgPlan;
  $('ttgt').textContent = sel ? '' : 'Pick a target below, or search above.';
  [...$('tside').children].forEach(b=>b.classList.toggle('on',+b.dataset.h===targSide));
  const flat = !tgTilt && !tgRoll;
  $('tyaw').disabled=flat; $('tyawn').hidden=!flat;
  tgPlateSel();
  $('tozero').hidden = !tgPlate && !tgOffOn();
  if(!OUTOK){
    D.innerHTML=''; N.hidden=false; $('tpath').hidden=true; tgFootHTML(null);
    N.textContent='This build carries no brain outline, so a depth from the surface cannot be measured.';
    return;
  }
  if(!o){ D.innerHTML=''; N.hidden=true; $('tpath').hidden=true; tgFootHTML(null); return; }
  $('ttgt').innerHTML=`<b style="color:var(--targ)">${esc(tgName(o))}</b> · `+
    `${o.side>0?'right':'left'} · ${o.plate?'plate '+o.plate:'off the series'}`+
    ` · ${o.T.n} label${o.T.n===1?'':'s'}${o.pick?' on it':''}`;
  const F=FRAME.on?1:0, rows=[], off=tgOffOn();
  /* with an offset set the label is no longer the target, so both are printed: the plan
     is a claim about a point that nothing in the atlas is printed at, and the point it
     was measured from has to be readable beside it. */
  if(off) rows.push(['Label', tgCoord(o.T.L,F)+' mm', tgFrom(o)]);
  rows.push(['Target', tgCoord(o.T,F)+' mm',
             off ? tgOffTxt()+' from the label'+(FRAME.on?' · along the atlas axes':'')
                 : tgFrom(o)]);
  if(o.len!==undefined){
    rows.push(['Approach', tgHead(o),
               `tilt ${tgDeg(tgTilt)} · roll ${tgDeg(tgRoll)} · yaw ${tgDeg(tgYaw)}`]);
    rows.push(['Entry', tgCoord(o.E,F)+' mm', 'where the track meets the surface']);
    rows.push(['Drive', `<b>${o.len.toFixed(2)} mm</b>`, 'from the surface to the target']);
    rows.push(['Sides', `${o.down.toFixed(2)} mm down · ${o.across.toFixed(2)} mm across`,
               'the legs this track is the hypotenuse of']);
  }
  if(o.vert!==undefined)
    rows.push(['Straight down', `${o.vert.toFixed(2)} mm`,
               'the same target on a vertical dorsal approach']);
  D.innerHTML=rows.map(([k,v,s])=>
    `<dt>${k}</dt><dd>${v}${s?`<span class="sub">${s}</span>`:''}</dd>`).join('');
  const warn=[];
  /* an offset can walk the target off the section it was taken from, which is a real
     plan for a point on a neighbouring plate and not an error -- but it is not what the
     plate menu appears to promise, so it is said out loud */
  if(o.pick && o.plate && o.plate!==o.pick)
    warn.push(`The offset carries the target off plate ${o.pick} and onto `+
      `plate ${o.plate}; the label was read from plate ${o.pick}.`);
  if(!o.plate) warn.push(tgOffOn()
    ? `The offset carries the target past the end of the plate series, so there is no `+
      `section to measure it against.`
    : `This label lies beyond either end of the plate series, so there is no section to `+
      `measure it against.`);
  else if(!o.inside) warn.push(tgOffOn()
    ? `The target — ${esc(tgName(o))}’s label plus the offset — falls outside the traced `+
      `outline of its plate. Either the offset reaches past the surface, or the atlas prints `+
      `this abbreviation beside the section and points at it. `+
      (o.len===undefined
        ? `Nothing of the brain lies along this approach to it, so there is no depth to give.`
        : `The track is measured to it anyway; read the entry with that in mind.`)
    : `The label for ${esc(tgName(o))} sits outside the traced outline of its `+
      `plate — the drawing prints some abbreviations beside the section and points at them. `+
      (o.len===undefined
        ? `Nothing of the brain lies along this approach to it, so there is no depth to give.`
        : `The track is measured to it anyway; read the entry with that in mind.`));
  else if(o.len===undefined) warn.push('No surface lies along this direction from the target.');
  if(o.flank) warn.push('The entry is on the flank of the section, not its dorsal surface: '+
    'this track goes in through the side of the head.');
  N.hidden=!warn.length; N.innerHTML=warn.join(' ');
  tgPathHTML(o); tgFootHTML(o);
}

/* ---- the track on the plate ----
   Drawn where the track actually runs in the atlas, so a frame does not have to be
   hedged here. Solid where it is within half a section of this plate's AP -- genuinely
   on this plane -- and ghosted where it is only a projection of a track passing in front
   of or behind it. */
function tgSample(o,n){
  const q=[];
  for(let i=0;i<=n;i++){
    const s=o.len*(1-i/n);
    q.push(tgBack({ap:o.T.ap-o.d[0]*s, ml:o.T.ml-o.d[1]*s, dv:o.T.dv-o.d[2]*s}));
  }
  return q;
}
function tgDraw(){
  const g=$('tk'), o=tgPlan;
  if(!o||o.len===undefined||smode!=='targ'){ g.innerHTML=''; tgPJ(); return; }
  const ap0=plateOf[cur].bregma, half=PSTEP/2;
  const q=tgSample(o,64).map(p=>({x:fromML(p.ml), y:fromDV(p.dv), on:Math.abs(p.ap-ap0)<=half}));
  const out=[];
  let run=[q[0]];
  for(let i=1;i<q.length;i++){
    run.push(q[i]);
    if(i===q.length-1 || q[i].on!==q[i+1].on){
      out.push(`<path class="${q[i].on?'':'gh'}" d="M`+
        run.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join('L')+'"/>');
      run=[q[i]];
    }
  }
  if(tgLegs){                                   /* the projected right triangle */
    const E=q[0], Tt=q[q.length-1];
    out.push(`<path class="leg" d="M${E.x.toFixed(1)} ${E.y.toFixed(1)}`+
             `L${E.x.toFixed(1)} ${Tt.y.toFixed(1)}L${Tt.x.toFixed(1)} ${Tt.y.toFixed(1)}"/>`);
  }
  const E=q[0], Tt=q[q.length-1];
  /* an end that is not on this plate is ghosted like the line into it: drawn solid it
     would assert a place on this section that the entry or the target is not at */
  out.push(`<circle class="${E.on?'':'gh'}" cx="${E.x.toFixed(1)}" cy="${E.y.toFixed(1)}" r="5"/>`,
           `<circle class="${Tt.on?'':'gh'}" cx="${Tt.x.toFixed(1)}" cy="${Tt.y.toFixed(1)}" r="8"/>`);
  /* where the track crosses this plane. Asked of the atlas, not of the working frame:
     a track that is vertical in a tilted frame is oblique through the sections, and it
     is the sections this is drawn on. */
  const c=q.find(p=>p.on);
  if(c && q.some(p=>!p.on))
    out.push(`<circle class="here" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="13"/>`);
  /* the shank past the target, and a tick where the track crosses from one structure into
     the next -- the panel names them; the plate only has to show where they fall */
  if(o.path){
    const P=o.path;
    if(P.reach>o.len+1e-9){
      const ext=[]; const m=Math.max(2,Math.round((P.reach-o.len)/.1));
      for(let i=0;i<=m;i++){ const p=tgAtDepth(o,o.len+(P.reach-o.len)*i/m);
        ext.push({x:fromML(p.ml), y:fromDV(p.dv), on:Math.abs(p.ap-ap0)<=half}); }
      out.push(`<path class="ext${ext.every(p=>p.on)?'':' gh'}" d="M`+ext.map(p=>p.x.toFixed(1)+' '+p.y.toFixed(1)).join('L')+'"/>');
    }
    for(let i=1;i<P.segs.length;i++){
      const d=P.segs[i].from, a=tgAtDepth(o,d), b=tgAtDepth(o,Math.min(d+.05,P.reach));
      if(Math.abs(a.ap-ap0)>half) continue;
      const ax=fromML(a.ml), ay=fromDV(a.dv), dx=fromML(b.ml)-ax, dy=fromDV(b.dv)-ay, L=Math.hypot(dx,dy)||1;
      const nx=-dy/L*6, ny=dx/L*6;
      out.push(`<line class="bd" x1="${(ax-nx).toFixed(1)}" y1="${(ay-ny).toFixed(1)}" x2="${(ax+nx).toFixed(1)}" y2="${(ay+ny).toFixed(1)}"/>`);
    }
  }
  out.push(...tgFootPlate(o));
  g.innerHTML=out.join('');
  tgPJ();
  if(typeof v3frame==='function') v3frame();
}
/* the sphere cut by this plate's plane: a circle shrinking with the plane's distance from
   the target, in atlas millimetres on both axes */
function tgFootPlate(o){
  if(!tgFoot||!o) return [];
  const dAP=o.Ta.ap-plateOf[cur].bregma, rr=tgFoot*tgFoot-dAP*dAP;
  if(rr<=0) return [];
  const r2=Math.sqrt(rr);
  return [`<ellipse class="fp" cx="${fromML(o.Ta.ml).toFixed(1)}" cy="${fromDV(o.Ta.dv).toFixed(1)}"`+
          ` rx="${(r2*ML_PXMM).toFixed(1)}" ry="${(r2*DV_PXMM).toFixed(1)}"/>`];
}
/* the same track on the projections, where neither axis is foreshortened and a tilt reads
   at its true angle -- which is why a tilted plan is worth looking at here */
function tgPJ(){
  const g=$('pjtk'), o=tgPlan;
  if(!g) return;
  if(!o||o.len===undefined||smode!=='targ'){ g.innerHTML=''; return; }
  const V=VIEWS[pview], q=tgSample(o,2).map(pjq);
  const X=p=>pjx(p.ap).toFixed(1), Y=p=>pjy(V,p[V.k]).toFixed(1);
  const E=q[0], Tt=q[2], out=[];
  if(tgLegs){
    const c=V.k==='dv' ? {ap:E.ap, dv:Tt.dv} : {ap:Tt.ap, ml:E.ml};
    out.push(`<line class="leg" x1="${X(E)}" y1="${Y(E)}" x2="${X(c)}" y2="${Y(c)}"/>`,
             `<line class="leg" x1="${X(c)}" y1="${Y(c)}" x2="${X(Tt)}" y2="${Y(Tt)}"/>`);
  }
  out.push(`<line x1="${X(E)}" y1="${Y(E)}" x2="${X(Tt)}" y2="${Y(Tt)}"/>`,
           `<circle cx="${X(E)}" cy="${Y(E)}" r="4"/>`,
           `<circle cx="${X(Tt)}" cy="${Y(Tt)}" r="7"/>`);
  if(tgFoot) out.push(`<circle class="fp" cx="${X(Tt)}" cy="${Y(Tt)}" r="${(tgFoot*K).toFixed(1)}"/>`);
  g.innerHTML=out.join('');
}

/* ---- notes ----
   Plain text, one field a line, carrying the frame it was planned in. A plan read back in
   six months has to say which zero its numbers were measured from, or it is a set of
   numbers about nothing. */
/* hard-wrapping for the caveat paragraph below, which is now assembled from what the
   plan actually did rather than fixed at the width it was typed at */
const tgWrap=(t,w)=>{
  const out=[]; let ln='';
  for(const word of t.split(/\s+/)){
    if(ln && (ln+' '+word).length>w){ out.push(ln); ln=word; } else ln = ln ? ln+' '+word : word;
  }
  if(ln) out.push(ln);
  return out;
};
function tgNotes(){
  const o=tgPlan; if(!o) return '';
  const r=byAb[o.abbr], L=apLab(FRAME.on?1:0);
  const ln=[];
  ln.push('Gerbil Atlas Explorer — track plan');
  ln.push('');
  ln.push(`target        ${tgName(o)}  (${r?r.name:''})`);
  ln.push(`hemisphere    ${o.side>0?'right':'left'}`);
  ln.push(`plate         ${o.plate||'off the series'}`);
  ln.push(`labels read   ${o.pick ? `plate ${o.pick} only, ${o.T.n} label${o.T.n===1?'':'s'}`
                                  : `every plate the abbreviation is printed on, ${o.T.n} label${o.T.n===1?'':'s'}`}`);
  if(tgOffOn()){
    ln.push(`label         ${L} ${sgn(o.T.L.ap)}  ML ${sgn(o.T.L.ml)}  DV ${sgn(o.T.L.dv)}  mm`);
    ln.push(`offset        ${tgOffTxt()}`);
  }
  ln.push(`target        ${L} ${sgn(o.T.ap)}  ML ${sgn(o.T.ml)}  DV ${sgn(o.T.dv)}  mm`);
  if(o.len!==undefined){
    ln.push(`entry         ${L} ${sgn(o.E.ap)}  ML ${sgn(o.E.ml)}  DV ${sgn(o.E.dv)}  mm`);
    ln.push(`angles        tilt ${tgTilt}  roll ${tgRoll}  yaw ${tgYaw}  deg`);
    ln.push(`              = ${tgHead(o)}`);
    ln.push(`drive         ${o.len.toFixed(2)} mm from the brain surface`);
    ln.push(`sides         ${o.down.toFixed(2)} mm down, ${o.across.toFixed(2)} mm across`);
  }
  if(o.vert!==undefined) ln.push(`straight down ${o.vert.toFixed(2)} mm`);
  if(o.path&&o.path.segs.length){
    ln.push('');
    ln.push('along the track  depth from the surface, mm');
    for(const s of o.path.segs)
      ln.push(`  ${s.from.toFixed(2).padStart(5)}–${s.to.toFixed(2).padStart(5)}  ${(s.ab||'—').padEnd(8)} ${s.name}${s.est?' (boundary estimated)':''}`);
    if(o.path.tip){ const past=tgProbe-o.len;
      ln.push(`probe         ${tgProbe.toFixed(2)} mm; the tip ends in ${o.path.tip.ab||o.path.tip.name}, `+
        (Math.abs(past)<.005?'at the target':past>0?`${past.toFixed(2)} mm past the target`:`${(-past).toFixed(2)} mm short of the target`)); }
  }
  if(o.foot){
    ln.push('');
    ln.push(`footprint     ${o.foot.r.toFixed(2)} mm sphere about the target, ~${footVolTxt(o.foot.r)}`);
    for(const t of o.foot.rows.filter(t=>t.share>=.005).slice(0,12))
      ln.push(`  ${(t.share*100).toFixed(0).padStart(3)}%  ${(t.ab||'—').padEnd(8)} ${t.name}`);
  }
  ln.push('');
  ln.push(`build         ${BUILD||'unstamped'}`);
  ln.push(`frame         ${FRAME.on?frameTxt()+' · zero at '+orgFull():'atlas coordinates'}`);
  ln.push(`angle order   roll, then tilt, then yaw about the vertical`);
  ln.push(`signs         tilt + drives the tip anterior, roll + to the right`);
  ln.push('');
  /* the caveats, wrapped rather than written out line by line, because what has to be
     said now depends on how the target was named and a fixed set of lines cannot say it */
  ln.push(...tgWrap(
    (tgOffOn()
      ? 'The target is an offset in atlas millimetres from the median position of the '+
        'structure’s printed abbreviation, with lateral taken toward the chosen side; the '+
        'label is not a centroid. '
      : 'The target is the median position of the structure’s printed abbreviation, not its '+
        'centroid. ')+
    (o.pick
      ? `It was read from the label${o.T.n===1?'':'s'} on plate ${o.pick} alone. `
      : tgPlates(o.abbr).length>1
        ? 'It is the median across every plate the abbreviation is printed on, which is a '+
          'point inside the structure rather than a point on any one section. '
        : '')+
    `The surface is the outline of the nearest plate, so the entry AP is quantised at the `+
    `${(PSTEP*1000).toFixed(0)} um section spacing, and it is a fixed, sectioned brain rather than the `+
    'surface under intact dura. Experimental.', 78));
  ln.push('');
  ln.push(location.href);
  return ln.join('\n');
}

/* ---- wiring ---- */
/* A build without the outline block has nothing to plan a track against, so the mode
   says so on the button rather than opening a pane that can only apologise -- the same
   courtesy the toolbar pays a build with no histology. Disabled rather than removed: a
   link carrying a plan can still arrive, and the pane it lands on has to exist to
   explain itself. */
if(!OUTOK){
  const b=[...$('mseg').children].find(x=>x.dataset.m==='targ');
  if(b){ b.disabled=true;
         b.title='This build carries no brain outline, so there is no surface to plan against.'; }
}
/* Whether any of the track is off this plate. The track is straight in the working frame
   and fromFrame() is affine, so it is straight in the atlas too and its AP runs
   monotonically from one end to the other: the two ends settle it, without sampling. */
function tgOffPlate(){
  const o=tgPlan;
  if(!o||o.len===undefined||smode!=='targ') return false;
  const ap0=plateOf[cur].bregma, h=PSTEP/2;
  return Math.abs(o.Ta.ap-ap0)>h || Math.abs(o.Ea.ap-ap0)>h;
}
/* a plate named for one structure means nothing for the next one, and a menu holding a
   plate its target is not printed on would quietly go on reading every plate while
   claiming one. So the pick is dropped the moment it stops being available. */
function tgSync(){
  if(tgPlate && !tgPlates(sel).includes(tgPlate)) tgPlate=0;
  tgSolve(); tgPanel(); mark(); tgDraw();
}
function tgAng(id,set){
  const el=$(id);
  el.oninput=()=>{ const v=+el.value; set(Number.isFinite(v)?Math.max(-89,Math.min(89,v)):0); tgSync(); queueHash(); };
}
tgAng('ttilt',v=>tgTilt=v); tgAng('troll',v=>tgRoll=v); tgAng('tyaw',v=>tgYaw=v);
/* Naming a plate also turns the viewer to it. The plan is drawn on the plates, and a
   target taken from plate 13 that is being read against plate 30 is a picture of a track
   somewhere else; the pick is a deliberate act, so it is allowed to move the view. */
$('tplate').onchange=e=>{
  const p=+e.target.value||0;
  tgPlate = plateOf[p] ? p : 0;
  if(tgPlate && tgPlate!==cur) go(tgPlate);
  tgSync(); queueHash();
};
/* the offset is a distance, not an angle, so it is clamped by the brain rather than by
   the arm: 10 mm reaches past either end of a gerbil brain from anywhere inside it */
const TG_OFFMAX=10;
function tgOffIn(id,k){
  const el=$(id);
  el.oninput=()=>{ const v=+el.value;
    tgOff[k]=Number.isFinite(v)?Math.max(-TG_OFFMAX,Math.min(TG_OFFMAX,v)):0;
    tgSync(); queueHash(); };
}
tgOffIn('toap','ap'); tgOffIn('toml','ml'); tgOffIn('todv','dv');
$('tprobe').oninput=e=>{ const v=+e.target.value;
  tgProbe=Number.isFinite(v)&&v>0?Math.min(TG_PROBEMAX,v):0; tgSync(); queueHash(); };
$('tfoot').oninput=e=>{ const v=+e.target.value;
  tgFoot=Number.isFinite(v)&&v>0?Math.min(TG_FOOTMAX,v):0; tgSync(); queueHash(); };
/* the plan as data, for a lab notebook or a script: everything the notes say, typed */
function tgJSON(){
  const o=tgPlan; if(!o) return null;
  const r=byAb[o.abbr], F=FRAME.on?1:0;
  const pt=q=>q?{ap:+q.ap.toFixed(3),ml:+q.ml.toFixed(3),dv:+q.dv.toFixed(3)}:null;
  return {
    app:'Gerbil Atlas Explorer', build:BUILD||null, generated:new Date().toISOString(),
    experimental:true, link:location.href,
    target:{abbr:tgName(o), name:r?r.name:null, hemisphere:o.side>0?'right':'left',
      division:r&&r.grp?{structures:r.n_members, members:r.members}:null,
      plate:o.plate, labels_read_from_plate:o.pick||null, n_labels:o.T.n,
      label:pt(o.T.L), offset_atlas_mm:{...tgOff}, position:pt(o.T), inside_outline:o.inside},
    approach:{tilt_deg:tgTilt, roll_deg:tgRoll, yaw_deg:tgYaw, order:'roll, then tilt, then yaw',
      signs:'tilt + drives the tip anterior, roll + to the right',
      from_vertical_deg:o.len!==undefined?+o.deg.toFixed(2):null, heading:o.len!==undefined?tgHead(o):null},
    entry:o.len!==undefined?pt(o.E):null,
    drive_mm:o.len!==undefined?+o.len.toFixed(3):null,
    legs_mm:o.len!==undefined?{down:+o.down.toFixed(3),across:+o.across.toFixed(3)}:null,
    straight_down_mm:o.vert!==undefined?+o.vert.toFixed(3):null,
    entry_on_flank:!!o.flank,
    probe_mm:tgProbe||null,
    footprint:o.foot?{radius_mm:o.foot.r, volume_nl:+o.foot.vol.toFixed(1),
      shares:o.foot.rows.map(t=>({abbr:t.ab,name:t.name,share:+t.share.toFixed(4)}))}:null,
    along_track:o.path?o.path.segs.map(s=>({from_mm:+s.from.toFixed(2),to_mm:+s.to.toFixed(2),
      abbr:s.ab,name:s.name,boundary_estimated:!!s.est,plates:[...s.plates].sort((a,b)=>a-b)})):null,
    frame:{on:!!FRAME.on, text:FRAME.on?frameTxt():'atlas coordinates', zero:FRAME.on?orgFull():'the atlas origin',
      ap_label:apLab(F), pitch:FRAME.pitch, roll:FRAME.roll, yaw:FRAME.yaw,
      pivot:[FRAME.pap,FRAME.pml,FRAME.pdv], offset:[FRAME.dap,FRAME.dml,FRAME.ddv],
      origin:FRAME.org?{landmark:LM[FRAME.oref][0].toLowerCase(),offset:[FRAME.oap,FRAME.oml,FRAME.odv]}:null},
    notes:'The target is the median position of the printed abbreviation, not a centroid. The surface is '+
      'the outline of the nearest plate, 350 um apart, of a fixed sectioned brain. Along-track structures are '+
      'read off the extents of the nearest plate at each 20 um step. Experimental: check against anatomy you know.',
    source:'Radtke-Schuller et al. 2016, Brain Struct Funct 221(Suppl 1):1-272, doi:10.1007/s00429-016-1259-0'
  };
}
$('tjson').onclick=()=>{
  const j=tgJSON(); if(!j) return;
  const b=new Blob([JSON.stringify(j,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(b);
  dl(`track_${tgName(tgPlan).replace(/[^A-Za-z0-9]/g,'')}_${tgPlan.side>0?'R':'L'}.json`,u,u);
};
$('tozero').onclick=()=>{
  tgPlate=0; tgOff={ap:0,ml:0,dv:0};
  $('toap').value=0; $('toml').value=0; $('todv').value=0;
  tgSync(); queueHash();
};
$('tside').setAttribute('aria-label','Hemisphere');
[...$('tside').children].forEach(b=>b.onclick=()=>{ targSide=+b.dataset.h; tgSync(); queueHash(); });
$('tlegs').onchange=e=>{ tgLegs=e.target.checked; tgDraw(); queueHash(); };
$('tzero').onclick=()=>{
  tgTilt=tgRoll=tgYaw=0;
  $('ttilt').value=0; $('troll').value=0; $('tyaw').value=0;
  tgSync(); queueHash();
};
/* one query, two boxes: the targeting pane keeps the same result list, so it needs a way
   into it without stealing the search field out of the pane beside it */
$('tq').oninput=e=>{ $('q').value=e.target.value; run(); };
$('tcopy').onclick=function(){
  const t=tgNotes(), b=this, old=b.textContent;
  const ok=()=>{ b.textContent='Copied'; setTimeout(()=>b.textContent=old,1300); };
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(ok,()=>fb());
  else fb();
  function fb(){
    const a=document.createElement('textarea'); a.value=t;
    a.style.cssText='position:fixed;opacity:0'; document.body.appendChild(a);
    a.select(); try{ document.execCommand('copy'); ok(); }catch(_){}
    a.remove();
  }
};
$('tdl').onclick=()=>{
  const o=tgPlan; if(!o) return;
  const b=new Blob([tgNotes()],{type:'text/plain;charset=utf-8'});
  const u=URL.createObjectURL(b);
  dl(`track_${o.abbr.replace(/[^A-Za-z0-9]/g,'')}_${o.side>0?'R':'L'}.txt`,u,u);
};

/* ---------- export ---------- */
function dl(name,href,revoke){
  const a=document.createElement('a'); a.download=name; a.href=href;
  document.body.appendChild(a); a.click(); a.remove();
  if(revoke) setTimeout(()=>URL.revokeObjectURL(href),4000);
}
/* the whole plate at 2x, with whatever is currently drawn over it, plus a caption */
function exportPNG(){
  const SC=2, CAP=104, im=$('pi');
  const c=document.createElement('canvas');
  c.width=NW*SC; c.height=(NH+CAP)*SC;
  const g=c.getContext('2d');
  g.scale(SC,SC);
  g.fillStyle='#fff'; g.fillRect(0,0,NW,NH+CAP);
  /* grey and contrast are a filter on the <img>, so the canvas has to be given the same
     one or the sheet would not be the plate that was on screen. Overlays are drawn after
     it is cleared: a contrast stretch belongs to the section, not to the annotation. */
  g.filter=plateFilter();
  try{ g.drawImage(im,0,0,NW,NH); }
  catch(_){ hintWarn('The plate image is still loading — try again in a moment.'); return; }
  finally{ g.filter='none'; }

  if(showGrid){
    g.strokeStyle='rgba(91,112,133,.55)';
    for(let m=-8;m<=8;m++){ const x=fromML(m); g.lineWidth=m?0.7:1.4;
      g.beginPath(); g.moveTo(x,BY0); g.lineTo(x,BY1); g.stroke(); }
    for(let v=1;v>=-10;v--){ const y=fromDV(v); g.lineWidth=v?0.7:1.4;
      g.beginPath(); g.moveTo(BX0,y); g.lineTo(BX1,y); g.stroke(); }
  }
  if(showSK){
    g.strokeStyle='#8f8264'; g.globalAlpha=.8; g.lineWidth=2;
    skullLoops(cur).forEach(d=>g.stroke(new Path2D(d)));
    g.globalAlpha=1;
  }
  const SKL=window.__SKULL__&&window.__SKULL__.lm;
  if(showLM&&SKL){
    g.strokeStyle='#0f766e'; g.fillStyle='#0f766e'; g.lineWidth=1.8;
    g.font='600 15px ui-sans-serif,Segoe UI,Helvetica,Arial,sans-serif';
    const ap=plateOf[cur].bregma, iaAP=-LMof('Interaural'), y=fromDV(SKL.ear.dv);
    const here=Math.abs(ap-iaAP)<0.18;
    g.setLineDash(here?[]:[7,5]);
    g.beginPath(); g.moveTo(BX0,y); g.lineTo(BX1,y); g.stroke();
    g.setLineDash([]);
    g.fillText('interaural'+(here?'':' height'),BX0+8,y-7);
    LM.forEach(([nm,off])=>{
      const a=-off, h=SKL.vault[nm.toLowerCase()];
      if(nm==='Interaural'||h===undefined||Math.abs(ap-a)>0.18) return;
      const x=fromML(0), yy=fromDV(h);
      g.lineWidth=2.4; g.beginPath(); g.arc(x,yy,7,0,6.2832); g.stroke();
      g.lineWidth=1.8; g.beginPath(); g.moveTo(x,yy-16); g.lineTo(x,yy-8); g.stroke();
      g.fillText(nm.toLowerCase(),x+11,yy-12);
    });
  }
  /* the selection, marked the way the screen marks it: the extent where there is one,
     the circle round where the name falls where there is not */
  const bs=(LB[cur]||{})[sel]||[], rgS=regOut(sel);
  g.strokeStyle=markC(); g.lineWidth=1.8;
  if(rgS){
    g.beginPath();
    rgS.gs.forEach(gg=>{ gg.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); });
    g.fillStyle=markF(undefined,'.10'); g.fill('evenodd');
    g.lineWidth=1.5; if(regEst(rgS)) g.setLineDash([6,4]);
    g.stroke(); g.setLineDash([]);
  } else bs.forEach((b,i)=>{
    const [cx,cy]=ptAt(cur,sel,i,b), R=Math.max(b[2]*NW,b[3]*NH);
    g.beginPath(); g.ellipse(cx*NW,cy*NH,R*0.85+7,R*0.55+6,0,0,6.2832); g.stroke();
  });
  if(mA&&mB){
    g.strokeStyle='#00875a'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(mA[0],mA[1]); g.lineTo(mB[0],mB[1]); g.stroke();
    [mA,mB].forEach(p=>{ g.beginPath(); g.arc(p[0],p[1],4,0,6.2832); g.stroke(); });
  }
  /* the planned track, dashed where it is only the projection of a track that passes in
     front of or behind this plane -- the same distinction the screen draws */
  if(tgPlan && tgPlan.len!==undefined && smode==='targ'){
    const ap0=plateOf[cur].bregma, half=PSTEP/2;
    const q=tgSample(tgPlan,64).map(o=>({x:fromML(o.ml), y:fromDV(o.dv),
                                        on:Math.abs(o.ap-ap0)<=half}));
    g.strokeStyle='#c4008f';
    for(let i=1;i<q.length;i++){
      const on=q[i-1].on&&q[i].on;
      g.lineWidth=on?2.4:1.6; g.setLineDash(on?[]:[5,4]);
      g.beginPath(); g.moveTo(q[i-1].x,q[i-1].y); g.lineTo(q[i].x,q[i].y); g.stroke();
    }
    g.setLineDash([]); g.lineWidth=2.4;
    const E=q[0], Tt=q[q.length-1];
    if(tgLegs){
      g.lineWidth=1.4; g.setLineDash([2,4]);
      g.beginPath(); g.moveTo(E.x,E.y); g.lineTo(E.x,Tt.y); g.lineTo(Tt.x,Tt.y); g.stroke();
      g.setLineDash([]); g.lineWidth=2.4;
    }
    g.setLineDash(E.on?[]:[5,4]); g.lineWidth=E.on?2.4:1.6;
    g.beginPath(); g.arc(E.x,E.y,5,0,6.2832); g.stroke();
    g.setLineDash(Tt.on?[]:[5,4]); g.lineWidth=Tt.on?2.4:1.6;
    g.beginPath(); g.arc(Tt.x,Tt.y,8,0,6.2832); g.stroke();
    g.setLineDash([]);
    if(tgFoot){ const dAP=tgPlan.Ta.ap-ap0, rr=tgFoot*tgFoot-dAP*dAP;
      if(rr>0){ const r2=Math.sqrt(rr); g.lineWidth=1.6; g.setLineDash([3,3]);
        g.beginPath(); g.ellipse(fromML(tgPlan.Ta.ml),fromDV(tgPlan.Ta.dv),r2*ML_PXMM,r2*DV_PXMM,0,0,6.2832); g.stroke();
        g.setLineDash([]); } }
  }
  /* the coordinate lookup's query point, but only on the plate its AP resolves to */
  const qa = smode==='coord' ? revAtlas() : null;
  const qOn = !!qa && apPlate()===cur;
  if(qOn){
    const x=fromML(qa.ml), y=fromDV(qa.dv), R=12, A=5, B=R+8;
    g.strokeStyle='#7b23c9'; g.lineWidth=2.4;
    g.beginPath(); g.arc(x,y,R,0,6.2832); g.stroke();
    g.lineWidth=1.6;
    [[x-B,y,x-A,y],[x+A,y,x+B,y],[x,y-B,x,y-A],[x,y+A,x,y+B]].forEach(([a,b,c2,d2])=>{
      g.beginPath(); g.moveTo(a,b); g.lineTo(c2,d2); g.stroke(); });
  }

  const p=plateOf[cur];
  g.strokeStyle='#dddad3'; g.lineWidth=1;
  g.beginPath(); g.moveTo(0,NH+9); g.lineTo(NW,NH+9); g.stroke();
  g.textBaseline='top'; g.fillStyle='#1b1a17';
  g.font='600 19px ui-sans-serif,Segoe UI,Helvetica,Arial,sans-serif';
  g.fillText(`Plate ${cur}`+(sel&&byAb[sel]?`   ·   ${byAb[sel].abbr} — ${byAb[sel].name}`:''),0,NH+24);
  g.font='15px ui-sans-serif,Segoe UI,Helvetica,Arial,sans-serif'; g.fillStyle='#5a554c';
  g.fillText(`AP   bregma ${p.bregma.toFixed(2)}  ·  lambda ${p.lambda_.toFixed(2)}  ·  interaural ${p.interaural.toFixed(2)}  ·  occipital crest ${p.occipital_crest.toFixed(2)} mm`,0,NH+50);
  /* whatever else was drawn on the plate gets a word, so the mark is never unexplained */
  const notes=[];
  if(psrc!=='drawing') notes.push(`${SRCN[psrc][0].toUpperCase()+SRCN[psrc].slice(1)} — unlabelled, registered to the drawing by the printed coordinate box`);
  if(pgrey||pctr!==100) notes.push(`Shown ${[pgrey&&'in grey',pctr!==100&&`at ${(pctr/100).toFixed(1)}× contrast`].filter(Boolean).join(' and ')}`);
  if(mA&&mB){ const dml=toML(mB[0])-toML(mA[0]), ddv=toDV(mB[1])-toDV(mA[1]);
    notes.push(`Measured ${Math.hypot(dml,ddv).toFixed(2)} mm (ΔML ${sgn(dml)}, ΔDV ${sgn(ddv)})`); }
  if(qOn) notes.push(`Query point ML ${sgn(qa.ml)}, DV ${sgn(qa.dv)}`);
  if(tgPlan&&tgPlan.len!==undefined&&smode==='targ')
    notes.push(`Track to ${tgPlan.abbr} (${tgPlan.side>0?'right':'left'})`+
      `${tgOffOn()?`, ${tgOffTxt()} from its label`:''}`+
      `${tgPlan.pick?`${tgOffOn()?'':', from its label'} on plate ${tgPlan.pick}`:''} — `+
      `${tgPlan.len.toFixed(2)} mm from the surface at tilt ${tgTilt}°, roll ${tgRoll}°, `+
      `yaw ${tgYaw}°${tgFoot?` — ${tgFoot.toFixed(2)} mm footprint sphere`:''} — experimental`);
  /* the sheet carries the plate and its overlays, all of which are atlas-framed, so it
     says so rather than letting a working frame be assumed from the app around it */
  if(showSK) notes.push('Skull outline — experimental, approximate fit');
  if(showLM) notes.push('Landmarks: atlas AP, heights from the registered skull — approximate');
  if(FRAME.on) notes.push(`Atlas coordinates — working frame (${frameTxt()}) not applied to this plate`);
  notes.push('Radtke-Schuller et al. 2016, Brain Struct Funct 221(Suppl 1):1–272 · doi:10.1007/s00429-016-1259-0');
  g.font='13px ui-sans-serif,Segoe UI,Helvetica,Arial,sans-serif'; g.fillStyle='#8a8378';
  g.fillText(notes.join('   ·   '),0,NH+74);

  dl(`gerbil_plate${cur}${sel?'_'+sel.replace(/[^\w-]/g,''):''}.png`, c.toDataURL('image/png'));
}
/* the same sheet as the PNG, but the plate is the traced regional outlines rather
   than the photograph, so every line stays a path an illustrator can pick up.
   The outlines were vectorized off the printed plate at 3296 x 2481 and are left in
   that frame; VEC[plate].m is the matrix that puts them on the 1100 x 703 crop the
   rest of the app measures in, fitted to the plate's own ink (worst plate 1.8 px,
   0.03 mm) and carrying the quarter turn that plate 20 is printed with. */
const VEC = window.__VEC__;
const SVGF = "ui-sans-serif,'Segoe UI',Helvetica,Arial,sans-serif";
const xml = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const n2 = v => Math.round(v*100)/100;
/* canvas measures text from its top, SVG from the baseline */
function svgText(x,y,size,fill,txt,weight){
  return `<text x="${n2(x)}" y="${n2(y+size*0.8)}" font-family="${SVGF}" `+
         `font-size="${size}"${weight?` font-weight="${weight}"`:''} fill="${fill}">${xml(txt)}</text>`;
}
function exportSVG(){
  const V = VEC && VEC[cur];
  if(!V){ hintWarn('No vector outlines are bundled for this plate.'); return; }
  const CAP=104, H=NH+CAP, o=[];
  o.push('<?xml version="1.0" encoding="UTF-8"?>');
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${NW}" height="${H}" `+
         `viewBox="0 0 ${NW} ${H}">`);
  o.push(`<title>${xml('Gerbil atlas plate '+cur)}</title>`);
  o.push(`<defs><clipPath id="plate"><rect x="0" y="0" width="${NW}" height="${NH}"/></clipPath></defs>`);
  o.push(`<rect width="${NW}" height="${H}" fill="#ffffff"/>`);

  /* --- the plate itself --- */
  const grp=(id,rows,dash)=>rows&&rows.length
    ? `<g id="${id}">`+rows.map(r=>`<path d="${r[0]}" stroke-width="${r[1]}"`+
        (dash&&r[2]?` stroke-dasharray="${r[2]}"`:'')+'/>').join('')+'</g>' : '';
  /* the clip is a plate-frame rectangle, so it has to sit outside the matrix: a
     clipPath resolves in the user space its own element establishes, which for a
     transformed group is the page frame the paths are still in */
  o.push('<g id="outlines" clip-path="url(#plate)">');
  o.push(`<g transform="matrix(${V.m.join(' ')})" `+
         'fill="none" stroke="#1b1a17" stroke-linecap="round" stroke-linejoin="round">');
  o.push(grp('outlines-solid',V.s,false));
  o.push(grp('outlines-dashed',V.d,true));
  o.push('</g></g>');
  /* the extents, one group per structure and named for it, so an illustrator can pick a
     region up by name rather than by hunting for its lines. Drawn faint: the tracing above
     is the atlas's line, and this is the face it encloses. */
  if(ROK){
    const R=regBuild(cur), idOf=t=>t.replace(/[^A-Za-z0-9_-]/g,'_');
    o.push('<g id="regions" fill="none" stroke="#1b1a17" stroke-opacity="0.35" stroke-width="0.8">'+
      R.regs.map(r=>`<g id="region-${idOf(r.ab)}" data-abbr="${xml(r.ab)}" data-name="${xml(byAb[r.ab]?byAb[r.ab].name:'')}"`+
        `${regEst(r)?' stroke-dasharray="4 3"':''}`+
        `${regUnd(r)?' data-outline="a split this atlas does not draw"':''}><title>${xml(r.ab+(byAb[r.ab]?' — '+byAb[r.ab].name:''))}</title>`+
        `<path d="${regD(r)}"/></g>`).join('')+
      (RUNA[cur]||[]).map((g,k)=>`<g id="region-unnamed-${k+1}" data-name="unnamed sealed face"><path d="M`+
        g.map(([x,y])=>(x*NW).toFixed(1)+' '+(y*NH).toFixed(1)).join('L')+'Z"/></g>').join('')+'</g>');
  }

  /* --- overlays, in the order and the colours the PNG draws them --- */
  if(showGrid){
    const L=[];
    for(let m=-8;m<=8;m++){ const x=n2(fromML(m));
      L.push(`<line x1="${x}" y1="${BY0}" x2="${x}" y2="${BY1}" stroke-width="${m?0.7:1.4}"/>`); }
    for(let v=1;v>=-10;v--){ const y=n2(fromDV(v));
      L.push(`<line x1="${BX0}" y1="${y}" x2="${BX1}" y2="${y}" stroke-width="${v?0.7:1.4}"/>`); }
    o.push('<g id="grid" stroke="#5b7085" stroke-opacity="0.55">'+L.join('')+'</g>');
  }
  if(showSK){
    const d=skullLoops(cur);
    if(d.length) o.push('<g id="skull" fill="none" stroke="#8f8264" stroke-opacity="0.8" '+
      'stroke-width="2">'+d.map(s=>`<path d="${s}"/>`).join('')+'</g>');
  }
  const SKL=window.__SKULL__&&window.__SKULL__.lm;
  if(showLM&&SKL){
    const L=[], ap=plateOf[cur].bregma, iaAP=-LMof('Interaural'),
          y=n2(fromDV(SKL.ear.dv)), here=Math.abs(ap-iaAP)<0.18;
    L.push(`<line x1="${BX0}" y1="${y}" x2="${BX1}" y2="${y}" stroke-width="1.8"`+
           (here?'':' stroke-dasharray="7 5"')+'/>');
    L.push(svgText(BX0+8,y-22,15,'#0f766e','interaural'+(here?'':' height'),600));
    LM.forEach(([nm,off])=>{
      const h=SKL.vault[nm.toLowerCase()];
      if(nm==='Interaural'||h===undefined||Math.abs(ap+off)>0.18) return;
      const x=n2(fromML(0)), yy=n2(fromDV(h));
      L.push(`<circle cx="${x}" cy="${yy}" r="7" stroke-width="2.4"/>`);
      L.push(`<line x1="${x}" y1="${n2(yy-16)}" x2="${x}" y2="${n2(yy-8)}" stroke-width="1.8"/>`);
      L.push(svgText(x+11,yy-27,15,'#0f766e',nm.toLowerCase(),600));
    });
    o.push('<g id="landmarks" fill="none" stroke="#0f766e">'+L.join('')+'</g>');
  }
  /* as on the screen and the PNG: the extent where there is one, otherwise the circle */
  const bs=(LB[cur]||{})[sel]||[], rgS=regOut(sel);
  if(rgS) o.push(`<g id="highlight" fill="${markC()}" fill-opacity=".10" fill-rule="evenodd"`+
    ` stroke="${markC()}" stroke-width="1.5"${regEst(rgS)?' stroke-dasharray="6 4"':''}>`+
    `<path d="${regD(rgS)}"/></g>`);
  else if(bs.length) o.push(`<g id="highlight" fill="none" stroke="${markC()}" stroke-width="1.8">`+
    bs.map(([cx,cy,w,h])=>{ const R=Math.max(w*NW,h*NH);
      return `<ellipse cx="${n2(cx*NW)}" cy="${n2(cy*NH)}" `+
             `rx="${n2(R*0.85+7)}" ry="${n2(R*0.55+6)}"/>`; }).join('')+'</g>');
  if(mA&&mB) o.push('<g id="measure" fill="none" stroke="#00875a" stroke-width="2.2">'+
    `<line x1="${n2(mA[0])}" y1="${n2(mA[1])}" x2="${n2(mB[0])}" y2="${n2(mB[1])}"/>`+
    [mA,mB].map(p=>`<circle cx="${n2(p[0])}" cy="${n2(p[1])}" r="4"/>`).join('')+'</g>');
  /* the planned track, dashed where it is only the projection of a track that passes in
     front of or behind this plane -- the same distinction the screen and the PNG draw */
  if(tgPlan && tgPlan.len!==undefined && smode==='targ'){
    const ap0=plateOf[cur].bregma, half=PSTEP/2, T=[];
    const q=tgSample(tgPlan,64).map(o=>({x:n2(fromML(o.ml)), y:n2(fromDV(o.dv)),
                                         on:Math.abs(o.ap-ap0)<=half}));
    for(let i=1;i<q.length;i++){
      const on=q[i-1].on&&q[i].on;
      T.push(`<line x1="${q[i-1].x}" y1="${q[i-1].y}" x2="${q[i].x}" y2="${q[i].y}" `+
             `stroke-width="${on?2.4:1.6}"${on?'':' stroke-dasharray="5 4"'}/>`);
    }
    const E=q[0], Tt=q[q.length-1];
    if(tgLegs) T.push(`<polyline points="${E.x},${E.y} ${E.x},${Tt.y} ${Tt.x},${Tt.y}" `+
      'stroke-width="1.4" stroke-dasharray="2 4"/>');
    T.push(`<circle cx="${E.x}" cy="${E.y}" r="5" stroke-width="${E.on?2.4:1.6}"`+
           (E.on?'':' stroke-dasharray="5 4"')+'/>');
    T.push(`<circle cx="${Tt.x}" cy="${Tt.y}" r="8" stroke-width="${Tt.on?2.4:1.6}"`+
           (Tt.on?'':' stroke-dasharray="5 4"')+'/>');
    tgFootPlate(tgPlan).forEach(e=>T.push(e.replace('class="fp"','stroke-width="1.6" stroke-dasharray="3 3"')));
    o.push('<g id="track" fill="none" stroke="#c4008f">'+T.join('')+'</g>');
  }
  const qa = smode==='coord' ? revAtlas() : null;
  const qOn = !!qa && apPlate()===cur;
  if(qOn){
    const x=n2(fromML(qa.ml)), y=n2(fromDV(qa.dv)), R=12, A=5, B=R+8;
    o.push('<g id="query" fill="none" stroke="#7b23c9">'+
      `<circle cx="${x}" cy="${y}" r="${R}" stroke-width="2.4"/>`+
      [[x-B,y,x-A,y],[x+A,y,x+B,y],[x,y-B,x,y-A],[x,y+A,x,y+B]]
        .map(([a,b,c,d])=>`<line x1="${n2(a)}" y1="${n2(b)}" x2="${n2(c)}" y2="${n2(d)}" `+
             'stroke-width="1.6"/>').join('')+'</g>');
  }

  /* --- caption: the PNG's wording, with the notes this sheet needs in place of the
     ones about the photograph, which it does not carry --- */
  const p=plateOf[cur], cap=[];
  cap.push(`<line x1="0" y1="${NH+9}" x2="${NW}" y2="${NH+9}" stroke="#dddad3" stroke-width="1"/>`);
  cap.push(svgText(0,NH+24,19,'#1b1a17',
    `Plate ${cur}`+(sel&&byAb[sel]?`   ·   ${byAb[sel].abbr} — ${byAb[sel].name}`:''),600));
  cap.push(svgText(0,NH+50,15,'#5a554c',
    `AP   bregma ${p.bregma.toFixed(2)}  ·  lambda ${p.lambda_.toFixed(2)}  ·  `+
    `interaural ${p.interaural.toFixed(2)}  ·  occipital crest ${p.occipital_crest.toFixed(2)} mm`));
  const notes=['Regional outlines traced from the printed plate — vector paths only, no section image'+
               (ROK?'; one named group per region':'')];
  if(mA&&mB){ const dml=toML(mB[0])-toML(mA[0]), ddv=toDV(mB[1])-toDV(mA[1]);
    notes.push(`Measured ${Math.hypot(dml,ddv).toFixed(2)} mm (ΔML ${sgn(dml)}, ΔDV ${sgn(ddv)})`); }
  if(qOn) notes.push(`Query point ML ${sgn(qa.ml)}, DV ${sgn(qa.dv)}`);
  if(tgPlan&&tgPlan.len!==undefined&&smode==='targ')
    notes.push(`Track to ${tgPlan.abbr} (${tgPlan.side>0?'right':'left'}) — `+
      `${tgPlan.len.toFixed(2)} mm from the surface at tilt ${tgTilt}°, roll ${tgRoll}°, `+
      `yaw ${tgYaw}° — experimental`);
  if(showSK) notes.push('Skull outline — experimental, approximate fit');
  if(showLM) notes.push('Landmarks: atlas AP, heights from the registered skull — approximate');
  if(FRAME.on) notes.push(`Atlas coordinates — working frame (${frameTxt()}) not applied to this plate`);
  notes.push('Radtke-Schuller et al. 2016, Brain Struct Funct 221(Suppl 1):1–272 · doi:10.1007/s00429-016-1259-0');
  cap.push(svgText(0,NH+74,13,'#8a8378',notes.join('   ·   ')));
  o.push('<g id="caption">'+cap.join('')+'</g>');

  o.push('</svg>');
  dl(`gerbil_plate${cur}${sel?'_'+sel.replace(/[^\w-]/g,''):''}.svg`,
     URL.createObjectURL(new Blob([o.join('\n')],{type:'image/svg+xml;charset=utf-8'})), true);
}
function exportCSV(){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  const head=['abbr','name','first_plate','last_plate','n_plates','plates',
    'bregma_anterior_mm','bregma_posterior_mm','lambda_anterior_mm','lambda_posterior_mm',
    'interaural_anterior_mm','interaural_posterior_mm',
    'label_AP_bregma_mm','label_ML_abs_mm','label_DV_mm','n_labels','systems'];
  /* the atlas columns are left exactly as they were and the working frame is added
     beside them, never in place of them: a CSV outlives the session that set the frame,
     so the file carries both readings and a spec saying which frame produced the second */
  const FR=FRAME.on, fold=bilat();
  if(FR) head.push(...(fold
      ? ['frame_AP_mm','frame_ML_abs_mm','frame_DV_mm']
      : ['frame_AP_right_mm','frame_ML_right_mm','frame_DV_right_mm',
         'frame_AP_left_mm','frame_ML_left_mm','frame_DV_left_mm']),'frame_spec');
  /* deliberately comma-free: it is a quoted field so a comma would be legal, but this
     column exists to be read a year later, often by something that splits on commas */
  const spec=FR?`pitch=${FRAME.pitch} roll=${FRAME.roll} yaw=${FRAME.yaw}`+
    /* whichever of the two decided where zero is; the other has no effect and saying it
       anyway would leave a reader guessing which of them the numbers came from */
    (FRAME.org
      ? ` origin=${orgName().replace(/ /g,'-')}`+
        ` origin_from=${LM[FRAME.oref][0].toLowerCase()}`+
        ` origin_offset_AP/ML/DV=${FRAME.oap}/${FRAME.oml}/${FRAME.odv}`+
        ` origin_atlas_AP/ML/DV=${oAbs().map(v=>+v.toFixed(3)).join('/')}`
      : ` origin=atlas pivot_AP/ML/DV=${FRAME.pap}/${FRAME.pml}/${FRAME.pdv}`)+
    ` offset_AP/ML/DV=${FRAME.dap}/${FRAME.dml}/${FRAME.ddv}`+
    ` order=yaw>pitch>roll signs=nose-down/right-ear-down/nose-right`:'';
  const rows=results.map(r=>{ const c=coordsOf(r.abbr);
    const row=[r.abbr,r.name,r.first_plate,r.last_plate,r.n_plates,r.plates.join(' '),
      r.bregma_anterior.toFixed(2),r.bregma_posterior.toFixed(2),
      (r.bregma_anterior+LMof('Lambda')).toFixed(2),(r.bregma_posterior+LMof('Lambda')).toFixed(2),
      (r.bregma_anterior+LMof('Interaural')).toFixed(2),(r.bregma_posterior+LMof('Interaural')).toFixed(2),
      c?c.ap.toFixed(2):'', c?c.ml.toFixed(2):'', c?c.dv.toFixed(2):'', c?c.n:0,
      r.systems.join(' ')];
    if(FR){
      const k=coordsOf(r.abbr,1);
      const t=o=>o?[o.ap.toFixed(2),o.ml.toFixed(2),o.dv.toFixed(2)]:['','',''];
      row.push(...(fold?t(k):[...t(k&&k.R),...t(k&&k.L)]), spec);
    }
    return row.map(q).join(','); });
  const csv='﻿'+[head.map(q).join(',')].concat(rows).join('\r\n')+'\r\n';
  dl('gerbil_atlas_structures.csv',
     URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), true);
}
/* one row per printed label rather than one per structure: every located label of the
   structures in the list, with the triplet the app reads it at -- the end of its leader
   line where the atlas draws one, the centre of the word otherwise */
function exportLabelsCSV(){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  const head=['abbr','name','plate','label_index','ap_bregma_mm','ml_mm','ml_abs_mm','dv_mm','position_from'];
  const FR=FRAME.on;
  if(FR) head.push('frame_AP_mm','frame_ML_mm','frame_DV_mm','frame_spec');
  const spec=FR?`pitch=${FRAME.pitch} roll=${FRAME.roll} yaw=${FRAME.yaw} zero=${orgFull().replace(/ /g,'-')}`:'';
  const rows=[];
  for(const r of results) for(const t of (ptsOf[r.abbr]||[])){
    const row=[t.ab,r.name,t.p,t.i,t.ap.toFixed(2),t.ml.toFixed(2),Math.abs(t.ml).toFixed(2),t.dv.toFixed(2),
               t.ld?'leader tip':'label box'];
    if(FR){ const k=toFrame(t.ap,t.ml,t.dv); row.push(k.ap.toFixed(2),k.ml.toFixed(2),k.dv.toFixed(2),spec); }
    rows.push(row.map(q).join(','));
  }
  const csv='\ufeff'+[head.map(q).join(',')].concat(rows).join('\r\n')+'\r\n';
  dl('gerbil_atlas_labels.csv',
     URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), true);
}
$('epng').onclick=exportPNG;
$('esvg').onclick=exportSVG;
$('ecsv').onclick=exportCSV;
$('elab').onclick=exportLabelsCSV;


/* ---------- sagittal / top-down projection ----------
   A label's plate gives it an AP and the coordinate box above gives it an ML and a DV,
   so all 6,220 of them can be scattered at once. That shows a structure's whole extent
   down the brain in one picture, which a stack of coronal plates cannot do. */
const PM={l:56,r:14,t:24,b:44}, K=40, AP0=8.15, AP1=-13.90, PW=(AP0-AP1)*K;
/* How far the turned cloud runs past the atlas's own extents, in whole millimetres per
   end of each axis. A view that is turned but not widened would simply drop the dots the
   rotation pushed out -- at 17 degrees of pitch that is most of the cortex -- so the plot
   grows to hold them and the axis keeps its 1/40 mm to the unit either way. Every entry
   is 0 while the view is not turned, which leaves all three axes exactly what they were. */
let fvP={ap:[0,0],ml:[0,0],dv:[0,0]}, pA0=AP0, PWv=PW;
const VIEWS={
  dv:{k:'dv',hi:.4,lo:-9.6,ax:'DV (mm)',z0:'dorsal surface',
      nm:'sagittal projection, anterior\u2013posterior against dorsal\u2013ventral'},
  ml:{k:'ml',hi:8,lo:-8,ax:'ML (mm)',z0:'midline',
      nm:'top-down projection, anterior\u2013posterior against mediolateral'}
};
/* This view plots atlas positions until it is asked not to. A re-zero never moves a dot,
   only the numbering, so the axes are ruled and labelled from wherever zero now is and
   the captions name it. A rotation does move dots -- so with *In frame* ticked the cloud
   is turned by it and the axes become the frame's own, and without it the view stays in
   atlas coordinates and says so, which is all it could ever do before. */
const pjq = q => fvOn() ? fRot(q.ap,q.ml,q.dv) : q;
/* The skull silhouette and the landmark rules are the two things that cannot come along.
   Both are flattened along the axis the view drops, and the flattening was done at the
   atlas's angle: the outline of a turned skull is not the turned outline of a skull, and
   a landmark whose AP is all the atlas prints stops being a line once the frame tilts.
   So they sit out a turned view rather than being drawn wrong in it. */
const pjSkOn = () => pjsk && !fvOn();
const pjLmOn = () => pjlm && !fvOn();
/* what the AP axis is counted from, once anything has moved zero */
const pjZero = () => (shifted()||fvOn()) && FRAME.org ? esc(orgName()) : 'bregma';
const dotTxt=q=>{ const F=shifted()||fvOn(), c=F?toFrame(q.ap,q.ml,q.dv):q;
  return `${FRAME.on&&!F?'atlas ':''}${apLab(F)} ${sgn(c.ap)}`+
         ` \u00b7 ML ${sgn(c.ml)} \u00b7 DV ${sgn(c.dv)} mm`; };
/* whole millimetres of the axis as it is labelled, which is the atlas's own lattice until
   an origin moves it. Two apart, from the top of the range down -- the same set the fixed
   lists used to spell out, including the extra ticks the wider skull and landmark views
   open up, but derived from the range rather than kept in step with it by hand. */
const pjTicks=(k,hi,lo)=>{ const a=[];
  for(let d=Math.floor(axTo(k,hi)/2)*2; d>=axTo(k,lo)-1e-9; d-=2) a.push(d);
  return a; };
/* one viewBox unit is 1/40 mm on both axes, so neither view is distorted */
/* with the skull outline on, each view opens out just far enough to hold the bone
   around the cloud; off, the axes are exactly what they always were */
const pjHi=V=>V.hi+Math.max(pjSkOn()?(V.k==='dv'?0.7:3.3):0, pjLmOn()?(V.k==='dv'?0.8:3.0):0)
             +fvP[V.k][1];
const pjLo=V=>V.lo-Math.max(pjSkOn()?(V.k==='dv'?3.5:3.3):0, pjLmOn()?(V.k==='dv'?0:3.0):0)
             -fvP[V.k][0];
const pjx=ap=>PM.l+(pA0-ap)*K, pjy=(V,v)=>PM.t+(pjHi(V)-v)*K;
/* the whole cloud, turned, measured against what the plot already holds */
function fvBounds(){
  fvP={ap:[0,0],ml:[0,0],dv:[0,0]}; pA0=AP0; PWv=PW;
  if(!fvOn()) return;
  const b={ap:[1e9,-1e9],ml:[1e9,-1e9],dv:[1e9,-1e9]};
  for(const q of PTS){ const c=fRot(q.ap,q.ml,q.dv);
    for(const k in b){ if(c[k]<b[k][0]) b[k][0]=c[k]; if(c[k]>b[k][1]) b[k][1]=c[k]; } }
  const lowPad=(v,lim)=>Math.max(0,Math.ceil(lim-v-1e-9));
  const hiPad =(v,lim)=>Math.max(0,Math.ceil(v-lim-1e-9));
  fvP.ap=[lowPad(b.ap[0],AP1), hiPad(b.ap[1],AP0)];
  fvP.dv=[lowPad(b.dv[0],VIEWS.dv.lo), hiPad(b.dv[1],VIEWS.dv.hi)];
  fvP.ml=[lowPad(b.ml[0],VIEWS.ml.lo), hiPad(b.ml[1],VIEWS.ml.hi)];
  pA0=AP0+fvP.ap[1]; PWv=(pA0-(AP1-fvP.ap[0]))*K;
}
/* axis ticks are whole millimetres, and get a real minus rather than a hyphen */
const tick=v=>v>0?'+'+v:(v<0?'\u2212'+(-v):'0');
const PJS=$('pjs'), PJW=$('pjw'), PJT=$('pjt'), PJH=$('pjhi');
let pview='dv', bgd={}, fld={}, phot=null;

/* grid, ticks and axis titles; only a change of view can move them */
function pjAxes(){
  const V=VIEWS[pview], H=(pjHi(V)-pjLo(V))*K, y1=PM.t+H, g=[];
  /* the silhouette runs on past the axes -- the nose alone reaches AP +19 -- so it is
     clipped to the plot rectangle rather than allowed to stroke through the captions */
  g.push(`<clipPath id="pjclip"><rect x="${PM.l}" y="${PM.t}" width="${PWv}" height="${H.toFixed(1)}"></rect></clipPath>`);
  PJS.setAttribute('viewBox',`0 0 ${PM.l+PWv+PM.r} ${PM.t+H+PM.b}`);
  $('pjttl').textContent='Every printed label in the atlas as a '+V.nm+
    (fvOn()?', turned into the working frame.':'.');
  for(const d of pjTicks('ap',8+fvP.ap[1],-12-fvP.ap[0])){
    const x=pjx(axFrom('ap',d)).toFixed(1);
    g.push(`<line class="${d?'':'zero'}" x1="${x}" y1="${PM.t}" x2="${x}" y2="${y1}"></line>`,
           `<text x="${x}" y="${y1+16}" text-anchor="middle">${tick(d)}</text>`);
  }
  for(const d of pjTicks(V.k,pjHi(V),pjLo(V))){
    const y=pjy(V,axFrom(V.k,d));
    g.push(`<line class="${d?'':'zero'}" x1="${PM.l}" y1="${y.toFixed(1)}" x2="${PM.l+PWv}" y2="${y.toFixed(1)}"></line>`,
           `<text x="${PM.l-8}" y="${(y+4.5).toFixed(1)}" text-anchor="end">${tick(d)}</text>`);
  }
  /* the captions name what zero is, and stop claiming the atlas's answer once it moves */
  const z0=axTo(V.k,0)?'your zero':V.z0;
  g.push(`<text transform="translate(13,${(PM.t+H/2).toFixed(1)}) rotate(-90)" text-anchor="middle">${V.ax} \u00b7 0 = ${z0}</text>`,
         `<text x="${PM.l}" y="${y1+36}" text-anchor="start">\u2190 anterior</text>`,
         `<text x="${PM.l+PWv/2}" y="${y1+36}" text-anchor="middle">AP from ${pjZero()} (mm)</text>`,
         `<text x="${PM.l+PWv}" y="${y1+36}" text-anchor="end">posterior \u2192</text>`);
  $('pja').innerHTML=g.join('');
}
/* thousands of points, one node: a zero-length subpath per dot, rounded by the cap */
const pjd=(l,V)=>l.map(q=>{ const c=pjq(q);
  return 'M'+pjx(c.ap).toFixed(1)+' '+pjy(V,c[V.k]).toFixed(1)+'h.01'; }).join('');

/* the skull silhouette around the cloud: the same surface as the 3-D shell, flattened
   the same way the labels are -- everything collapsed along the axis not shown */
function pjSk(){
  const g=$('pjk'), SK=window.__SKULL__;
  if(!pjSkOn()||!SK||!SK.sil){ g.innerHTML=''; return; }
  const V=VIEWS[pview];
  g.innerHTML=(SK.sil[V.k]||[]).map(lp=>
    '<path d="M'+lp.map(p=>pjx(p[0]).toFixed(1)+' '+pjy(V,p[1]).toFixed(1)).join('L')+'Z"/>').join('');
}
/* the same landmarks on the projections. Here the AP lines are exact -- they are the
   atlas's own printed coordinates -- while only the heights and the ear-canal width come
   off the skull fit, so the AP rules are drawn whatever the skull says. The interaural
   line is a mediolateral axis: it projects to a point in the sagittal view and to a real
   line across the top-down one, which is the only place it can honestly be drawn as one. */
function pjLM(){
  const g=$('pjlm');
  if(!pjLmOn()){ g.innerHTML=''; return; }
  const V=VIEWS[pview], SK=window.__SKULL__, lm=SK&&SK.lm, o=[];
  const y0=PM.t, y1=PM.t+(pjHi(V)-pjLo(V))*K;
  LM.forEach(([nm,off])=>{
    const a=-off, x=pjx(a);
    if(x<PM.l-1||x>PM.l+PWv+1) return;
    o.push(`<line class="ref" x1="${x.toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${y1.toFixed(1)}"/>`,
           `<text x="${(x+4).toFixed(1)}" y="${(y1-6).toFixed(1)}">${esc(nm.toLowerCase())}</text>`);
    if(!lm) return;
    const h=lm.vault[nm.toLowerCase()];
    if(V.k==='dv'&&h!==undefined&&nm!=='Interaural')
      o.push(`<circle cx="${x.toFixed(1)}" cy="${pjy(V,h).toFixed(1)}" r="4"/>`);
  });
  if(lm){
    const iaX=pjx(-LMof('Interaural'));
    if(V.k==='ml'){          /* the interaural axis lies in this plane: a real line */
      o.push(`<line x1="${iaX.toFixed(1)}" y1="${pjy(V,-lm.ear.ml).toFixed(1)}"`+
             ` x2="${iaX.toFixed(1)}" y2="${pjy(V,lm.ear.ml).toFixed(1)}"/>`);
      [-lm.ear.ml,lm.ear.ml].forEach(m=>
        o.push(`<circle cx="${iaX.toFixed(1)}" cy="${pjy(V,m).toFixed(1)}" r="4"/>`));
    } else {                 /* seen end-on: a point, plus its height as a reference */
      const yy=pjy(V,lm.ear.dv);
      o.push(`<line class="ref" x1="${PM.l}" y1="${yy.toFixed(1)}" x2="${PM.l+PWv}" y2="${yy.toFixed(1)}"/>`,
             `<circle cx="${iaX.toFixed(1)}" cy="${yy.toFixed(1)}" r="4"/>`);
    }
  }
  g.innerHTML=o.join('');
}
/* everything a change of view or of the skull toggle has to rebuild, in one place:
   the dot cloud caches per-view path strings, so those survive; the axes, the
   silhouette and the plate guide are position-dependent and do not */
function pjRefresh(){ pjAxes(); pjSk(); pjLM(); pj(); tgPJ(); anPJ(); }

function pj(){
  const V=VIEWS[pview];
  /* the cache key carries the axis state: extended and normal axes place every dot
     differently, so each keeps its own copy rather than fighting over one */
  const ck=V.k+(pjSkOn()?'+':'')+(pjLmOn()?'L':'')+(fvOn()?'F':'');
  $('pjb').setAttribute('d', bgd[ck]||(bgd[ck]=pjd(PTS,V)));
  /* the current filter as a middle layer: pick the auditory chip and the whole
     ascending pathway lights up at once, which is the point of having this view */
  const fs=results.length<S.length?new Set(results.map(r=>r.abbr)):null;
  const key=ck+'\u0000'+(fs?results.map(r=>r.abbr).join(' '):'*')+'\u0000'+(sel||'');
  if(!(key in fld)){ fld={}; fld[key]=fs?pjd(PTS.filter(q=>fs.has(q.ab)&&q.ab!==sel),V):''; }
  $('pjf').setAttribute('d',fld[key]);
  const q=(sel&&ptsOf[sel])||[];
  $('pjl').classList.toggle('grp',isGrp(sel));
  $('pjl').innerHTML=q.map(t=>{ const c=pjq(t);
    return `<circle cx="${pjx(c.ap).toFixed(1)}" cy="${pjy(V,c[V.k]).toFixed(1)}" r="5"></circle>`; }).join('');
  pjNote(q); pjGuide(); pjHide(); anPJ();
}
/* Where the plate viewer is sitting, on the AP axis the two share. Turned into the frame
   a plate stops being a single AP -- the section is a plane, and the plane meets this
   pair of axes in a line rather than in one place on the AP one. So the guide is drawn
   as that line: the plate's own cut through the middle of the brain, tilted by exactly
   the part of the rotation these two axes can see. */
const PJMID = () => (VIEWS.dv.hi+VIEWS.dv.lo)/2;   /* mid-brain on the axis a view drops */
function pjGuide(){
  const V=VIEWS[pview], H=(pjHi(V)-pjLo(V))*K, ap=plateOf[cur].bregma;
  let x1,y1,x2,y2;
  if(fvOn()){
    const [a,b]=[V.hi,V.lo].map(t=>pjq(V.k==='dv'?{ap,ml:0,dv:t}:{ap,ml:t,dv:PJMID()}));
    x1=pjx(a.ap); y1=pjy(V,a[V.k]); x2=pjx(b.ap); y2=pjy(V,b[V.k]);
  } else { x1=x2=pjx(ap); y1=PM.t; y2=PM.t+H; }
  const cx=Math.max(PM.l+17,Math.min(PM.l+PWv-17,x1));
  $('pjg').innerHTML=
    `<g clip-path="url(#pjclip)"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"`+
    ` x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line></g>`+
    `<rect x="${(cx-17).toFixed(1)}" y="2" width="34" height="18" rx="5"></rect>`+
    `<text x="${cx.toFixed(1)}" y="15.5" text-anchor="middle">${cur}</text>`;
}
/* the one sentence a turned view owes the reader: what has moved, and what had to go */
const pjTurn = () => !fvOn() ? '' :
  ` Turned into your frame (${frameTxt()}), so the axes are the ones your manipulator`+
  ` drives \u2014 the dots are a rigid rotation of the published coordinates, not a`+
  ` resectioning. The skull outline and the landmark rules are flattened at the atlas's`+
  ` own angle and cannot follow, so they are unavailable while this is on.`;
function pjNote(q){
  const V=VIEWS[pview], N=$('pjn');
  const dot='A dot is where an abbreviation is <em>printed</em> \u2014 close to its structure, not its centre.';
  if(!sel){ N.innerHTML=`Every located label in the atlas. ${dot} Hover one to read it, click it to open its plate.`+pjTurn(); return; }
  const r=byAb[sel];
  if(!q.length){ N.innerHTML=`<b>${esc(selName())}</b> is indexed for plates ${r.first_plate}\u2013${r.last_plate}, but none of its labels were located, so there is nothing to plot.`; return; }
  const pl=[...new Set(q.map(t=>t.p))].sort((a,b)=>a-b);
  const out=q.filter(t=>{ const c=pjq(t); return c[V.k]>pjHi(V)||c[V.k]<pjLo(V); }).length;
  N.innerHTML=`<b>${esc(selName())}</b> in ${selHue()}: ${q.length} label${q.length>1?'s':''} on ${pl.length} plate${pl.length>1?'s':''}`+
    ` (${pl[0]}${pl.length>1?'\u2013'+pl[pl.length-1]:''}), against every other label in the atlas. ${dot}`+
    (out?` ${out} label${out>1?'s fall':' falls'} outside the plotted range.`:'')+pjTurn();
}

/* hover to read a dot, click to go to it: the same bargain as the plate above */
const PJTOL=121;
function pjLoc(e){
  const m=PJS.getScreenCTM();
  return m?new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()):null;
}
function pjPick(p){
  const V=VIEWS[pview]; let best=null, bs=Infinity;
  for(const q of PTS){
    const c=pjq(q);
    const dx=pjx(c.ap)-p.x, dy=pjy(V,c[V.k])-p.y, d=dx*dx+dy*dy;
    if(d>PJTOL) continue;
    const b=q.ab===sel?d-64:d;                 /* a dot already picked out wins a tie */
    if(b<bs){ bs=b; best=q; }
  }
  return best;
}
function pjHide(){ PJT.hidden=true; PJH.style.display='none'; PJW.classList.remove('hot'); phot=null; }
function pjShow(q){
  const V=VIEWS[pview], r=byAb[q.ab], c=pjq(q), cx=pjx(c.ap), cy=pjy(V,c[V.k]);
  PJT.innerHTML=`<span class="ta">${esc(q.ab)}</span>`+
    `<span class="tn">${esc(r?r.name:'not in the published index')}</span>`+
    `<span class="tx">plate ${q.p} · ${dotTxt(q)}</span>`;
  PJT.hidden=false;
  PJH.setAttribute('cx',cx.toFixed(1)); PJH.setAttribute('cy',cy.toFixed(1));
  PJH.style.display=''; PJW.classList.add('hot');
  const m=PJS.getScreenCTM(); if(!m) return;
  const b=PJW.getBoundingClientRect(), t=new DOMPoint(cx,cy).matrixTransform(m);
  let x=t.x-b.left-PJT.offsetWidth/2; x=Math.max(2,Math.min(b.width-PJT.offsetWidth-2,x));
  let y=t.y-b.top-PJT.offsetHeight-11; if(y<2) y=t.y-b.top+13;
  PJT.style.left=x.toFixed(1)+'px'; PJT.style.top=y.toFixed(1)+'px';
}
function pjHover(e){
  const p=pjLoc(e), q=(p&&pjPick(p))||null;
  if(q===phot) return;
  phot=q; if(q) pjShow(q); else pjHide();
}
PJW.addEventListener('pointermove', e=>{ if(e.pointerType!=='touch') pjHover(e); });
PJW.addEventListener('pointerleave',e=>{ if(e.pointerType!=='touch') pjHide(); });
PJW.addEventListener('pointerdown', e=>{ if(e.pointerType==='touch') pjHover(e); });
PJW.addEventListener('click', e=>{
  const p=pjLoc(e); if(!p) return;
  const q=pjPick(p);
  if(q){ if(byAb[q.ab]) select(q.ab); go(q.p); return; }
  if(p.x<PM.l-10||p.x>PM.l+PWv+10) return;     /* the axis gutter is not a plate */
  /* bare plot: scrub the plate viewer. Turned into the frame the x of a click is no
     longer an atlas AP, so the point is read back through the rotation at the same
     mid-brain depth the guide is drawn at -- clicking the guide then lands on its plate. */
  const V=VIEWS[pview], u=pA0-(p.x-PM.l)/K, w=pjHi(V)-(p.y-PM.t)/K;
  const ap = !fvOn() ? u
    : (V.k==='dv' ? fUnrot(u,0,w) : fUnrot(u,w,PJMID())).ap;
  let best=P[0]; P.forEach(t=>{ if(Math.abs(t.bregma-ap)<Math.abs(best.bregma-ap)) best=t; });
  go(best.plate);
});
function setPView(v){
  if(!VIEWS[v]||v===pview) return;
  pview=v;
  [...$('pjseg').children].forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  pjRefresh(); queueHash();
}
[...$('pjseg').children].forEach(el=>el.onclick=()=>setPView(el.dataset.v));
$('ckpk').onchange=e=>{ pjsk=e.target.checked; pjRefresh(); queueHash(); };
$('ckplm').onchange=e=>{ pjlm=e.target.checked; pjRefresh(); queueHash(); };

/* ---------- one switch, in front of both views that can honour it ----------
   The projection and the 3-D view share the setting rather than each keeping its own:
   they are two pictures of one brain, and a reader who has turned one into their frame
   has said which orientation they are working in, not which panel they are looking at.
   The checkbox is hidden until there is a rotation to show, because with no angle set
   there is nothing for it to do and it would only invite the question. */
let fvLast=false;
function fvApply(force){
  $('v3f').checked=$('ckpf').checked=fview;
  $('v3fw').hidden=$('pjfw').hidden=!turned();
  /* neither overlay can be re-flattened at the frame's angle, so while the projection is
     turned they go dead rather than staying tickable and quietly drawing nothing */
  $('ckpk').disabled=$('ckplm').disabled=fvOn();
  /* the dot paths are cached per axis state, and turning the view is an axis state:
     rebuild them when the orientation has changed and leave them alone when it has not,
     so typing an angle into the frame dialog does not re-lay 6,220 points each keystroke */
  if(force||fvOn()||fvLast){ bgd={}; fld={}; fvBounds(); pjRefresh(); v3frame(); }
  else { pjAxes(); pjGuide(); }
  fvLast=fvOn();
  v3note();
}
const fvSet=on=>{ fview=!!on; fvApply(1); queueHash(); };
$('ckpf').onchange=e=>fvSet(e.target.checked);
$('v3f').onchange=e=>fvSet(e.target.checked);

/* ---------- 3-D view ----------
   The projection plots flatten the atlas onto two axes at a time; this puts the third
   back. All three renderers read one RG8 3-D texture -- red channel the tissue ink,
   green the drawn contour -- built once, on first use, from the plate images already
   embedded above. Nothing extra is downloaded and there is no library: about 24 MB on
   the GPU, plus the same 6,220 label points the projection already carries.

   The volume covers the interior of the plates' own printed coordinate box, which is
   what makes the world extent exact -- that box is where the millimetres come from.
   A flood fill inward from the border drops everything outside the brain, and that is
   what removes the plate number and the AP-coordinate table without hand-tuned
   rectangles: they are marginalia, so they lose on area to the section. */
const V3W=544, V3H=362, V3D=62;
/* The box interior, in frame pixels -- inside the printed rules, and now inside the 1 mm
   tick lattice they carry as well. The ticks sit a few pixels in from the right and bottom
   rules; on the drawing they are small enough that the component filter below drops them,
   but a photographed section leaves them attached to the grain and they survived as a
   dotted rule hanging in the volume. Nothing anatomical is lost: the widest section reaches
   ML 8 at x=976 and the deepest DV -10 at y=664. */
const V3C=[14,14,1020,681];
const V3X0=toML(V3C[0]), V3X1=toML(V3C[2]),
      V3Y0=toDV(V3C[3]), V3Y1=toDV(V3C[1]),        /* DV grows upward, so [3] is the floor */
      V3Z0=P[0].bregma,  V3Z1=P[P.length-1].bregma;
const V3YC=(V3Y0+V3Y1)/2, V3ZS=V3Z0-V3Z1;
/* world millimetres, centred on the brain: x mediolateral, y dorsoventral, z posterior */
const w3y=dv=>dv-V3YC, w3z=ap=>(V3Z0-ap)-V3ZS/2;

const V3CV=$('v3c'), V3WRAP=$('v3w'), V3MSG=$('v3msg'), V3TIP=$('v3t');
let gl=null, v3ready=false, v3busy=false, v3fail='';
/* the meshes: the brain surface and one closed mesh per structure, built offline from the
   extents by tools/build_volumes.py (METHODS, "The third dimension") and fetched here on
   first use -- 20 MB, so never part of the page. Six planes in seven of them are
   interpolated, which the note says every time they are shown. */
let v3m=false, MESH=null, meshBusy=false, meshFail='';
const MESHC={};                                  /* abbr -> {va, n, type} on the GPU */
let v3mode='contour', v3op=.42, v3a=0, v3b=61, v3half=false;
/* the tissue window and the curve across it -- Floor, Ceiling and Gamma in the toolbar.
   0, 1 and 1 is the identity, which is what this view drew before they existed. */
let v3t0=0, v3t1=1, v3gam=1;
let v3ortho=false;                 /* parallel vs perspective projection */
let v3sk=false, v3sko=.32;             /* the skull shell: off by default, opacity 0..1 */
let v3az=-.82, v3el=.30, v3dist=26, v3tx=0, v3ty=0;   /* orbit + screen-space pan */
let v3view='obl';                  /* the named viewpoint in force, '' once dragged off it */
let v3hot=null, v3raf=null, v3col={};

/* ---------- the small amount of matrix algebra this needs ---------- */
function m3mul(a,b){ const o=new Float32Array(16);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0;
    for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; }
function m3persp(f,asp,n,fa){ const t=1/Math.tan(f/2), o=new Float32Array(16);
  o[0]=t/asp; o[5]=t; o[10]=(fa+n)/(n-fa); o[11]=-1; o[14]=2*fa*n/(n-fa); return o; }
/* Parallel projection. The near plane goes behind the eye because nothing here is
   depth-tested and the camera can be closer to the brain than the box's front face:
   a positive near would clip the near half of the stack away. */
function m3ortho(hh,asp,n,fa){ const o=new Float32Array(16);
  o[0]=1/(hh*asp); o[5]=1/hh; o[10]=-2/(fa-n); o[14]=-(fa+n)/(fa-n); o[15]=1; return o; }
function m3look(e,c,u){
  const s=[e[0]-c[0],e[1]-c[1],e[2]-c[2]], lz=Math.hypot(...s)||1;
  const z=[s[0]/lz,s[1]/lz,s[2]/lz];
  const cx=[u[1]*z[2]-u[2]*z[1], u[2]*z[0]-u[0]*z[2], u[0]*z[1]-u[1]*z[0]];
  const lx=Math.hypot(...cx)||1, x=[cx[0]/lx,cx[1]/lx,cx[2]/lx];
  const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
  const d=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
                           -d(x,e),-d(y,e),-d(z,e),1]);
}
function v3cam(){
  const ce=Math.cos(v3el);
  return [v3dist*ce*Math.sin(v3az), v3dist*Math.sin(v3el), v3dist*ce*Math.cos(v3az)];
}
/* the pan is applied after the view matrix, so dragging always tracks the screen */

/* ---------- turning the scene into the working frame ----------
   Everything here -- the section stack, the 6,220 labels, the skull shell, the plate ring
   and the planned track -- is held in one world built affinely out of atlas millimetres
   (x = ML, y = DV about the centre, z = bregma minus AP). So a frame rotation is a model
   matrix in front of the camera rather than a rebuild of any of it, and three transformed
   basis vectors are the whole of that matrix. Only the rotation goes in: the translation
   half of the frame moves zero, not the brain, and the view already reads its axes from
   wherever zero is. Taken about the world's own centre, so the brain turns in place
   instead of swinging out of shot. The result is S R S-inverse for an S of determinant
   -1, so it is still a rotation and its inverse is still its transpose. */
let v3mo=null, v3camM=null;
function v3mod(){
  if(!fvOn()) return null;
  /* a world direction is (ml, dv, -ap) of an atlas one, and back the same way */
  const f=(x,y,z)=>{ const c=fRot(-z,x,y); return [c.ml,c.dv,-c.ap]; };
  const u=f(1,0,0), v=f(0,1,0), w=f(0,0,1);
  return new Float32Array([u[0],u[1],u[2],0, v[0],v[1],v[2],0, w[0],w[1],w[2],0, 0,0,0,1]);
}
/* a world vector read back in model space, by the transpose */
const v3unmod=(M,p)=> M ? [M[0]*p[0]+M[1]*p[1]+M[2]*p[2],
                           M[4]*p[0]+M[5]*p[1]+M[6]*p[2],
                           M[8]*p[0]+M[9]*p[1]+M[10]*p[2]] : p.slice();
/* the unit vector from the brain toward the eye, kept for the picker: with no w to
   divide by, an orthographic projection has to measure depth along the view axis. It is
   in model space, because that is where every point the shaders and the picker see is. */
let v3dep=null;
function v3mvp(){
  const w=V3CV.width||1, h=V3CV.height||1;
  const c=v3cam(), L=Math.hypot(c[0],c[1],c[2])||1;
  v3mo=v3mod();
  v3camM=v3unmod(v3mo,c);
  v3dep=v3unmod(v3mo,[c[0]/L,c[1]/L,c[2]/L]);
  const V=m3look(c,[0,0,0],[0,1,0]);
  V[12]+=v3tx; V[13]+=v3ty;
  /* the parallel view is framed to match the perspective one at the pivot plane, so
     switching between them neither jumps nor rescales and the wheel still zooms */
  const P = v3ortho ? m3ortho(v3dist*Math.tan(.36), w/h, -400, 400)
                    : m3persp(.72, w/h, .4, 400);
  const M=m3mul(P, V);
  return v3mo ? m3mul(M, v3mo) : M;
}

/* ---------- shaders ---------- */
function v3prog(vs,fs){
  const mk=(t,src)=>{ const o=gl.createShader(t); gl.shaderSource(o,src); gl.compileShader(o);
    if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
    return o; };
  const p=gl.createProgram();
  gl.attachShader(p,mk(gl.VERTEX_SHADER,vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const V3_QUAD=`#version 300 es
layout(location=0) in vec2 a_p;
uniform mat4 u_mvp; uniform vec3 u_o,u_u,u_v;
out vec2 v_uv;
void main(){ v_uv=a_p; gl_Position=u_mvp*vec4(u_o+u_u*a_p.x+u_v*a_p.y,1.0); }`;

/* The tissue channel's response curve, shared by both raster renderers so that a section
   reads the same way whether it is drawn as one of 62 quads or sampled by a ray. Tissue at
   or below u_t0 counts for nothing, u_t1 and above counts for all, and u_gam bends what
   lies between: under 1 it lifts faint tissue, over 1 it keeps only the dense. Density
   scales the alpha this ends up with; these three decide what the sample was worth in the
   first place, which is the difference between turning the whole render up and pulling one
   band of tissue out of it. At 0, 1 and 1 the curve is the identity, so an untouched view
   -- and every link written before there was anything to set -- draws exactly what it did.
   The contour channel is left alone: it is a drawn line, already there or absent, and it
   also picks the colour, so windowing it would recolour the render rather than stretch it. */
const V3_TONE=`
float tone(float v){
  float t=clamp((v-u_t0)/max(u_t1-u_t0,0.004),0.0,1.0);
  /* the exponent is one uniform for the whole draw, so this test is wave-wide and saves
     a pow at 288 samples a ray whenever the curve is left straight */
  return u_gam==1.0 ? t : pow(t,u_gam);
}`;

/* one plate: the contour in the accent, the tissue as a faint wash behind it */
const V3_SLICE=`#version 300 es
precision highp float; precision highp sampler3D;
in vec2 v_uv; out vec4 o;
uniform sampler3D u_vol; uniform vec3 u_ce,u_ti;
uniform float u_z,u_op,u_half,u_ink,u_t0,u_t1,u_gam;
${V3_TONE}
void main(){
  if(u_half>0.5 && v_uv.x<0.5) discard;
  vec2 s=texture(u_vol, vec3(v_uv.x, 1.0-v_uv.y, u_z)).rg;
  float a=(s.g + tone(s.r)*u_ink)*u_op;
  if(a<0.004) discard;
  o=vec4(mix(u_ti,u_ce,smoothstep(0.03,0.30,s.g)), min(a,1.0));
}`;

/* the same field, ray-marched front to back through the box */
const V3_BOX=`#version 300 es
layout(location=0) in vec3 a_p; uniform mat4 u_mvp; out vec3 v_p;
void main(){ v_p=a_p; gl_Position=u_mvp*vec4(a_p,1.0); }`;
const V3_VOL=`#version 300 es
precision highp float; precision highp sampler3D;
in vec3 v_p; out vec4 o;
uniform sampler3D u_vol; uniform vec3 u_cam,u_lo,u_hi,u_ce,u_ti,u_vdir;
uniform float u_op,u_half,u_z0,u_z1,u_ink,u_ortho,u_t0,u_t1,u_gam;
${V3_TONE}
void main(){
  /* under a parallel projection every ray shares the view direction, and starts far
     enough back that the box-entry clamp below still finds the front face */
  vec3 rd = u_ortho>0.5 ? u_vdir : normalize(v_p-u_cam);
  vec3 ro = u_ortho>0.5 ? v_p-u_vdir*400.0 : u_cam;
  vec3 i0=(u_lo-ro)/rd, i1=(u_hi-ro)/rd;
  vec3 lo=min(i0,i1), hi=max(i0,i1);
  float t0=max(max(max(lo.x,lo.y),lo.z),0.0), t1=min(min(hi.x,hi.y),hi.z);
  if(t1<=t0) discard;
  float dt=(t1-t0)/288.0;
  vec4 acc=vec4(0.0);
  for(int i=0;i<288;i++){
    vec3 uvw=(ro+rd*(t0+(float(i)+0.5)*dt)-u_lo)/(u_hi-u_lo);
    if(u_half>0.5 && uvw.x<0.5) continue;
    if(uvw.z<u_z0||uvw.z>u_z1) continue;
    /* the volume was filled row 0 first, which is the dorsal edge of the plate, so
       the DV axis runs the other way to the world's -- the same flip the slice
       shader applies. Miss it here and the brain renders upside down. */
    vec2 s=texture(u_vol, vec3(uvw.x, 1.0-uvw.y, uvw.z)).rg;
    float a=clamp((s.g + tone(s.r)*u_ink)*u_op*dt*7.0,0.0,1.0);
    acc.rgb+=(1.0-acc.a)*a*mix(u_ti,u_ce,smoothstep(0.03,0.30,s.g));
    acc.a  +=(1.0-acc.a)*a;
    if(acc.a>0.985) break;
  }
  if(acc.a<0.004) discard;
  o=acc;
}`;

/* the printed labels: dim for all, mid for the current filter, bright for the selection */
const V3_PTV=`#version 300 es
layout(location=0) in vec3 a_p; layout(location=1) in float a_f;
uniform mat4 u_mvp; uniform float u_size,u_half,u_zl,u_zh,u_only,u_ow;
out float v_f;
void main(){
  v_f=a_f;
  gl_Position=u_mvp*vec4(a_p,1.0);
  /* the slab and the midline cut have to hold here too, or the labels would
     keep drawing plates the contours have already dropped. Over the contours and
     the volume only the filtered and selected dots are drawn: the whole cloud on
     top of a solid render is noise, not information. */
  if((u_half>0.5 && a_p.x<0.0) || a_p.z<u_zl || a_p.z>u_zh || (u_only>0.5 && a_f<0.5))
    gl_Position=vec4(2.0,2.0,2.0,1.0);
  /* perspective shrinks far dots by their w; a parallel view has none, so the whole
     cloud takes one size from the camera distance instead of all clamping to the max */
  float wv = u_ow>0.0 ? u_ow : max(gl_Position.w,1.0);
  gl_PointSize=u_size*(a_f>1.5?1.85:1.0)*clamp(26.0/wv,0.55,2.4);
}`;
const V3_PTF=`#version 300 es
precision highp float; in float v_f; out vec4 o;
uniform vec3 u_c0,u_c1,u_c2;
void main(){
  float r=length(gl_PointCoord-0.5);
  if(r>0.5) discard;
  float e=smoothstep(0.5,0.34,r);
  vec3 c = v_f>1.5 ? u_c2 : (v_f>0.5 ? u_c1 : u_c0);
  o=vec4(c, e*(v_f>1.5?1.0:(v_f>0.5?0.85:0.62)));
}`;
const V3_LINE=`#version 300 es
precision highp float; out vec4 o; uniform vec3 u_c; uniform float u_a;
void main(){ o=vec4(u_c,u_a); }`;

/* the CT skull shell. Drawn twice around the brain content -- far side first, near side
   last -- so the section stack reads as sitting inside a translucent case without any
   per-triangle sorting. The rim term thickens the silhouette the way a real translucent
   shell does: edge-on bone is more bone. */
const V3_SKV=`#version 300 es
layout(location=0) in vec3 a_p; layout(location=1) in vec3 a_n;
uniform mat4 u_mvp; out vec3 v_n,v_p;
void main(){ v_n=a_n; v_p=a_p; gl_Position=u_mvp*vec4(a_p,1.0); }`;
const V3_SKF=`#version 300 es
precision highp float; in vec3 v_n,v_p; out vec4 o;
uniform vec3 u_cam,u_c; uniform float u_op,u_half;
void main(){
  if(u_half>0.5 && v_p.x<0.0) discard;
  vec3 N=normalize(v_n); if(!gl_FrontFacing) N=-N;
  float d=clamp(dot(N,normalize(u_cam-v_p)),0.0,1.0);
  float rim=(1.0-d)*(1.0-d);
  o=vec4(u_c*(0.50+0.55*d)+0.10*rim, u_op*mix(0.55+0.35*rim, 1.0, pow(u_op,4.0)));
}`;

/* u_ink is how much the plain tissue channel counts for beside the drawn contours. On the
   drawing the contours are the picture and the tissue is a wash behind them, so one low
   weight serves both modes. A histology section has no contour channel at all -- it is
   tissue the whole way through -- so there the tissue has to carry the render, and the two
   modes want very different amounts of it. A slice is composited once, so it needs enough
   to be seen through 62 of them; a ray is composited at 288 samples along its length, and
   at anything near the slice weight a section this dark goes opaque a fifth of the way in.
   Both are still a starting point: Density is the control that moves them. */
const v3ink = () => psrc==='drawing' ? .30 : (v3mode==='volume' ? .10 : 1.0);
let pSlice,pVol,pPts,pLine,pSkull, vaoQ,vaoB,vaoP, texV, bufF, nPT=0;
let vaoS=null, nSK=0;                      /* skull mesh, built on first use */
const v3box=new Array(V3D).fill(null);   /* section bounds per plate, set during the build */

/* ---------- build the volume from the plate images ---------- */
async function v3build(onp){
  const vol=new Uint8Array(V3W*V3H*V3D*2);
  const cvs=document.createElement('canvas'); cvs.width=V3W; cvs.height=V3H;
  const g=cvs.getContext('2d',{willReadFrequently:true});
  const N=V3W*V3H;
  const ink=new Uint8Array(N), red=new Uint8Array(N), solid=new Uint8Array(N),
        bg=new Uint8Array(N), comp=new Int32Array(N), stack=new Int32Array(N);
  for(let k=0;k<V3D;k++){
    const n=P[k].plate;
    const im=new Image(); im.src=plateImg(n);
    try{ await im.decode(); }catch(_){ continue; }
    g.clearRect(0,0,V3W,V3H);
    g.drawImage(im, V3C[0],V3C[1], V3C[2]-V3C[0],V3C[3]-V3C[1], 0,0, V3W,V3H);
    const px=g.getImageData(0,0,V3W,V3H).data;
    for(let i=0;i<N;i++){
      const r=px[i*4], gg=px[i*4+1], b=px[i*4+2];
      const mn=r<gg?(r<b?r:b):(gg<b?gg:b);
      const d=r-(gg>b?gg:b);
      red[i]  = (d>30 && r>80) ? Math.min(255,(d-30)*4) : 0;
      ink[i]  = mn<236 ? Math.min(255,(236-mn)*2) : 0;
      solid[i]= mn<236 ? 1 : 0;
      bg[i]=0; comp[i]=-1;
    }
    /* paper, flooded in from the border */
    let sp=0;
    for(let x=0;x<V3W;x++){ stack[sp++]=x; stack[sp++]=(V3H-1)*V3W+x; }
    for(let y=0;y<V3H;y++){ stack[sp++]=y*V3W; stack[sp++]=y*V3W+V3W-1; }
    while(sp>0){
      const i=stack[--sp];
      if(bg[i]||solid[i]) continue;
      bg[i]=1;
      const x=i%V3W, y=(i/V3W)|0;
      if(x>0)      stack[sp++]=i-1;
      if(x<V3W-1)  stack[sp++]=i+1;
      if(y>0)      stack[sp++]=i-V3W;
      if(y<V3H-1)  stack[sp++]=i+V3W;
    }
    /* what the paper did not reach is the section, plus a little marginalia */
    const area=[];
    for(let i=0;i<N;i++){
      if(bg[i]||comp[i]>=0) continue;
      const id=area.length; let a=0; let sp2=0;
      stack[sp2++]=i; comp[i]=id;
      while(sp2>0){
        const j=stack[--sp2]; a++;
        const x=j%V3W, y=(j/V3W)|0;
        if(x>0     && !bg[j-1]    && comp[j-1]<0)   { comp[j-1]=id;    stack[sp2++]=j-1; }
        if(x<V3W-1 && !bg[j+1]    && comp[j+1]<0)   { comp[j+1]=id;    stack[sp2++]=j+1; }
        if(y>0     && !bg[j-V3W]  && comp[j-V3W]<0) { comp[j-V3W]=id;  stack[sp2++]=j-V3W; }
        if(y<V3H-1 && !bg[j+V3W]  && comp[j+V3W]<0) { comp[j+V3W]=id;  stack[sp2++]=j+V3W; }
      }
      area.push(a);
    }
    let amax=0; for(const a of area) if(a>amax) amax=a;
    /* the floor has to clear the plate number and the AP table, whose glyphs run to a
       few hundred pixels, while still keeping the smallest real section (plate 62 is
       about 1,300) -- so an absolute floor, not just a fraction of the largest blob */
    const floor=Math.max(400,.02*amax), off=k*N*2;
    let x0=V3W, x1=-1, y0=V3H, y1=-1;
    for(let i=0;i<N;i++){
      const c=comp[i], keep = c>=0 && area[c]>floor;
      vol[off+i*2]   = keep?ink[i]:0;
      vol[off+i*2+1] = keep?red[i]:0;
      if(keep){ const x=i%V3W, y=(i/V3W)|0;
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    }
    /* where the section actually sits on this plate, so the current-plate marker can
       trace the section rather than float around the whole coordinate box */
    v3box[k] = x1<0 ? null
      : [x0/V3W, 1-y1/V3H, (x1+1)/V3W, 1-y0/V3H];
    if(onp) onp((k+1)/V3D);
    if((k&3)===3) await new Promise(r=>setTimeout(r));   /* let the bar paint */
  }
  return vol;
}

/* ---------- colours come from the sheet, so the view follows the theme ---------- */
function v3colours(){
  const cs=getComputedStyle(document.documentElement);
  const hex=v=>{ const s=cs.getPropertyValue(v).trim();
    const m=/^#?([0-9a-f]{6})$/i.exec(s);
    if(!m) return [.5,.5,.5];
    const n=parseInt(m[1],16);
    return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; };
  v3col={ ce:hex('--accent'), ti:hex('--cloud2'),
          c0:hex('--cloud'), c1:hex('--cloud2'), c2:hex('--mark'), cg:hex('--markg'),
          bg:hex('--panel'), bone:hex('--bone'), tg:hex('--targ'), an:hex('--note') };
  for(const k in MESHC) if(MESHC[k].col) MESHC[k].col=null;   /* recoloured on next draw */
}

function v3init(){
  gl=V3CV.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false});
  if(!gl){ v3fail='This browser does not support WebGL 2, which the 3-D view needs.'; return false; }
  pSlice=v3prog(V3_QUAD,V3_SLICE);
  pVol  =v3prog(V3_BOX ,V3_VOL);
  pPts  =v3prog(V3_PTV ,V3_PTF);
  pLine =v3prog(V3_BOX ,V3_LINE);
  pSkull=v3prog(V3_SKV ,V3_SKF);

  vaoQ=gl.createVertexArray(); gl.bindVertexArray(vaoQ);
  const qb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,qb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

  /* the box the ray-march runs through, and the outline that marks the current plate */
  const lo=[V3X0,w3y(V3Y0),w3z(V3Z0)], hi=[V3X1,w3y(V3Y1),w3z(V3Z1)];
  const bv=[]; for(let i=0;i<8;i++) bv.push(i&1?hi[0]:lo[0], i&2?hi[1]:lo[1], i&4?hi[2]:lo[2]);
  const bi=[]; [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]
    .forEach(f=>bi.push(f[0],f[1],f[2],f[0],f[2],f[3]));
  vaoB=gl.createVertexArray(); gl.bindVertexArray(vaoB);
  const bb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,bb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(bv),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(bi),gl.STATIC_DRAW);

  nPT=PTS.length;
  const pa=new Float32Array(nPT*3);
  PTS.forEach((q,i)=>{ pa[i*3]=q.ml; pa[i*3+1]=w3y(q.dv); pa[i*3+2]=w3z(q.ap); });
  vaoP=gl.createVertexArray(); gl.bindVertexArray(vaoP);
  const pb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pb);
  gl.bufferData(gl.ARRAY_BUFFER,pa,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  bufF=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,bufF);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nPT),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,1,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);
  v3colours();
  return true;
}

/* Decode the embedded skull surface once, in atlas millimetres, for everyone: the 3-D
   shell, the plate slicer and the PNG export all read this one copy. */
let SKM=null;
function skullMesh(){
  const SK=window.__SKULL__;
  if(SKM||!SK) return SKM;
  const b64=a=>{ const t=atob(a), u=new Uint8Array(t.length);
    for(let i=0;i<t.length;i++) u[i]=t.charCodeAt(i); return u; };
  const q=new Uint16Array(b64(SK.v).buffer), F=new Uint16Array(b64(SK.f).buffer);
  const pos=new Float32Array(SK.nv*3);
  for(let i=0;i<SK.nv*3;i++) pos[i]=SK.o[i%3]+q[i]*SK.s;
  return SKM={pos,idx:F,nf:SK.nf};
}
/* the skull's cut through one plate's plane: slice every triangle against ap=bregma,
   then chain the crossing segments into polylines by their shared quantised endpoints.
   Cached per plate -- the mesh never changes, so a plate is sliced at most once. */
const SKSL={};
function skullLoops(k){
  if(SKSL[k]) return SKSL[k];
  const M=skullMesh(); if(!M) return SKSL[k]=[];
  const ap=plateOf[k].bregma, {pos,idx,nf}=M;
  const px=[], py=[], segA=[], segB=[];
  const keyOf=(x,y)=>(Math.round(x*4))*8192+Math.round(y*4);
  const ends=new Map();
  const addPt=(x,y)=>{ px.push(x); py.push(y); return px.length-1; };
  for(let f=0;f<nf;f++){
    const ia=idx[f*3]*3, ib=idx[f*3+1]*3, ic=idx[f*3+2]*3;
    const da=pos[ia]-ap, db=pos[ib]-ap, dc=pos[ic]-ap;
    const pts=[];
    const edge=(i,j,di,dj)=>{
      if((di>0)===(dj>0)) return;
      const t=di/(di-dj);
      pts.push([fromML(pos[i+1]+t*(pos[j+1]-pos[i+1])),
                fromDV(pos[i+2]+t*(pos[j+2]-pos[i+2]))]);
    };
    edge(ia,ib,da,db); edge(ib,ic,db,dc); edge(ic,ia,dc,da);
    if(pts.length!==2) continue;
    const a=addPt(pts[0][0],pts[0][1]), b=addPt(pts[1][0],pts[1][1]);
    const s=segA.length; segA.push(a); segB.push(b);
    for(const [p,kk] of [[a,keyOf(pts[0][0],pts[0][1])],[b,keyOf(pts[1][0],pts[1][1])]]){
      let l=ends.get(kk); if(!l){ l=[]; ends.set(kk,l); } l.push(s);
    }
  }
  const used=new Uint8Array(segA.length), out=[];
  for(let s0=0;s0<segA.length;s0++){
    if(used[s0]) continue;
    used[s0]=1;
    /* walk both ways from this segment, joining wherever exactly one other segment
       shares the endpoint; a junction or a dead end just ends the polyline */
    const walk=start=>{
      const path=[]; let cur=s0, at=start;
      for(;;){
        path.push(at);
        const nxt = at===segA[cur]?segB[cur]:segA[cur];
        path.push(nxt);
        const kk=keyOf(px[nxt],py[nxt]);
        const cands=(ends.get(kk)||[]).filter(t=>!used[t]);
        if(cands.length!==1) return path;
        cur=cands[0]; used[cur]=1;
        at = keyOf(px[segA[cur]],py[segA[cur]])===kk ? segA[cur] : segB[cur];
      }
    };
    const fwd=walk(segA[s0]);
    /* fwd started from segA; extend backwards from the same seed's other end */
    used[s0]=1;
    const rev=[];
    {
      let kk=keyOf(px[fwd[0]],py[fwd[0]]);
      let cands=(ends.get(kk)||[]).filter(t=>!used[t]);
      let at=fwd[0];
      while(cands.length===1){
        const cur=cands[0]; used[cur]=1;
        at = keyOf(px[segA[cur]],py[segA[cur]])===kk ? segB[cur] : segA[cur];
        rev.push(at);
        kk=keyOf(px[at],py[at]);
        cands=(ends.get(kk)||[]).filter(t=>!used[t]);
      }
    }
    const ids=rev.reverse().concat(fwd);
    if(ids.length<6) continue;   /* a few stray triangles are noise, not bone */
    let d='M'+px[ids[0]].toFixed(1)+' '+py[ids[0]].toFixed(1);
    for(let i=1;i<ids.length;i++){
      if(ids[i]===ids[i-1]) continue;
      d+='L'+px[ids[i]].toFixed(1)+' '+py[ids[i]].toFixed(1);
    }
    out.push(d);
  }
  return SKSL[k]=out;
}
function drawSK(){
  const g=$('sk');
  g.innerHTML = showSK ? skullLoops(cur).map(d=>`<path d="${d}"/>`).join('') : '';
}
/* ---------- stereotaxic landmarks ----------
   The atlas prints an AP for bregma, lambda, the interaural line and the occipital crest
   and a height for none of them, so the APs here are the atlas's own and the heights come
   off the registered skull -- which is why this rides on the same approximate fit the
   outline does, and says so.

   A point landmark only exists in the one coronal plane it sits in, so it is drawn on the
   nearest plate and nowhere else. The interaural line runs mediolaterally, so it lies IN
   its own plane and is drawn solid there; on every other plate the same height is still
   the stereotaxic DV zero people zero their ear bars on, so it stays as a dashed
   reference rather than pretending the line is there. */
function drawLM(){
  const g=$('lm'), SK=window.__SKULL__;
  if(!showLM||!SK||!SK.lm){ g.innerHTML=''; return; }
  const ap=plateOf[cur].bregma, o=[];
  const iaAP=-LMof('Interaural'), y=fromDV(SK.lm.ear.dv), here=Math.abs(ap-iaAP)<0.18;
  o.push(`<line class="${here?'':'ref'}" x1="${BX0}" y1="${y.toFixed(1)}" x2="${BX1}" y2="${y.toFixed(1)}"/>`,
         `<text x="${BX0+8}" y="${(y-7).toFixed(1)}">interaural${here?'':' height'}</text>`);
  LM.forEach(([nm,off])=>{
    const a=-off, h=SK.lm.vault[nm.toLowerCase()];
    /* the interaural landmark is the ear-bar axis drawn above, not a point on the vault:
       marking the roof at its AP as well would label plain bone "interaural" */
    if(nm==='Interaural'||h===undefined||Math.abs(ap-a)>0.18) return;
    const x=fromML(0), yy=fromDV(h);
    o.push(`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="7"/>`,
           `<line x1="${x.toFixed(1)}" y1="${(yy-16).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(yy-8).toFixed(1)}"/>`,
           `<text x="${(x+11).toFixed(1)}" y="${(yy-12).toFixed(1)}">${esc(nm.toLowerCase())}</text>`);
  });
  g.innerHTML=o.join('');
}

/* Build the GPU copy for the 3-D shell from the shared decode, with smooth per-vertex
   normals accumulated here rather than shipped (they are derivable, so shipping them
   would double the payload for nothing). The atlas->world map (x=ml, y=dv-centre,
   z=bregma-ap-half) has determinant -1, so the triangle winding is swapped on the way
   in to keep outward faces front-facing. */
function v3skullBuild(){
  if(vaoS||!gl) return;
  const M=skullMesh(); if(!M) return;
  const nv=M.pos.length/3;
  const pos=new Float32Array(nv*3);
  for(let i=0;i<nv;i++){
    pos[i*3]=M.pos[i*3+1]; pos[i*3+1]=w3y(M.pos[i*3+2]); pos[i*3+2]=w3z(M.pos[i*3]);
  }
  const idx=new Uint16Array(M.idx.length);
  for(let f=0;f<M.nf;f++){ idx[f*3]=M.idx[f*3]; idx[f*3+1]=M.idx[f*3+2]; idx[f*3+2]=M.idx[f*3+1]; }
  const nrm=new Float32Array(nv*3);
  for(let f=0;f<M.nf;f++){
    const a=idx[f*3]*3, b=idx[f*3+1]*3, c=idx[f*3+2]*3;
    const ux=pos[b]-pos[a], uy=pos[b+1]-pos[a+1], uz=pos[b+2]-pos[a+2];
    const vx=pos[c]-pos[a], vy=pos[c+1]-pos[a+1], vz=pos[c+2]-pos[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    nrm[a]+=nx; nrm[a+1]+=ny; nrm[a+2]+=nz;
    nrm[b]+=nx; nrm[b+1]+=ny; nrm[b+2]+=nz;
    nrm[c]+=nx; nrm[c+1]+=ny; nrm[c+2]+=nz;
  }
  const unit=a=>{ for(let i=0;i<nv;i++){
    const l=Math.hypot(a[i*3],a[i*3+1],a[i*3+2])||1;
    a[i*3]/=l; a[i*3+1]/=l; a[i*3+2]/=l; } };
  unit(nrm);
  /* The 0.42 mm decimation leaves the shell finely dented. Translucent bone blends the
     dents away; opaque bone shows every one as a dark fleck, so relax the shading normals
     over the 1-ring a few times. Only the normals move -- the geometry the plate outlines
     and the silhouettes are cut from is untouched. */
  for(let it=0;it<4;it++){
    const acc=new Float32Array(nv*3);
    const pair=(i,j)=>{ for(let k=0;k<3;k++){ acc[i*3+k]+=nrm[j*3+k]; acc[j*3+k]+=nrm[i*3+k]; } };
    for(let f=0;f<M.nf;f++){
      const a=idx[f*3], b=idx[f*3+1], c=idx[f*3+2];
      pair(a,b); pair(b,c); pair(c,a);
    }
    unit(acc);
    for(let i=0;i<nv*3;i++) nrm[i]=nrm[i]*.35+acc[i]*.65;
    unit(nrm);
  }
  vaoS=gl.createVertexArray(); gl.bindVertexArray(vaoS);
  const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb);
  gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const nb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,nb);
  gl.bufferData(gl.ARRAY_BUFFER,nrm,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  nSK=idx.length;
}

function v3upload(vol){
  if(texV) gl.deleteTexture(texV);          /* a rebuild makes a new one every time */
  texV=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D,texV);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RG8,V3W,V3H,V3D,0,gl.RG,gl.UNSIGNED_BYTE,vol);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])
    gl.texParameteri(gl.TEXTURE_3D,p,gl.CLAMP_TO_EDGE);
}

/* which points are in the current filter, and which one is selected */
function v3flags(){
  if(!v3ready) return;
  const f=new Float32Array(nPT);
  const fs = results.length<S.length ? new Set(results.map(r=>r.abbr)) : null;
  /* a division has no printed label of its own, so what stands for it in the cloud is
     every label its members carry, on the plates the division is on -- the same points
     the projection draws for it */
  const G = isGrp(sel) ? byAb[sel] : null;
  const gm = G ? new Set(G.members) : null, gp = G ? new Set(G.plates) : null;
  for(let i=0;i<nPT;i++){
    const q=PTS[i], ab=q.ab;
    f[i] = (G ? (gm.has(ab)&&gp.has(q.p)) : ab===sel) ? 2 : (fs&&fs.has(ab) ? 1 : 0);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,bufF);
  gl.bufferData(gl.ARRAY_BUFFER,f,gl.DYNAMIC_DRAW);
  v3note(); v3frame();
}

function v3render(){
  if(!v3ready) return;
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(V3WRAP.clientWidth*dpr)),
        h=Math.max(1,Math.round(V3WRAP.clientHeight*dpr));
  if(V3CV.width!==w||V3CV.height!==h){ V3CV.width=w; V3CV.height=h; }
  gl.viewport(0,0,w,h);
  gl.clearColor(v3col.bg[0],v3col.bg[1],v3col.bg[2],1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

  /* v3mvp() is what puts the model matrix in, so it also leaves the camera restated in
     model space -- which is the space the box, the shell and the slice order live in */
  const M=v3mvp(), cam=v3camM;
  const z0=v3a/(V3D-1), z1=v3b/(V3D-1);
  const U=(p,n)=>gl.getUniformLocation(p,n);
  /* the tissue curve goes to whichever raster program is about to draw: one field, read
     one way, whether the stack or the ray-march is the thing reading it */
  const tone=p=>{ gl.uniform1f(U(p,'u_t0'),v3t0); gl.uniform1f(U(p,'u_t1'),v3t1);
                  gl.uniform1f(U(p,'u_gam'),v3gam); };

  /* Translucent bone: the far side of the skull goes down before the brain content and
     the near side after it, so the stack shows through the shell instead of being pasted
     over it. Opaque bone needs neither trick -- one depth-tested pass over the whole
     shell, laid down last, sorts itself and hides the stack outright. Face culling is
     what splits near from far, so the opaque pass does without it: the decimated mesh
     has a few triangles wound inside out, and culling would drop them from the near
     side and leave brain content showing through the pinholes. */
  const solid=v3sko>0.97;
  const skull=side=>{
    if(!v3sk||!vaoS||(solid&&!side)) return;
    gl.useProgram(pSkull); gl.bindVertexArray(vaoS);
    if(solid){ gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); }
    else { gl.enable(gl.CULL_FACE); gl.cullFace(side?gl.BACK:gl.FRONT); }
    gl.uniformMatrix4fv(U(pSkull,'u_mvp'),false,M);
    gl.uniform3fv(U(pSkull,'u_cam'),new Float32Array(cam));
    gl.uniform3fv(U(pSkull,'u_c'),v3col.bone);
    gl.uniform1f(U(pSkull,'u_op'),v3sko);
    gl.uniform1f(U(pSkull,'u_half'),v3half?1:0);
    gl.drawElements(gl.TRIANGLES,nSK,gl.UNSIGNED_SHORT,0);
    if(solid) gl.disable(gl.DEPTH_TEST); else gl.disable(gl.CULL_FACE);
  };
  skull(false);

  if(v3mode==='contour'){
    gl.useProgram(pSlice); gl.bindVertexArray(vaoQ);
    gl.uniformMatrix4fv(U(pSlice,'u_mvp'),false,M);
    gl.uniform1f(U(pSlice,'u_op'),v3op);
    gl.uniform1f(U(pSlice,'u_half'),v3half?1:0);
    gl.uniform1f(U(pSlice,'u_ink'),v3ink());
    tone(pSlice);
    gl.uniform3fv(U(pSlice,'u_ce'),v3col.ce);
    gl.uniform3fv(U(pSlice,'u_ti'),v3col.ti);
    gl.uniform1i(U(pSlice,'u_vol'),0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D,texV);
    gl.uniform3f(U(pSlice,'u_u'),V3X1-V3X0,0,0);
    gl.uniform3f(U(pSlice,'u_v'),0,w3y(V3Y1)-w3y(V3Y0),0);
    const uo=U(pSlice,'u_o'), uz=U(pSlice,'u_z');
    /* back to front, or the near slices erase what is behind them */
    const near = cam[2] < w3z(P[0].bregma);
    for(let n=0;n<=v3b-v3a;n++){
      const k = near ? v3a+n : v3b-n;
      gl.uniform3f(uo,V3X0,w3y(V3Y0),w3z(P[k].bregma));
      gl.uniform1f(uz,k/(V3D-1));
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
  } else if(v3mode==='volume'){
    gl.useProgram(pVol); gl.bindVertexArray(vaoB);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
    gl.uniformMatrix4fv(U(pVol,'u_mvp'),false,M);
    gl.uniform3fv(U(pVol,'u_cam'),new Float32Array(cam));
    /* a parallel view has one ray direction for the whole box: the way the eye looks,
       which is the depth axis the picker already keeps, reversed */
    gl.uniform3f(U(pVol,'u_vdir'),-v3dep[0],-v3dep[1],-v3dep[2]);
    gl.uniform1f(U(pVol,'u_ortho'),v3ortho?1:0);
    gl.uniform3f(U(pVol,'u_lo'),V3X0,w3y(V3Y0),w3z(V3Z0));
    gl.uniform3f(U(pVol,'u_hi'),V3X1,w3y(V3Y1),w3z(V3Z1));
    gl.uniform3fv(U(pVol,'u_ce'),v3col.ce);
    gl.uniform3fv(U(pVol,'u_ti'),v3col.ti);
    gl.uniform1f(U(pVol,'u_op'),v3op);
    gl.uniform1f(U(pVol,'u_ink'),v3ink());
    tone(pVol);
    gl.uniform1f(U(pVol,'u_half'),v3half?1:0);
    gl.uniform1f(U(pVol,'u_z0'),z0); gl.uniform1f(U(pVol,'u_z1'),z1);
    gl.uniform1i(U(pVol,'u_vol'),0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D,texV);
    gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0);
    gl.disable(gl.CULL_FACE);
  }

  /* the plate the rest of the app is showing, traced where its section actually sits */
  const bx=v3box[cur-1];
  if(v3mode!=='points' && bx && cur-1>=v3a && cur-1<=v3b){
    const zc=w3z(plateOf[cur].bregma), m=.18;      /* a little air around the section */
    const lx=V3X0+(V3X1-V3X0)*Math.max(0,bx[0]-.01), hx=V3X0+(V3X1-V3X0)*Math.min(1,bx[2]+.01);
    const ly=w3y(V3Y0)+(w3y(V3Y1)-w3y(V3Y0))*Math.max(0,bx[1]-.01),
          hy=w3y(V3Y0)+(w3y(V3Y1)-w3y(V3Y0))*Math.min(1,bx[3]+.01);
    const x0=v3half?Math.max(lx-m,0):lx-m;
    gl.useProgram(pLine);
    const lv=[x0,ly-m,zc, hx+m,ly-m,zc, hx+m,hy+m,zc, x0,hy+m,zc];
    const vb=gl.createBuffer();
    const va=gl.createVertexArray(); gl.bindVertexArray(va);
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lv),gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(U(pLine,'u_mvp'),false,M);
    gl.uniform3fv(U(pLine,'u_c'),v3col.c2);
    gl.uniform1f(U(pLine,'u_a'),.42);
    gl.drawArrays(gl.LINE_LOOP,0,4);
    gl.deleteBuffer(vb); gl.deleteVertexArray(va);
  }

  /* the planned track, drawn where it actually runs through the stack. This is the view
     that shows what a tilt costs in the axis the plate cannot show, so it is drawn in
     every mode rather than only over the contours. */
  if(tgPlan && tgPlan.len!==undefined && smode==='targ'){
    const q=tgSample(tgPlan,24).map(p=>[p.ml, w3y(p.dv), w3z(p.ap)]);
    gl.useProgram(pLine);
    const vb=gl.createBuffer(), va=gl.createVertexArray();
    gl.bindVertexArray(va);
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(q.flat()),gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(U(pLine,'u_mvp'),false,M);
    gl.uniform3fv(U(pLine,'u_c'),v3col.tg);
    gl.uniform1f(U(pLine,'u_a'),.95);
    gl.drawArrays(gl.LINE_STRIP,0,q.length);
    if(tgFoot){                                /* the sphere, as three rings */
      const c=[tgPlan.Ta.ml, w3y(tgPlan.Ta.dv), w3z(tgPlan.Ta.ap)], rr=tgFoot, ring=[];
      for(const ax of [0,1,2]) for(let i=0;i<=32;i++){ const t=i/32*6.2832, u=Math.cos(t)*rr, v=Math.sin(t)*rr;
        const pnt=[...c]; pnt[(ax+1)%3]+=u; pnt[(ax+2)%3]+=v; ring.push(...pnt);
        if(i===0||i===32) ring.push(...pnt); }   /* doubled ends break the strip between rings */
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ring),gl.STREAM_DRAW);
      gl.uniform1f(U(pLine,'u_a'),.55);
      gl.drawArrays(gl.LINE_STRIP,0,ring.length/3);
      gl.uniform1f(U(pLine,'u_a'),.95);
    }
    const e=q[0], r=.5;                      /* a cross on the entry, to find it by */
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      e[0]-r,e[1],e[2], e[0]+r,e[1],e[2],
      e[0],e[1]-r,e[2], e[0],e[1]+r,e[2],
      e[0],e[1],e[2]-r, e[0],e[1],e[2]+r]),gl.STREAM_DRAW);
    gl.drawArrays(gl.LINES,0,6);
    gl.deleteBuffer(vb); gl.deleteVertexArray(va);
  }

  meshDraw(M);
  if(anShow && NOTES.length){                  /* the notes, each as a small cross */
    const r=.3, lv=[];
    for(const n of NOTES){ const c=[n.ml,w3y(n.dv),w3z(n.ap)];
      lv.push(c[0]-r,c[1],c[2], c[0]+r,c[1],c[2], c[0],c[1]-r,c[2], c[0],c[1]+r,c[2], c[0],c[1],c[2]-r, c[0],c[1],c[2]+r); }
    gl.useProgram(pLine);
    const vb=gl.createBuffer(), va=gl.createVertexArray();
    gl.bindVertexArray(va); gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lv),gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(U(pLine,'u_mvp'),false,M);
    gl.uniform3fv(U(pLine,'u_c'),v3col.an);
    gl.uniform1f(U(pLine,'u_a'),.95);
    gl.drawArrays(gl.LINES,0,lv.length/3);
    gl.deleteBuffer(vb); gl.deleteVertexArray(va);
  }

  skull(true);

  /* the labels ride along in every mode; alone, they are the mode */
  gl.useProgram(pPts); gl.bindVertexArray(vaoP);
  gl.uniformMatrix4fv(U(pPts,'u_mvp'),false,M);
  gl.uniform1f(U(pPts,'u_size'), (v3mode==='points'?4.6:3.4)*dpr);
  gl.uniform1f(U(pPts,'u_half'),v3half?1:0);
  gl.uniform1f(U(pPts,'u_zl'),w3z(P[v3a].bregma)-.02);
  gl.uniform1f(U(pPts,'u_zh'),w3z(P[v3b].bregma)+.02);
  gl.uniform1f(U(pPts,'u_only'),v3mode==='points'?0:1);
  gl.uniform1f(U(pPts,'u_ow'), v3ortho ? v3dist : 0);
  gl.uniform3fv(U(pPts,'u_c0'),v3col.c0);
  gl.uniform3fv(U(pPts,'u_c1'),v3col.c1);
  gl.uniform3fv(U(pPts,'u_c2'),isGrp(sel)?v3col.cg:v3col.c2);
  gl.drawArrays(gl.POINTS,0,nPT);
  gl.bindVertexArray(null);
}
function v3frame(){ if(v3raf||!v3ready) return;
  v3raf=requestAnimationFrame(()=>{ v3raf=null; v3render(); }); }

/* ---------- picking: 6,220 points is nothing to project on the CPU ---------- */
function v3proj(M,p){
  const x=M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],
        y=M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],
        w=M[3]*p[0]+M[7]*p[1]+M[11]*p[2]+M[15];
  if(w<=0) return null;
  const b=V3WRAP.getBoundingClientRect();
  /* w is the eye distance under perspective and a constant 1 under a parallel one, so
     ties there are broken along the view axis instead -- smaller is still nearer */
  const d = (v3ortho&&v3dep) ? -(p[0]*v3dep[0]+p[1]*v3dep[1]+p[2]*v3dep[2]) : w;
  return [(x/w*.5+.5)*b.width, (.5-y/w*.5)*b.height, d];
}
function v3near(e){
  if(!v3ready) return -1;
  const M=v3mvp(), b=V3WRAP.getBoundingClientRect();
  const mx=e.clientX-b.left, my=e.clientY-b.top;
  const R2=17*17;
  let best=-1, bd=Infinity, bw=Infinity;
  for(let i=0;i<nPT;i++){
    const q=PTS[i];
    if(v3half && q.ml<0) continue;
    const k=q.p-1; if(k<v3a||k>v3b) continue;
    const s=v3proj(M,[q.ml,w3y(q.dv),w3z(q.ap)]); if(!s) continue;
    const d=(s[0]-mx)*(s[0]-mx)+(s[1]-my)*(s[1]-my);
    if(d>R2) continue;
    /* nearest to the pointer wins; where two are as good, the one nearer the eye,
       which is what you get with a cloud this deep and dots this close together */
    if(d<bd-4 || (Math.abs(d-bd)<=4 && s[2]<bw)){ best=i; bd=d; bw=s[2]; }
  }
  return best;
}
function v3hide(){ V3TIP.hidden=true; V3WRAP.classList.remove('hot'); v3hot=null; }
function v3show(i){
  const q=PTS[i], r=byAb[q.ab];
  V3TIP.innerHTML=`<span class="ta">${esc(q.ab)}</span>`+
    `<span class="tn">${esc(r?r.name:'not in the published index')}</span>`+
    `<span class="tx">plate ${q.p} · ${dotTxt(q)}</span>`;
  V3TIP.hidden=false; V3WRAP.classList.add('hot');
  const s=v3proj(v3mvp(),[q.ml,w3y(q.dv),w3z(q.ap)]); if(!s) return;
  const b=V3WRAP.getBoundingClientRect(), tw=V3TIP.offsetWidth, th=V3TIP.offsetHeight;
  let x=s[0]-tw/2; x=Math.max(2,Math.min(b.width-tw-2,x));
  let y=s[1]-th-12; if(y<2) y=s[1]+14;
  V3TIP.style.left=x.toFixed(1)+'px'; V3TIP.style.top=y.toFixed(1)+'px';
}

/* ---------- orbit, pan, zoom ---------- */
const v3p=new Map();
let v3drag=null, v3pinch=null, v3moved=0, v3noclick=false;
V3CV.addEventListener('pointerdown',e=>{
  v3p.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(v3p.size===1){
    v3drag={x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey}; v3moved=0;
    try{ V3CV.setPointerCapture(e.pointerId); }catch(_){}
    V3WRAP.classList.add('drag'); v3hide();
  } else if(v3p.size===2){
    const [a,b]=[...v3p.values()];
    v3pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:v3dist}; v3drag=null;
  }
});
V3CV.addEventListener('pointermove',e=>{
  if(v3p.has(e.pointerId)) v3p.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(v3p.size===2&&v3pinch){
    const [a,b]=[...v3p.values()], d=Math.hypot(a.x-b.x,a.y-b.y);
    if(d){ v3dist=Math.max(9,Math.min(90,v3pinch.z*v3pinch.d/d)); v3moved=99; v3frame(); }
    return;
  }
  if(v3drag){
    const dx=e.clientX-v3drag.x, dy=e.clientY-v3drag.y;
    v3moved+=Math.abs(dx)+Math.abs(dy);
    v3drag.x=e.clientX; v3drag.y=e.clientY;
    if(v3drag.pan){ const s=v3dist*.0022; v3tx+=dx*s; v3ty-=dy*s; }
    else { v3az-=dx*.0062; v3el=Math.max(-V3POLE,Math.min(V3POLE,v3el+dy*.0062));
           v3view=''; $('v3v').value=''; }
    v3frame();
    return;
  }
  if(e.pointerType==='touch') return;
  const i=v3near(e);
  if(i===v3hot) { if(i>=0) v3show(i); return; }
  v3hot=i; if(i>=0) v3show(i); else v3hide();
});
function v3end(e){
  v3p.delete(e.pointerId);
  if(v3p.size<2) v3pinch=null;
  if(v3p.size===0){
    V3WRAP.classList.remove('drag');
    if(v3moved>7) v3noclick=true;
    v3drag=null;
  }
}
V3CV.addEventListener('pointerup',v3end);
V3CV.addEventListener('pointercancel',v3end);
V3CV.addEventListener('pointerleave',()=>{ if(!v3p.size) v3hide(); });
V3CV.addEventListener('contextmenu',e=>e.preventDefault());
V3CV.addEventListener('wheel',e=>{
  e.preventDefault();
  v3dist=Math.max(9,Math.min(90,v3dist*Math.exp(e.deltaY*.0012)));
  v3hide(); v3frame();
},{passive:false});
/* a tap opens the label under it, the way a dot in the projection does */
V3CV.addEventListener('click',e=>{
  if(v3noclick){ v3noclick=false; return; }
  const i=v3near(e); if(i<0) return;
  const q=PTS[i];
  if(byAb[q.ab]) select(q.ab);
  go(q.p);
});

/* ---------- controls ---------- */
[...$('m3seg').children].forEach(b=>b.onclick=()=>{
  v3mode=b.dataset.r;
  [...$('m3seg').children].forEach(x=>x.classList.toggle('on',x===b));
  v3note(); v3frame(); queueHash();
});
/* Density, and the three that decide what a sample was worth before it scales it. Floor
   and ceiling hold each other in order the way the slab's two ends do -- the dragged one
   stops at the other rather than pushing it -- and meeting is allowed, because a window
   with no width is a hard threshold and that is a picture somebody may want. */
$('v3op').oninput=e=>{ v3op=+e.target.value/100; v3tr(); v3frame(); queueHash(); };
$('v3t0').oninput=e=>{ const v=Math.min(+e.target.value,+$('v3t1').value);
  e.target.value=v; v3t0=v/100; $('v3t0l').textContent=v+'%';
  v3tr(); v3note(); v3frame(); queueHash(); };
$('v3t1').oninput=e=>{ const v=Math.max(+e.target.value,+$('v3t0').value);
  e.target.value=v; v3t1=v/100; $('v3t1l').textContent=v+'%';
  v3tr(); v3note(); v3frame(); queueHash(); };
$('v3gm').oninput=e=>{ v3gam=+e.target.value/100; $('v3gml').textContent=v3gam.toFixed(2);
  v3tr(); v3note(); v3frame(); queueHash(); };
/* one place writes the four of them, so the sliders, their readouts and a deep link
   cannot drift apart -- and the reset that puts them back is the same call with the
   defaults. The button only exists while it has something to undo. */
function v3tone(op,t0,t1,gm){
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(v)));
  op=cl(op,4,100); t1=cl(t1,0,100); t0=Math.min(cl(t0,0,100),t1); gm=cl(gm/5,8,50)*5;
  v3op=op/100; v3t0=t0/100; v3t1=t1/100; v3gam=gm/100;
  $('v3op').value=op;
  $('v3t0').value=t0; $('v3t0l').textContent=t0+'%';
  $('v3t1').value=t1; $('v3t1l').textContent=t1+'%';
  $('v3gm').value=gm; $('v3gml').textContent=v3gam.toFixed(2);
  v3tr();
}
const v3tdef=()=>v3op===.42&&v3t0===0&&v3t1===1&&v3gam===1;
const v3tr=()=>{ $('v3tr').hidden=v3tdef(); };
$('v3tr').onclick=()=>{ v3tone(42,0,100,100); v3note(); v3frame(); queueHash(); };
$('v3s').onchange=e=>{ v3sk=e.target.checked;
  if(v3sk) v3skullBuild();
  /* the default distance frames the brain; the skull is half again bigger, so the
     first sight of it should not be a clipped close-up. Only an untouched camera is
     moved -- a viewpoint the user has set is theirs. */
  if(v3sk&&v3dist<34) v3dist=38;
  $('v3sol').hidden=!v3sk; v3note(); v3frame(); queueHash(); };
$('v3so').oninput=e=>{ v3sko=+e.target.value/100; v3frame(); };
$('v3a').oninput=e=>{ v3a=Math.min(+e.target.value-1,v3b); e.target.value=v3a+1;
  $('v3al').textContent=v3a+1; v3note(); v3frame(); queueHash(); };
$('v3b').oninput=e=>{ v3b=Math.max(+e.target.value-1,v3a); e.target.value=v3b+1;
  $('v3bl').textContent=v3b+1; v3note(); v3frame(); queueHash(); };
$('v3h').onchange=e=>{ v3half=e.target.checked; v3note(); v3frame(); queueHash(); };
$('v3o').onchange=e=>{ v3ortho=e.target.checked; v3note(); v3frame(); queueHash(); };
/* Named viewpoints. World x is the animal's right, y dorsal, z posterior, so each view
   is just the azimuth and elevation that put the eye on the matching axis. Dorsal and
   ventral stop a degree short of the pole: a camera exactly there is parallel to the up
   vector and the view matrix has no way to decide which way is forward. Rostral and
   caudal are both offered because the plates are printed as seen from behind, so the
   caudal view is the one that reads the same way round as the plate. */
const V3POLE=1.553;
const V3VIEW={ obl:[-.82,.30], left:[-Math.PI/2,0], right:[Math.PI/2,0],
               rost:[Math.PI,0], caud:[0,0], dors:[0,V3POLE], vent:[Math.PI,-V3POLE] };
function v3setView(k){
  const v=V3VIEW[k]; if(!v) return;
  v3view=k; v3az=v[0]; v3el=v[1]; v3tx=v3ty=0;
  $('v3v').value=k; v3frame(); queueHash();
}
$('v3v').onchange=e=>v3setView(e.target.value);
/* the reset is the viewpoint plus the framing: distance and pan come back too */
$('v3r').onclick=()=>{ v3dist=v3sk?38:26; v3setView('obl'); };

/* ---- the meshes ---- */
const MESHURL='data/gerbil_atlas_volumes.json';
function meshCanFetch(){ return /^https?:$/.test(location.protocol); }
function meshLoad(){
  if(MESH||meshBusy) return;
  if(!meshCanFetch()){ meshFail='This page was opened from disk, so the meshes cannot be fetched; use Load file to open data/gerbil_atlas_volumes.json from the repository.'; v3note(); $('v3mf').hidden=false; return; }
  meshBusy=true; meshFail=''; v3note();
  fetch(MESHURL).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(meshTake).catch(err=>{ meshFail='The meshes could not be fetched ('+(err&&err.message||err)+').'; $('v3mf').hidden=false; })
    .finally(()=>{ meshBusy=false; v3note(); v3frame(); });
}
function meshTake(j){
  if(!j||!j.data||!j.surface) throw new Error('not the volumes file');
  MESH=j; meshFail=''; $('v3mf').hidden=true; v3flags(); v3frame();
}
$('v3mfile').onchange=e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  meshBusy=true; v3note();
  f.text().then(t=>meshTake(JSON.parse(t))).catch(()=>{ meshFail='That file is not the volumes file.'; })
    .finally(()=>{ meshBusy=false; v3note(); v3frame(); });
  e.target.value='';
};
/* base64 -> the little-endian uint16 the file promises, as positions and normals */
function meshDecode(m){
  const bin=atob(m.v), nv=m.nv, q=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) q[i]=bin.charCodeAt(i);
  const dv=new DataView(q.buffer), P=new Float32Array(nv*3), s=MESH.grid?0.01:0.01;
  for(let i=0;i<nv*3;i++) P[i]=dv.getUint16(i*2,true)*s;
  /* stored (ML, DV, AP) offsets from o; the world is (ML, w3y(DV), w3z(AP)) */
  for(let i=0;i<nv;i++){ const ml=m.o[0]+P[i*3], d=m.o[1]+P[i*3+1], ap=m.o[2]+P[i*3+2];
    P[i*3]=ml; P[i*3+1]=w3y(d); P[i*3+2]=w3z(ap); }
  const fb=atob(m.f), fq=new Uint8Array(fb.length);
  for(let i=0;i<fb.length;i++) fq[i]=fb.charCodeAt(i);
  const fd=new DataView(fq.buffer), nf=m.nf, F=m.fw===4?new Uint32Array(nf*3):new Uint16Array(nf*3);
  for(let i=0;i<nf*3;i++) F[i]=m.fw===4?fd.getUint32(i*4,true):fd.getUint16(i*2,true);
  const N=new Float32Array(nv*3);
  for(let t=0;t<nf;t++){ const a=F[t*3]*3,b=F[t*3+1]*3,c=F[t*3+2]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2], vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    for(const i of [a,b,c]){ N[i]+=nx; N[i+1]+=ny; N[i+2]+=nz; } }
  for(let i=0;i<nv;i++){ const L=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1; N[i*3]/=L; N[i*3+1]/=L; N[i*3+2]/=L; }
  return {P,N,F,nf,nv};
}
function meshGPU(key,m){
  if(MESHC[key]) return MESHC[key];
  const d=meshDecode(m);
  const va=gl.createVertexArray(); gl.bindVertexArray(va);
  const pb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pb); gl.bufferData(gl.ARRAY_BUFFER,d.P,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const nb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,nb); gl.bufferData(gl.ARRAY_BUFFER,d.N,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,d.F,gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return MESHC[key]={va, n:d.nf*3, type:d.F instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT};
}
/* an HSL colour, as the bars use, to the RGB triple the shader wants */
function hslRGB(h,sat,l){
  const a=sat*Math.min(l,1-l), f=n=>{ const k=(n+h/30)%12; return l-a*Math.max(-1,Math.min(k-3,9-k,1)); };
  return [f(0),f(8),f(4)];
}
function meshColor(ab){
  /* every mesh of a superstructure in the one colour the plate outlines it in: they are
     parts of a thing, and twenty hues would read as twenty things */
  if(isGrp(sel)) return v3col.cg;
  if(ab===sel||(sel&&ab===meshKey(sel))) return v3col.c2;
  let h=0; for(let i=0;i<ab.length;i++) h=(h*31+ab.charCodeAt(i))>>>0;
  return hslRGB(h%360,.55,.55);
}
/* Every name of a joined label -- "Au1 (A1/AAF)" -- resolves to the one the label leads
   with, which is how regBuild() answers a selection in the plane: pick A1 and the plate
   outlines the region the three of them share. The meshes are filed under the same leader,
   because region_extents is what they were built from, so the 3-D view has to resolve the
   same way. Looking A1 up directly finds nothing and draws nothing, which reads as a mesh
   that failed rather than as a name the atlas prints inside somebody else's boundary. */
let MBLK=null;
function meshBlk(ab){
  if(!MBLK){ MBLK={};
    for(const p in RBLK) for(const g of RBLK[p]) for(let i=1;i<g.length;i++) MBLK[g[i]]=g; }
  return MBLK[ab]||null;
}
/* the mesh that answers for a structure: its own, or the one the region it shares is filed
   under. Null where the atlas names a structure and draws it no region anywhere. */
function meshKey(ab){
  if(!MESH||!ab) return null;
  if(MESH.data[ab]) return ab;
  const g=meshBlk(ab);
  return g&&MESH.data[g[0]] ? g[0] : null;
}
/* Every mesh a superstructure is made of, capped. There is no mesh of a division as
   such -- it is its members' meshes drawn together, which is what the outline on the
   plate is too -- and the biggest of them holds nearly three hundred, enough to drop the
   frame rate on a laptop, so past the cap it draws the largest and says how many it left. */
const MESHMAX=140;
function meshGroup(g){
  const out=[];
  for(const a of g.members){ const k=meshKey(a); if(k&&!out.includes(k)) out.push(k); }
  if(out.length<=MESHMAX) return out;
  return out.sort((a,b)=>(MESH.data[b].volume_mm3||0)-(MESH.data[a].volume_mm3||0)).slice(0,MESHMAX);
}
/* which meshes to show: the selection, or the current filter when it is a short list */
function meshList(){
  if(!MESH) return [];
  if(isGrp(sel)) return meshGroup(byAb[sel]);
  const out=[], add=ab=>{ const k=meshKey(ab); if(k&&!out.includes(k)) out.push(k); };
  if(sel&&meshKey(sel)) add(sel);
  else if(results.length<S.length && results.length<=40)
    for(const r of results) add(r.abbr);
  return out;
}
function meshDraw(M){
  if(!v3m||!MESH||!gl) return;
  /* pSkull shades from dot(N, cam - p) with p a model-space vertex, so the camera has to
     be the one v3mvp() restated in model space -- the same one the shell is given. The
     mesh geometry itself needs nothing: the model matrix is already folded into u_mvp. */
  const list=meshList(), cam=v3camM||v3cam(), U=(p,n)=>gl.getUniformLocation(p,n);
  gl.useProgram(pSkull);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(U(pSkull,'u_mvp'),false,M);
  gl.uniform3fv(U(pSkull,'u_cam'),cam);
  gl.uniform1f(U(pSkull,'u_half'),v3half?1:0);
  const draw=(key,m,col,op)=>{ const g=meshGPU(key,m); gl.bindVertexArray(g.va);
    gl.uniform3fv(U(pSkull,'u_c'),col); gl.uniform1f(U(pSkull,'u_op'),op);
    gl.drawElements(gl.TRIANGLES,g.n,g.type,0); };
  for(const ab of list) draw('s:'+ab, MESH.data[ab].mesh, meshColor(ab), .92);
  if($('v3ms').checked){ gl.depthMask(false); draw('surface', MESH.surface.mesh, v3col.ti, .16); gl.depthMask(true); }
  gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null);
}
/* the selection's mesh as a binary STL, in atlas millimetres (ML, DV, AP). A
   superstructure writes every mesh it is drawn from into the one file, as separate shells
   in one solid -- which is what it is: there is no surface of a division that the atlas
   drew, only its members' surfaces standing together. */
function meshSTL(){
  const keys = isGrp(sel) ? meshList() : (meshKey(sel)?[meshKey(sel)]:[]);
  if(!keys.length) return;
  const parts=keys.map(k=>meshDecode(MESH.data[k].mesh));
  const nf=parts.reduce((n,d)=>n+d.nf,0);
  const buf=new ArrayBuffer(84+nf*50), v=new DataView(buf);
  /* named for the region, not for the name it was reached by: a file called A1 that holds
     Au1's boundary would be the one thing about this the reader could not check */
  const name = isGrp(sel) ? byAb[sel].abbr : keys[0];
  const head='Gerbil Atlas Explorer '+name+(isGrp(sel)?' ('+keys.length+' structures)':'')+
    ' (ML,DV,AP mm; interpolated between 350 um sections)';
  for(let i=0;i<80;i++) v.setUint8(i, i<head.length?head.charCodeAt(i):32);
  v.setUint32(80,nf,true);
  let o=84;
  for(const d of parts){
    const P=d.P, F=d.F;
    /* back from world to atlas: x = ML, y = DV = w3y^-1, z = AP = w3z^-1 */
    const at=i=>[P[i*3], P[i*3+1]+V3YC, V3Z0-(P[i*3+2]+V3ZS/2)];
    for(let t=0;t<d.nf;t++){
      const a=at(F[t*3]), b=at(F[t*3+1]), c=at(F[t*3+2]);
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz)||1;
      for(const val of [nx/L,ny/L,nz/L,...a,...b,...c]){ v.setFloat32(o,val,true); o+=4; }
      v.setUint16(o,0,true); o+=2;
    }
  }
  const u=URL.createObjectURL(new Blob([buf],{type:'model/stl'}));
  dl(`mesh_${name.replace(/[^A-Za-z0-9]/g,'')}.stl`,u,u);
}
$('v3m').onchange=e=>{ v3m=e.target.checked; if(v3m) meshLoad(); $('v3msw').hidden=!v3m; v3flags(); v3note(); v3frame(); queueHash(); };
$('v3ms').onchange=()=>v3frame();
$('v3stl').onclick=meshSTL;
$('v3mfb').onclick=()=>$('v3mfile').click();

function v3note(){
  const N=$('v3n');
  if(v3fail){ N.textContent=''; return; }
  $('v3stl').hidden=!(v3m&&MESH&&(isGrp(sel)?meshList().length:meshKey(sel)));
  /* the slab's own AP bounds, quoted from wherever zero is -- a re-zero does not move the
     plates, only what their APs are called, and this line is the only place the 3-D view
     names one */
  const slab = (v3a>0||v3b<61)
    ? ` Plates ${v3a+1}–${v3b+1} only (${shifted()&&FRAME.org?esc(orgName()):'bregma'}`+
      ` ${sgn(axTo('ap',P[v3a].bregma))} to ${sgn(axTo('ap',P[v3b].bregma))} mm).` : '';
  const half = v3half ? ' Cut at the midline.' : '';
  const bone = v3sk ? ' Skull fit is experimental and approximate.' : '';
  const proj = v3ortho ? ' Parallel projection: equal lengths read equally at any depth.' : '';
  /* a windowed render is a picture of the tissue after something was done to it, and this
     is the line where the view says what. Quoted whenever the curve is off the identity --
     including a curve that arrived in somebody else's link, which is the case where the
     reader has no other way of knowing the render was tuned. */
  const tone = (v3t0>0||v3t1<1||v3gam!==1)
    ? ` Tissue windowed ${Math.round(v3t0*100)}–${Math.round(v3t1*100)}%`+
      (v3gam!==1 ? ` at γ ${v3gam.toFixed(2)}` : '')+
      `: a contrast setting, not a threshold on anything measured.` : '';
  /* the rotation is on the picture rather than on the numbers, so the caveat is about
     what a turned stack is not: still 62 coronal sections, just stood up in your frame */
  const turn = fvOn() ? ` Standing in your frame (${frameTxt()}): up is your frame's DV.`+
    ` The stack is turned, not recut \u2014 these are the same 62 coronal sections.` : '';
  let mesh='';
  if(v3m){
    if(meshBusy) mesh=' Fetching the meshes (20 MB, once)…';
    else if(meshFail) mesh=' '+meshFail;
    else if(MESH){
      const list=meshList(), key=sel&&meshKey(sel), e=key&&MESH.data[key];
      /* four things can be true of a selection here and the reader cannot tell them
         apart from the picture: it has its own mesh; it shares a printed region and the
         mesh is filed under the name that region is filed under; the atlas names it
         and draws it no region anywhere, so there is nothing to build one from; or it
         names no region at all -- a fissure, a vessel -- and never could have one. The
         last two are what an unexplained blank looks like, and they are not the same
         blank: one is a gap in what could be cut, the other is the atlas being read
         correctly. */
      const blk = key&&key!==sel ? meshBlk(sel) : null;
      const how = e && (e.grade==='slab'
        ? 'a hull, not a shape — the structure is on one or two plates only'
        : 'interpolated between its plates');
      /* A division has no mesh of its own and never will: it is its members' meshes drawn
         together, the way its outline on the plate is their outlines unioned. What can go
         unsaid and should not is how many of them are actually there -- the members the
         atlas draws no region for have no mesh either, and past the cap the rest are the
         largest ones, so the shape on screen is short of the division by a stated amount. */
      const G = isGrp(sel) ? byAb[sel] : null;
      const vol = G && list.reduce((t,k)=>t+(MESH.data[k].volume_mm3||0),0);
      const cut = G && list.length<G.members.filter(m=>meshKey(m)).length;
      mesh = (G ? ` <b>${esc(G.name)}</b> as ${list.length} mesh${list.length===1?'':'es'}`+
               `, one per structure — there is no mesh of a division, only its members'`+
               ` standing together: ${vol.toFixed(2)} mm³ in all, of its ${G.n_members} structures`+
               (cut ? `, the ${list.length} largest of them` :
                list.length<G.n_members ? ` (the rest the atlas draws no region for)` : '')+'.'
             : blk ? ` <b>${esc(sel)}</b> is printed <b>${esc(blk.join('/'))}</b>, one region, so its mesh is the one filed under <b>${esc(key)}</b>: ${how}, ${e.volume_mm3.toFixed(2)} mm³.`
             : e ? ` <b>${esc(sel)}</b> as a mesh: ${how}, ${e.volume_mm3.toFixed(2)} mm³.`
             : isFeat(sel) ? ` <b>${esc(sel)}</b> has no mesh and no volume: ${featTxt(sel)}, so the atlas draws it no boundary anywhere and there is no shape to build. It is in the label cloud, where every plate that prints it puts a dot.`
             : sel ? ` <b>${esc(sel)}</b> has no mesh: the atlas names it but draws it no region of its own on any plate, so there is nothing to build one from — as for ${NREG-Object.keys(MESH.data).length} of the ${NREG} structures that are regions.`
             : list.length ? ` ${list.length} structures of the filter as meshes.` : ' Select a structure, or filter to a few, to see its mesh.')+
        ' Six planes in seven are arithmetic between sections 350 µm apart; nothing here is a segmentation.';
    }
  }
  if(v3mode==='points'){
    const q=(sel&&ptsOf[sel])||[];
    N.innerHTML = (sel&&q.length
      ? `<b>${esc(selName())}</b> in ${selHue()}: ${q.length} label${q.length>1?'s':''} on `+
        `${new Set(q.map(t=>t.p)).size} plate${new Set(q.map(t=>t.p)).size>1?'s':''}, against all 6,220. `
      : `All 6,220 printed labels at their stereotaxic positions. `)+
      `A dot is where an abbreviation is <em>printed</em> — close to its structure, not its centre. `+
      `Hover to read one, click to open its plate.`+slab+half+proj+turn+bone+mesh;
    return;
  }
  const q=(sel&&ptsOf[sel])||[];
  const on = sel&&q.length ? ` <b>${esc(selName())}</b> is picked out in ${selHue()}.`
           : (results.length<S.length ? ` The current filter is picked out in it.` : '');
  const what = psrc==='drawing' ? `The atlas's own drawn contours` : `The 62 ${SRCN[psrc]}s`;
  N.innerHTML = (v3mode==='contour'
    ? `${what}, each at its true bregma. It reads as a stack because that is what it is — 62 sections, 350 µm apart.`
    : `The same field ray-marched. Sampling along the brain is 20× coarser than across it, so the streaks are interpolation, not anatomy.`)+
    on+` The ring marks plate ${cur}.`+tone+slab+half+proj+turn+bone+mesh;
}

/* changing the plate source changes what the stack is made of, so it is read again from
   the top. Nothing is done until the view has been opened at least once: an unbuilt stack
   already reads whatever source is current when it is finally built. */
function v3resrc(){
  if(!v3ready||v3busy) return;
  v3ready=false;
  v3open();
  if(tab==='v3d') v3frame();
}
/* built on first sight, not on load: it costs a second and most visits never open it */
function v3open(){
  if(v3ready||v3busy) { if(v3ready){ v3flags(); v3frame(); } return; }
  if(v3fail){ V3MSG.hidden=false; V3MSG.innerHTML=`<b>3-D is not available here</b><span>${esc(v3fail)}</span>`; return; }
  v3busy=true;
  V3MSG.hidden=false;
  V3MSG.innerHTML='<b>Building the 3-D view</b>'+
    '<span>Reading the 62 plates already loaded. This happens once.</span>'+
    '<span class="v3bar"><i id="v3pg"></i></span>';
  const pg=$('v3pg');
  setTimeout(async()=>{
    try{
      if(!v3init()) throw new Error(v3fail);
      const vol=await v3build(f=>{ if(pg) pg.style.width=(f*100).toFixed(0)+'%'; });
      v3upload(vol);
      if(v3sk) v3skullBuild();       /* a deep link can ask for the skull before GL exists */
      v3ready=true; V3MSG.hidden=true;
      v3flags(); v3frame();
    }catch(err){
      v3fail=String(err&&err.message||err);
      V3MSG.innerHTML=`<b>3-D could not start</b><span>${esc(v3fail)}</span>`;
    }finally{ v3busy=false; }
  },30);
}
new ResizeObserver(()=>{ if(tab==='v3d') v3frame(); }).observe(V3WRAP);

/* ---------- deep links: #p30/MGV, plus the view state when it is not the default ---------- */
let hashT=null, lastWritten='';
function queueHash(){ clearTimeout(hashT); hashT=setTimeout(writeHash,180); }
function writeHash(){
  let h='p'+cur; if(sel) h+='/'+encodeURIComponent(sel);
  const b=iwRect();
  if(zoom>1.01 && b.width) h+=`&z=${zoom.toFixed(2)}`+
    `&c=${(((b.width/2-tx)/zoom)/b.width).toFixed(4)},${(((b.height/2-ty)/zoom)/b.height).toFixed(4)}`;
  const f=[showXY&&'r',showGrid&&'g',showSB&&'s',measMode&&'m',showSK&&'k',pjsk&&'K',
           showLM&&'l',pjlm&&'L',pgrey&&'y',tgLegs&&'T'].filter(Boolean).join('');
  if(f) h+='&v='+f;
  /* ct, not c: c has been the pan centre since before there was anything to stretch */
  if(psrc!=='drawing') h+='&ps='+psrc;
  if(pctr!==100) h+='&ct='+pctr;
  if(pview!=='dv') h+='&pj='+pview;
  if(cmpOn) h+='&cmp='+cmpWhat;
  h+=anHash();
  if(tab!=='plate') h+='&t='+tab;
  /* the plan: target, side and the three angles, written only while the planner is the
     pane in front. A link without it is a link that was never planning anything, so no
     link ever written before this existed changes meaning.
     The plate and the offset are appended after those five, and only when they are not
     the defaults -- so a plan that aims at the label itself still writes the exact link
     it always wrote, and an older reader that stops at the fifth field reads a new one as
     the plan minus its offset rather than as nonsense. */
  if(smode==='targ'&&sel){
    h+='&tg='+encodeURIComponent(sel)+','+(targSide>0?'R':'L')+
       ','+tgTilt+','+tgRoll+','+tgYaw;
    if(tgPlate||tgOffOn()||tgProbe)
      h+=','+tgPlate+','+tgOff.ap+','+tgOff.ml+','+tgOff.dv;
    if(tgProbe) h+=','+tgProbe;
  }
  if(smode==='targ'&&sel&&tgFoot) h+='&ft='+tgFoot;
  if(v3mode!=='contour') h+='&r='+v3mode;
  /* the tissue curve, as density, floor, ceiling and gamma in hundredths -- four numbers
     because they are one setting, and a render tuned to show a nucleus is worth sending
     with the viewpoint that shows it. Written only when one of them is off its default,
     so nothing changes about a link written before there was a curve to carry. */
  if(!v3tdef()) h+='&tf='+[v3op,v3t0,v3t1,v3gam].map(v=>Math.round(v*100)).join(',');
  if(v3a>0||v3b<61) h+='&sl='+(v3a+1)+','+(v3b+1);
  if(v3half) h+='&hf=1';
  if(v3ortho) h+='&or=1';
  if(v3view&&v3view!=='obl') h+='&vp='+v3view;
  if(v3sk) h+='&sk='+Math.round(v3sko*100);
  if(v3m) h+='&mh=1';
  /* fo used to be a bare 1 for "an origin is set". It now carries the landmark as 1 + its
     index, so bregma is still 1 and every link ever written still reads correctly. */
  if(FRAME.on){ h+='&fr='+FKEYS.map(k=>FRAME[k]).join(','); if(FRAME.org) h+='&fo='+(1+FRAME.oref); }
  /* only worth writing where it changes a picture, which is only beside a rotation */
  if(fvOn()) h+='&fv=1';
  lastWritten='#'+h;
  /* replaceState can be refused on a file:// origin, which is how the README says to
     open this; falling back to the hash keeps deep links working there too */
  try{ history.replaceState(null,'',lastWritten); }catch(_){ location.hash=h; }
}
function readHash(){
  const raw=location.hash.replace(/^#/,''); if(!raw) return false;
  const parts=raw.split('&'), par={};
  parts.slice(1).forEach(kv=>{ const i=kv.indexOf('='); if(i>0) par[kv.slice(0,i)]=kv.slice(i+1); });
  const m=parts[0].match(/^p(\d{1,2})(?:\/(.+))?$/i);
  if(!m) return false;
  const k=+m[1]; if(!(k>=1&&k<=62)) return false;

  const v=par.v||'';
  showXY=v.includes('r'); showGrid=v.includes('g'); showSB=v.includes('s');
  showSK=v.includes('k'); const pk=v.includes('K');
  showLM=v.includes('l'); const pl=v.includes('L');
  $('cklm').checked=showLM; drawLM();
  if(pl!==pjlm){ pjlm=pl; $('ckplm').checked=pl; pjRefresh(); }
  $('ckc').checked=showXY; $('ckg').checked=showGrid; $('cks').checked=showSB;
  $('cksk').checked=showSK;
  if(pk!==pjsk){ pjsk=pk; $('ckpk').checked=pk; pjRefresh(); }
  /* the source is set before go(), which is what paints the plate: setting it after
     would show the drawing for a frame and then swap it */
  const ct=Math.round(+par.ct);
  pctr = Number.isFinite(ct) ? Math.min(260,Math.max(60,ct)) : 100;
  pgrey = v.includes('y');
  psrc = srcOK(par.ps) ? par.ps : 'drawing';
  if(v3ready) v3resrc();
  $('ckm').checked=v.includes('m'); $('rd').hidden=!showXY;
  if(showXY && !lastPt) $('rd').textContent=RDHINT;
  setMeas(v.includes('m')); drawGrid();

  go(k);
  let a=m[2]; try{ a=decodeURIComponent(a||''); }catch(_){}
  if(a&&byAb[a]) select(a); else clear();

  const z=parseFloat(par.z);
  if(Number.isFinite(z)&&z>1){
    zoom=Math.min(ZMAX,z);
    const c=(par.c||'').split(',').map(Number);
    if(c.length===2&&c.every(Number.isFinite)) centreOn(c[0]*NW,c[1]*NH); else applyView();
  } else { zoom=1; tx=ty=0; applyView(); }
  setPView(par.pj==='ml'?'ml':'dv');
  if(CMPWHAT.includes(par.cmp)!==cmpOn || (par.cmp&&par.cmp!==cmpWhat)) setCmp(CMPWHAT.includes(par.cmp), par.cmp);

  const r=par.r==='volume'||par.r==='points'?par.r:'contour';
  v3mode=r;
  [...$('m3seg').children].forEach(b=>b.classList.toggle('on',b.dataset.r===r));
  /* read positionally and a short list forgiven, the way fr and tg are: a link carrying
     only a density still sets one. Missing altogether, all four go back to the values
     this view has always drawn with, so a bare #p30 arriving by hashchange clears a
     curve rather than leaving the last one on top of somebody else's link. */
  /* split only a parameter that is there: ''.split(',') is [''], and Number('') is 0,
     not NaN, so the absent case would read as a curve of zeros rather than as no curve */
  const tf=par.tf?par.tf.split(',').map(Number):[], tfn=(i,d)=>Number.isFinite(tf[i])?tf[i]:d;
  v3tone(tfn(0,42), tfn(1,0), tfn(2,100), tfn(3,100));
  const sl=(par.sl||'').split(',').map(Number);
  if(sl.length===2&&sl.every(n=>Number.isFinite(n)&&n>=1&&n<=62)&&sl[0]<=sl[1]){
    v3a=sl[0]-1; v3b=sl[1]-1;
  } else { v3a=0; v3b=61; }
  $('v3a').value=v3a+1; $('v3al').textContent=v3a+1;
  $('v3b').value=v3b+1; $('v3bl').textContent=v3b+1;
  v3half = par.hf==='1';
  $('v3h').checked=v3half;
  v3ortho = par.or==='1';
  $('v3o').checked=v3ortho;
  /* only a link that names a viewpoint moves the camera; a bare #p30 arriving by
     hashchange should not throw away the angle the user is looking from */
  if(par.vp&&V3VIEW[par.vp]) v3setView(par.vp);
  const sk=parseInt(par.sk,10);
  v3sk = Number.isFinite(sk)&&sk>=6&&sk<=100;
  if(v3sk){ v3sko=sk/100; $('v3so').value=sk; if(gl) v3skullBuild();
            if(v3dist<34) v3dist=38; }
  $('v3s').checked=v3sk; $('v3sol').hidden=!v3sk;
  v3m = par.mh==='1'; $('v3m').checked=v3m; $('v3msw').hidden=!v3m;
  if(v3m) meshLoad();

  /* the frame is sticky: a link carrying one sets it, a link without one leaves whatever
     this browser had stored. Wiping a lab's calibration because somebody opened a bare
     #p30 link would be a nasty way to lose it. */
  /* links written before the origin existed carry the first nine values only, so a short
     list is read positionally and the origin left at zero rather than thrown away */
  /* the turned views ride with the frame: fv is read before it so that the frameApply()
     below draws them turned first time rather than straight and then again turned */
  fview = par.fv==='1';
  const fr=(par.fr||'').split(',').map(Number);
  if(par.fr && (fr.length===9||fr.length===FKEYS.length) && fr.every(Number.isFinite)){
    const fo=+par.fo;
    const o={on:true,org:fo>0,oref:fo>0?fo-1:0};
    FKEYS.forEach((k,i)=>o[k]= i<fr.length ? fr[i] : 0);
    /* frameApply() is the only thing that rebuilds the matrix, so a frame arriving by
       hashchange rather than on load has to go through it too */
    frameSet(o); frameApply();
  } else if(fview||fvLast) fvApply(1);

  /* read positionally and forgive a short list, the way fr does: a plan link that
     loses its angles is still a plan for a vertical approach to that structure. */
  tgLegs=v.includes('T'); $('tlegs').checked=tgLegs;
  const tg=(par.tg||'').split(',');
  let tga=''; try{ tga=decodeURIComponent(tg[0]||''); }catch(_){}
  if(tga&&byAb[tga]){
    targSide = tg[1]==='L' ? -1 : 1;
    const num=(i)=>{ const q=+tg[i]; return Number.isFinite(q)?Math.max(-89,Math.min(89,q)):0; };
    tgTilt=num(2); tgRoll=num(3); tgYaw=num(4);
    $('ttilt').value=tgTilt; $('troll').value=tgRoll; $('tyaw').value=tgYaw;
    /* a plate the target is not printed on is dropped rather than honoured: tgSync()
       would drop it a moment later anyway, and the menu should never show one */
    const pk=+tg[5];
    tgPlate = Number.isFinite(pk)&&plateOf[pk]&&tgPlates(tga).includes(pk) ? pk : 0;
    const off=(i)=>{ const q=+tg[i]; return Number.isFinite(q)?Math.max(-10,Math.min(10,q)):0; };
    tgOff={ap:off(6), ml:off(7), dv:off(8)};
    $('toap').value=tgOff.ap; $('toml').value=tgOff.ml; $('todv').value=tgOff.dv;
    const pb=+tg[9]; tgProbe=Number.isFinite(pb)&&pb>0?Math.min(TG_PROBEMAX,pb):0;
    $('tprobe').value=tgProbe||'';
    const ft=+par.ft; tgFoot=Number.isFinite(ft)&&ft>0?Math.min(TG_FOOTMAX,ft):0;
    $('tfoot').value=tgFoot||'';
    /* set before the selection, because selecting is what solves the plan */
    if(sel!==tga) select(tga);
    setMode('targ');
  }
  tgSync();
  if(par.an) anFromHash(par.an);
  setTab(par.t==='proj'?'proj':(par.t==='v3d'?'v3d':'plate'));
  return true;
}
addEventListener('hashchange',()=>{ if(location.hash!==lastWritten) readHash(); });
/* icon-only now, so "copied" has to be said without any text to swap: the glyph
   becomes a check and the tooltip/aria-label say it in words for anyone reading those */
const LINK_ICON=`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>`+
  `<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`;
const CHECK_ICON=`<path d="M4 12.5l5 5L20 7"/>`;
function copyLink(btn){
  clearTimeout(hashT); writeHash();
  const t=location.href, svg=btn.querySelector('svg'), oldTitle=btn.title;
  const ok=()=>{
    svg.innerHTML=CHECK_ICON; btn.title='Copied'; btn.setAttribute('aria-label','Copied');
    setTimeout(()=>{ svg.innerHTML=LINK_ICON; btn.title=oldTitle; btn.setAttribute('aria-label',oldTitle); },1300);
  };
  const fb=()=>{
    const ta=document.createElement('textarea');
    ta.value=t; ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); ok(); }catch(_){ prompt('Copy this link:',t); }
    ta.remove();
  };
  if(navigator.clipboard && isSecureContext) navigator.clipboard.writeText(t).then(ok,fb); else fb();
}
$('elink').onclick=e=>copyLink(e.currentTarget);

/* ---------- reverse lookup ----------
   The three fields are a point, so the plate shows that point rather than leaving the
   reader to imagine it, and the plate can set it back: arm the pick, click the plate,
   and ML and DV come from the click while AP comes from the plate it was clicked on.
   Nothing here reads the hover position, which is why the old shortcut kept filling in
   wherever the pointer happened to leave the image on its way to the button. */

/* the three fields as atlas millimetres. With a working frame they are read in that
   frame and inverted, and the landmark dropdown steps aside: lambda, interaural and the
   occipital crest are AP landmarks with no DV or ML recorded anywhere in the database,
   so their position in a tilted frame cannot be worked out honestly. Without a frame
   nothing changes and the dropdown is the plain AP offset it always was. */
function revAtlas(){
  const ap=+$('rap').value, ml=+$('rml').value, dv=+$('rdv').value;
  if(![ap,ml,dv].every(Number.isFinite)) return null;
  return FRAME.on ? fromFrame(ap,ml,dv) : {ap:ap-(+$('rref').value),ml,dv};
}
/* the plate whose bregma is nearest the AP field: the AP this lookup can really resolve.
   Under a tilted frame the inverse mixes all three axes, so this now depends on ML and DV
   as well -- which is why it takes the whole triplet rather than reading rap alone. */
function apPlate(){
  const a=revAtlas();
  if(!a) return null;
  return P.reduce((x,b)=>Math.abs(b.bregma-a.ap)<Math.abs(x.bregma-a.ap)?b:x).plate;
}
/* solid on the plate the AP resolves to, faint on any other, so a result found on a
   neighbouring plate can still be read against the ML and DV that were asked for */
function drawPick(){
  const g=$('pk'), ml0=+$('rml').value, dv0=+$('rdv').value;
  /* off the frame this is a plain ML/DV mark and AP need not be filled in; on it the
     point's place on the plate depends on AP too, so all three have to be there */
  const pt = smode!=='coord' ? null
    : FRAME.on ? revAtlas()
    : (Number.isFinite(ml0)&&Number.isFinite(dv0) ? {ml:ml0,dv:dv0} : null);
  if(!pt){ g.innerHTML=''; g.classList.remove('off'); return; }
  const x=fromML(pt.ml), y=fromDV(pt.dv), R=12, A=5, B=R+8;
  const arm=(x1,y1,x2,y2)=>`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"`+
                           ` x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  g.classList.toggle('off', apPlate()!==cur);
  g.innerHTML=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}"/>`+
    arm(x-B,y,x-A,y)+arm(x+A,y,x+B,y)+arm(x,y-B,x,y-A)+arm(x,y+A,x,y+B);
}
/* which plate the AP lands on, and a way to go there when it is not the one showing */
function revPlate(){
  const el=$('rplate'), k=smode==='coord'?apPlate():null;
  if(!k){ el.textContent=''; return; }
  const b=plateOf[k].bregma.toFixed(2);
  el.innerHTML=`AP is plate <b>${k}</b> · bregma ${b}`+
    (k===cur?'':` <button type="button" class="flink" id="rgo">show it</button>`);
  if(k!==cur) $('rgo').onclick=()=>{ go(k); setTab('plate'); };
}
function revSync(){ revPlate(); drawPick(); }

function revRun(){
  const a=revAtlas();
  const O=$('revout');
  revSync();
  if(!a){ O.innerHTML='<p class="empty">Enter AP, ML and DV.</p>'; return; }
  /* the search itself never moved: it runs in atlas millimetres, which is also why its
     bilateral ML matching stays right under a roll or a yaw that is not itself symmetric */
  const {ap,ml,dv}=a;
  const best=new Map();
  for(const q of PTS){
    /* the atlas is bilaterally symmetric, so match ML against whichever side is nearer */
    const dm=Math.min(Math.abs(q.ml-ml),Math.abs(q.ml+ml));
    const d=Math.hypot(q.ap-ap,dm,q.dv-dv);
    const e=best.get(q.ab); if(!e||d<e.d) best.set(q.ab,{d,q});
  }
  O.innerHTML=[...best.values()].sort((x,y)=>x.d-y.d).slice(0,10).map(({d,q})=>{
    const r=byAb[q.ab];
    /* the row is read in whichever frame was asked in; the atlas figures stay on the title */
    const rc=FRAME.on?toFrame(q.ap,q.ml,q.dv):q;
    return `<div class="rrow${d<0.5?' near':''}" data-a="${esc(q.ab)}" data-p="${q.p}">
      <span class="ab">${esc(q.ab)}</span>
      <span class="nm">${esc(r?r.name:'—')}</span>
      <span class="rd2"${FRAME.on?` title="atlas AP ${sgn(q.ap)} · ML ±${Math.abs(q.ml).toFixed(2)} · DV ${sgn(q.dv)}"`:''}>plate ${q.p} · ${apLab(1)} ${sgn(rc.ap)} · ML ±${Math.abs(rc.ml).toFixed(2)} · DV ${sgn(rc.dv)}</span>
      <span class="rdist">${d.toFixed(2)} mm</span></div>`; }).join('');
  [...O.querySelectorAll('.rrow')].forEach(el=>el.onclick=()=>{
    go(+el.dataset.p); select(el.dataset.a); setTab('plate');
    if(!SHELL.matches) document.querySelector('.viewer').scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}
['rap','rml','rdv'].forEach(i=>$(i).oninput=revRun);
$('rref').onchange=revRun;

/* arming is a mode, and the two plate modes cannot both own the next click */
function setPick(on){
  if(on===pickArm) return;
  pickArm=on;
  IW.classList.toggle('pick',on);
  const b=$('rpick');
  b.classList.toggle('armed',on);
  b.textContent=on?'Click the plate…':'Pick on the plate';
  b.setAttribute('aria-pressed',on?'true':'false');
  if(on&&measMode){ $('ckm').checked=false; setMeas(false); }
  if(on) setTab('plate');
  hideTip(); mark(); fit();
}
function takePick(f){
  const ml=toML(f[0]), dv=toDV(f[1]), ap=plateOf[cur].bregma;
  if(FRAME.on){
    const q=toFrame(ap,ml,dv);
    $('rap').value=q.ap.toFixed(2); $('rml').value=q.ml.toFixed(2); $('rdv').value=q.dv.toFixed(2);
  } else {
    $('rml').value=ml.toFixed(2);
    $('rdv').value=dv.toFixed(2);
    $('rap').value=(ap + +$('rref').value).toFixed(2);
  }
  setPick(false); revRun();
}
$('rpick').onclick=()=>setPick(!pickArm);

/* ---------- input plumbing ---------- */
$('rng').oninput=e=>go(+e.target.value);
$('prev').onclick=()=>go(cur-1);
$('next').onclick=()=>go(cur+1);
$('q').oninput=run;
addEventListener('keydown',e=>{
  const t=document.activeElement;
  if(t&&(t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA')) return;
  if(e.key==='ArrowLeft')  go(cur-1);
  if(e.key==='ArrowRight') go(cur+1);
  /* the zoom keys follow whichever view is open */
  if(e.key==='+'||e.key==='='){ if(tab==='v3d'){ v3dist=Math.max(9,v3dist/1.3); v3frame(); }
                                else zoomCentre(zoom*1.6); }
  if(e.key==='-'||e.key==='_'){ if(tab==='v3d'){ v3dist=Math.min(90,v3dist*1.3); v3frame(); }
                                else zoomCentre(zoom/1.6); }
  if(e.key==='0'){ if(tab==='v3d') $('v3r').click();
                   else { zoom=1; tx=ty=0; hideTip(); applyView(); } }
  /* the search box is one of the things a maximised view has put away, so reaching for
     it is also a way of asking for it back */
  if(e.key==='/'){ e.preventDefault(); setMax(false); setMode('find'); $('q').focus(); $('q').select(); }
  if(e.key==='?'){ e.preventDefault(); openAbout(); }
  /* bare F only: Ctrl-F and Cmd-F belong to the browser's own find */
  if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ e.preventDefault(); MAXB.click(); }
  if(e.key==='Home'){ e.preventDefault(); go(1); }
  if(e.key==='End'){ e.preventDefault(); go(62); }
  /* what Escape drops is whatever is most recently in the way: a click the plate is
     waiting for, then a half-made measurement, then the maximised view, then the selection */
  if(e.key==='Escape'){ if(pickArm) setPick(false);
                        else if(measMode&&mA){ mA=mB=mHover=null; drawMeas(); }
                        else if(maxed) MAXB.click();
                        else clear(); }
});

/* ---------- layout: two modes in the sidebar, two views in the main pane ----------
   There is more here than one scrolling column can hold, so the sidebar switches
   between finding a structure and asking what is at a coordinate, the main pane
   switches between the plate and the projection, and each pane keeps its own scroll.
   Given a window with room, the whole app then sits inside it, plate included. */
const SHELL = matchMedia('(min-width:900px) and (min-height:600px)');
/* maximised, the window is filled rather than scrolled -- but only where there is the
   height for that to be a gain; the stylesheet draws the line in the same place */
const TALL  = matchMedia('(min-height:600px)');
let smode='find', tab='plate', scope='all', nHere=0, maxed=false;

function setMode(m){
  if(m===smode) return;
  smode=m;
  [...$('mseg').children].forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('paneFind').classList.toggle('on',m==='find');
  $('paneCoord').classList.toggle('on',m==='coord');
  $('paneTarg').classList.toggle('on',m==='targ');
  $('paneNotes').classList.toggle('on',m==='notes');
  if(m==='notes'){ anList(); if(!anShow) anShowSet(true); }
  /* the planner picks its target out of the same list, so the list stays with it */
  $('list').classList.toggle('on',m==='find'||m==='targ');
  $('revout').classList.toggle('on',m==='coord');
  /* the query point belongs to this pane, so it leaves the plate when the pane does */
  if(m==='coord') revRun(); else { setPick(false); revSync(); reveal(); }
  /* and the track belongs to its own: leaving the pane takes it off every view */
  if(m==='targ') $('tq').value=$('q').value;
  tgSync();
}
[...$('mseg').children].forEach(b=>b.onclick=()=>setMode(b.dataset.m));

function setTab(t){
  tab=t;
  [...$('vseg').children].forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  $('plateview').classList.toggle('on',t==='plate');
  $('projview').classList.toggle('on',t==='proj');
  $('v3dview').classList.toggle('on',t==='v3d');
  $('ctlPlate').hidden = t!=='plate';
  $('ctlProj').hidden  = t!=='proj';
  $('ctl3d').hidden    = t!=='v3d';
  /* the projection plots label positions, not pixels, so no image source applies to it */
  if($('srcseg').children.length>1) $('ctlSrc').hidden = t==='proj';
  /* contrast is a screen filter on the plate image; the stack has Density for the same job */
  $('ctrw').hidden = t!=='plate';
  hideTip(); pjHide(); v3hide();
  if(t==='plate'){ fitW=0; fit(); applyView(); }
  else if(t==='v3d'){ v3note(); v3open(); }
  else pjGuide();
  queueHash();
}
[...$('vseg').children].forEach(b=>b.onclick=()=>setTab(b.dataset.t));

/* ---------- the plate source, and how it is drawn ----------
   One state for the plate and the 3-D view rather than one each: the two are the same
   62 sections seen two ways, and a build where the flat plate and the stack disagree
   about which staining is on screen would be a puzzle, not a feature. */
function srcShow(){
  const el=$('pi');
  el.src=plateImg(cur);
  el.style.filter=plateFilter();
  el.alt=`Atlas plate ${cur}, ${SRCN[psrc]}`;
  [...$('srcseg').children].forEach(b=>b.classList.toggle('on',b.dataset.s===psrc));
  $('ctrs').value=pctr;
  $('ctrl').textContent=(pctr/100).toFixed(1)+'×';
  /* the drawing is the only source with colour in it. The histology was published in grey
     and is stored that way, so the box reads as already checked there and goes dead rather
     than offering a filter that would do nothing. */
  if(cmpOn) cmpShow();
  const grey = psrc!=='drawing';
  $('ckgy').checked = pgrey || grey;
  $('ckgy').disabled = grey;
  $('ckgy').closest('.tg').title = grey
    ? 'The '+SRCN[psrc]+' is printed in grey already'
    : 'Read every source the same way: the drawing loses its colour';
  /* the first 3-D mode draws one textured quad per plate. On the drawing what that shows
     is the contours, and the button has always said so; on a section it shows the section,
     so the button says that instead rather than naming something that is not there. */
  const c=$('m3seg').firstElementChild;
  c.textContent = grey ? 'Slices' : 'Contours';
  c.title = grey
    ? 'Each section drawn where it sits, one plate at a time'
    : "The atlas's own drawn contours, one plate at a time";
}
function setSrc(k){
  if(!srcOK(k)&&k!=='drawing') return;
  psrc=k; srcShow(); markSel(); v3resrc(); v3note(); queueHash();
}
[...$('srcseg').children].forEach(b=>{
  if(!srcOK(b.dataset.s)) b.remove();          /* a source this build does not carry */
  else b.onclick=()=>setSrc(b.dataset.s);
});
if($('srcseg').children.length<2) $('ctlSrc').hidden=true;
$('ckgy').onchange=e=>{ pgrey=e.target.checked; srcShow(); queueHash(); };
$('ctrs').oninput=e=>{ pctr=+e.target.value||100; srcShow(); queueHash(); };
$('ctrs').ondblclick=()=>{ pctr=100; srcShow(); queueHash(); };

function setScope(s){
  if(s===scope) return;
  scope=s;
  [...$('scopeseg').children].forEach(b=>b.classList.toggle('on',b.dataset.s===s));
  refine(); reveal();
}
[...$('scopeseg').children].forEach(b=>b.onclick=()=>setScope(b.dataset.s));

/* 21 system chips would take a third of the sidebar, so two rows show until asked */
const CHIPS=$('sys'), MORE=$('moresys');
function chipFit(){
  MORE.hidden = CHIPS.classList.contains('open') || CHIPS.scrollHeight<=CHIPS.clientHeight+2;
}
MORE.onclick=()=>{ CHIPS.classList.add('open'); MORE.hidden=true; };
new ResizeObserver(chipFit).observe(CHIPS);
chipFit();     /* the observer is the net, not the first answer */

/* ---------- the plate takes whatever room is left over ----------
   Its box has to match the rendered image exactly, because the overlays, the label
   hit testing and the tooltip are all measured off it. So the width is computed from
   the free space that is actually there, rather than guessed at from the viewport
   with the rest of the chrome subtracted as a constant. */
const IMGBOX=$('imgbox');
let fitW=0;
function fit(){
  if(tab!=='plate') return;
  /* stacked, the page scrolls and the plate is bound by its width, which CSS already
     knows; an inline width left over from a wider window would only fight it. Maximised
     in a window with the height for it, the app fills the window instead, whatever its
     width, so that is the other way in to the measuring path */
  if(!SHELL.matches && !(maxed&&TALL.matches)){
    if(IW.style.width){ IW.style.width=''; IW2.style.width=''; fitW=0; applyView(); }
    return;
  }
  const cs=getComputedStyle(IMGBOX);
  const w=IMGBOX.clientWidth -parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const h=IMGBOX.clientHeight-parseFloat(cs.paddingTop) -parseFloat(cs.paddingBottom);
  if(!(w>0&&h>0)) return;                       /* laid out to nothing, or not showing */
  const per = cmpOn ? (w-8)/2 : w;              /* two panes share the width */
  const nw=Math.max(160,Math.min(per,h*NW/NH));
  if(Math.abs(nw-fitW)<0.5) return;
  fitW=nw; IW.style.width=nw.toFixed(1)+'px'; IW2.style.width=nw.toFixed(1)+'px';
  applyView();
}
new ResizeObserver(fit).observe(IMGBOX);
for(const q of [SHELL,TALL]) q.addEventListener('change',()=>{ fitW=0; fit(); });

/* ---------- maximised: the window handed over to the view ----------
   The plate, the projection and the stack are each bound by whatever room is left once
   the search column, the header and the footer have taken theirs. This gives them the
   lot, and asks the browser for its own chrome as well. That ask can be refused -- an
   iframe without the permission, a policy, a pointer that never gestured -- and the
   page-level half is worth having on its own, so a refusal is not an error here: the
   layout goes either way. Leaving fullscreen by a route the page did not take, Esc or
   F11 or the browser's own control, comes back as fullscreenchange and puts the rest
   of the layout back with it, so the two never drift apart. */
const MAXB=$('emax');
const MAXT="Give the view the whole window: the search column, the header and the browser's own chrome step out of the way. F, or Esc to come back.";
const fsOn=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function setMax(on){
  on=!!on;
  if(on===maxed) return;
  maxed=on;
  document.body.classList.toggle('maxed',on);
  MAXB.setAttribute('aria-pressed',on?'true':'false');
  MAXB.setAttribute('aria-label',on?'Restore the view':'Maximise the view');
  MAXB.title = on ? 'Give the search column and the header their room back. Esc does the same.' : MAXT;
  hideTip(); pjHide(); v3hide();
  /* every view is measured off the box it sits in, and that box has just changed */
  fitW=0; fit(); applyView();
  if(tab==='v3d') v3frame();
}
/* both halves are optional on some browser or other, so each is called through a guard
   rather than assumed; a rejected promise from either is the refusal, not a fault */
function fsGo(on){
  const el=document.documentElement;
  const f = on ? (el.requestFullscreen||el.webkitRequestFullscreen)
               : (document.exitFullscreen||document.webkitExitFullscreen);
  if(!f) return;
  try{ const r=f.call(on?el:document); if(r&&r.catch) r.catch(()=>{}); }catch(_){}
}
MAXB.onclick=()=>{ const on=!maxed; setMax(on); if(on||fsOn()) fsGo(on); };
for(const ev of ['fullscreenchange','webkitfullscreenchange'])
  document.addEventListener(ev,()=>{ if(maxed&&!fsOn()) setMax(false); });

/* ---------- theme ----------
   The palette has had a dark half and a data-theme override all along; this is the
   switch for it, with auto left as the default so the system still decides. */
const THEMES=['auto','light','dark'];
let theme='auto';
try{ theme=localStorage.getItem('gae-theme')||'auto'; }catch(_){}
function setTheme(t){
  theme=THEMES.includes(t)?t:'auto';
  if(theme==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',theme);
  const b=$('themeb');
  b.textContent=theme[0].toUpperCase()+theme.slice(1);
  b.title=(theme==='auto'?'Following the system theme':'Held to '+theme)+' \u2014 click to change';
  try{ localStorage.setItem('gae-theme',theme); }catch(_){}
  /* the 3-D view takes its colours from the sheet, so it has to be told */
  if(v3ready){ v3colours(); v3frame(); }
}
$('themeb').onclick=()=>setTheme(THEMES[(THEMES.indexOf(theme)+1)%THEMES.length]);
setTheme(theme);

/* ---------- the working frame: the dialog, and everything a change has to refresh ----
   One way in and one way out: frameRead() takes the fields, frameApply() rebuilds the
   matrix and re-renders every readout that quotes a coordinate. Nothing else writes to
   FRAME, so no value can reach the matrix without having been a finite number first. */
const FDLG=$('frame');
/* order is load-bearing: it is the order of the values in a deep link, so the origin keys
   go on the end where an older nine-value link can still be read positionally */
const FKEYS=['pitch','roll','yaw','pap','pml','pdv','dap','dml','ddv','oap','oml','odv'];
const FIN={pitch:'fpitch',roll:'froll',yaw:'fyaw',pap:'fpap',pml:'fpml',pdv:'fpdv',
           dap:'fdap',dml:'fdml',ddv:'fddv',oap:'foap',oml:'foml',odv:'fodv'};
/* the preview names somewhere familiar and shows what the frame does to it. Nothing in
   the atlas records which way a given frame is tilted, so a sign cannot be checked by the
   app -- it has to be read back against anatomy the user already knows. */
const FPREV=['MSO','CIC','Au1','CA1'].find(a=>ptsOf[a]&&ptsOf[a].length)||S[0].abbr;
function framePreview(){
  const a=coordsOf(FPREV), el=$('fprev');
  if(!a){ el.textContent=''; return; }
  el.innerHTML=FRAME.on
    ? `<b>${esc(FPREV)}</b> ${ctrTxt(coordsOf(FPREV,1),1)}<span class="fpa">atlas ${ctrTxt(a)}</span>`
    : `<b>${esc(FPREV)}</b> ${ctrTxt(a)}<span class="fpa">the frame is off, so this is the atlas reading</span>`;
}
function frameApply(){
  if(smode==='notes') anList();
  frmBuild();
  const b=$('frameb');
  b.classList.toggle('on',FRAME.on);
  b.textContent=FRAME.on?'Frame · '+frameTxt():'Frame';
  b.title=!FRAME.on
    ? "Work in your own stereotaxic frame rather than the atlas's, or just move where zero is"
    : rotated()
      ? `Coordinates are read in your frame: ${frameTxt()}, about pivot `+
        `${FRAME.pap}/${FRAME.pml}/${FRAME.pdv} — rotation is experimental; click to change`
      /* no rotation means no approximation to warn about: this is a subtraction */
      : `Coordinates are measured from ${orgFull()} — an exact re-zero; click to change`;
  $('fon').textContent=FRAME.on?'Turn off':'Turn on';
  /* lambda, interaural and the occipital crest are AP landmarks with no DV or ML on
     record, so in a tilted frame the dropdown has nothing honest to offer */
  $('rref').disabled=FRAME.on;
  $('rrefl').textContent=FRAME.on?(FRAME.org?'from '+orgName():'from the pivot'):'relative to';
  framePreview(); frameMarks(); orgSync();
  if(sel) select(sel);
  if(showXY&&lastPt) drawXH(lastPt);
  /* the projection's axes are ruled from the origin, and the 3-D note quotes its slab
     from it, so both are rewritten with everything else. Whether the dots and the stack
     are redrawn as well is fvApply's call: they have not moved unless the views are being
     drawn in the frame, in which case a changed angle has moved every one of them. */
  fvApply();
  drawMeas(); revRun(); tgSync(); frameSave(); queueHash();
}
/* ---------- the origin: which point reads zero ----------
   Built from LM rather than spelled out, so it stays in step with the plate table the way
   the pivot presets do. The landmark and the offset are separate: picking one moves zero
   to it and leaves the offset alone, because "half a millimetre behind lambda" is a thing
   people zero on and "an AP of -4.95" is not how they would say it. There is no "point of
   your own" entry any more -- every point is a landmark plus an offset, and the note under
   the fields says where the two of them put zero. */
$('forg').innerHTML='<option value="">the atlas origin, as the rotation leaves it</option>'+
  LM.map(([nm],i)=>`<option value="${i}">${esc(nm.toLowerCase())}</option>`).join('');
$('forg').onchange=e=>{
  const v=e.target.value;
  FRAME.org = v!=='';
  if(v!=='') FRAME.oref=+v;
  frameRead();
};
/* the fields go dead while the origin is off, so a stale offset cannot look like it is in
   use, and the note spells out in atlas millimetres where the pair of them landed */
function orgSync(){
  $('forg').value = FRAME.org ? String(FRAME.oref) : '';
  ['foap','foml','fodv'].forEach(k=>$(k).disabled=!FRAME.org);
  $('fpivn').hidden=!FRAME.org;
  $('fpivs').classList.toggle('fdim',!!FRAME.org);
  hgtRow($('fohgt'), FRAME.org?FRAME.oref:null, FRAME.odv, v=>{ $('fodv').value=v; });
  const N=$('forgn');
  N.hidden=!FRAME.org;
  if(FRAME.org){ const o=oAbs();
    N.innerHTML=`Zero is at atlas bregma <b>${sgn(o[0])}</b> &middot; ML <b>${sgn(o[1])}</b>`+
      ` &middot; DV <b>${sgn(o[2])}</b> mm, and reads 0 / 0 / 0.`; }
}
/* A preset sets the pivot's AP -- the landmark sits that far anterior of bregma, so the
   pivot goes to minus that -- and puts it on the midline. It does not set DV, because the
   atlas gives every one of these an AP and none of them a height. For pitch that is not a
   detail: pitch turns about a mediolateral axis, so the interaural preset only becomes the
   ear-bar axis once DV says how far below the dorsal surface that axis sits. That is what
   hgtRow() below offers, off the skull fit rather than off the atlas, in its own row so the
   exact half and the approximate half of the pivot are never set by the same click. */
$('fset').innerHTML='<span>Put the pivot on</span>'+LM.map(([n,off],i)=>
  `<button class="b" type="button" data-i="${i}" title="Pivot AP ${sgn(-off)} mm, on the midline">${esc(n)}</button>`).join('');
[...$('fset').children].forEach(b=>{ if(b.dataset.i===undefined) return;
  b.onclick=()=>{ $('fpap').value=-LM[+b.dataset.i][1]; $('fpml').value=0; frameRead(); }; });
/* a preset lights up while the pivot still sits where it put it; DV is free to be anything */
function frameMarks(){
  [...$('fset').children].forEach(b=>{ if(b.dataset.i===undefined) return;
    b.classList.toggle('on', Math.abs(FRAME.pap+LM[+b.dataset.i][1])<1e-9 && !FRAME.pml); });
  hgtRow($('fphgt'), pivLM(), FRAME.pdv, v=>{ $('fpdv').value=v; });
}
/* which landmark the pivot's AP is sitting on, or null. Matched on AP alone, unlike the
   preset lights above: the height belongs to the landmark's plane, and a pivot pushed off
   the midline for a roll is still on that plane. */
function pivLM(){
  const i=LM.findIndex(([,off])=>Math.abs(FRAME.pap+off)<1e-9);
  return i<0 ? null : i;
}
/* ---------- the landmark's height ----------
   One picker serves the origin and the pivot, because the question is the same in both
   places: is your DV zero the brain's dorsal surface, or the landmark's own height? It
   writes into the DV field rather than holding a flag of its own, so the number stays
   visible and editable and the deep link, the stored frame and the CSV carry it as the
   plain millimetres they always did -- nothing downstream has to learn about this.

   The dorsal-surface button is the atlas's own zero and exact. The other is off the skull
   fit, so it is named for what it is and carries the same asterisk the Skull toggles do. */
function hgtRow(el, idx, cur, put){
  const h = idx==null ? null : LMDV[idx];
  el.hidden=!h;
  if(!h) return;
  const opts=[[0,'dorsal surface',
               "the atlas's own DV zero: the plane through the most dorsal points of "+
               'cerebrum and cerebellum'],
              [+h.dv.toFixed(2),h.t,h.w]];
  el.innerHTML='<span>Height</span>'+opts.map(([v,lb,ti],i)=>{
    const b=`<button class="b${Math.abs(cur-v)<5e-3?' on':''}" type="button" data-v="${v}"`+
      ` title="Sets DV to ${sgn(v)} mm — ${esc(ti)}">${esc(lb)} ${sgn(v)}</button>`;
    /* the asterisk belongs to the fitted height, not to the row, so it is tied to that
       button the way the Skull toggles tie theirs -- one wrapping unit at any width */
    return i ? `<span class="tgw">${b}<button type="button" class="ast" title="The height`+
      ` is off the approximate skull fit — read the note"`+
      ` aria-label="Note on the skull fit">*</button></span>` : b;
  }).join('');
  [...el.querySelectorAll('button[data-v]')].forEach(b=>
    b.onclick=()=>{ put(+b.dataset.v); frameRead(); });
  el.querySelector('.ast').onclick=skullNote;
}
/* ---------- angles from two readings ----------
   Two points and the distance between them give an angle: atan(difference / separation).
   One shape serves all three axes; only which axis is read changes. The inputs are ordered
   so that "second minus first" is always the positive sense of the convention -- anterior
   then posterior for pitch, right then left for roll and yaw.

   What the answer is relative to is NOT the same for all three, and that is the part worth
   knowing. The atlas is bilaterally symmetric -- midline structures sit within 0.10 mm of
   ML 0 -- so its own roll and yaw against a symmetric skull are zero by construction, and a
   roll or yaw measured off symmetric landmarks IS the deviation from the atlas. Pitch has no
   such anchor: the atlas prints an AP for bregma, lambda, interaural and occipital crest and
   a height for none of them, so bregma-to-lambda gives the skull's tilt in the frame against
   flat skull, not against the atlas's own plane. The reading is written straight into the
   field, so the note under each result says what it actually measured. */
const MEAS=[
  {k:'pitch',t:'Pitch',pre:1,dv:4.45,d:'AP apart, as read in your frame (mm)',
   a:'DV at bregma (anterior)', b:'DV at the posterior landmark',
   n:"Gives the skull's tilt in your frame against <em>flat skull</em> — <b>not</b> against the "+
     "atlas plane, which the atlas gives no way to locate on the skull. Using it replaces the "+
     "pitch field outright. Read the AP span off the manipulator rather than taking a nominal "+
     "one: the atlas's 4.45 and 7.25 are measured along <em>its</em> AP axis, and a tilted frame "+
     "sees them foreshortened — about 0.7° low at 17°."},
  {k:'roll',t:'Roll',dv:6,d:'ML apart, as set on the arm (mm)',
   a:'DV at the right point (ML +)', b:'DV at the left point (ML −)',
   n:'Measures deviation from the atlas directly: the atlas is bilaterally symmetric, so its '+
     'own roll against a symmetric skull is zero and there is no baseline to add. The span is '+
     'exact here, unlike the pitch one, because you drive the arm to it rather than read it.'},
  {k:'yaw',t:'Yaw',dv:6,d:'ML apart, as set on the arm (mm)',
   a:'AP at the right point (ML +)', b:'AP at the left point (ML −)',
   n:'Measures deviation from the atlas directly, for the same reason.'}
];
const mId=(k,x)=>'m_'+k+'_'+x;
/* An empty box is a reading that was not taken, not a reading of zero. Coercing it with +
   the way the frame fields do would turn a half-filled form into a confident angle, so a
   blank leaves the result blank and the Use button disabled. */
function measAngle(m){
  const num=x=>{ const t=$(mId(m.k,x)).value.trim(); if(!t) return NaN;
    const v=+t; return Number.isFinite(v)?v:NaN; };
  const a=num('a'), b=num('b'), d=num('d');
  if([a,b,d].some(Number.isNaN)||!d) return null;
  return Math.atan2(b-a,Math.abs(d))*180/Math.PI;
}
$('fmeas').innerHTML=MEAS.map(m=>
  `<div class="fmb">
     <div class="fmh"><b>${m.t}</b>${m.pre?'<span>nominal span</span>'+LM.filter(l=>l[1]).map(l=>
       `<button class="b" type="button" data-k="${m.k}" data-d="${l[1]}"`+
       ` title="The atlas's own AP separation. A span you read in your own frame is better.">`+
       `bregma–${esc(l[0].toLowerCase())} ${l[1].toFixed(2)}</button>`).join(''):''}</div>
     <div class="fgrid">
       <label class="ffld"><span>${m.a}</span><input type="number" step="0.05" id="${mId(m.k,'a')}"></label>
       <label class="ffld"><span>${m.b}</span><input type="number" step="0.05" id="${mId(m.k,'b')}"></label>
       <label class="ffld"><span>${m.d}</span><input type="number" step="0.05" id="${mId(m.k,'d')}" value="${m.dv.toFixed(2)}"></label>
     </div>
     <div class="fmo"><span class="v" id="${mId(m.k,'r')}">—</span>
       <button class="b" type="button" id="${mId(m.k,'u')}" disabled>Use as ${m.k}</button></div>
     <p class="fmn">${m.n}</p>
   </div>`).join('');
function measCalc(){
  MEAS.forEach(m=>{
    const v=measAngle(m);
    $(mId(m.k,'r')).textContent = v===null?'—':sgn(v)+'°';
    $(mId(m.k,'u')).disabled = v===null;
  });
}
MEAS.forEach(m=>{
  ['a','b','d'].forEach(x=>$(mId(m.k,x)).oninput=measCalc);
  $(mId(m.k,'u')).onclick=()=>{ const v=measAngle(m); if(v===null) return;
    $(FIN[m.k]).value=+v.toFixed(2); frameRead(); };
});
[...$('fmeas').querySelectorAll('button[data-d]')].forEach(b=>
  b.onclick=()=>{ $(mId(b.dataset.k,'d')).value=(+b.dataset.d).toFixed(2); measCalc(); });
measCalc();

function frameSet(o){
  FKEYS.forEach(k=>{ const v=+o[k]; if(Number.isFinite(v)) FRAME[k]=v; });
  FRAME.on=!!o.on; FRAME.org=!!o.org;
  /* oref is an index, not a field, so it is clamped here rather than parsed with the rest:
     a stored frame from before it existed, or a hand-edited link, must still land on a real
     landmark or oAbs() would read off the end of the table */
  const r=Math.round(+o.oref);
  FRAME.oref = Number.isFinite(r) ? Math.min(LM.length-1,Math.max(0,r)) : 0;
  FKEYS.forEach(k=>{ $(FIN[k]).value=FRAME[k]; });
}
function frameRead(){
  FKEYS.forEach(k=>{ const v=+$(FIN[k]).value; FRAME[k]=Number.isFinite(v)?v:0; });
  frameApply();
}
/* Off by default: a fresh visit starts at the atlas unless the reader has opted in.
   The checkbox's own state is the one thing that always persists, so it stays checked
   for a reader who asked for that; the frame data underneath only follows it. */
let FREMEMBER=false;
try{ FREMEMBER=localStorage.getItem('gae-frame-remember')==='1'; }catch(_){}
function frameSave(){
  try{
    if(FREMEMBER&&FRAME.on) localStorage.setItem('gae-frame',JSON.stringify(FRAME));
    else localStorage.removeItem('gae-frame');
  }catch(_){}
}
function frameLoad(){
  if(!FREMEMBER) return;
  let o=null;
  try{ o=JSON.parse(localStorage.getItem('gae-frame')||'null'); }catch(_){}
  if(o&&typeof o==='object') frameSet(o);
}
const frameZero=()=>{ const z={on:false,org:false,oref:0}; FKEYS.forEach(k=>z[k]=0); return z; };
FKEYS.forEach(k=>{ $(FIN[k]).oninput=frameRead; });
$('fon').onclick=()=>{ FRAME.on=!FRAME.on; frameApply(); };
$('fzero').onclick=()=>{ frameSet(frameZero()); frameApply(); };
$('fremember').checked=FREMEMBER;
$('fremember').onchange=()=>{
  FREMEMBER=$('fremember').checked;
  try{ localStorage.setItem('gae-frame-remember',FREMEMBER?'1':'0'); }catch(_){}
  frameSave();
};
$('frameb').onclick=()=>{
  framePreview();
  if(FDLG.showModal) FDLG.showModal(); else FDLG.setAttribute('open','');
};
$('framex').onclick=()=>FDLG.close();
FDLG.addEventListener('click',e=>{ if(e.target===FDLG) FDLG.close(); });

/* ---------- about: the long form of what the footer says in one line ---------- */
const ABOUT=$('about');
const openAbout=()=>{ if(ABOUT.showModal) ABOUT.showModal(); else ABOUT.setAttribute('open',''); };
$('aboutb').onclick=openAbout;
$('aboutb2').onclick=openAbout;
$('aboutx').onclick=()=>ABOUT.close();
/* All three Skull toggles rest on the same approximate registration, so they share one
   footnote rather than repeating it: the asterisk opens About at the paragraph that
   explains the fit, and lights it so the reader is not left scanning for it. */
function skullNote(){
  openAbout();
  const p=$('skullnote'); if(!p) return;
  requestAnimationFrame(()=>{
    p.scrollIntoView({block:'center'});
    p.classList.remove('lit'); void p.offsetWidth; p.classList.add('lit');
  });
}
[...document.querySelectorAll('.ast')].forEach(b=>b.onclick=skullNote);
ABOUT.addEventListener('click',e=>{ if(e.target===ABOUT) ABOUT.close(); });

/* every segmented control is a tab list, and its .on class is mirrored to aria-selected
   from one place rather than at each of the dozen sites that toggle it */
for(const seg of document.querySelectorAll('.seg')){
  seg.setAttribute('role','tablist');
  for(const b of seg.children){ b.setAttribute('role','tab'); b.setAttribute('aria-selected',b.classList.contains('on')?'true':'false'); }
  new MutationObserver(ms=>ms.forEach(m=>{ const b=m.target;
    if(b.tagName==='BUTTON') b.setAttribute('aria-selected',b.classList.contains('on')?'true':'false'); }))
    .observe(seg,{attributes:true,attributeFilter:['class'],subtree:true});
}
/* the results list is a listbox the keyboard can walk: Enter or Space picks a row */
$('list').addEventListener('keydown',e=>{
  const r=e.target.closest&&e.target.closest('.row'); if(!r) return;
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); r.click(); }
});
frameLoad();                 /* before readHash, so a link's frame wins over the stored one */
pjAxes(); run();
if(!readHash()) go(30);
frameApply();
fit(); applyView(); revRun();

/* a handle for the tests and for the console: the pure functions and the state they
   read. Nothing in the app goes through it. */
window.__gae={toFrame,fromFrame,writeHash,readHash,tgSolve,tgPath,tgFootprint,plan:()=>tgPlan,
  select,go,clear,frameSet,frameApply,FRAME,frmBuild,BUILD,S,P,byAb,ptsOf,regBuild,plateAt,inBrain,
  coordsOf,tgJSON,tgNotes,meshList,setCmp,anMake,notes:()=>NOTES,mesh:()=>MESH,
  GRP,isGrp,regIn,grpsOf,
  setMax,
  state:()=>({cur,sel,zoom,tab,smode,psrc,tgProbe,tgFoot,cmpOn,anShow,maxed,targSide,tgTilt,tgRoll,tgYaw,tgPlate,tgOff,fview,fvOn:fvOn()})};
