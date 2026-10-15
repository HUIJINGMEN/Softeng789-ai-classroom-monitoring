/** Fold resolved results into the next operation: versioned writes must never run in parallel. */
export async function runSequential<Item, State>(
  items: readonly Item[],
  initial: State,
  step: (current: State, item: Item, index: number) => State | Promise<State>,
): Promise<State> {
  if (items.length === 0) return initial;
  const [first, ...remaining] = items;
  const current = await step(initial, first, 0);
  return remaining.reduce<Promise<State>>(
    (pending, item, index) => pending.then(value => step(value, item, index + 1)),
    Promise.resolve(current),
  );
}
