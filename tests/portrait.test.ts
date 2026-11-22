import test from "node:test";
import assert from "node:assert/strict";
import { BEARD_IDS, DEFAULT_PORTRAIT, DEFAULT_PORTRAIT_LOOK, EARRING_IDS, GLASSES_IDS, HAIR_COLORS, HAIR_COLOR_IDS, HAIR_IDS, HAT_COLORS, HAT_IDS, mergePortrait, NOSE_IDS, partIconShapes, PARTS, portraitElement, portraitShapes, readPortrait, SEX_IDS, SHAPE_IDS, SKIN_IDS, SKIN_TONES, withPortrait } from "../src/portrait";
import { FACE_IDS, LOOK_IDS } from "../src/figure";
import { iconToElements } from "../src/icon-strokes";
import { iconData } from "../src/icon-registry";
import { createEmptyDoc, parseSketchnote, serializeSketchnote } from "../src/file-format";
import { isSafePath } from "../src/svg-path";
import { isSafeColor } from "../src/color";
import { panelKinds, sectionShown } from "../src/panel-kinds";
import { readOrder, DEFAULT_ORDER, drawFunctions } from "../src/draw-functions";
import type { IconElement } from "../src/elements";

const ink = { stroke: `#000000`, strokeWidth: 3, roughness: 1, seed: 5 };

test(`les choix du personnage sont aussi nombreux que demande`, () => {
  assert.equal(SHAPE_IDS.length, 5);
  assert.equal(SEX_IDS.length, 2);
  assert.equal(HAIR_IDS.length, 10, `neuf coiffures et la coupe punk`);
  assert.ok(HAIR_IDS.includes(`punk`) && HAIR_IDS.includes(`bald`));
  assert.equal(HAT_IDS.length, 8, `sept chapeaux et la casquette de capitaine`);
  assert.ok(HAT_IDS.includes(`captain`) && HAT_IDS.includes(`cap`));
  for (const b of [`goatee`, `moustache`, `thin`, `handlebar`, `goateestache`, `both`, `short`, `long`]) assert.ok(BEARD_IDS.includes(b as never), b);
  assert.equal(SKIN_IDS.length, 6);
  assert.ok(HAIR_COLOR_IDS.length >= 10);
  for (const c of [`black`, `brown`, `red`, `blond`, `platinum`, `grey`]) assert.ok(c in HAIR_COLORS, c);
  assert.ok(FACE_IDS.length >= 11);
  assert.deepEqual([...LOOK_IDS], [`front`, `left`, `right`]);
  assert.equal(GLASSES_IDS.length, 3);
  assert.equal(NOSE_IDS.length, 3);
  assert.equal(EARRING_IDS.length, 2);
});

test(`les couleurs de peau vont du clair au fonce`, () => {
  const light = (hex: string): number => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  const values = SKIN_IDS.map((id) => light(SKIN_TONES[id]));
  for (let i = 1; i < values.length; i++) assert.ok(values[i] < values[i - 1], `de plus en plus foncee : ${SKIN_IDS[i]}`);
  for (const c of [...Object.values(SKIN_TONES), ...Object.values(HAIR_COLORS), ...Object.values(HAT_COLORS)]) assert.ok(isSafeColor(c), c);
});

test(`chaque choix donne des formes sures, et change le dessin`, () => {
  const base = portraitShapes(DEFAULT_PORTRAIT).map((s) => s.d).join(`|`);
  for (const part of PARTS) {
    const seen = new Set<string>();
    for (const id of part.ids) {
      const shapes = portraitShapes({ ...DEFAULT_PORTRAIT, [part.key]: id } as never);
      assert.ok(shapes.length >= 3 && shapes.length <= 120, `${part.key} ${id}`);
      for (const s of shapes) assert.ok(isSafePath(s.d), `trace sure : ${part.key} ${id}`);
      seen.add(shapes.map((s) => s.d).join(`|`));
    }
    assert.equal(seen.size, part.ids.length, `deux choix de ${part.key} ne donnent jamais le meme dessin`);
  }
  assert.notEqual(base, ``);
});

test(`la peau peint le visage et les cheveux peignent les cheveux et la barbe`, () => {
  const shapes = portraitShapes({ ...DEFAULT_PORTRAIT, skin: `s5`, haircolor: `red`, beard: `both`, hair: `long` });
  const paints = shapes.map((s) => s.paint).filter((p): p is string => p !== undefined);
  assert.ok(paints.includes(SKIN_TONES.s5));
  assert.ok(paints.filter((p) => p === HAIR_COLORS.red).length >= 3, `cheveux, barbe et moustache`);
  assert.ok(!portraitShapes({ ...DEFAULT_PORTRAIT, skin: `s1` }).some((s) => s.paint === SKIN_TONES.s5));
});

