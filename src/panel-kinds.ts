// Which sections of the properties panel concern what the user is working on. The panel follows the selection (or the tool when nothing is selected): a line has no
// fill, a shape has no heads, a text has a font. No dependency on Obsidian: tested without the application.
import { isClosedLine } from "./elements";
import { isBubbleForm } from "./shape-forms";
import type { SketchElement } from "./elements";
import { isClosedStroke } from "./tidy";

export type PanelSection = `colour` | `fill` | `width` | `dash` | `look` | `border` | `corners` | `edges` | `taper` | `regularity` | `brush` | `warp` | `icon` | `image` | `heads` | `text` | `effects` | `organise` | `display` | `bubbleform` | `festoonform` | `eraser` | `stamp` | `transparency` | `shortcuts`;

// Returns the kinds of element the panel is about: the types of the selected elements, or the kind that the active tool is going to make when nothing is selected. A line
// about to be drawn is `new-line`: its heads are not offered (a line becomes an arrow once a head is chosen, after it is drawn). The tools that do not make an element
// (Select and Hand) give no kind.
export function panelKinds(tool: string, selected: SketchElement[]): Set<string> {
  if (tool !== `select` && tool !== `hand`) {
    // With the pen, the strokes that were just drawn are selected: the panel then shows what they can have (a closed stroke has a fill).
    const strokes = tool === `pen` ? selected.filter((e) => e.type === `freedraw`) : [];
    if (strokes.length > 0) return kindsOf(strokes);
    const made: Record<string, string> = { line: `new-line`, pen: `freedraw`, point: `new-point` };
    return new Set([made[tool] ?? tool]);
  }
  return kindsOf(selected);
}

// Returns the kinds of a list of elements. A shape or a line that has a text written in it also gets the settings of a text. A pen stroke that comes back to its start is a
// closed one: it can have a fill.
function kindsOf(elements: SketchElement[]): Set<string> {
  return new Set(
    elements.flatMap((e): string[] => {
      if (e.type === `freedraw`) return [isClosedStroke(e.points, e.strokeWidth) ? `freedraw-closed` : `freedraw`];
      // A text that is an element of its own (not a text written in a shape) can be distorted and written vertically.
      if (e.type === `text`) return [`text`, `free-text`];
      if (e.type === `icon`) return [`icon`];
      if (e.type === `image`) return [`image`];
      // A bubble or a festoon is a rectangle with a form: it has the settings of a shape, and the choice of its form instead of the corners.
      if (e.type === `rect` && e.form !== undefined) return e.label ? [isBubbleForm(e.form) ? `bubble` : `festoon`, `text`] : [isBubbleForm(e.form) ? `bubble` : `festoon`];
      const labelled = (e.type === `rect` || e.type === `ellipse` || e.type === `diamond` || e.type === `triangle` || e.type === `line` || e.type === `arrow`) && e.label;
      // A line that comes back to its start is a closed shape: it can have a fill.
      const closed = e.type === `line` && isClosedLine(e.points) ? [`line-closed`] : [];
      return labelled ? [e.type, `text`, ...closed] : [e.type, ...closed];
    }),
  );
}

const SHAPES = [`rect`, `diamond`, `ellipse`, `triangle`, `bubble`, `festoon`];
const PENS = [`freedraw`, `freedraw-closed`];
const STROKED = [...SHAPES, `line`, `arrow`, `icon`, `image`, ...PENS, `new-line`, `new-point`];

// Tells whether a section of the panel is shown for some kinds of element. With no kind at all (nothing selected, no drawing tool) the panel shows the general choices
// that the next elements will take: colour, width and style.
export function sectionShown(section: PanelSection, kinds: Set<string>): boolean {
  const some = (list: string[]): boolean => [...kinds].some((k) => list.includes(k));
  switch (section) {
    case `colour`:
      return kinds.size === 0 || [...kinds].some((k) => k !== `drawing`);
    case `fill`:
      return some([...SHAPES, `freedraw-closed`, `line-closed`, `icon`]);
    case `width`:
      return kinds.size === 0 || some(STROKED);
    case `look`:
      return kinds.size === 0 || some(STROKED.filter((k) => !PENS.includes(k)));
    case `regularity`:
    case `brush`:
      return some(PENS);
    case `dash`:
      return some([...SHAPES, `image`, `line`, `arrow`, `new-line`]);
    case `border`:
      return some([...SHAPES, `image`]);
    case `corners`:
      return some([`rect`, `image`]);
    case `transparency`:
      return kinds.size > 0 && [...kinds].some((k) => k !== `drawing` && k !== `text` && k !== `eraser` && k !== `new-point`);
    case `effects`:
      return kinds.size === 0 ? false : [...kinds].some((k) => k !== `drawing`);
    case `edges`:
      return some([`line`, `arrow`, `new-line`]);
    case `taper`:
      return some([`line`, `arrow`, `new-line`]);
    case `heads`:
      return some([`line`, `arrow`]);
    case `eraser`:
      return kinds.has(`eraser`);
    case `stamp`:
      return kinds.has(`new-point`);
    case `bubbleform`:
      return kinds.has(`bubble`);
    case `festoonform`:
      return kinds.has(`festoon`);
    case `text`:
      return kinds.has(`text`);
    case `warp`:
      return kinds.has(`free-text`);
    case `icon`:
      return kinds.has(`icon`);
    case `image`:
      return kinds.has(`image`);
    // What acts on the selection and the display do not depend on the kind of element: the function that shows them decides.
    case `organise`:
    case `display`:
    case `shortcuts`:
      return true;
  }
}
