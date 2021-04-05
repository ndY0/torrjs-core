import { nextTick } from "process";

async function promisify<Treturn>(
  fn: (callback: (...result: [Treturn]) => void) => void,
  context: any = null
): Promise<Treturn> {
  return new Promise(
    (resolve: (res: Treturn) => void, reject: (err: Error) => void) => {
      fn.bind(context)((...result: [Treturn]) => {
        resolve(...result);
      });
    }
  );
}

function cure<Tfirst, Trest, Treturn>(
  fn: (...args: [Tfirst, ...Trest[]]) => Treturn,
  context: any = null
): (first: Tfirst) => (...args: Trest[]) => Treturn {
  return (first: Tfirst) => (...args: Trest[]) =>
    fn.call(context, first, ...args);
}

async function tail<T>(
  iterator: AsyncGenerator<T, void, T | undefined>,
  acc: T | undefined = undefined
): Promise<void> {
  if (!acc) {
    await iterator.next(acc);
  }
  const step = await iterator.next(acc);
  if (!step.done) {
    return tail(iterator, step.value);
  }
}

async function loopPromise<T>(
  executor: (arg: T) => Promise<T | boolean>,
  startArg: T
) {
  let next: T | boolean;
  next = await executor(startArg);
  while (typeof next !== "boolean") {
    next = await executor(next);
  }
}

export { promisify, cure, tail, loopPromise };
