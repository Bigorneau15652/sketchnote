import { test } from "node:test";
import assert from "node:assert/strict";
import { backdropOpacity, BACKDROP_MAX_FADE, cleanBackdrop, DEFAULT_BACKDROP, pageToDrawing } from "../src/backdrop";

test(`l'estompage donne l'opacite des autres dessins, bornee, et une valeur fausse donne la valeur usuelle`, () => {
  assert.equal(backdropOpacity(0), 1);
  assert.equal(backdropOpacity(60), 0.4);
  assert.equal(backdropOpacity(BACKDROP_MAX_FADE), 0.1);
  assert.equal(backdropOpacity(500), 0.1, `jamais invisible`);
  assert.equal(backdropOpacity(-5), 1);
  assert.deepEqual(cleanBackdrop({}), DEFAULT_BACKDROP);
  assert.deepEqual(cleanBackdrop({ others: true, fade: 33.4 }), { others: true, fade: 33 });
  assert.deepEqual(cleanBackdrop({ others: true, fade: Number.NaN }), { others: true, fade: DEFAULT_BACKDROP.fade });
  assert.deepEqual(cleanBackdrop({ others: `oui` as unknown as boolean, fade: 999 }), { others: false, fade: BACKDROP_MAX_FADE });
});

test(`la page est portee dans le dessin : la zone du dessin se superpose a son guide`, () => {
  const t = pageToDrawing({ x: 100, y: 50, w: 300, h: 200 }, { x: 1200, y: 800, w: 600, h: 400 });
  assert.equal(t, `translate(1200 800) scale(2) translate(-100 -50)`);
  // The corner of the zone goes onto the corner of the guide, and a point of the zone far away is at twice the distance.
  const apply = (x: number, y: number): [number, number] => [1200 + (x - 100) * 2, 800 + (y - 50) * 2];
  assert.deepEqual(apply(100, 50), [1200, 800]);
  assert.deepEqual(apply(500, 50), [2000, 800]);
  assert.equal(pageToDrawing({ x: 0, y: 0, w: 0, h: 10 }, { x: 0, y: 0, w: 5, h: 5 }), null);
  assert.equal(pageToDrawing({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 5 }), null);
  assert.equal(pageToDrawing({ x: Number.NaN, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 5, h: 5 }), null);
});
