import test from "node:test";
import assert from "node:assert/strict";
import { BUILD_IDS, FACE_IDS, figureElement, figureOf, figureShapes, FIGURE_VB, JOINTS, moveJoint, poseJoints, POSE_IDS, readFigure, withFigure } from "../src/figure";
import { dragFigureJoint, figureToPage, jointAt, pageToFigure } from "../src/figure-edit";
import { applyStyle, cleanPatch, styleOf } from "../src/style";
import { parseSketchnote, serializeSketchnote, createEmptyDoc } from "../src/file-format";
import { isSafePath } from "../src/svg-path";
import { panelKinds, sectionShown } from "../src/panel-kinds";
import type { IconElement } from "../src/elements";

const dist = (a: number[], b: number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const look = { stroke: `#000000`, strokeWidth: 4, roughness: 1, seed: 3 };

test(`il y a huit poses, quinze visages et deux corps`, () => {
  assert.equal(POSE_IDS.length, 8);
  assert.ok(FACE_IDS.length >= 11, `au moins dix expressions en plus du visage vide`);
  assert.equal(BUILD_IDS.length, 2);
});

test(`chaque pose tient dans la grille et garde les longueurs de ses membres`, () => {
  for (const id of POSE_IDS) {
    const j = poseJoints(id);
    for (const name of JOINTS) {
      assert.ok(j[name][0] >= 0 && j[name][0] <= 100 && j[name][1] >= 0 && j[name][1] <= 100, `${id} ${name} dans la grille : ${j[name]}`);
    }
    const k = dist(j.neck, j.hip) / 28;
    assert.ok(k > 0.6 && k <= 1.001, `echelle de ${id} : ${k}`);
    assert.ok(Math.abs(dist(j.elbowL, j.handL) - 18.4 * k) < 0.5, `avant-bras de ${id}`);
    assert.ok(Math.abs(dist(j.hip, j.kneeR) - 24.2 * k) < 0.5, `cuisse de ${id}`);
  }
});

test(`chaque combinaison donne des formes sures`, () => {
  for (const pose of POSE_IDS) {
    for (const face of FACE_IDS) {
      for (const build of BUILD_IDS) {
        const shapes = figureShapes(figureOf(pose, face, build));
        assert.ok(shapes.length >= 5 && shapes.length <= 60);
        for (const s of shapes) assert.ok(isSafePath(s.d), `trace sure : ${pose} ${face} ${build}`);
      }
    }
  }
});

test(`un visage change les formes, un visage vide n en ajoute pas`, () => {
  const blank = figureShapes(figureOf(`stand`, `blank`, `stick`)).length;
  for (const face of FACE_IDS.filter((f) => f !== `blank`)) assert.ok(figureShapes(figureOf(`stand`, face, `stick`)).length > blank, face);
  const faces = new Set(FACE_IDS.map((f) => figureShapes(figureOf(`stand`, f, `stick`)).map((s) => s.d).join(`|`)));
  assert.equal(faces.size, FACE_IDS.length, `deux visages ne sont jamais les memes`);
});

test(`tirer une main tourne l avant-bras autour du coude sans changer sa longueur`, () => {
  const fig = figureOf(`stand`, `happy`, `stick`);
  const before = dist(fig.joints.elbowR, fig.joints.handR);
  const next = moveJoint(fig, `handR`, [80, 10]);
  assert.ok(Math.abs(dist(next.joints.elbowR, next.joints.handR) - before) < 0.2);
  assert.deepEqual(next.joints.elbowR, fig.joints.elbowR);
  assert.notDeepEqual(next.joints.handR, fig.joints.handR);
});

test(`tirer un coude fait suivre la main et garde les longueurs`, () => {
  const fig = figureOf(`stand`, `happy`, `stick`);
  const next = moveJoint(fig, `elbowL`, [10, 20]);
  assert.ok(Math.abs(dist(next.joints.neck, next.joints.elbowL) - dist(fig.joints.neck, fig.joints.elbowL)) < 0.2);
  assert.ok(Math.abs(dist(next.joints.elbowL, next.joints.handL) - dist(fig.joints.elbowL, fig.joints.handL)) < 0.2);
  assert.deepEqual(next.joints.neck, fig.joints.neck);
});

test(`tirer la hanche plie le corps, le haut ne bouge pas, les jambes suivent`, () => {
  const fig = figureOf(`stand`, `happy`, `stick`);
  const next = moveJoint(fig, `hip`, [80, 70]);
  assert.deepEqual(next.joints.neck, fig.joints.neck);
  assert.deepEqual(next.joints.head, fig.joints.head);
  assert.ok(Math.abs(dist(next.joints.neck, next.joints.hip) - dist(fig.joints.neck, fig.joints.hip)) < 0.2);
  assert.ok(Math.abs(dist(next.joints.hip, next.joints.kneeL) - dist(fig.joints.hip, fig.joints.kneeL)) < 0.2);
});

test(`aucun geste ne fait sortir un point de la grille`, () => {
  let fig = figureOf(`walk`, `happy`, `stick`);
  for (const j of JOINTS) fig = moveJoint(fig, j, [500, -500]);
  for (const j of JOINTS) assert.ok(fig.joints[j][0] <= 120 && fig.joints[j][0] >= -20 && fig.joints[j][1] <= 120 && fig.joints[j][1] >= -20);
});

test(`un bonhomme est une icone qui garde ses articulations`, () => {
  const el = figureElement(`wave`, `laugh`, `thick`, `front`, [200, 200], 150, look, `f1`);
  assert.equal(el.type, `icon`);
  assert.equal(el.width, 150);
  assert.deepEqual(el.vb, FIGURE_VB);
  assert.ok(el.figure && el.shapes && el.shapes.length > 10);
  assert.equal(el.x, 125);
});

test(`la page et la grille se correspondent, tourne ou retourne`, () => {
  const el = withFigure(figureElement(`stand`, `happy`, `stick`, `front`, [200, 200], 100, look, `f1`), figureOf(`stand`, `happy`, `stick`));
  for (const variant of [el, { ...el, angle: 40 }, { ...el, flipX: true }, { ...el, flipY: true, angle: 75 }] as IconElement[]) {
    for (const p of [[10, 20], [50, 50], [90, 80]] as [number, number][]) {
      const back = pageToFigure(variant, figureToPage(variant, p));
      assert.ok(dist(back, p) < 0.01, `aller retour ${JSON.stringify(p)}`);
    }
  }
});

test(`un clic atteint l articulation la plus proche et la fait bouger`, () => {
  const el = figureElement(`stand`, `happy`, `stick`, `front`, [200, 200], 100, look, `f1`);
  const hand = figureToPage(el, el.figure!.joints.handR);
  assert.equal(jointAt(el, hand, 6), `handR`);
  assert.equal(jointAt(el, [0, 0], 6), null);
  const moved = dragFigureJoint(el, `handR`, [hand[0] + 5, hand[1] - 30]);
  assert.notDeepEqual(moved.figure!.joints.handR, el.figure!.joints.handR);
  assert.notDeepEqual(moved.shapes, el.shapes);
});

test(`le fichier garde le bonhomme et redessine ses formes depuis les articulations`, () => {
  const el = figureElement(`run`, `fear`, `thick`, `front`, [300, 300], 120, look, `f1`);
  const doc = { ...createEmptyDoc(), elements: [el] };
  const back = parseSketchnote(serializeSketchnote(doc));
  assert.ok(back.ok);
  if (!back.ok) return;
  const read = back.doc.elements[0] as IconElement;
  assert.deepEqual(read.figure, el.figure);
  assert.deepEqual(read.shapes, el.shapes);
  // shapes that do not match the joints are replaced by the ones that do
  const tampered = JSON.parse(serializeSketchnote(doc));
  tampered.elements[0].shapes = [{ d: `M0,0L5,5`, fill: false, stroke: true, closed: false }];
  const again = parseSketchnote(JSON.stringify(tampered));
  assert.ok(again.ok);
  if (again.ok) assert.deepEqual((again.doc.elements[0] as IconElement).shapes, el.shapes);
});

test(`une articulation fausse fait refuser le bonhomme`, () => {
  const good = figureOf(`stand`, `happy`, `stick`);
  assert.ok(readFigure(good));
  assert.equal(readFigure({ ...good, face: `inconnu` }), null);
  assert.equal(readFigure({ ...good, build: `x` }), null);
  assert.equal(readFigure({ ...good, joints: { ...good.joints, head: [1e9, 0] } }), null);
  assert.equal(readFigure({ ...good, joints: { ...good.joints, hip: `non` } }), null);
  assert.equal(readFigure(null), null);
});

test(`le visage et le corps d un bonhomme choisi se changent par le style`, () => {
  const el = figureElement(`stand`, `happy`, `stick`, `front`, [200, 200], 100, look, `f1`);
  assert.equal(styleOf(el)?.figureFace, `happy`);
  const sad = applyStyle(el, { figureFace: `sad`, figureBuild: `thick` }) as IconElement;
  assert.equal(sad.figure?.face, `sad`);
  assert.equal(sad.figure?.build, `thick`);
  assert.notDeepEqual(sad.shapes, el.shapes);
  assert.deepEqual(sad.figure?.joints, el.figure?.joints);
  assert.deepEqual(cleanPatch({ figureFace: `nope`, figure: `walk`, figureSize: 9999 }), { figure: `walk`, figureSize: 400 });
});

test(`le menu du bonhomme apparait pour l outil et pour un bonhomme choisi`, () => {
  assert.equal(sectionShown(`figure`, panelKinds(`figure`, [])), true);
  assert.equal(sectionShown(`figuresize`, panelKinds(`figure`, [])), true);
  const el = figureElement(`stand`, `happy`, `stick`, `front`, [200, 200], 100, look, `f1`);
  assert.equal(sectionShown(`figure`, panelKinds(`select`, [el])), true);
  assert.equal(sectionShown(`figuresize`, panelKinds(`select`, [el])), false);
  assert.equal(sectionShown(`figure`, panelKinds(`rect`, [])), false);
});

test(`les bras et les jambes sont plus longs d un sixieme que la colonne ne le laisse attendre`, () => {
  const j = poseJoints(`stand`);
  const spine = dist(j.neck, j.hip);
  assert.ok(dist(j.hip, j.kneeL) + dist(j.kneeL, j.footL) > spine * 1.6, `jambes longues`);
  assert.ok(dist(j.neck, j.elbowL) + dist(j.elbowL, j.handL) > spine * 1.3, `bras longs`);
});

test(`le visage se tourne a gauche ou a droite : un nez et des traits decales`, () => {
  const front = figureShapes(figureOf(`stand`, `happy`, `stick`, `front`));
  const left = figureShapes(figureOf(`stand`, `happy`, `stick`, `left`));
  const right = figureShapes(figureOf(`stand`, `happy`, `stick`, `right`));
  assert.equal(left.length, front.length + 1, `un nez de plus`);
  assert.notDeepEqual(left.map((s) => s.d), right.map((s) => s.d));
  assert.notDeepEqual(left.map((s) => s.d), front.map((s) => s.d));
  const patched = applyStyle(figureElement(`stand`, `happy`, `stick`, `front`, [100, 100], 100, look, `a`), { figureLook: `left` }) as IconElement;
  assert.equal(patched.figure?.look, `left`);
  assert.equal(readFigure({ ...figureOf(`stand`, `happy`, `stick`), look: `haut` }), null);
  const old = figureOf(`stand`, `happy`, `stick`) as unknown as Record<string, unknown>;
  delete old.look;
  assert.equal(readFigure(old)?.look, `front`);
});
