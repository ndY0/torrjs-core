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
  factory: (acc: T) => AsyncGenerator<any, T, T | undefined>,
  canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
  acc: T,
  stopCondition?: (state: T) => boolean
): Promise<T | undefined> {
  const iterator = factory(acc);
  if (await getMemoValue(canceler)) {
    let done;
    let res: T = acc;
    while (!done) {
      const step = await iterator.next();
      done = step.done;
      res = step.value;
    }
    if (stopCondition && stopCondition(res)) {
      return res;
    } else {
      return tail(factory, canceler, res, stopCondition);
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

function memo<T>(initialState: T): AsyncGenerator<[T, EventEmitter], never, T> {
  const generator = (async function* (
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
  })(initialState);
  generator.next();
  return generator;
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
    if (await getMemoValue(canceler)) {
      if (
        spec.restart === ChildRestartStrategy.TRANSIENT ||
        spec.restart === ChildRestartStrategy.PERMANENT
      ) {
        return loopWorker(factory, spec, canceler);
      }
    }
  }
}

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
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
  delay,
};
