import { call, take, cast } from "./effects";
import EventEmitter from "events";

const run = async function* (): AsyncGenerator {
  const emitter = new EventEmitter({ captureRejections: true });
  const testCall = yield* call<string, number>(
    async function* (one, two, tree) {
      yield one;
      yield await new Promise((resolve) =>
        setTimeout(() => resolve(two), 2000)
      );
      return "blue";
    },
    1,
    2,
    3
  );
  console.log("testCall", testCall);
  setTimeout(() => emitter.emit("test", "lol"), 2000);
  const testTake = yield* take<string>("test", emitter);
  console.log("testTake", testTake);
  console.log("testCast, should print before saga resolution");
  const test = yield* cast(async function* () {
    const value: string = await new Promise((resolve) =>
      setTimeout(() => resolve("printed later"), 2000)
    );
    console.log(value);
  });
  console.log("end of execution", test);

  await new Promise((resolve) => setTimeout(() => resolve(null), 3000));
};
// test of supervisor restart and error handling
tail(run());
