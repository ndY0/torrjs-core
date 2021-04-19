import EventEmitter from "events";
import { ChildRestartStrategy, ChildSpec } from "../supervision/types";

async function promisify<Treturn>(
  fn: (callback: (...result: [Treturn]) => void) => void,
  context?: any
): Promise<Treturn> {
  return new Promise((resolve: (res: Treturn) => void) => {
    fn.bind(context)((...result: [Treturn]) => {
      resolve(...result);
    });
  });
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
  canceler: Generator<[boolean, EventEmitter], never, boolean>,
  acc: T,
  stopCondition?: (state: T) => boolean
): Promise<T | undefined> {
  const iterator = factory(acc);
  if (getMemoValue(canceler)) {
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

function getMemoPromise<T>(memo: Generator<[T, EventEmitter], never, T>) {
  const {
    value: [_, emitter],
  } = memo.next();
  return promisify<T>(cure(emitter.once, emitter)("updated"), emitter);
}

function getMemoValue<T>(memo: Generator<[T, EventEmitter], never, T>) {
  const {
    value: [memoized, _],
  } = memo.next();
  return memoized;
}

function putMemoValue<T>(
  memo: Generator<[T, EventEmitter], never, T>,
  value: T
) {
  memo.next(value);
}

function combineMemos<T, U>(
  mergeFunction: (...states: T[]) => U,
  ...memos: Generator<[T, EventEmitter], never, T>[]
): Generator<[U, EventEmitter], never, T> {
  const generator: Generator<[U, EventEmitter], never, T> = <any>(function* () {
    let state: U = mergeFunction(
      ...memos
        .map((memo) => memo.next())
        .map(({ value: [memoized, _] }) => memoized)
    );
    let shouldEmit: boolean = true;
    const memosLength: number = memos.length - 1;
    let currentMemoCount: number = 0;
    const emitter = new EventEmitter();
    const innerEmittersRef = memos
      .map((memo) => memo.next())
      .map(({ value: [_, innerEmitter] }) => innerEmitter);
    let innerStates: T[] = [];
    innerEmittersRef.forEach((innerEmitter, position) => {
      innerEmitter.on("updated", (data: T) => {
        innerStates[position] = data;
        if (shouldEmit) {
          currentMemoCount = 0;
          state = mergeFunction(...innerStates);
          emitter.emit("updated", state);
        } else {
          currentMemoCount += 1;
          if (currentMemoCount === memosLength) {
            shouldEmit = true;
            currentMemoCount = 0;
          }
        }
      });
    });
    while (true) {
      const passed: T | undefined = yield [state, emitter];
      if (passed !== undefined) {
        shouldEmit = false;
        innerStates = memos
          .map((memo) => memo.next(passed))
          .map(({ value: [memoized, _] }) => memoized);
        state = mergeFunction(...innerStates);
        emitter.emit("updated", state);
      } else {
        innerStates = memos
          .map((memo) => memo.next())
          .map(({ value: [memoized, _] }) => memoized);
      }
    }
  })();
  generator.next();
  return generator;
}

function memo<T>(initialState: T): Generator<[T, EventEmitter], never, T> {
  const generator = (function* (
    initialState: T
  ): Generator<[T, EventEmitter], never, T> {
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
  canceler: Generator<[boolean, EventEmitter], never, boolean>,
  [supervized, index]: [
    {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    number
  ]
): Promise<void> {
  try {
    if (getMemoValue(canceler)) {
      await factory();
      if (spec.restart === ChildRestartStrategy.PERMANENT) {
        return loopWorker(factory, spec, canceler, [supervized, index]);
      }
      supervized[index].id = null;
    }
    supervized[index].id = null;
  } catch (_e) {
    if (getMemoValue(canceler)) {
      if (
        spec.restart === ChildRestartStrategy.TRANSIENT ||
        spec.restart === ChildRestartStrategy.PERMANENT
      ) {
        return loopWorker(factory, spec, canceler, [supervized, index]);
      }
      supervized[index].id = null;
    }
    supervized[index].id = null;
  }
}

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

function mutateArray(original: any[], replace: any[]) {
  original.splice(0, original.length, ...replace);
  return original;
}

export {
  promisify,
  cure,
  tail,
  memo,
  combineMemos,
  getMemoPromise,
  getMemoValue,
  putMemoValue,
  promisifyAsyncGenerator,
  loopWorker,
  delay,
  mutateArray,
};
