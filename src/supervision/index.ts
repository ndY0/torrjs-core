import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./types";
import { GenServer } from "../interfaces/genserver";
import {
  memo,
  getMemoPromise,
  promisifyAsyncGenerator,
  loopWorker,
} from "../utils";

async function* supervise(
  children: [typeof GenServer, GenServer, ChildSpec][],
  strategy: RestartStrategy,
  upperCancelerPromise: Promise<boolean>
): AsyncGenerator<
  {
    childSpecs: [typeof GenServer, GenServer, ChildSpec][];
    strategy: RestartStrategy.ONE_FOR_ALL;
  },
  void,
  undefined
> {
  if (children.length === 0) {
    return undefined;
  }
  const canceler = memo(true);
  const cancelerPromise = getMemoPromise(canceler);
  if (strategy === RestartStrategy.ONE_FOR_ALL) {
    const mappedChildren = children.map(([Child, child, spec]) =>
      promisifyAsyncGenerator(
        child.start(
          spec.startArgs,
          Child,
          canceler,
          Promise.race([upperCancelerPromise, cancelerPromise])
        )
      )
        .then(() =>
          spec.restart === ChildRestartStrategy.PERMANENT
            ? [Child, child, spec]
            : undefined
        )
        .catch(() =>
          spec.restart === ChildRestartStrategy.TRANSIENT ||
          spec.restart === ChildRestartStrategy.PERMANENT
            ? [Child, child, spec]
            : undefined
        )
    );
    await Promise.race(mappedChildren)
      .then(() => canceler.next(false))
      .catch(() => canceler.next(false));
    const result = await Promise.all(mappedChildren);
    yield {
      childSpecs: result.filter((childState): childState is [
        typeof GenServer,
        GenServer,
        ChildSpec
      ] => {
        return childState instanceof Array;
      }),
      strategy,
    };
  } else if (strategy === RestartStrategy.ONE_FOR_ONE) {
    upperCancelerPromise.then((value: boolean) => canceler.next(value));
    await Promise.all(
      children.map(([Child, child, spec]) =>
        loopWorker(
          () =>
            promisifyAsyncGenerator(
              child.start(
                spec.startArgs,
                Child,
                canceler,
                Promise.race([upperCancelerPromise, cancelerPromise])
              )
            ),
          spec,
          canceler
        )
      )
    );
    return undefined;
  } else {
    return undefined;
  }
  return undefined;
}

export { supervise };
