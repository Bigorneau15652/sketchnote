// Undo and redo: a bounded list of earlier states and a list of undone states. States are never changed, only stored and returned.
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private readonly limit: number;

  // Creates a history that keeps at most `limit` earlier states.
  constructor(limit = 200) {
    this.limit = limit;
  }

  // Records the state as it was before a change. A new change makes the undone states unreachable.
  push(state: T): void {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  // Tells whether there is a change to undo.
  canUndo(): boolean {
    return this.past.length > 0;
  }

  // Tells whether there is an undone change to redo.
  canRedo(): boolean {
    return this.future.length > 0;
  }

  // Returns the previous state and keeps the current one for redo, or returns null when there is nothing to undo.
  undo(current: T): T | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(current);
    return previous;
  }

  // Returns the state that was undone and keeps the current one for undo, or returns null when there is nothing to redo.
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }

  // Forgets everything (used when the file is loaded again).
  clear(): void {
    this.past = [];
    this.future = [];
  }
}
