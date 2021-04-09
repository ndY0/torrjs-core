import { run, call, cast, take } from ".";
import { InMemoryEmitter } from "../transports/in-memory-emitter";

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
      new Promise<void>((resolve) =>
        setTimeout(() => {
          emitter.emit({ event: "test" }, { value: "test" });
          resolve();
        }, 200)
      ),
    ]);
  });
});
