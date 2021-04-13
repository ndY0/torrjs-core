import "reflect-metadata";
import { run, call, cast, take } from ".";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import EventEmitter from "events";
import { getMemoPromise } from "../utils";

describe("run", () => {
  it("should iterable an async generator until it returns done, with given args, and return the result", async () => {
    const generator = async function* (test: number) {
      let count = test;
      let innnerCount = 0;
      while (innnerCount < 100) {
        yield count;
        count += 1;
        innnerCount += 1;
      }
      return count;
    };
    const res = await run(generator, 50);
    expect(res).toEqual(150);
  });
});

describe("call", () => {
  it("should wrap conveniently the run function in an async generator", async () => {
    const generator = async function* (test: number) {
      let count = test;
      let innnerCount = 0;
      while (innnerCount < 100) {
        yield count;
        count += 1;
        innnerCount += 1;
      }
      return count;
    };
    const res = await call(generator, 50).next();
    expect(res.value).toEqual(150);
  });
});

describe("cast", () => {
  it("should trigger the run function asynchronously", async () => {
    const generator = async function* (test: number) {
      let count = test;
      let innnerCount = 0;
      while (innnerCount < 100) {
        yield count;
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
        count += 1;
        innnerCount += 1;
      }
      expect(count).toEqual(150);
      return count;
    };
    const res = cast(generator, 50).next();
    expect(res.value).toBeNull();
  });
});

describe("take", () => {
  it("should await for an event to be triggerred by an event emitter, and return the event data", async () => {
    const emitter = new InMemoryEmitter(1);
    const computationResult = await Promise.all([
      take("test", emitter).next(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          emitter.emit({ event: "test" }, { value: "test" });
          resolve();
        }, 500);
      }).catch(console.log),
    ]);
    expect(computationResult[0].value).toEqual({ value: "test" });
  });
  it(`should await for an event to be triggerred by an event emitter,
  and return undefined if reaching provided promise timeout, triggering the cancel memo in the process`, async () => {
    const emitter = new InMemoryEmitter(1);
    const onceFunctionDescriptor = Reflect.getOwnPropertyDescriptor(
      emitter,
      "once"
    );
    let cancelerRef: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
    let cancelerPromise: Promise<boolean>;
    const proxy = (
      {
        timeout,
        event,
        canceler,
      }: {
        timeout?: number;
        event: string | symbol;
        canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
      },
      listener: (...args: any[]) => void
    ) => {
      cancelerRef = canceler;
      return onceFunctionDescriptor?.value(
        { timeout, event, canceler },
        listener
      );
    };
    Reflect.defineProperty(emitter, "once", {
      ...onceFunctionDescriptor,
      value: proxy,
    });
    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => resolve(), 500)
    );
    const computationResult = await Promise.all([
      take("test", emitter, timeout).next(),
      new Promise<void>((resolve) => {
        cancelerPromise = getMemoPromise(cancelerRef);
        cancelerPromise.then((value) => expect(value).toBeFalsy());
        setTimeout(() => {
          emitter.emit({ event: "test" }, { value: "test" });
          resolve();
        }, 2000);
      }),
    ]);
    expect(computationResult[0].value).toEqual(undefined);
  });
  it(`should await for an event to be triggerred by an event emitter,
  and return undefined if reaching default 5_000ms timeout, triggering the cancel memo in the process`, async () => {
    const emitter = new InMemoryEmitter(1);
    const onceFunctionDescriptor = Reflect.getOwnPropertyDescriptor(
      emitter,
      "once"
    );
    let cancelerRef: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
    let cancelerPromise: Promise<boolean>;
    const proxy = (
      {
        timeout,
        event,
        canceler,
      }: {
        timeout?: number;
        event: string | symbol;
        canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
      },
      listener: (...args: any[]) => void
    ) => {
      cancelerRef = canceler;
      return onceFunctionDescriptor?.value(
        { timeout, event, canceler },
        listener
      );
    };
    Reflect.defineProperty(emitter, "once", {
      ...onceFunctionDescriptor,
      value: proxy,
    });
    const computationResult = await Promise.all([
      take("test", emitter).next(),
      new Promise<void>((resolve) => {
        cancelerPromise = getMemoPromise(cancelerRef);
        cancelerPromise.then((value) => expect(value).toBeFalsy());
        setTimeout(() => {
          emitter.emit({ event: "test" }, { value: "test" });
          resolve();
        }, 6000);
      }).catch(console.log),
    ]);
    expect(computationResult[0].value).toEqual(undefined);
  });
});

describe("takeAny", () => {
  it("", async () => {});
});