test(`un chapeau cache le haut des cheveux et prend sa couleur`, () => {
  const bare = portraitShapes({ ...DEFAULT_PORTRAIT, hat: `none`, hair: `short` });
  const hatted = portraitShapes({ ...DEFAULT_PORTRAIT, hat: `top`, hatcolor: `black`, hair: `short` });
  assert.ok(hatted.some((s) => s.paint === HAT_COLORS.black));
  assert.ok(!hatted.some((s) => s.paint === HAIR_COLORS.brown && bare.length > 0 && s.d === bare[bare.length - 1].d));
});

test(`un visage tourne montre une seule oreille`, () => {
  const ears = (look: `front` | `left` | `right`): number => portraitShapes({ ...DEFAULT_PORTRAIT, look }).filter((s) => !s.closed && s.stroke && /^M[\d.,-]+C/.test(s.d)).length;
  assert.ok(ears(`front`) > ears(`left`));
  assert.equal(ears(`left`), ears(`right`));
});

test(`la lecture d un personnage complete les choix manquants et refuse les faux`, () => {
  assert.deepEqual(readPortrait({}), DEFAULT_PORTRAIT);
  assert.equal(readPortrait({ hair: `punk` })?.hair, `punk`);
  assert.equal(readPortrait({ hair: `inconnu` }), null);
  assert.equal(readPortrait({ skin: 3 }), null);
  assert.equal(readPortrait(`oui`), null);
  assert.equal(mergePortrait(DEFAULT_PORTRAIT, { hat: `crown`, hair: `faux` }).hat, `crown`);
  assert.equal(mergePortrait(DEFAULT_PORTRAIT, { hat: `crown`, hair: `faux` }).hair, DEFAULT_PORTRAIT.hair);
});

test(`un personnage est une icone qui garde ses choix et se relit`, () => {
  const el = portraitElement({ ...DEFAULT_PORTRAIT, hair: `punk`, haircolor: `pink`, skin: `s6`, hat: `none` }, [200, 200], 140, ink, `p1`);
  assert.equal(el.type, `icon`);
  assert.equal(el.width, 140);
  assert.deepEqual(el.vb, [0, 0, 100, 100]);
  const doc = { ...createEmptyDoc(), elements: [el] };
  const back = parseSketchnote(serializeSketchnote(doc));
  assert.ok(back.ok);
  if (!back.ok) return;
  const read = back.doc.elements[0] as IconElement;
  assert.deepEqual(read.portrait, el.portrait);
  assert.deepEqual(read.shapes, el.shapes);
  const tampered = JSON.parse(serializeSketchnote(doc));
  tampered.elements[0].shapes = [{ d: `M0,0L5,5`, fill: false, stroke: true, closed: false }];
  const again = parseSketchnote(JSON.stringify(tampered));
  assert.ok(again.ok && JSON.stringify((again.doc.elements[0] as IconElement).shapes) === JSON.stringify(el.shapes));
  tampered.elements[0].portrait.hair = `faux`;
  assert.equal(parseSketchnote(JSON.stringify(tampered)).ok, false, `un choix faux fait refuser le fichier`);
});

test(`les choix d un personnage se changent sans changer sa place ni son trait`, () => {
  const el = portraitElement(DEFAULT_PORTRAIT, [100, 100], 100, ink, `p1`);
  const next = withPortrait(el, { ...DEFAULT_PORTRAIT, hat: `captain`, beard: `handlebar` });
  assert.equal(next.portrait?.hat, `captain`);
  assert.equal(next.portrait?.beard, `handlebar`);
  assert.notDeepEqual(next.shapes, el.shapes);
  assert.equal(next.x, el.x);
  assert.equal(next.seed, el.seed);
  assert.equal(next.strokeWidth, el.strokeWidth);
});

test(`un personnage n a pas de menu de reglages : seulement la transformation en traits`, () => {
  const el = portraitElement(DEFAULT_PORTRAIT, [100, 100], 100, ink, `p1`);
  const kinds = panelKinds(`select`, [el]);
  assert.equal(sectionShown(`icon`, kinds), true, `le bouton Transformer en traits`);
  for (const name of [`colour`, `transparency`, `effects`, `width`, `look`, `fill`, `figure`, `figuresize`] as const) assert.equal(sectionShown(name, kinds), false, name);
});

