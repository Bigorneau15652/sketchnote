// Pure operations on a whole document: applying new page settings and a new structure together.
import type { SketchnoteDoc, PageSettings } from "./file-format";
import { buildStructure, LayoutSettings, sameLayout } from "./layout";

// Returns the document with new page settings and a new structure (or none).
// The elements of the structure (group `structure`) are made again when the structure or the page size changes, and removed when the structure is removed.
// They are drawn first, so they stay behind the contents. When only the default ink changes, the structure elements that had the old ink take the new one.
// Every other element is kept as it is.
export function applySettings(doc: SketchnoteDoc, page: PageSettings, layout: LayoutSettings | null): SketchnoteDoc {
  const own = doc.elements.filter((e) => e.group !== `structure`);
  if (layout === null) return { ...doc, page, layout: null, elements: own };
  const sizeChanged = page.width !== doc.page.width || page.height !== doc.page.height;
  if (sizeChanged || !sameLayout(doc.layout, layout)) {
    return { ...doc, page, layout, elements: [...buildStructure(layout, page).elements, ...own] };
  }
  if (page.ink !== doc.page.ink) {
    const elements = doc.elements.map((e) => (e.group === `structure` && e.stroke === doc.page.ink ? { ...e, stroke: page.ink } : e));
    return { ...doc, page, layout, elements };
  }
  return { ...doc, page, layout };
}
