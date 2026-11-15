// Where the pictures of the vault are found: the plugin gives a function that turns the path of a picture into the address that the page can show (or nothing when the file does
// not exist). The renderer only knows this function, so that it never reads the vault itself. Pure module.
let resolver: (path: string) => string | null = () => null;

// Sets the function that finds the address of a picture of the vault.
export function setImageResolver(fn: (path: string) => string | null): void {
  resolver = fn;
}

// Returns the address that shows a picture of the vault, or null when the file does not exist. A function that fails gives null.
export function imageUrl(path: string): string | null {
  try {
    const url = resolver(path);
    return typeof url === `string` && url !== `` ? url : null;
  } catch {
    return null;
  }
}
