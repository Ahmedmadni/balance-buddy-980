// Concurrency gate for the diagnostics page (/app/system).
// Dozens of audits run at once; without a limit the browser hits
// ERR_INSUFFICIENT_RESOURCES. This queues them at a safe parallelism.
const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<() => void> = [];

function next() {
  if (active >= MAX_CONCURRENT) return;
  const job = queue.shift();
  if (!job) return;
  active++;
  job();
}

export function auditGate<T>(fn: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--;
          next();
        });
    });
    next();
  });
}
