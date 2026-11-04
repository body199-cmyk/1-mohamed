import { reduceEntry } from "../src/entry-state";
import type { EntryAction, EntryState } from "../src/entry-types";

export function applyActions(
  initial: EntryState,
  actions: readonly EntryAction[]
): EntryState {
  let current = initial;
  for (const action of actions) {
    const res = reduceEntry(current, action);
    if (!res.ok) {
      throw new Error(`Unexpected transition error: ${res.error.code}`);
    }
    current = res.state;
  }
  return current;
}
