import {
  promisify,
  cure,
  tail,
  memo,
  getMemoValue,
  getMemoPromise,
  putMemoValue,
  promisifyAsyncGenerator,
  loopWorker,
  delay,
} from ".";
import { ChildRestartStrategy } from "../supervision/types";

describe("promisify", () => {
  it("should return a promise which resolve when the given callback is called", async () => {
    const testCallback = (callback: (val: any) => void) => {
      setTimeout(() => callback(true), 200);
    };
    const promisifyReturn = promisify<any>(testCallback);
    expect(promisifyReturn).toBeInstanceOf(Promise);
    const result = await promisifyReturn;
    expect(result).toEqual(true);
  });
  it("should accept a context to bind to the function", async () => {
    const testCallback = {
      test: (callback: (val: any) => void) => {
        setTimeout(() => callback(true), 200);
      },
    };
    const promisifyReturn = promisify<any>(testCallback.test, testCallback);
    expect(promisifyReturn).toBeInstanceOf(Promise);
    const result = await promisifyReturn;
    expect(result).toEqual(true);
  });
});

describe("cure", () => {
  it("should cure the function first argument into an higher order function", () => {
    const toCure = (arg1: any, arg2: any) => {
      return `${arg1}, ${arg2}`;
    };
    const cured = cure(toCure);
    expect(cured("Jane")("Jeannot")).toEqual(toCure("Jane", "Jeannot"));
  });
});

describe("tail", () => {
  it("should call next on given async iterator, without memory exhaustion (tail call), passing the yielded value", async () => {
    const outterCount = { counter: 0 };
    const canceler = memo(true);
    const longRunningIterator = async function* (count: {
      counter: number;
    }): AsyncGenerator<
      never,
      { counter: number },
      { counter: number } | undefined
    > {
      count.counter += 1;
      return count;
    };
    await tail(
      (counter) => longRunningIterator(counter),
      canceler,
      outterCount,
      (counter) => counter.counter > 50_000
    );
    expect(outterCount.counter).toBeGreaterThanOrEqual(50_000);
  });
  it("should stop recursion if the memo iterator returns an falsy value", async () => {
    const outterCount = { counter: 0 };
    const canceler = memo(true);
    const longRunningIterator = async function* (count: {
      counter: number;
    }): AsyncGenerator<
      never,
      { counter: number },
      { counter: number } | undefined
    > {
      count.counter += 1;
      return count;
    };
    await Promise.all([
      tail(
        (counter) => longRunningIterator(counter),
        canceler,
        outterCount,
        (counter) => counter.counter > 50_000
      ),
      new Promise<void>((resolve) => {
        canceler.next(false);
        resolve();
      }),
    ]);
    expect(outterCount.counter).toBeLessThanOrEqual(50000);
  });
});

describe("memo", () => {
  it("should retain a value, give it back on empty next call alongside an eventEmitter wich will emit on next change, and change it on none empty next call", async () => {
    const memoGenerator = memo({ test: "Jane" });
    const {
      value: [retainedValue, promise],
    } = await memoGenerator.next();
    promise.once("updated", (val) => expect(val).toEqual({ test: "Jeannot" }));
    expect(retainedValue).toEqual({ test: "Jane" });
    const {
      value: [retainedValue2],
    } = await memoGenerator.next();
    expect(retainedValue2).toEqual({ test: "Jane" });
    await memoGenerator.next({ test: "Jeannot" });
    const {
      value: [retainedValue3],
    } = await memoGenerator.next();
    expect(retainedValue3).toEqual({ test: "Jeannot" });
    const {
      value: [retainedValue4],
    } = await memoGenerator.next();
    expect(retainedValue4).toEqual({ test: "Jeannot" });
  });
});

describe("getMemoValue", () => {
  it("should return the stored value in a memo Generator", async () => {
    const testValue = "test";
    const memorized = memo(testValue);
    expect(await getMemoValue(memorized)).toEqual(testValue);
  });
});

describe("getMemoPromise", () => {
  it("should return a promise which will resolve when the stored value in a memo Generator changes", async () => {
    const testValue = "test";
    const nextValue = "changed";
    const memorized = memo(testValue);
    const valueChangePromise = getMemoPromise(memorized);
    valueChangePromise.then((value) => expect(value).toEqual(nextValue));
    await memorized.next(nextValue);
  });
});

describe("putMemoValue", () => {
  it("should mutate the stored value in a memo Generator", async () => {
    const testValue = "test";
    const nextValue = "changed";
    const memorized = memo(testValue);
    const {
      value: [retainedValue],
    } = await memorized.next();
    expect(retainedValue).toEqual(testValue);
    await putMemoValue(memorized, nextValue);
    const {
      value: [retainedValue2],
    } = await memorized.next();
    expect(retainedValue2).toEqual(nextValue);
  });
});

describe("promisifyAsyncGenerator", () => {
  it("should wrap the execution of an async generator in an async function", async () => {
    const testGenerator = async function* () {
      let count = 0;
      while (count < 100) {
        count = await new Promise<number>((resolve) =>
          setTimeout(() => resolve(count + 1), 1)
        );
        yield count;
      }
      return count;
    };
    const result = await promisifyAsyncGenerator<number>(testGenerator());
    expect(result).toEqual(100);
  });
});

describe("loopWorker", () => {
  it("should await a promise generated by the provided factory, and restart it at normal termination for the permanent restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.PERMANENT },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toBeGreaterThan(1);
  });
  it("should await a promise generated by the provided factory, and restart it at exception termination for the permanent restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      throw new Error("oups ...");
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.PERMANENT },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toBeGreaterThan(1);
  });
  it("should await a promise generated by the provided factory, and not restart it at normal termination for the transient restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.TRANSIENT },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toEqual(1);
  });
  it("should await a promise generated by the provided factory, and restart it only at exception termination for the transient restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      if (restartCount < 2) {
        throw new Error("oups ...");
      }
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.TRANSIENT },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toEqual(2);
  });
  it("should await a promise generated by the provided factory, and not restart it at normal termination for the temporary restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.TEMPORARY },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toEqual(1);
  });
  it("should await a promise generated by the provided factory, and not restart it at exception termination for the temporary restart strategy", async () => {
    let restartCount = 0;
    const canceler = memo(true);
    const factory = async () => {
      restartCount += 1;
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      throw new Error("oups ...");
    };
    await Promise.race([
      loopWorker(
        factory,
        { restart: ChildRestartStrategy.TEMPORARY },
        canceler
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 200)),
    ]);
    await putMemoValue(canceler, false);
    expect(restartCount).toEqual(1);
  });
});
describe("delay", () => {
  it("should delay further execution by given milliseconds", async () => {
    const before = new Date().getTime();
    await delay(300);
    const after = new Date().getTime();
    expect(after - before).toBeGreaterThanOrEqual(300);
  });
});
