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
  mutateArray,
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
  upperCancelerPromise: Promise<boolean>,
  supervised: {
    id: string | null;
    canceler: Generator<[boolean, EventEmitter], never, boolean>;
  }[]
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
    supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[];
  },
  undefined
> {
  if (children.length === 0) {
    return { childSpecs: [], strategy, supervised: [] };
  }
  const canceler = memo(true);
  if (strategy === RestartStrategy.ONE_FOR_ALL) {
    const mappedChildren = children.map(
      ([Child, child, spec, individualCanceler], index) =>
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
              if (spec.restart === ChildRestartStrategy.PERMANENT) {
                return [Child, child, spec, individualCanceler];
              } else {
                supervised[index].id = null;
                return undefined;
              }
            }
            supervised[index].id = null;
            return undefined;
          } catch (e) {
            if (
              getMemoValue(upperCanceler) &&
              getMemoValue(individualCanceler)
            ) {
              if (
                spec.restart === ChildRestartStrategy.TRANSIENT ||
                spec.restart === ChildRestartStrategy.PERMANENT
              ) {
                return [Child, child, spec, individualCanceler];
              } else {
                supervised[index].id = null;
                return undefined;
              }
            }
            supervised[index].id = null;
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
      supervised: mutateArray(
        supervised,
        supervised.filter((child) => child.id !== null)
      ),
    };
  } else if (strategy === RestartStrategy.ONE_FOR_ONE) {
    upperCancelerPromise.then((_value: boolean) =>
      putMemoValue(canceler, false)
    );
    await Promise.all(
      children.map(([Child, child, spec, individualCanceler], index) => {
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
          combined,
          [supervised, index]
        );
      })
    );
    return { childSpecs: [], strategy, supervised: [] };
  } else {
    return { childSpecs: [], strategy, supervised: [] };
  }
}

export { supervise };
