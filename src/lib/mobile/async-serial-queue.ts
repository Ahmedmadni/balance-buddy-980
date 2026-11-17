/**
 * Serialize side effects that mutate the same Android OS resources.
 * A failed task must not poison the queue and block later cleanup.
 */
export function createAsyncSerialQueue() {
  let tail: Promise<void> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
