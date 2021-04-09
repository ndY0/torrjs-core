import EventEmitter from "events";
import { ChildRestartStrategy, ChildSpec } from "../supervision/types";

async function promisify<Treturn>(
  fn: (callback: (...result: [Treturn]) => void) => void,
  context?: any
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
  canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
  acc: T | undefined = undefined
): Promise<void> {
  if (await getMemoValue(canceler)) {
    if (!acc) {
      await iterator.next(acc);
    }
    const step = await iterator.next(acc);
    if (!step.done) {
      return tail(iterator, canceler, step.value);
    }
  }
}

async function getMemoPromise<T>(
  memo: AsyncGenerator<[T, EventEmitter], never, T>
) {
  const {
    value: [_, emitter],
  } = await memo.next();
  return promisify<T>(cure(emitter.once, emitter)("updated"), emitter);
}

async function getMemoValue<T>(
  memo: AsyncGenerator<[T, EventEmitter], never, T>
) {
  const {
    value: [memoized, _],
  } = await memo.next();
  return memoized;
}

async function putMemoValue<T>(
  memo: AsyncGenerator<[T, EventEmitter], never, T>,
  value: T
) {
  await memo.next(value);
}

async function* memo<T>(
  initialState: T
): AsyncGenerator<[T, EventEmitter], never, T> {
  let state: T = initialState;
  const emitter = new EventEmitter();
  while (true) {
    const passed = yield [state, emitter];
    if (passed !== undefined) {
      state = passed;
      emitter.emit("updated", state);
    }
  }
}

async function promisifyAsyncGenerator<T>(
  generator: AsyncGenerator<T, T, unknown>
) {
  let isDone;
  let result: T;
  do {
    const { done, value } = await generator.next();
    isDone = done;
    result = value;
  } while (!isDone);
  return result;
}

async function loopWorker(
  factory: () => Promise<any>,
  spec: ChildSpec,
  canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>
): Promise<void> {
  try {
    if (await getMemoValue(canceler)) {
      await factory();
      if (spec.restart === ChildRestartStrategy.PERMANENT) {
        return loopWorker(factory, spec, canceler);
      }
    }
  } catch (_e) {
    if (
      spec.restart === ChildRestartStrategy.TRANSIENT ||
      spec.restart === ChildRestartStrategy.PERMANENT
    ) {
      return loopWorker(factory, spec, canceler);
    }
  }
}

export {
  promisify,
  cure,
  tail,
  memo,
  getMemoPromise,
  getMemoValue,
  putMemoValue,
  promisifyAsyncGenerator,
  loopWorker,
};
