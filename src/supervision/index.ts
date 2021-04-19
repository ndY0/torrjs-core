import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./types";
import { GenServer } from "../interfaces/genserver";
import {
  memo,
  getMemoPromise,
  promisifyAsyncGenerator,
  loopWorker,
  putMemoValue,
  getMemoValue,
  combineMemos,
} from "../utils";
import EventEmitter from "events";

async function* supervise(
  children: [
    typeof GenServer,
    GenServer,
    ChildSpec,
    Generator<[boolean, EventEmitter], never, boolean>
  ][],
  strategy: RestartStrategy,
  upperCanceler: Generator<[boolean, EventEmitter], never, boolean>,
  upperCancelerPromise: Promise<boolean>
): AsyncGenerator<
  any,
  {
    childSpecs: [
      typeof GenServer,
      GenServer,
      ChildSpec,
      Generator<[boolean, EventEmitter], never, boolean>
    ][];
    strategy: RestartStrategy;
  },
  undefined
> {
  if (children.length === 0) {
    return { childSpecs: [], strategy };
  }
  const canceler = memo(true);
  const cancelerPromise = getMemoPromise(canceler);
  if (strategy === RestartStrategy.ONE_FOR_ALL) {
    const mappedChildren = children.map(
      ([Child, child, spec, individualCanceler]) =>
        (async () => {
          try {
            const combined = combineMemos(
              (...states: boolean[]) =>
                states.reduce((acc, curr) => acc && curr, true),
              canceler,
              individualCanceler
            );
            const combinedPromise = getMemoPromise(combined);
            await promisifyAsyncGenerator(
              child.start(
                spec.startArgs || [],
                Child,
                combined,
                Promise.race([upperCancelerPromise, combinedPromise])
              )
            );
            if (
              getMemoValue(upperCanceler) &&
              getMemoValue(individualCanceler)
            ) {
              return spec.restart === ChildRestartStrategy.PERMANENT
                ? [Child, child, spec, individualCanceler]
                : undefined;
            }
            return undefined;
          } catch (e) {
            if (
              getMemoValue(upperCanceler) &&
              getMemoValue(individualCanceler)
            ) {
              return spec.restart === ChildRestartStrategy.TRANSIENT ||
                spec.restart === ChildRestartStrategy.PERMANENT
                ? [Child, child, spec, individualCanceler]
                : undefined;
            }
            return undefined;
          }
        })()
    );
    await Promise.race(mappedChildren).then(() =>
      putMemoValue(canceler, false)
    );
    const result = await Promise.all(mappedChildren);
    return {
      childSpecs: result.filter((childState): childState is [
        typeof GenServer,
        GenServer,
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
      ] => {
        return childState instanceof Array;
      }),
      strategy,
    };
  } else if (strategy === RestartStrategy.ONE_FOR_ONE) {
    upperCancelerPromise.then((_value: boolean) =>
      putMemoValue(canceler, false)
    );
    await Promise.all(
      children.map(([Child, child, spec, individualCanceler]) => {
        const combined = combineMemos(
          (...states: boolean[]) =>
            states.reduce((acc, curr) => acc && curr, true),
          canceler,
          individualCanceler
        );
        const combinedPromise = getMemoPromise(combined);
        return loopWorker(
          () =>
            promisifyAsyncGenerator(
              child.start(
                spec.startArgs || [],
                Child,
                combined,
                Promise.race([upperCancelerPromise, combinedPromise])
              )
            ),
          spec,
          combined
        );
      })
    );
    return { childSpecs: [], strategy };
  } else {
    return { childSpecs: [], strategy };
  }
}

export { supervise };
