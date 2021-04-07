import { promisify, cure } from "../utils";
import { time } from "console";

async function run<Treturn, Tyield>(
  fn: (...args: any[]) => AsyncGenerator<Tyield, Treturn, any>,
  ...args: any[]
): Promise<Treturn> {
  const iterable = fn(...args);
  let state: IteratorResult<Tyield, Treturn>;
  do {
    state = await iterable.next();
  } while (!state.done);
  return state.value;
}

async function* call<Treturn, Tyield>(
  fn: (...args: any[]) => AsyncGenerator<Tyield, Treturn, any>,
  ...args: any[]
): AsyncGenerator<Tyield, Treturn, any> {
  const result = await run(fn, ...args);
  return result;
}

function* cast(
  fn: (...args: any[]) => AsyncGenerator<any, any, any>,
  ...args: any[]
): Generator<null, null, any> {
  run(fn, ...args);
  return null;
}

async function* take<Treturn>(
  event: string,
  emitter: NodeJS.EventEmitter,
  timeout: number | Promise<any> = Infinity
): AsyncGenerator<void, Treturn, any> {
  return await Promise.race([
    promisify<Treturn>(cure(emitter.once, emitter)(event), emitter),
    typeof timeout === "number"
      ? new Promise((resolve) => {
          setTimeout(() => resolve(), timeout);
        })
      : timeout,
  ]);
}

export { call, take, cast };
