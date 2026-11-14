// Small helpers that build SVG elements with the DOM (never from a text), so that no markup string is ever parsed.
const NS = `http://www.w3.org/2000/svg`;

// Creates an SVG element with the given attributes. Attribute values are set as plain text.
export function svgEl(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  if (parent) parent.appendChild(el);
  return el as SVGElement;
}
