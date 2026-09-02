#!/usr/bin/env python3
"""Superstructures: the gross divisions of the brain, as unions of atlas structures.

The published atlas names 723 structures and no containers for them -- there is no
"hippocampus" in the index, only CA1, CA2, CA3, DG and their layers. This builds that
missing layer: a flat set of gross divisions, each one a named list of the atlas's own
abbreviations. It adds no geometry. A superstructure's outline, area, coordinates and
mesh are all derived in the app from the members' own, so nothing here can invent a
boundary the atlas does not draw.

Like the system tags, the divisions are a convenience layer added here and are NOT part
of the published atlas. Unlike a segmentation, every one of them is checkable: the member
list is written out in full, and `--report` prints each division with the plate range and
the bregma span the members give it.

Groups may overlap, on purpose. `brainstem` is the union of midbrain, pons and medulla;
`olfactory bulb` sits inside `olfactory areas`; the four cortical lobes sit inside
`cerebral cortex`; a structure that genuinely straddles the pons and the medulla is in
both. What is NOT allowed is a structure in no group at all, apart from the handful named
in FREE below -- vessels and surface fissures, which are not part of any division.

Rules are declarative so they can be read and argued with:

    sys      seed from these system tags (any of)
    nsys     then drop anything carrying these tags
    match    then add anything whose name matches this regex
    add      then add these abbreviations outright
    drop     then remove these abbreviations outright
    span     add every structure whose plate range overlaps this one, except those
             already claimed by the groups in `unless` -- how the hindbrain is cut
    of       union of other groups, evaluated after them
    alias    other names for the division, so the search box finds it by them too

Usage:

    python3 tools/build_groups.py            write the `groups` block into the database
    python3 tools/build_groups.py --report   print every group and the residue, write nothing
    python3 tools/build_groups.py --check    exit 1 if the committed block is stale

Stdlib only.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

# The pons and the medulla are the one boundary the atlas's own geometry can settle, so
# it is drawn off the plates rather than asserted: the pons runs from the first plate
# that prints the pontine nuclei to the last that prints the facial nucleus, and the
# medulla from there to the end of the series. A structure spanning both is in both.
PONS_PLATES = (39, 49)
MEDULLA_PLATES = (50, 62)
MIDBRAIN_ROSTRAL = 33          # nothing rostral of this plate is swept into the hindbrain

# Everything the hindbrain sweep must not swallow: a forebrain nucleus that happens to
# reach plate 39, a cerebellar peduncle, a ventricle.
ROSTRAL = ('ctx', 'hipp', 'olf', 'amyg', 'stri', 'bfor', 'thal', 'hypo', 'midb', 'cblm', 'vent')

# Not in any division, and correctly so: two arteries, a generic vessel, and three
# surface fissures. They are landmarks on the section, not parts of the brain.
FREE = ('acer', 'mcer', 'BV', 'rf', 'ri', 'hif')

GROUPS = [
    dict(id='ctx', abbr='CTX', name='cerebral cortex',
         alias=('cortex', 'neocortex', 'isocortex', 'cerebral cortex', 'pallium'),
         note='Isocortex, the cingulate and retrosplenial belt, the insular and orbital '
              'fields, the rhinal cortices, piriform cortex, the cortical layers the atlas '
              'names separately, and the claustro-endopiriform complex. The dorsal and '
              "external cortices of the inferior colliculus carry the atlas's `cortex` tag "
              'and are not cerebral cortex; they are filed under midbrain alone.',
         sys=('cortex', 'claustrum'),
         add=('A1', 'AAF', 'DEn', 'IEn', 'VEn'),
         drop=('DCIC', 'ECIC')),

    dict(id='hipp', abbr='HIPP', name='hippocampal formation',
         alias=('hippocampus', 'hippocampal', 'archicortex'),
         note="The atlas's hippocampal tag: the CA fields and their layers, the dentate "
              'gyrus, the subicular complex, entorhinal cortex, and the fibre systems the '
              'formation is defined by (fornix, fimbria, alveus, the hippocampal commissures).',
         sys=('hippocampal',),
         drop=('hif',)),

    dict(id='olf', abbr='OLF', name='olfactory areas',
         alias=('olfactory', 'rhinencephalon', 'paleocortex'),
         note='The main and accessory olfactory bulbs, the anterior olfactory nucleus, tenia '
              'tecta, piriform cortex, the endopiriform nuclei, the olfactory tubercle and '
              'islands of Calleja, and the lateral olfactory tract.',
         sys=('olfactory',)),

    dict(id='bulb', abbr='BULB', name='olfactory bulb',
         alias=('olfactory bulb', 'main olfactory bulb', 'accessory olfactory bulb'),
         note='The bulb proper: every layer of the main and accessory olfactory bulbs, the '
              'olfactory nerve layer, the intrabulbar anterior commissure and the olfactory '
              'ventricle. A subset of olfactory areas.',
         match=r'olfactory bulb',
         add=('ON', 'OV', 'aci')),

    dict(id='amyg', abbr='AMYG', name='amygdala',
         alias=('amygdala', 'amygdaloid complex'),
         note='The amygdaloid complex, including its cortical nuclei and the '
              'amygdalohippocampal and amygdalopiriform transition areas.',
         sys=('amygdala',)),

    dict(id='stri', abbr='STRI', name='striatum and pallidum',
         alias=('basal ganglia', 'striatum', 'pallidum', 'corpus striatum', 'neostriatum'),
         note='Dorsal and ventral striatum (caudate putamen, accumbens, olfactory tubercle, '
              'islands of Calleja), the pallidum (globus pallidus, ventral pallidum, '
              'entopeduncular nucleus) and the subthalamic nucleus.',
         add=('CPu', 'AcbC', 'AcbSh', 'LAcbSh', 'LSS', 'CB', 'Tu', 'ICj', 'ICjM',
              'GP', 'VP', 'EP', 'STh', 'IPAC')),

    dict(id='bfor', abbr='BFOR', name='septum and basal forebrain',
         alias=('basal forebrain', 'septum', 'septal', 'substantia innominata'),
         note='The septal nuclei, the diagonal band and magnocellular basal forebrain, '
              'substantia innominata, and the bed nucleus of the stria terminalis with its '
              'stria. The ventral striatum and pallidum are filed under striatum and '
              'pallidum instead, though the atlas tags them here.',
         sys=('basal_forebrain',),
         add=('SFi', 'SHi'),
         drop=('AcbC', 'AcbSh', 'LAcbSh', 'LSS', 'CB', 'VP', 'IPAC', 'Tu', 'ICj', 'ICjM')),

    dict(id='thal', abbr='THAL', name='thalamus',
         alias=('thalamus', 'dorsal thalamus', 'epithalamus', 'diencephalon'),
         note='Dorsal thalamus, the geniculate bodies, the reticular and midline nuclei, the '
              'epithalamus and zona incerta. The atlas tags many hypothalamic nuclei '
              '`thalamus` as well; those are excluded here.',
         sys=('thalamus',),
         nsys=('hypothalamus',),
         add=('A13',)),

    dict(id='hypo', abbr='HYPO', name='hypothalamus',
         alias=('hypothalamus', 'diencephalon'),
         note='The hypothalamic nuclei and areas, the mammillary bodies, the median eminence '
              'and the hypothalamic tracts.',
         sys=('hypothalamus',),
         add=('A11',)),

    dict(id='midb', abbr='MIDB', name='midbrain',
         alias=('midbrain', 'mesencephalon', 'tectum', 'tegmentum', 'colliculus'),
         note='Tectum (superior and inferior colliculi), the pretectum, the periaqueductal '
              'grey, the tegmentum, substantia nigra and the ventral tegmental area, the red '
              'nucleus and the oculomotor and trochlear nuclei. The dorsal raphe is here where '
              'the atlas prints it rostral of the pontine nuclei; its caudal subdivisions fall '
              'at pontine levels and are filed there.',
         sys=('midbrain',),
         add=('Aq', 'DLPAG', 'DMPAG', 'LPAG', 'VLPAG', 'p1PAG', 'Su3', 'Su3C',
              'CIC', 'DCIC', 'ECIC', 'DMIC', 'BIC', 'bic', 'cic', 'Pta', 'Sag',
              'APT', 'APTD', 'APTV', 'MPT', 'OPT', 'PPT',
              'DR', 'CLi', 'RLi', 'Me5', 'me5', '4n', '3n')),

    dict(id='pons', abbr='PONS', name='pons',
         alias=('pons', 'pontine', 'metencephalon'),
         note='From the first plate that prints the pontine nuclei to the last that prints '
              'the facial nucleus (plates %d–%d, bregma −5.50 to −9.35 mm): the '
              'basis pontis and pontine tegmentum, the superior olivary complex and the nuclei '
              'of the lateral lemniscus, the parabrachial nuclei, the trigeminal motor and '
              'principal sensory nuclei, and the facial and abducens nuclei.' % PONS_PLATES,
         span=PONS_PLATES, unless=ROSTRAL),

    dict(id='medu', abbr='MEDU', name='medulla',
         alias=('medulla', 'medulla oblongata', 'myelencephalon', 'bulb of the brainstem'),
         note='Caudal to the facial nucleus (plates %d–%d, bregma −9.35 to '
              '−13.55 mm): the medullary reticular formation and raphe, the inferior '
              'olive, the solitary and spinal trigeminal complexes, the dorsal column nuclei, '
              'the vestibular and cochlear nuclei, and the caudal cranial nerve nuclei.'
              % MEDULLA_PLATES,
         span=MEDULLA_PLATES, unless=ROSTRAL),

    dict(id='bstem', abbr='BSTEM', name='brainstem',
         alias=('brainstem', 'brain stem'),
         note='Midbrain, pons and medulla together — exactly the union of those three, '
              'so anything in one of them is in this.',
         of=('midb', 'pons', 'medu')),

    dict(id='cblm', abbr='CBLM', name='cerebellum',
         alias=('cerebellum', 'cerebellar', 'metencephalon'),
         note='The cerebellar cortex lobules, the deep nuclei, the peduncles and the '
              'cerebellar fissures.',
         sys=('cerebellum',),
         drop=('hif', 'rf', 'af')),

    dict(id='fibr', abbr='FIBR', name='fiber tracts',
         alias=('white matter', 'tracts', 'fibre tracts', 'commissures'),
         note='Every named tract, commissure, lemniscus, fascicle and cranial nerve root. '
              'These run through the grey-matter divisions rather than beside them, so most '
              'are in one of those as well.',
         sys=('fiber_tract',)),

    dict(id='vent', abbr='VENT', name='ventricular system',
         alias=('ventricles', 'ventricular', 'csf', 'circumventricular'),
         note='The ventricles and their recesses, the aqueduct and central canal, the choroid '
              'plexus and ependyma, and the circumventricular organs. The periaqueductal grey '
              'is filed under midbrain, though the atlas tags it here.',
         sys=('ventricular',),
         nsys=('vascular',),
         drop=('DLPAG', 'DMPAG', 'LPAG', 'VLPAG', 'p1PAG', 'Su3')),

    dict(id='fcx', abbr='FCX', name='frontal cortex',
         alias=('frontal lobe', 'frontal cortex', 'prefrontal', 'motor cortex', 'cingulate cortex'),
         note='Motor, orbital, prelimbic, infralimbic and cingulate fields. A subset of '
              'cerebral cortex.',
         add=('FrA', 'Fr3', 'M1', 'M2', 'MO', 'VO', 'LO', 'DLO',
              'PrL', 'IL', 'DP', 'Cg1', 'Cg2')),

    dict(id='pcx', abbr='PCX', name='parietal cortex',
         alias=('parietal lobe', 'parietal cortex', 'somatosensory cortex', 'barrel cortex'),
         note='Primary and secondary somatosensory fields and the parietal association areas. '
              'A subset of cerebral cortex.',
         match=r'^primary somatosensory cortex',
         add=('S2', 'PtP', 'LPtA', 'MPtA')),

    dict(id='tcx', abbr='TCX', name='temporal cortex',
         alias=('temporal lobe', 'temporal cortex', 'auditory cortex'),
         note='The auditory fields, temporal association cortex, and the ectorhinal and '
              'perirhinal belt. A subset of cerebral cortex.',
         add=('Au1', 'AuD', 'AuV', 'A1', 'AAF', 'TeA', 'Ect', 'PRh')),

    dict(id='ocx', abbr='OCX', name='occipital cortex',
         alias=('occipital lobe', 'occipital cortex', 'visual cortex', 'striate cortex'),
         note='Primary and secondary visual fields. A subset of cerebral cortex.',
         add=('V1', 'V1B', 'V1M', 'V2L', 'V2M')),
]


def resolve(structs):
    """Every group as an ordered list of member abbreviations, and the plates it is on.

    Order-independent: a group that reads other groups (`span ... unless`, `of`) is
    resolved after the ones it reads, whatever order GROUPS is written in, so the list
    can stay in the order the app should show them.
    """
    byab = {s['abbr']: s for s in structs}
    members, window = {}, {}
    plain = [g for g in GROUPS if not g.get('span') and not g.get('of')]
    swept = [g for g in GROUPS if g.get('span')]
    joins = [g for g in GROUPS if g.get('of')]
    if len(plain) + len(swept) + len(joins) != len(GROUPS):
        sys.exit('build_groups: a group both sweeps a span and unions other groups')
    for g in plain + swept + joins:
        m = set()
        for t in g.get('sys', ()):
            m |= {s['abbr'] for s in structs if t in s['systems']}
        if g.get('nsys'):
            m -= {s['abbr'] for s in structs if set(g['nsys']) & set(s['systems'])}
        if g.get('match'):
            rx = re.compile(g['match'], re.I)
            m |= {s['abbr'] for s in structs if rx.search(s['name'])}
        if g.get('span'):
            a, b = g['span']
            missing = [k for k in g.get('unless', ()) if k not in members]
            if missing:
                sys.exit('build_groups: %s excludes groups that do not exist: %s'
                         % (g['id'], ', '.join(missing)))
            taken = set().union(set(), *(members[k] for k in g.get('unless', ())))
            for s in structs:
                if s['abbr'] in taken or s['abbr'] in FREE:
                    continue
                if s['last_plate'] < MIDBRAIN_ROSTRAL:
                    continue
                # In, if more than one plate of it is inside the range, or at least half
                # of it is. Clipping a range at one plate is what a long forebrain tract
                # does when it peters out at the pons -- the forceps major reaches plate 39
                # and is no more pontine for it -- but a two-plate structure sitting astride
                # the boundary, as the deep dorsal cochlear nucleus does, is in both.
                over = min(b, s['last_plate']) - max(a, s['first_plate']) + 1
                if over > 1 or over * 2 >= s['n_plates']:
                    m.add(s['abbr'])
        for k in g.get('of', ()):
            if k not in members:
                sys.exit('build_groups: %s unions a group that does not exist: %s' % (g['id'], k))
            m |= set(members[k])
        m |= set(g.get('add', ()))
        m -= set(g.get('drop', ()))
        unknown = sorted(x for x in m if x not in byab)
        if unknown:
            sys.exit('build_groups: %s names structures the atlas has not: %s'
                     % (g['id'], ', '.join(unknown)))
        members[g['id']] = sorted(m, key=lambda x: (x.lower(), x))
        # Which plates the group is *on*, which is not simply where its members are. A
        # division is where its grey matter is: the tracts belong to it there and are still
        # outlined with it, but the medial lemniscus reaching plate 54 does not put the
        # thalamus in the medulla. A group of nothing but tracts is where its tracts are.
        core = [a for a in members[g['id']] if 'fiber_tract' not in byab[a]['systems']]
        pl = {p for a in (core or members[g['id']]) for p in byab[a]['plates']}
        if g.get('span'):
            a, b = g['span']
            pl = {p for p in pl if a <= p <= b}
        elif g.get('of'):
            pl = set().union(set(), *(window[k] for k in g['of']))
        window[g['id']] = sorted(pl)
    return members, window


def block(db):
    """The `groups` block, exactly as it goes into the database."""
    structs = db['structures']
    byab = {s['abbr']: s for s in structs}
    breg = A.bregma_of(db)
    members, window = resolve(structs)
    dup = [g['abbr'] for g in GROUPS if g['abbr'] in byab]
    if dup:
        sys.exit('build_groups: group labels collide with atlas abbreviations: %s'
                 % ', '.join(dup))
    rows = []
    for g in GROUPS:
        ms, plates = members[g['id']], window[g['id']]
        if not ms or not plates:
            sys.exit('build_groups: %s has no members on any plate' % g['id'])
        rows.append({
            'id': g['id'],
            'abbr': g['abbr'],
            'name': g['name'],
            'alias': list(g.get('alias', ())),
            'note': g['note'],
            'members': ms,
            'n_members': len(ms),
            'plates': plates,
            'first_plate': plates[0],
            'last_plate': plates[-1],
            'n_plates': len(plates),
            'bregma_anterior': max(breg[p] for p in plates),
            'bregma_posterior': min(breg[p] for p in plates),
            'systems': sorted({t for a in ms for t in byab[a]['systems']}),
        })
    covered = set().union(set(), *members.values())
    free = sorted(a for a in byab if a not in covered)
    if free != sorted(FREE):
        sys.exit('build_groups: structures in no group changed.\n  expected: %s\n'
                 '  found:    %s\nEither place them or update FREE.'
                 % (', '.join(sorted(FREE)), ', '.join(free)))
    return {
        'note': 'Gross divisions of the brain, added here and not part of the published '
                "atlas. Each is a named union of the atlas's own structures; groups may "
                'overlap. A group is only on the plates listed, which for the pons and the '
                'medulla is narrower than where their members reach. '
                'Built by tools/build_groups.py.',
        'pons_medulla_boundary': 'the caudal end of the facial nucleus, plate %d' % PONS_PLATES[1],
        'ungrouped': list(FREE),
        'data': rows,
    }


def report(db):
    byab = {s['abbr']: s for s in db['structures']}
    b = block(db)
    for r in b['data']:
        print('%-6s %-28s %3d members  plates %2d-%2d  bregma %+.2f to %+.2f'
              % (r['abbr'], r['name'], r['n_members'], r['first_plate'], r['last_plate'],
                 r['bregma_anterior'], r['bregma_posterior']))
        print('       ' + ' '.join(r['members']))
    print('\nin no group (%d): %s' % (len(b['ungrouped']),
                                      ', '.join('%s (%s)' % (a, byab[a]['name'])
                                                for a in b['ungrouped'])))
    n = len(db['structures'])
    print('covered: %d of %d structures' % (n - len(b['ungrouped']), n))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--report', action='store_true', help='print the divisions, write nothing')
    ap.add_argument('--check', action='store_true', help='exit 1 if the committed block is stale')
    a = ap.parse_args()
    db = A.load_db()
    if a.report:
        return report(db)
    fresh = block(db)
    if a.check:
        if db.get('groups') == fresh:
            print('groups: current')
            return 0
        print('groups: STALE -- run tools/build_groups.py')
        return 1
    if db.get('groups') == fresh:
        print('groups: unchanged (%d divisions)' % len(fresh['data']))
        return 0
    # keep the block beside the structures it groups rather than at the end of the file
    items = [kv for kv in db.items() if kv[0] != 'groups']
    db.clear()
    for k, v in items:
        db[k] = v
        if k == 'structures':
            db['groups'] = fresh
    if 'groups' not in db:
        db['groups'] = fresh
    A.save_db(db)
    print('groups: wrote %d divisions over %d structures'
          % (len(fresh['data']), len(db['structures']) - len(fresh['ungrouped'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