test(`le bouton du personnage ouvre une fenetre, est dans l ordre habituel et une ancienne barre le recoit`, () => {
  assert.ok(DEFAULT_ORDER.includes(`portrait`));
  const fn = drawFunctions().find((f) => f.id === `portrait`);
  assert.ok(fn && fn.opens === `portrait` && fn.tools.length === 0 && fn.sections.length === 0);
  const old = DEFAULT_ORDER.filter((id) => id !== `portrait`);
  assert.deepEqual(readOrder(old, drawFunctions().map((f) => f.id as string)), DEFAULT_ORDER);
});

test(`en transformant un personnage en traits, la peau et les cheveux gardent leur couleur`, () => {
  const el = portraitElement({ ...DEFAULT_PORTRAIT, skin: `s5`, haircolor: `red` }, [100, 100], 100, ink, `p1`);
  const data = iconData(el);
  assert.ok(data);
  if (!data) return;
  const made = iconToElements(el, data, []);
  assert.equal(made.elements.length, data.shapes.length, `un trait pour chaque forme`);
  const fills = made.elements.map((e) => (`fill` in e ? e.fill : undefined)).filter((f): f is string => typeof f === `string`);
  assert.ok(fills.includes(SKIN_TONES.s5));
  assert.ok(fills.includes(HAIR_COLORS.red));
  assert.ok(made.elements.every((e) => e.type === `line` || e.type === `freedraw` || e.type === `ellipse` || e.type === `rect`), `des traits de stylo a retoucher`);
  assert.ok(made.groupId !== null, `groupes pour se deplacer ensemble`);
});

test(`chaque choix a un pictogramme dessinable`, () => {
  for (const part of PARTS) for (const id of part.ids) assert.ok(partIconShapes(part.key, id).length >= 2, `${part.key} ${id}`);
});

test(`tout ce qui est sur le visage tourne avec lui : barbe, moustache, lunettes, nez, sourcils`, () => {
  const centre = (shapes: { d: string }[]): number => {
    const xs: number[] = [];
    for (const sh of shapes) for (const m of sh.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) xs.push(Number(m[1]));
    return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  };
  const part = (look: `front` | `left` | `right`, o: Record<string, string>) => portraitShapes({ ...DEFAULT_PORTRAIT, hair: `bald`, face: `blank`, nose: `small`, look, ...o } as never);
  const nothing = (look: `front` | `left` | `right`) => centre(part(look, {}));
  for (const [key, id] of [[`beard`, `moustache`], [`beard`, `handlebar`], [`beard`, `thin`], [`beard`, `goatee`], [`beard`, `short`], [`glasses`, `round`], [`glasses`, `square`]] as [string, string][]) {
    const left = centre(part(`left`, { [key]: id })) - nothing(`left`);
    const front = centre(part(`front`, { [key]: id })) - nothing(`front`);
    const right = centre(part(`right`, { [key]: id })) - nothing(`right`);
    assert.ok(left <= front + 0.01 && right >= front - 0.01, `${key} ${id} suit le visage : ${left.toFixed(2)} ${front.toFixed(2)} ${right.toFixed(2)}`);
  }
  // a nose seen from the side sticks out toward where the face looks, as far as its kind
  assert.notDeepEqual(portraitShapes({ ...DEFAULT_PORTRAIT, look: `left`, nose: `long` }).map((sh) => sh.d), portraitShapes({ ...DEFAULT_PORTRAIT, look: `right`, nose: `long` }).map((sh) => sh.d));
  // the peak of a cap points where the face looks, a ponytail hangs behind
  const peak = (look: `front` | `left` | `right`): number => centre(portraitShapes({ ...DEFAULT_PORTRAIT, hair: `bald`, hat: `cap`, look }).slice(-2, -1));
  // from the front the peak points to the right, as when the face looks right; it turns to the left when the face does
  assert.ok(peak(`left`) < peak(`front`) && peak(`right`) >= peak(`front`));
  const tail = (look: `front` | `left` | `right`): number => centre(portraitShapes({ ...DEFAULT_PORTRAIT, hair: `ponytail`, look }).slice(0, 2));
  assert.ok(tail(`right`) < tail(`front`) && tail(`left`) >= tail(`front`));
});

test(`le trait d un nouveau personnage est net : une imperfection de 3 et un trait de 1 pixel`, () => {
  assert.equal(DEFAULT_PORTRAIT_LOOK.roughness, 0.3);
  assert.equal(DEFAULT_PORTRAIT_LOOK.strokeWidth, 1);
  const el = portraitElement(DEFAULT_PORTRAIT, [100, 100], 140, { stroke: `#000000`, strokeWidth: 5, roughness: 0.3, seed: 1 }, `p`);
  assert.equal(el.strokeWidth, 5, `la largeur choisie est gardee`);
});
