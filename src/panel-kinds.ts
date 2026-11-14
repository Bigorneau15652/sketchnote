// Which sections of the properties panel concern what the user is working on. The panel follows the selection (or the tool when nothing is selected): a line has no
// fill, a shape has no heads, a text has a font. No dependency on Obsidian: tested without the application.
import type { SketchElement } from "./elements";

export type PanelSection = `colour` | `fill` | `width` | `dash` | `look` | `border` | `corners` | `edges` | `taper` | `heads` | `text` | `effects`;

// Returns the kinds of element the panel is about: the types of the selected elements, or the kind that the active tool is going to make when nothing is selected. A line
// about to be drawn is `new-line`: its heads are not offered (a line becomes an arrow once a head is chosen, after it is drawn). The tools that do not make an element
// (Select and Hand) give no kind.
export function panelKinds(tool: string, selected: SketchElement[]): Set<string> {
  if (tool !== `select` && tool !== `hand`) {
    const made: Record<string, string> = { line: `new-line`, pen: `freedraw`, point: `new-point` };
    return new Set([made[tool] ?? tool]);
  }
  // A shape or a line that has a text written in it also gets the settings of a text.
  return new Set(selected.flatMap((e) => ((e.type === `rect` || e.type === `ellipse` || e.type === `diamond` || e.type === `triangle` || e.type === `line` || e.type === `arrow`) && e.label ? [e.type, `text`] : [e.type])));
}

const SHAPES = [`rect`, `diamond`, `ellipse`, `triangle`];
const STROKED = [...SHAPES, `line`, `arrow`, `freedraw`, `new-line`, `new-point`];

// Tells whether a section of the panel is shown for some kinds of element. With no kind at all (nothing selected, no drawing tool) the panel shows the general choices
// that the next elements will take: colour, width and style.
export function sectionShown(section: PanelSection, kinds: Set<string>): boolean {
  const some = (list: string[]): boolean => [...kinds].some((k) => list.includes(k));
  switch (section) {
    case `colour`:
      return kinds.size === 0 || [...kinds].some((k) => k !== `drawing`);
    case `fill`:
      return some(SHAPES);
    case `width`:
    case `look`:
      return kinds.size === 0 || some(STROKED);
    case `dash`:
      return some([...SHAPES, `line`, `arrow`, `new-line`]);
    case `border`:
      return some(SHAPES);
    case `corners`:
      return some([`rect`]);
    case `effects`:
      return kinds.size === 0 ? false : [...kinds].some((k) => k !== `drawing`);
    case `edges`:
      return some([`line`, `arrow`, `new-line`]);
    case `taper`:
      return some([`line`, `arrow`, `new-line`]);
    case `heads`:
      return some([`line`, `arrow`]);
    case `text`:
      return kinds.has(`text`);
  }
}
