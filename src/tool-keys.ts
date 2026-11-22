// The keys that choose a tool with one press (G for the eraser, P for the pen...). Each tool has one key; two tools never share a key. The user can change them in the settings.
// Pure module: no page, no application.
export const KEY_TOOLS = [`select`, `hand`, `rect`, `diamond`, `ellipse`, `triangle`, `bubble`, `festoon`, `arrow`, `line`, `pen`, `point`, `eraser`, `text`] as const;
export type KeyTool = (typeof KEY_TOOLS)[number];

export type ToolKeys = Record<KeyTool, string>;

// The keys that come with the plugin.
export const DEFAULT_TOOL_KEYS: ToolKeys = {
  select: `v`,
  hand: `h`,
  rect: `c`,
  diamond: `l`,
  ellipse: `r`,
  triangle: `m`,
  bubble: `b`,
  festoon: `n`,
  arrow: `f`,
  line: `t`,
  pen: `p`,
  point: `.`,
  eraser: `g`,
  text: `x`,
};

export function isKeyTool(value: unknown): value is KeyTool {
  return typeof value === `string` && (KEY_TOOLS as readonly string[]).includes(value);
}

// Returns a key in its clean form (one visible character, in lower case), or null when it cannot be a key of a tool.
export function cleanKey(value: unknown): string | null {
  if (typeof value !== `string`) return null;
  const chars = Array.from(value.trim().toLowerCase());
  if (chars.length !== 1 || /\s/.test(chars[0]) || chars[0].charCodeAt(0) < 33) return null;
  return chars[0];
}

// Reads the saved keys: a key that is wrong or already taken by an earlier tool gives the key that comes with the plugin, unless that one is taken too (then the tool has none free and
// takes the first free default).
export function readToolKeys(raw: unknown): ToolKeys {
  const source = typeof raw === `object` && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: Partial<ToolKeys> = {};
  const used = new Set<string>();
  for (const tool of KEY_TOOLS) {
    const key = cleanKey(source[tool]);
    if (key !== null && !used.has(key)) {
      out[tool] = key;
      used.add(key);
    }
  }
  for (const tool of KEY_TOOLS) {
    if (out[tool] !== undefined) continue;
    const key = DEFAULT_TOOL_KEYS[tool];
    if (!used.has(key)) {
      out[tool] = key;
      used.add(key);
    }
  }
  // A tool that still has no key (its default is taken by another tool) takes the first free letter.
  for (const tool of KEY_TOOLS) {
    if (out[tool] !== undefined) continue;
    const free = `abcdefghijklmnopqrstuvwxyz0123456789`.split(``).find((c) => !used.has(c)) ?? `?`;
    out[tool] = free;
    used.add(free);
  }
  return out as ToolKeys;
}

// Gives a key to a tool. Returns the new keys, or the tool that already has this key (the change is then refused).
export function setToolKey(keys: ToolKeys, tool: KeyTool, value: unknown): { keys: ToolKeys } | { taken: KeyTool } | { invalid: true } {
  const key = cleanKey(value);
  if (key === null) return { invalid: true };
  const other = KEY_TOOLS.find((t) => t !== tool && keys[t] === key);
  if (other) return { taken: other };
  return { keys: { ...keys, [tool]: key } };
}

// The table that the keyboard uses: a key and the tool it chooses.
export function keyTable(keys: ToolKeys): Record<string, KeyTool> {
  const table: Record<string, KeyTool> = {};
  for (const tool of KEY_TOOLS) table[keys[tool]] = tool;
  return table;
}
