import { test } from "node:test";
import assert from "node:assert/strict";
import { canFill, isClosedLine, LineElement, Point, readElements, SketchElement } from "../src/elements";
import { hitElement } from "../src/geometry";
import { movePointTo, removePointAt } from "../src/linear";
import { panelKinds, sectionShown } from "../src/panel-kinds";
import { elementPaths } from "../src/shape-paths";
import { applyStyle, styleOf } from "../src/style";

const closed: Point[] = [[100, 100], [300, 100], [300, 250], [100, 100]];
const line = (points: Point[], extra: Record<string, unknown> = {}): LineElement => (readElements([{ id: `l`, type: `line`, points, stroke: `#000000`, strokeWidth: 3, seed: 1, ...extra }]) as { ok: true; elements: SketchElement[] }).elements[0] as LineElement;

test(`une ligne brisee qui revient a son premier point est fermee : trois coins au moins, et elle peut avoir un remplissage`, () => {
  assert.equal(isClosedLine(closed), true);
  assert.equal(isClosedLine([[0, 0], [10, 0], [0, 0]]), false, `deux segments ne font pas une forme`);
  assert.equal(isClosedLine([[0, 0], [10, 0], [10, 10], [5, 5]]), false);
  assert.equal(canFill(line(closed)), true);
  assert.equal(canFill(line([[0, 0], [10, 0], [10, 10]])), false, `une ligne ouverte n'a pas de remplissage`);
});

test(`une ligne lit son remplissage, et le menu propose le remplissage seulement quand elle est fermee`, () => {
  const el = line(closed, { fill: `#ffcc00`, fillStyle: `hachure`, fillOpacity: 0.5 });
  assert.deepEqual([el.fill, el.fillStyle, el.fillOpacity], [`#ffcc00`, `hachure`, 0.5]);
  assert.equal(readElements([{ id: `l`, type: `line`, points: closed, stroke: `#000000`, strokeWidth: 3, fill: `url(#x)` }]).ok, false);
  assert.equal(sectionShown(`fill`, panelKinds(`select`, [el])), true);
  assert.equal(sectionShown(`fill`, panelKinds(`select`, [line([[0, 0], [10, 0], [10, 10]])])), false);
  // The other settings of a line stay.
  assert.equal(sectionShown(`edges`, panelKinds(`select`, [el])), true);
  const s = styleOf(applyStyle(line(closed), { fill: `#00aa00`, fillStyle: `dots` }));
  assert.deepEqual([s?.fill, s?.fillStyle], [`#00aa00`, `dots`]);
  const open = applyStyle(line([[0, 0], [10, 0], [10, 10]]), { fill: `#00aa00` }) as LineElement;
  assert.equal(open.fill, undefined, `rien ne se remplit sur une ligne ouverte`);
});

test(`l'interieur d'une ligne fermee est dessine et se touche seulement quand elle a un remplissage`, () => {
  const plain = elementPaths(line(closed));
  const filled = elementPaths(line(closed, { fill: `#ffcc00` }));
  assert.ok(filled.pieces.length > plain.pieces.length, `une piece de plus pour le remplissage`);
  assert.equal(filled.pieces[0].fill !== `none` && filled.pieces[0].fill !== undefined, true, `le remplissage est dessine sous le trait`);
  assert.equal(hitElement(line(closed, { fill: `#ffcc00` }), [250, 130], 3), true, `un clic dedans le touche`);
  assert.equal(hitElement(line(closed), [250, 130], 3), false, `sans remplissage on ne le touche que sur son trait`);
  assert.equal(hitElement(line(closed, { fill: `#ffcc00` }), [120, 240], 3), false, `hors de la forme`);
  const rounded = elementPaths(line(closed, { fill: `#ffcc00`, rounded: true }));
  assert.ok(rounded.pieces.length >= 2);
});

test(`les deux bouts d'une ligne fermee bougent ensemble, et supprimer le coin de depart referme la ligne`, () => {
  const el = line(closed);
  const moved = movePointTo(el, 0, [90, 80]);
  assert.deepEqual([moved.points[0], moved.points[3]], [[90, 80], [90, 80]]);
  assert.equal(isClosedLine(moved.points), true);
  const middle = movePointTo(el, 1, [320, 90]);
  assert.deepEqual(middle.points[0], [100, 100]);
  const four = line([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]);
  const cut = removePointAt(four, 0);
  assert.ok(cut !== null && isClosedLine(cut.points) && cut.points.length === 4 && cut.points[0][0] === 100);
  assert.equal(removePointAt(el, 0), null, `un triangle ne perd pas un coin`);
  const inner = removePointAt(four, 2);
  assert.ok(inner !== null && isClosedLine(inner.points));
});
