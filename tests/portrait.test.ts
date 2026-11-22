import test from "node:test";
import assert from "node:assert/strict";
import { BEARD_IDS, DEFAULT_PORTRAIT, EARRING_IDS, GLASSES_IDS, HAIR_COLORS, HAIR_COLOR_IDS, HAIR_IDS, HAT_COLORS, HAT_IDS, mergePortrait, NOSE_IDS, partIconShapes, PARTS, portraitElement, portraitShapes, readPortrait, SEX_IDS, SHAPE_IDS, SKIN_IDS, SKIN_TONES, withPortrait } from "../src/portrait";
import { FACE_IDS, LOOK_IDS } from "../src/figure";
import { applyStyle, cleanPatch, styleOf } from "../src/style";
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

test(`les choix d un personnage choisi se changent par le style`, () => {
  const el = portraitElement(DEFAULT_PORTRAIT, [100, 100], 100, ink, `p1`);
  assert.deepEqual(styleOf(el)?.portrait, DEFAULT_PORTRAIT);
  const next = applyStyle(el, { portrait: { ...DEFAULT_PORTRAIT, hat: `captain`, beard: `handlebar` } }) as IconElement;
  assert.equal(next.portrait?.hat, `captain`);
  assert.equal(next.portrait?.beard, `handlebar`);
  assert.notDeepEqual(next.shapes, el.shapes);
  assert.deepEqual(withPortrait(el, { ...DEFAULT_PORTRAIT, hat: `captain`, beard: `handlebar` }).shapes, next.shapes);
  assert.deepEqual(cleanPatch({ portrait: { hair: `faux`, hat: `crown` } as never }).portrait?.hat, `crown`);
  assert.equal(cleanPatch({ portraitSize: 9999 }).portraitSize, 400);
});

test(`le menu du personnage apparait pour l outil et pour un personnage choisi`, () => {
  assert.equal(sectionShown(`portrait`, panelKinds(`portrait`, [])), true);
  assert.equal(sectionShown(`portraitsize`, panelKinds(`portrait`, [])), true);
  const el = portraitElement(DEFAULT_PORTRAIT, [100, 100], 100, ink, `p1`);
  assert.equal(sectionShown(`portrait`, panelKinds(`select`, [el])), true);
  assert.equal(sectionShown(`portraitsize`, panelKinds(`select`, [el])), false);
  assert.equal(sectionShown(`figure`, panelKinds(`select`, [el])), false);
});

test(`le bouton du personnage est dans l ordre habituel et une ancienne barre le recoit`, () => {
  assert.ok(DEFAULT_ORDER.includes(`portrait`));
  assert.ok(drawFunctions().some((f) => f.id === `portrait` && f.tools[0] === `portrait`));
  const old = DEFAULT_ORDER.filter((id) => id !== `portrait`);
  assert.deepEqual(readOrder(old, drawFunctions().map((f) => f.id as string)), DEFAULT_ORDER);
});

test(`chaque choix a un pictogramme dessinable`, () => {
  for (const part of PARTS) for (const id of part.ids) assert.ok(partIconShapes(part.key, id).length >= 2, `${part.key} ${id}`);
});
