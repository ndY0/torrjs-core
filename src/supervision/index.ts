import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./types";
import { GenServer } from "../interfaces/genserver";
import {
  memo,
  getMemoPromise,
  promisifyAsyncGenerator,
  loopWorker,
  putMemoValue,
} from "../utils";

async function* supervise(
  children: [typeof GenServer, GenServer, ChildSpec][],
  strategy: RestartStrategy,
  upperCancelerPromise: Promise<boolean>
): AsyncGenerator<
  any,
  {
    childSpecs: [typeof GenServer, GenServer, ChildSpec][];
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
    await Promise.race(mappedChildren).then(
      async () => await putMemoValue(canceler, false)
    );
    const result = await Promise.all(mappedChildren);
    return {
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
    upperCancelerPromise.then((_value: boolean) =>
      putMemoValue(canceler, false)
    );
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
    return { childSpecs: [], strategy };
  } else {
    return { childSpecs: [], strategy };
  }
}

export { supervise };
