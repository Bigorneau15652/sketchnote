// Finding a free place for a new file. The index of the vault does not always know every file of the disk (for example a file with an extension that the plugin has just
// registered, or one that a synchronisation has just copied), so a path that the index calls free can still be taken: the disk is asked as well. Pure module: what the disk
// answers is given by the caller.

// Returns the first path that is free on the disk. `next` gives a path that is not in the set of the paths found taken; `exists` asks the disk.
export async function firstFreePath(next: (taken: Set<string>) => string, exists: (path: string) => Promise<boolean>, limit = 200): Promise<string> {
  const taken = new Set<string>();
  for (let i = 0; i < limit; i++) {
    const path = next(taken);
    let found = false;
    try {
      found = await exists(path);
    } catch {
      found = false;
    }
    if (!found) return path;
    taken.add(path);
  }
  return next(taken);
}
