# Staged wiki pages

The GitHub wiki lives in its own git repository —
`https://github.com/dstolz/GerbilAtlasExplorer.wiki.git` — which the GitHub API cannot
reach and which this session had no push credential for. So the pages and figures written
for it are staged here instead, exactly as they should land.

This is **not** a mirror of the whole wiki: it is the thirteen pages this change touches
and the twenty-two images they add. Every other page in the wiki is untouched and is not
copied here.

## Publishing it

```sh
git clone https://github.com/dstolz/GerbilAtlasExplorer.wiki.git /tmp/gae-wiki
rsync -a --exclude README.md wiki/ /tmp/gae-wiki/     # this note stays behind
git -C /tmp/gae-wiki add -A
git -C /tmp/gae-wiki commit -m "The guide shows what it describes: 22 figures across thirteen pages"
git -C /tmp/gae-wiki push
```

Without `rsync`: `cp -r wiki/images /tmp/gae-wiki/` and then copy the thirteen `.md` files
beside it, leaving this `README.md` out.

The wiki has no branches or pull requests: a push to `master` is the publish.

## How the figures were made

Every one is the built bundle driven by Playwright at 1560 CSS px wide and a device pixel
ratio of 2, then scaled to 1280 px. The view in each was set by the app's own link format —
`#p30/DLG&v=gsl` and the rest — so any of them can be reproduced by opening that link, and
re-taken the same way when the interface moves.

Two are not screenshots at all. `images/plate30-colored.png` and `images/export-svg.png`
are the app's own **PNG** and **SVG** exports of plate 30, saved from the Controls panel
and cropped to the plate: what a reader gets if they press the button, not a picture of the
window it was pressed in.
