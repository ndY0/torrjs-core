import { promisify, cure, memo, putMemoValue } from "../utils";
import { TransportEmitter } from "../transports/interface";

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
  emitter: TransportEmitter,
  timeout: number | Promise<any> = 5_000
): AsyncGenerator<void, Treturn, any> {
  const canceler = memo(true);
  return await Promise.race([
    promisify<Treturn>(
      cure(emitter.once, emitter)({ event, canceler }),
      emitter
    ),
    typeof timeout === "number"
      ? new Promise<void>((resolve) => {
          setTimeout(() => (putMemoValue(canceler, false), resolve()), timeout);
        })
      : timeout.then((data) => (putMemoValue(canceler, false), data)),
  ]);
}
async function* takeAny<Treturn>(
  event: string,
  emitters: TransportEmitter[],
  timeout: number | Promise<any> = 5_000
) {
  const canceler = memo(true);
  return await Promise.race<Promise<Treturn>>([
    ...emitters.map((emitter) =>
      promisify<Treturn>(
        cure(emitter.once, emitter)({ event, canceler }),
        emitter
      )
    ),
    typeof timeout === "number"
      ? new Promise<void>((resolve) => {
          setTimeout(() => (putMemoValue(canceler, false), resolve()), timeout);
        })
      : timeout.then((data) => (putMemoValue(canceler, false), data)),
  ]).then((data) => (putMemoValue(canceler, false), data));
}

export { call, take, takeAny, cast, run };
